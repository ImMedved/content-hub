import { spawn } from "node:child_process";
import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { Client } from "minio";

const RENDITIONS = [
  { label: "480p", shortSide: 480, bitrate: 1400, crf: 23 },
  { label: "720p", shortSide: 720, bitrate: 3000, crf: 23 },
  { label: "1080p", shortSide: 1080, bitrate: 5500, crf: 23 }
];

const CONTENT_TYPES = new Map([
  [".jpg", "image/jpeg"],
  [".m3u8", "application/vnd.apple.mpegurl"],
  [".mp4", "video/mp4"],
  [".m4s", "video/iso.segment"]
]);

function createMinio(config) {
  return new Client(config.minio);
}

function runProcess(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"],
      ...options
    });
    let stderr = "";

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stderr });
        return;
      }

      reject(new Error(`${command} exited with code ${code}: ${stderr}`));
    });
  });
}

async function probeVideo(inputPath) {
  const result = await new Promise((resolve, reject) => {
    const child = spawn("ffprobe", [
      "-v", "error",
      "-print_format", "json",
      "-show_format",
      "-show_streams",
      inputPath
    ]);
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`ffprobe exited with code ${code}: ${stderr}`));
        return;
      }

      resolve(JSON.parse(stdout));
    });
  });

  const video = result.streams?.find((stream) => stream.codec_type === "video");
  const audio = result.streams?.find((stream) => stream.codec_type === "audio");

  if (!video?.width || !video?.height) {
    throw new Error("No video stream found");
  }

  return {
    duration: Number(result.format?.duration || video.duration || 0),
    width: Number(video.width),
    height: Number(video.height),
    fps: parseFrameRate(video.avg_frame_rate || video.r_frame_rate),
    hasAudio: Boolean(audio)
  };
}

function parseFrameRate(value) {
  const [numerator, denominator] = String(value || "0/1").split("/").map(Number);

  if (!numerator || !denominator) {
    return 0;
  }

  return numerator / denominator;
}

function makeEven(value) {
  const rounded = Math.max(2, Math.round(value));
  return rounded % 2 === 0 ? rounded : rounded - 1;
}

function fitDimensions(width, height, targetShortSide) {
  const sourceShortSide = Math.min(width, height);
  const shortSide = Math.min(targetShortSide, sourceShortSide);
  const scale = shortSide / sourceShortSide;

  return {
    width: makeEven(width * scale),
    height: makeEven(height * scale)
  };
}

function planRenditions(probe) {
  const sourceShortSide = Math.min(probe.width, probe.height);

  return RENDITIONS
    .filter((rendition) => rendition.shortSide <= sourceShortSide)
    .map((rendition) => ({
      ...rendition,
      ...fitDimensions(probe.width, probe.height, rendition.shortSide)
    }));
}

async function downloadObject(minio, bucket, key, targetPath) {
  const stream = await minio.getObject(bucket, key);
  await pipeline(stream, fs.createWriteStream(targetPath));
}

async function generatePoster(inputPath, outputPath, duration) {
  const offset = Math.max(0, Math.min(1, duration * 0.1 || 0));

  await runProcess("ffmpeg", [
    "-nostdin",
    "-hide_banner",
    "-y",
    "-ss", String(offset),
    "-i", inputPath,
    "-frames:v", "1",
    "-vf", "scale=640:-2",
    "-q:v", "3",
    outputPath
  ]);
}

async function transcodeRendition(inputPath, outputDir, rendition, probe) {
  await fsp.mkdir(outputDir, { recursive: true });

  const fpsArgs = probe.fps > 30 ? ["-r", "30"] : [];
  const threadCount = Math.max(1, Number(process.env.FFMPEG_THREADS || 2));

  await runProcess("ffmpeg", [
    "-nostdin",
    "-hide_banner",
    "-y",
    "-i", inputPath,
    "-map", "0:v:0",
    ...(probe.hasAudio ? ["-map", "0:a:0"] : ["-an"]),
    "-vf", `scale=${rendition.width}:${rendition.height}:flags=lanczos`,
    ...fpsArgs,
    "-c:v", "libx264",
    "-preset", "veryfast",
    "-threads", String(threadCount),
    "-profile:v", "high",
    "-level:v", "4.1",
    "-pix_fmt", "yuv420p",
    "-crf", String(rendition.crf),
    "-maxrate", `${rendition.bitrate}k`,
    "-bufsize", `${rendition.bitrate * 2}k`,
    "-g", "120",
    "-keyint_min", "120",
    "-sc_threshold", "0",
    "-force_key_frames", "expr:gte(t,n_forced*4)",
    ...(probe.hasAudio ? ["-c:a", "aac", "-b:a", "128k", "-ar", "48000", "-ac", "2"] : []),
    "-hls_time", "4",
    "-hls_playlist_type", "vod",
    "-hls_segment_type", "fmp4",
    "-hls_flags", "independent_segments+temp_file",
    "-hls_fmp4_init_filename", "init.mp4",
    "-hls_segment_filename", path.join(outputDir, "segment_%06d.m4s"),
    path.join(outputDir, "index.m3u8")
  ]);
}

async function writeMaster(outputRoot, renditions) {
  const lines = ["#EXTM3U", "#EXT-X-VERSION:7", "#EXT-X-INDEPENDENT-SEGMENTS"];

  for (const rendition of renditions) {
    const bandwidth = rendition.bitrate * 1000;
    lines.push(
      `#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth},RESOLUTION=${rendition.width}x${rendition.height},CODECS="avc1.640029,mp4a.40.2"`,
      `video/${rendition.label}/r1/index.m3u8`
    );
  }

  const masterDir = path.join(outputRoot, "master");
  await fsp.mkdir(masterDir, { recursive: true });
  await fsp.writeFile(path.join(masterDir, "revision_1.m3u8"), `${lines.join("\n")}\n`);
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
}

export async function transcodeVideoToHls(config, request) {
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
  const workDir = await fsp.mkdtemp(path.join(workRoot, "hls-"));
  const inputPath = path.join(workDir, "source");
  const outputRoot = path.join(workDir, "output");
  const hlsPrefix = String(request.destinationPrefix || `media/${mediaId}`).replace(/\/+$/g, "");

  try {
    await downloadObject(minio, bucket, sourceKey, inputPath);
    const probe = await probeVideo(inputPath);
    const renditions = planRenditions(probe);

    if (renditions.length === 0) {
      throw new Error("No rendition can be produced for this source");
    }

    await generatePoster(inputPath, path.join(outputRoot, "poster.jpg"), probe.duration);

    for (const rendition of renditions) {
      await transcodeRendition(
        inputPath,
        path.join(outputRoot, "video", rendition.label, "r1"),
        rendition,
        probe
      );
    }

    await writeMaster(outputRoot, renditions);
    await uploadDirectory(minio, bucket, outputRoot, hlsPrefix);

    return {
      hlsPrefix,
      masterKey: `${hlsPrefix}/master/revision_1.m3u8`,
      posterKey: `${hlsPrefix}/poster.jpg`,
      probe,
      renditions
    };
  } finally {
    await fsp.rm(workDir, { recursive: true, force: true });
  }
}
