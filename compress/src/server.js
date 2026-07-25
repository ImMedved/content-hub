import express from "express";
import { loadConfig } from "./config.js";
import { compressSingleObject } from "./index.js";
import { transcodeVideoToHls } from "./video-hls.js";

const app = express();
const port = Number(process.env.PORT || 8092);

app.use(express.json({ limit: "1mb" }));

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.post("/compress", async (req, res) => {
  try {
    const sourceKey = String(req.body?.sourceKey || "");

    if (!sourceKey) {
      res.status(400).json({ error: "sourceKey is required" });
      return;
    }

    const baseConfig = loadConfig({
      ...process.env,
      MINIO_BUCKET: req.body?.bucket || process.env.MINIO_BUCKET,
      SOURCE_PREFIX: "",
      DESTINATION_PREFIX: ""
    });
    const compressedKey = await compressSingleObject(
      baseConfig,
      sourceKey,
      req.body?.destinationKey || null
    );

    res.json({ compressedKey });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/video/hls", async (req, res) => {
  try {
    const baseConfig = loadConfig({
      ...process.env,
      MINIO_BUCKET: req.body?.bucket || process.env.MINIO_BUCKET,
      SOURCE_PREFIX: "",
      DESTINATION_PREFIX: ""
    });
    const result = await transcodeVideoToHls(baseConfig, req.body || {});

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Media compressor listening on ${port}`);
});
