package com.smartgallery.thumbnail;

import io.minio.GetObjectArgs;
import io.minio.MinioClient;
import io.minio.PutObjectArgs;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import javax.imageio.ImageIO;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;

@Service
public class ThumbnailService {

    public static final int DEFAULT_THUMBNAIL_SIZE = 128;
    private final MinioClient minioClient;

    public ThumbnailService() {
        String endpoint = env("MINIO_ENDPOINT", "localhost");
        String port = env("MINIO_PORT", "9000");
        String protocol = Boolean.parseBoolean(env("MINIO_USE_SSL", "false")) ? "https" : "http";
        this.minioClient = MinioClient.builder()
                .endpoint(protocol + "://" + endpoint + ":" + port)
                .credentials(env("MINIO_ACCESS_KEY", "contenthub"), env("MINIO_SECRET_KEY", "contenthub-password"))
                .build();
    }

    public byte[] generate(byte[] originalContent) {
        return generate(originalContent, DEFAULT_THUMBNAIL_SIZE);
    }

    public byte[] generate(byte[] originalContent, int thumbnailSize) {
        if (thumbnailSize < 16 || thumbnailSize > 2048) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "thumbnail size must be between 16 and 2048");
        }

        try {
            BufferedImage source = ImageIO.read(new ByteArrayInputStream(originalContent));
            if (source == null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unsupported image format");
            }

            int width = source.getWidth();
            int height = source.getHeight();
            double scale = Math.max((double) thumbnailSize / width, (double) thumbnailSize / height);
            int scaledWidth = Math.max(thumbnailSize, (int) Math.round(width * scale));
            int scaledHeight = Math.max(thumbnailSize, (int) Math.round(height * scale));

            BufferedImage result = new BufferedImage(thumbnailSize, thumbnailSize, BufferedImage.TYPE_INT_RGB);
            Graphics2D graphics = result.createGraphics();
            try {
                graphics.setColor(Color.WHITE);
                graphics.fillRect(0, 0, thumbnailSize, thumbnailSize);
                graphics.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
                graphics.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);

                int x = (thumbnailSize - scaledWidth) / 2;
                int y = (thumbnailSize - scaledHeight) / 2;
                graphics.drawImage(source, x, y, scaledWidth, scaledHeight, null);
            } finally {
                graphics.dispose();
            }

            ByteArrayOutputStream output = new ByteArrayOutputStream();
            ImageIO.write(result, "jpg", output);
            return output.toByteArray();
        } catch (IOException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unable to build thumbnail", exception);
        }
    }

    public byte[] generateFit(byte[] originalContent, int maxSize) {
        if (maxSize < 64 || maxSize > 4096) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "max size must be between 64 and 4096");
        }

        try {
            BufferedImage source = ImageIO.read(new ByteArrayInputStream(originalContent));
            if (source == null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unsupported image format");
            }

            int width = source.getWidth();
            int height = source.getHeight();
            double scale = Math.min(1.0, (double) maxSize / Math.max(width, height));
            int targetWidth = Math.max(1, (int) Math.round(width * scale));
            int targetHeight = Math.max(1, (int) Math.round(height * scale));

            BufferedImage result = new BufferedImage(targetWidth, targetHeight, BufferedImage.TYPE_INT_RGB);
            Graphics2D graphics = result.createGraphics();
            try {
                graphics.setColor(Color.WHITE);
                graphics.fillRect(0, 0, targetWidth, targetHeight);
                graphics.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
                graphics.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
                graphics.drawImage(source, 0, 0, targetWidth, targetHeight, null);
            } finally {
                graphics.dispose();
            }

            ByteArrayOutputStream output = new ByteArrayOutputStream();
            ImageIO.write(result, "jpg", output);
            return output.toByteArray();
        } catch (IOException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unable to build feed thumbnail", exception);
        }
    }

    public String generateFromMinio(String bucket, String sourceKey, String destinationKey, int thumbnailSize, String mode) throws Exception {
        if (bucket == null || bucket.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "bucket is required");
        }

        if (sourceKey == null || sourceKey.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "sourceKey is required");
        }

        String targetKey = destinationKey == null || destinationKey.isBlank()
                ? sourceKey.replaceFirst("^originals/", "thumbnails/").replaceFirst("\\.[^.]+$", "-" + thumbnailSize + ".jpg")
                : destinationKey;

        try (InputStream source = minioClient.getObject(
                GetObjectArgs.builder()
                        .bucket(bucket)
                        .object(sourceKey)
                        .build()
        )) {
            byte[] sourceBytes = source.readAllBytes();
            byte[] thumbnail = "fit".equalsIgnoreCase(mode)
                    ? generateFit(sourceBytes, thumbnailSize)
                    : generate(sourceBytes, thumbnailSize);
            minioClient.putObject(
                    PutObjectArgs.builder()
                            .bucket(bucket)
                            .object(targetKey)
                            .stream(new ByteArrayInputStream(thumbnail), thumbnail.length, -1)
                            .contentType(MediaType.IMAGE_JPEG_VALUE)
                            .build()
            );
        }

        return targetKey;
    }

    private static String env(String name, String fallback) {
        String value = System.getenv(name);
        return value == null || value.isBlank() ? fallback : value;
    }
}
