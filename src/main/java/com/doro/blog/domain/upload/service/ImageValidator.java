package com.doro.blog.domain.upload.service;

import com.doro.blog.common.exception.BlogException;
import com.doro.blog.common.exception.ErrorCode;

import java.io.IOException;
import java.io.InputStream;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * 업로드 이미지 검증. 클라이언트가 보낸 확장자/Content-Type 은 믿지 않고 파일의 첫 바이트(매직 넘버)로 형식을 판별한다.
 * SVG 는 스크립트를 담을 수 있고 같은 출처에서 서빙되므로 허용하지 않는다.
 */
public final class ImageValidator {

    /** 판별된 형식: 서버가 저장할 때 쓰는 Content-Type 과 확장자. */
    public record DetectedImage(String contentType, String extension) {
    }

    private static final Map<String, Set<String>> EXTENSIONS_BY_TYPE = Map.of(
            "image/jpeg", Set.of("jpg", "jpeg"),
            "image/png", Set.of("png"),
            "image/gif", Set.of("gif"),
            "image/webp", Set.of("webp")
    );

    private static final int HEADER_BYTES = 12;

    private ImageValidator() {
    }

    /** 첫 바이트로 형식을 판별하고, 선언된 확장자가 그 형식과 맞는지 확인한다. 맞지 않으면 INVALID_FILE_TYPE. */
    public static DetectedImage validate(InputStream stream, String filename) {
        String detected = detectContentType(readHeader(stream));
        if (detected == null) {
            throw new BlogException(ErrorCode.INVALID_FILE_TYPE);
        }
        String extension = extensionOf(filename);
        if (extension != null && !EXTENSIONS_BY_TYPE.get(detected).contains(extension)) {
            throw new BlogException(ErrorCode.INVALID_FILE_TYPE);
        }
        return new DetectedImage(detected, canonicalExtension(detected));
    }

    static String detectContentType(byte[] h) {
        if (h.length >= 3 && (h[0] & 0xFF) == 0xFF && (h[1] & 0xFF) == 0xD8 && (h[2] & 0xFF) == 0xFF) {
            return "image/jpeg";
        }
        if (h.length >= 8 && (h[0] & 0xFF) == 0x89 && h[1] == 'P' && h[2] == 'N' && h[3] == 'G'
                && h[4] == 0x0D && h[5] == 0x0A && h[6] == 0x1A && h[7] == 0x0A) {
            return "image/png";
        }
        if (h.length >= 6 && h[0] == 'G' && h[1] == 'I' && h[2] == 'F' && h[3] == '8' && (h[4] == '7' || h[4] == '9') && h[5] == 'a') {
            return "image/gif";
        }
        if (h.length >= 12 && h[0] == 'R' && h[1] == 'I' && h[2] == 'F' && h[3] == 'F'
                && h[8] == 'W' && h[9] == 'E' && h[10] == 'B' && h[11] == 'P') {
            return "image/webp";
        }
        return null;
    }

    private static byte[] readHeader(InputStream stream) {
        try {
            return stream.readNBytes(HEADER_BYTES);
        } catch (IOException e) {
            throw new BlogException(ErrorCode.INVALID_FILE_TYPE);
        }
    }

    private static String extensionOf(String filename) {
        if (filename == null) return null;
        int dot = filename.lastIndexOf('.');
        if (dot <= 0 || dot == filename.length() - 1) return null;
        return filename.substring(dot + 1).toLowerCase(Locale.ROOT);
    }

    private static String canonicalExtension(String contentType) {
        return switch (contentType) {
            case "image/jpeg" -> "jpg";
            case "image/png" -> "png";
            case "image/gif" -> "gif";
            default -> "webp";
        };
    }
}
