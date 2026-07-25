package com.smartgallery.thumbnail;

import org.junit.jupiter.api.Test;

import javax.imageio.ImageIO;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;

import static org.junit.jupiter.api.Assertions.assertEquals;

class ThumbnailServiceTest {

    private final ThumbnailService thumbnailService = new ThumbnailService();

    @Test
    void shouldGenerateExact128x128Thumbnail() throws IOException {
        BufferedImage image = new BufferedImage(640, 320, BufferedImage.TYPE_INT_RGB);
        Graphics2D graphics = image.createGraphics();
        graphics.setColor(Color.BLUE);
        graphics.fillRect(0, 0, 640, 320);
        graphics.dispose();

        ByteArrayOutputStream original = new ByteArrayOutputStream();
        ImageIO.write(image, "png", original);

        byte[] thumbnailBytes = thumbnailService.generate(original.toByteArray());
        BufferedImage thumbnail = ImageIO.read(new ByteArrayInputStream(thumbnailBytes));

        assertEquals(128, thumbnail.getWidth());
        assertEquals(128, thumbnail.getHeight());
    }

    @Test
    void shouldGenerateCustomSizeThumbnail() throws IOException {
        BufferedImage image = new BufferedImage(320, 640, BufferedImage.TYPE_INT_RGB);
        ByteArrayOutputStream original = new ByteArrayOutputStream();
        ImageIO.write(image, "png", original);

        byte[] thumbnailBytes = thumbnailService.generate(original.toByteArray(), 256);
        BufferedImage thumbnail = ImageIO.read(new ByteArrayInputStream(thumbnailBytes));

        assertEquals(256, thumbnail.getWidth());
        assertEquals(256, thumbnail.getHeight());
    }
}
