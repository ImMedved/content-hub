# Smart Gallery Thumbnail Service

Standalone thumbnail generation service extracted from SmartGalleryServer.

## What it does

- Accepts an uploaded image via `POST /thumbnail`.
- Center-crops and scales it to a square JPEG thumbnail.
- Default size is `128x128`, matching the original SmartGalleryServer behavior.
- Optional `size` request parameter supports `16..2048` pixels.

No storage, database, generated media, reports, datasets, or gallery files are included.

## Run locally

```powershell
mvn test
mvn spring-boot:run
```

Service URL:

```text
http://127.0.0.1:8080
```

Generate a thumbnail:

```powershell
curl.exe -F "file=@C:\path\to\image.jpg" http://127.0.0.1:8080/thumbnail --output thumbnail.jpg
```

Custom size:

```powershell
curl.exe -F "file=@C:\path\to\image.jpg" -F "size=256" http://127.0.0.1:8080/thumbnail --output thumbnail-256.jpg
```

## Run with Docker Compose

```powershell
docker compose build thumbnail
docker compose up -d thumbnail
```

Docker URL:

```text
http://127.0.0.1:8091
```

```powershell
curl.exe -F "file=@C:\path\to\image.jpg" http://127.0.0.1:8091/thumbnail --output thumbnail.jpg
```
