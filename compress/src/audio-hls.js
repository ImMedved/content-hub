import { spawn } from "node:child_process";
import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { Client } from "minio";

const AUDIO_RENDITIONS = [
  { label: "64k", bitrate: 64, averageBandwidth: 66000 },
  { label: "128k", bitrate: 128, averageBandwidth: 130000 },
  { label: "256k", bitrate: 256, averageBandwidth: 260000 }
];

const SPEECH_RENDITIONS = [
  { label: "speech", bitrate: 64, averageBandwidth: 66000, channels: 1 }
];

const CONTENT_TYPES = new Map([
  [".json", "application/json"],
  [".m3u8", "application/vnd.apple.mpegurl"],
  [".mp4", "audio/mp4"],
  [".m4s", "video/iso.segment"]
]);

function createMinio(config) {
  return new Client(config.minio);
}

function runProcess(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const captureBuffer = Boolean(options.captureBuffer);
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"],
      ...Object.fromEntries(Object.entries(options).filter(([key]) => key !== "captureBuffer"))
    });
    let stdout = captureBuffer ? [] : "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      if (captureBuffer) {
        stdout.push(chunk);
      } else {
        stdout += chunk.toString();
      }
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout: captureBuffer ? Buffer.concat(stdout) : stdout, stderr });
        return;
      }

      reject(new Error(`${command} exited with code ${code}: ${stderr}`));
    });
  });
}

async function probeAudio(inputPath) {
  const { stdout } = await runProcess("ffprobe", [
    "-v", "error",
    "-print_format", "json",
    "-show_format",
    "-show_streams",
    inputPath
  ]);
  const result = JSON.parse(stdout);
  const audio = result.streams?.find((stream) => stream.codec_type === "audio");

  if (!audio) {
    throw new Error("No audio stream found");
  }

  return {
    duration: Number(result.format?.duration || audio.duration || 0),
    codec: audio.codec_name || null,
    sampleRate: Number(audio.sample_rate || 0),
    channels: Number(audio.channels || 0),
    channelLayout: audio.channel_layout || null,
    bitRate: Number(audio.bit_rate || result.format?.bit_rate || 0),
    tags: result.format?.tags || {}
  };
}

function planAudioRenditions(probe) {
  if (Number(probe.channels || 0) <= 1) {
    return SPEECH_RENDITIONS.map((rendition) => ({
      ...rendition,
      sampleRate: 48000,
      codec: "mp4a.40.2",
      channelLayout: "mono"
    }));
  }

  return AUDIO_RENDITIONS.map((rendition) => ({
    ...rendition,
    channels: 2,
    sampleRate: 48000,
    codec: "mp4a.40.2",
    channelLayout: "stereo"
  }));
}

async function downloadObject(minio, bucket, key, targetPath) {
  console.log(`[audio-hls] download start bucket=${bucket} key=${key}`);
  const stream = await minio.getObject(bucket, key);
  await pipeline(stream, fs.createWriteStream(targetPath));
  const stat = await fsp.stat(targetPath);
  console.log(`[audio-hls] download done bucket=${bucket} key=${key} bytes=${stat.size}`);
}

async function transcodeRendition(inputPath, outputDir, rendition) {
  await fsp.mkdir(outputDir, { recursive: true });

  console.log(`[audio-hls] rendition start label=${rendition.label} bitrate=${rendition.bitrate}k sampleRate=${rendition.sampleRate} channels=${rendition.channels} output=${outputDir}`);
  await runProcess("ffmpeg", [
    "-nostdin",
    "-hide_banner",
    "-y",
    "-i", inputPath,
    "-map", "0:a:0",
    "-vn",
    "-c:a", "aac",
    "-profile:a", "aac_low",
    "-b:a", `${rendition.bitrate}k`,
    "-ar", String(rendition.sampleRate),
    "-ac", String(rendition.channels),
    "-hls_time", "6",
    "-hls_playlist_type", "vod",
    "-hls_segment_type", "fmp4",
    "-hls_flags", "independent_segments+temp_file",
    "-hls_fmp4_init_filename", "init.mp4",
    "-hls_segment_filename", path.join(outputDir, "segment_%06d.m4s"),
    path.join(outputDir, "index.m3u8")
  ]);
  console.log(`[audio-hls] rendition done label=${rendition.label} output=${outputDir}`);
}

async function generateWaveform(inputPath, outputPath, duration) {
  console.log(`[audio-hls] waveform start output=${outputPath}`);
  const { stdout } = await runProcess("ffmpeg", [
    "-nostdin",
    "-v", "error",
    "-i", inputPath,
    "-map", "0:a:0",
    "-ac", "1",
    "-ar", "8000",
    "-f", "s16le",
    "pipe:1"
  ], {
    captureBuffer: true
  });

  const buffer = stdout;
  const sampleCount = Math.floor(buffer.length / 2);
  const targetPoints = 1000;
  const samplesPerPoint = Math.max(1, Math.floor(sampleCount / targetPoints));
  const samples = [];

  for (let start = 0; start < sampleCount; start += samplesPerPoint) {
    const end = Math.min(sampleCount, start + samplesPerPoint);
    let sumSquares = 0;

    for (let index = start; index < end; index += 1) {
      const sample = buffer.readInt16LE(index * 2);
      sumSquares += sample * sample;
    }

    const rms = Math.sqrt(sumSquares / Math.max(1, end - start)) / 32767;
    samples.push(Number(Math.min(1, rms).toFixed(4)));
  }

  await fsp.writeFile(outputPath, JSON.stringify({
    samples,
    durationMs: Math.round(Number(duration || 0) * 1000)
  }));
  console.log(`[audio-hls] waveform done output=${outputPath} points=${samples.length}`);
}

async function writeMaster(outputRoot, renditions) {
  const lines = ["#EXTM3U", "#EXT-X-VERSION:7", "#EXT-X-INDEPENDENT-SEGMENTS"];

  for (const rendition of renditions) {
    const bandwidth = Math.round(rendition.averageBandwidth * 1.1);
    lines.push(
      `#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth},AVERAGE-BANDWIDTH=${rendition.averageBandwidth},CODECS="${rendition.codec}"`,
      `../audio/${rendition.label}/r1/index.m3u8`
    );
  }

  const masterDir = path.join(outputRoot, "master");
  await fsp.mkdir(masterDir, { recursive: true });
  await fsp.writeFile(path.join(masterDir, "revision_1.m3u8"), `${lines.join("\n")}\n`);
  console.log(`[audio-hls] master written renditions=${renditions.map((rendition) => rendition.label).join(",")} path=${path.join(masterDir, "revision_1.m3u8")}`);
}

async function walkFiles(rootDir) {
  const entries = await fsp.readdir(rootDir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(rootDir, entry.name);

    if (entry.isDirectory()) {
      files.push(...await walkFiles(fullPath));
    } else {
      files.push(fullPath);
    }
  }

  return files;
}

async function uploadDirectory(minio, bucket, sourceDir, destinationPrefix) {
  const files = await walkFiles(sourceDir);
  console.log(`[audio-hls] upload start bucket=${bucket} prefix=${destinationPrefix} files=${files.length}`);

  for (const filePath of files) {
    const relativePath = path.relative(sourceDir, filePath).replace(/\\/g, "/");
    const destinationKey = `${destinationPrefix}/${relativePath}`;
    const extension = path.extname(filePath).toLowerCase();
    const stat = await fsp.stat(filePath);

    await minio.putObject(
      bucket,
      destinationKey,
      fs.createReadStream(filePath),
      stat.size,
      { "Content-Type": CONTENT_TYPES.get(extension) || "application/octet-stream" }
    );
  }

  console.log(`[audio-hls] upload done bucket=${bucket} prefix=${destinationPrefix} files=${files.length}`);
}

export async function transcodeAudioToHls(config, request) {
  const sourceKey = String(request.sourceKey || "");
  const mediaId = String(request.mediaId || "");

  if (!sourceKey) {
    throw new Error("sourceKey is required");
  }

  if (!mediaId) {
    throw new Error("mediaId is required");
  }

  const minio = createMinio(config);
  const bucket = request.bucket || config.bucket;
  const workRoot = process.env.MEDIA_WORK_DIR || os.tmpdir();
  await fsp.mkdir(workRoot, { recursive: true });
  const workDir = await fsp.mkdtemp(path.join(workRoot, "audio-hls-"));
  const inputPath = path.join(workDir, "source");
  const outputRoot = path.join(workDir, "output");
  const hlsPrefix = String(request.destinationPrefix || `media/${mediaId}`).replace(/\/+$/g, "");

  try {
    await downloadObject(minio, bucket, sourceKey, inputPath);
    const probe = await probeAudio(inputPath);
    console.log(`[audio-hls] probe done mediaId=${mediaId} duration=${probe.duration.toFixed(3)} codec=${probe.codec || "unknown"} sampleRate=${probe.sampleRate || "unknown"} channels=${probe.channels || "unknown"}`);
    const renditions = planAudioRenditions(probe);
    console.log(`[audio-hls] plan done mediaId=${mediaId} renditions=${renditions.map((rendition) => `${rendition.label}:${rendition.bitrate}k`).join(",")}`);

    await fsp.mkdir(outputRoot, { recursive: true });
    await generateWaveform(inputPath, path.join(outputRoot, "waveform.json"), probe.duration);

    for (const rendition of renditions) {
      await transcodeRendition(
        inputPath,
        path.join(outputRoot, "audio", rendition.label, "r1"),
        rendition
      );
    }

    await writeMaster(outputRoot, renditions);
    await uploadDirectory(minio, bucket, outputRoot, hlsPrefix);

    return {
      hlsPrefix,
      masterKey: `${hlsPrefix}/master/revision_1.m3u8`,
      waveformKey: `${hlsPrefix}/waveform.json`,
      probe,
      renditions
    };
  } finally {
    await fsp.rm(workDir, { recursive: true, force: true });
    console.log(`[audio-hls] cleanup done mediaId=${mediaId} workDir=${workDir}`);
  }
}
