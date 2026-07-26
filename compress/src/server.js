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
  const sourceKey = String(req.body?.sourceKey || "");
  const startedAt = Date.now();

  try {
    if (!sourceKey) {
      res.status(400).json({ error: "sourceKey is required" });
      return;
    }

    console.log(`[image-compress] start sourceKey=${sourceKey} destinationKey=${req.body?.destinationKey || "auto"}`);
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

    console.log(`[image-compress] done sourceKey=${sourceKey} compressedKey=${compressedKey} status=ok durationMs=${Date.now() - startedAt}`);
    res.json({ compressedKey });
  } catch (error) {
    console.error(`[image-compress] failed sourceKey=${sourceKey || "missing"} status=failed durationMs=${Date.now() - startedAt} error=${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

app.post("/video/hls", async (req, res) => {
  const mediaId = String(req.body?.mediaId || "");
  const sourceKey = String(req.body?.sourceKey || "");
  const startedAt = Date.now();

  try {
    console.log(`[video-hls] request start mediaId=${mediaId || "missing"} sourceKey=${sourceKey || "missing"} destinationPrefix=${req.body?.destinationPrefix || "auto"}`);
    const baseConfig = loadConfig({
      ...process.env,
      MINIO_BUCKET: req.body?.bucket || process.env.MINIO_BUCKET,
      SOURCE_PREFIX: "",
      DESTINATION_PREFIX: ""
    });
    const result = await transcodeVideoToHls(baseConfig, req.body || {});

    console.log(`[video-hls] request done mediaId=${mediaId} sourceKey=${sourceKey} status=ok durationMs=${Date.now() - startedAt} masterKey=${result.masterKey}`);
    res.json(result);
  } catch (error) {
    console.error(`[video-hls] request failed mediaId=${mediaId || "missing"} sourceKey=${sourceKey || "missing"} status=failed durationMs=${Date.now() - startedAt} error=${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Media compressor listening on ${port}`);
});
