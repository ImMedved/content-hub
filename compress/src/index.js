import { Client } from "minio";
import sharp from "sharp";
import { loadConfig } from "./config.js";

const IMAGE_EXTENSIONS = new Set([
  ".avif",
  ".bmp",
  ".gif",
  ".jpeg",
  ".jpg",
  ".png",
  ".tif",
  ".tiff",
  ".webp"
]);

export async function compressImages(config = loadConfig()) {
  const minio = new Client(config.minio);
  let processed = 0;
  let skipped = 0;
  let failed = 0;

  for await (const object of listObjects(minio, config.bucket, config.sourcePrefix)) {
    if (config.limit && processed + skipped + failed >= config.limit) {
      break;
    }

    if (!isSupportedImage(object.name)) {
      skipped += 1;
      continue;
    }

    const destinationName = buildDestinationName(
      object.name,
      config.sourcePrefix,
      config.destinationPrefix
    );

    if (!config.overwrite && await objectExists(minio, config.bucket, destinationName)) {
      skipped += 1;
      continue;
    }

    try {
      await compressObject(minio, config, object.name, destinationName);
      processed += 1;
      console.log(`Compressed ${object.name} -> ${destinationName}`);
    } catch (error) {
      failed += 1;
      console.error(`Failed to compress ${object.name}:`, error);
    }
  }

  return { processed, skipped, failed };
}

export async function compressObject(minio, config, sourceName, destinationName) {
  const sourceStream = await minio.getObject(config.bucket, sourceName);
  const transformer = sharp()
    .rotate()
    .webp({
      quality: config.quality,
      effort: config.effort
    });

  const webpStream = sourceStream.pipe(transformer);

  await minio.putObject(
    config.bucket,
    destinationName,
    webpStream,
    undefined,
    {
      "Content-Type": "image/webp",
      "x-amz-meta-source-object": sourceName
    }
  );
}

export async function compressSingleObject(config, sourceKey, destinationKey) {
  const minio = new Client(config.minio);
  const targetKey = destinationKey || buildDestinationName(
    sourceKey,
    config.sourcePrefix,
    config.destinationPrefix
  );

  await compressObject(minio, config, sourceKey, targetKey);

  return targetKey;
}

function listObjects(minio, bucket, prefix) {
  return minio.listObjectsV2(bucket, prefix, true);
}

function isSupportedImage(objectName) {
  const lowerName = objectName.toLowerCase();
  return [...IMAGE_EXTENSIONS].some((extension) => lowerName.endsWith(extension));
}

function buildDestinationName(sourceName, sourcePrefix, destinationPrefix) {
  const withoutSourcePrefix = sourcePrefix && sourceName.startsWith(`${sourcePrefix}/`)
    ? sourceName.slice(sourcePrefix.length + 1)
    : sourceName;

  const webpName = withoutSourcePrefix.replace(/\.[^.]+$/, ".webp");
  return destinationPrefix ? `${destinationPrefix}/${webpName}` : webpName;
}

async function objectExists(minio, bucket, objectName) {
  try {
    await minio.statObject(bucket, objectName);
    return true;
  } catch (error) {
    if (error?.code === "NotFound" || error?.code === "NoSuchKey") {
      return false;
    }

    throw error;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  compressImages()
    .then((result) => {
      console.log("Done:", result);
      if (result.failed > 0) {
        process.exitCode = 1;
      }
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
