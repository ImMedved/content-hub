# Image Compressor

Standalone JS module that reads images from MinIO, converts them to WebP, and writes the results back to the same MinIO bucket.

## Install

```bash
npm install
```

## Configuration

Environment variables:

| Name | Required | Description |
| --- | --- | --- |
| `MINIO_ENDPOINT` | yes | MinIO host, for example `localhost` |
| `MINIO_PORT` | no | MinIO port, for example `9000` |
| `MINIO_USE_SSL` | no | `true` or `false`, default `false` |
| `MINIO_ACCESS_KEY` | yes | MinIO access key |
| `MINIO_SECRET_KEY` | yes | MinIO secret key |
| `MINIO_BUCKET` | yes | Bucket to read from and write to |
| `SOURCE_PREFIX` | no | Prefix to scan inside the bucket |
| `DESTINATION_PREFIX` | no | Prefix for generated WebP files |
| `OVERWRITE` | no | Replace existing destination objects when `true`, default `false` |
| `WEBP_QUALITY` | no | WebP quality from `1` to `100`, default `82` |
| `WEBP_EFFORT` | no | WebP CPU effort from `0` to `6`, default `4` |
| `LIMIT` | no | Maximum number of objects to inspect during one run |

## Run

```bash
npm start
```

Example:

```bash
MINIO_ENDPOINT=localhost \
MINIO_PORT=9000 \
MINIO_ACCESS_KEY=minioadmin \
MINIO_SECRET_KEY=minioadmin \
MINIO_BUCKET=media \
SOURCE_PREFIX=uploads \
DESTINATION_PREFIX=compressed \
npm start
```

## Docker

Build:

```bash
docker build -t content-hub-compress .
```

Run:

```bash
docker run --rm \
  -e MINIO_ENDPOINT=host.docker.internal \
  -e MINIO_PORT=9000 \
  -e MINIO_ACCESS_KEY=minioadmin \
  -e MINIO_SECRET_KEY=minioadmin \
  -e MINIO_BUCKET=media \
  -e SOURCE_PREFIX=uploads \
  -e DESTINATION_PREFIX=compressed \
  content-hub-compress
```

## Programmatic usage

```js
import { compressImages } from "./src/index.js";

const result = await compressImages({
  minio: {
    endPoint: "localhost",
    port: 9000,
    useSSL: false,
    accessKey: "minioadmin",
    secretKey: "minioadmin"
  },
  bucket: "media",
  sourcePrefix: "uploads",
  destinationPrefix: "compressed",
  overwrite: false,
  quality: 82,
  effort: 4
});

console.log(result);
```
