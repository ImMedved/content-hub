package com.smartgallery.thumbnail;

import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.TimeUnit;

@RestController
public class ThumbnailController {

    private final ThumbnailService thumbnailService;

    public ThumbnailController(ThumbnailService thumbnailService) {
        this.thumbnailService = thumbnailService;
    }

    @PostMapping(value = "/thumbnail", consumes = MediaType.MULTIPART_FORM_DATA_VALUE, produces = MediaType.IMAGE_JPEG_VALUE)
    public ResponseEntity<byte[]> thumbnail(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "size", defaultValue = "128") int size
    ) throws IOException {
        byte[] thumbnail = thumbnailService.generate(file.getBytes(), size);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=thumbnail.jpg")
                .cacheControl(CacheControl.maxAge(1, TimeUnit.HOURS).cachePublic())
                .contentType(MediaType.IMAGE_JPEG)
                .contentLength(thumbnail.length)
                .body(thumbnail);
    }

    @PostMapping(value = "/thumbnail/minio", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public Map<String, String> thumbnailFromMinio(@RequestBody MinioThumbnailRequest request) throws Exception {
        String thumbnailKey = thumbnailService.generateFromMinio(
                request.bucket(),
                request.sourceKey(),
                request.destinationKey(),
                request.size() == null ? 256 : request.size(),
                request.mode() == null ? "square" : request.mode()
        );

        return Map.of("thumbnailKey", thumbnailKey);
    }

    public record MinioThumbnailRequest(
            String bucket,
            String sourceKey,
            String destinationKey,
            Integer size,
            String mode
    ) {
    }
}
