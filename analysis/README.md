# Smart Gallery Analysis Service

Standalone image analysis/OCR service extracted from SmartGalleryServer.

## What is included

- FastAPI service entrypoint: `app.py`
- Analysis package: `analysis_service/`
- Docker build files: `Dockerfile`, `.dockerignore`, `docker-compose.yml`
- Runtime dependency manifests: `requirements.txt`, `requirements-ml.txt`
- Basic tests: `tests/`
- Evaluation harness without bundled datasets: `analysis-evaluation/evaluate.py`

Generated reports, raw benchmark results, training/evaluation datasets, and gallery samples are intentionally not included.

## Run with Docker Compose

```powershell
docker compose build analysis
docker compose up -d analysis
```

Service URL:

```text
http://127.0.0.1:8090
```

Health checks:

```powershell
Invoke-RestMethod http://127.0.0.1:8090/health/live
Invoke-RestMethod http://127.0.0.1:8090/health/ready
```

Analyze one image:

```powershell
curl.exe -F "file=@C:\path\to\image.jpg" -F "topTags=10" -F "includeDebug=true" http://127.0.0.1:8090/analyze
```

## Model cache

The compose file stores models in the `analysis_model_cache` Docker volume mounted at `/models`.
By default `ANALYSIS_ALLOW_MODEL_DOWNLOAD=false`, so prepare/download model artifacts explicitly or run once with:

```powershell
$env:ANALYSIS_ALLOW_MODEL_DOWNLOAD='true'
docker compose up -d analysis
```

## Evaluation datasets

Put your own datasets here when ready:

```text
analysis-evaluation/
  images/
  expected/
  reports/
  results/
```

Then run:

```powershell
python analysis-evaluation/evaluate.py --base-url http://127.0.0.1:8090 --images-dir analysis-evaluation/images --expected-dir analysis-evaluation/expected
```

Expected labels can be adapted to the existing evaluator format or extended for the richer JSON labels you plan to add.

## Useful environment variables

- `OCR_ENGINE=easyocr|paddle|auto|both`
- `OCR_LANGUAGES=ru,en`
- `OCR_POLICY=auto|always|skip`
- `ANALYSIS_MODE=fast|quality|best`
- `ANALYSIS_FAST_TIMEOUT_SECONDS=90`
- `ENABLE_YOLO=true|false`
- `ENABLE_CLIP=true|false`
- `ENABLE_VLM=false`
