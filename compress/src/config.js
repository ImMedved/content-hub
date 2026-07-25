export function loadConfig(env = process.env) {
  const required = [
    "MINIO_ENDPOINT",
    "MINIO_ACCESS_KEY",
    "MINIO_SECRET_KEY",
    "MINIO_BUCKET"
  ];

  const missing = required.filter((name) => !env[name]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }

  return {
    minio: {
      endPoint: env.MINIO_ENDPOINT,
      port: env.MINIO_PORT ? Number(env.MINIO_PORT) : undefined,
      useSSL: parseBoolean(env.MINIO_USE_SSL, false),
      accessKey: env.MINIO_ACCESS_KEY,
      secretKey: env.MINIO_SECRET_KEY
    },
    bucket: env.MINIO_BUCKET,
    sourcePrefix: normalizePrefix(env.SOURCE_PREFIX ?? ""),
    destinationPrefix: normalizePrefix(env.DESTINATION_PREFIX ?? ""),
    overwrite: parseBoolean(env.OVERWRITE, false),
    quality: parseInteger(env.WEBP_QUALITY, 82, 1, 100),
    effort: parseInteger(env.WEBP_EFFORT, 4, 0, 6),
    limit: env.LIMIT ? parseInteger(env.LIMIT, 0, 1, Number.MAX_SAFE_INTEGER) : undefined
  };
}

function parseBoolean(value, fallback) {
  if (value === undefined || value === "") {
    return fallback;
  }

  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

function parseInteger(value, fallback, min, max) {
  const parsed = Number.parseInt(value ?? String(fallback), 10);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`Expected integer from ${min} to ${max}, received: ${value}`);
  }

  return parsed;
}

function normalizePrefix(prefix) {
  return prefix.replace(/^\/+/, "").replace(/\/+$/, "");
}
