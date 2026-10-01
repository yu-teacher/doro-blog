package com.doro.blog.domain.upload.service;

import com.doro.blog.common.exception.BlogException;
import com.doro.blog.common.exception.ErrorCode;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * 업로드 이미지 검증. 클라이언트가 보낸 확장자/Content-Type 은 믿지 않고 파일의 첫 바이트로 형식을 판별한다.
 * SVG 는 스크립트를 담을 수 있으므로 형식만 판별하고, 저장 전에 반드시 {@link SvgSanitizer} 로 정제해야 한다.
 */
public final class ImageValidator {

    /** 판별된 형식: 서버가 저장할 때 쓰는 Content-Type 과 확장자. */
    public record DetectedImage(String contentType, String extension) {
    }

    private static final Map<String, Set<String>> EXTENSIONS_BY_TYPE = Map.of(
            "image/jpeg", Set.of("jpg", "jpeg"),
            "image/png", Set.of("png"),
            "image/gif", Set.of("gif"),
            "image/webp", Set.of("webp"),
            "image/svg+xml", Set.of("svg")
    );

    /** SVG 는 앞쪽에 XML 선언/주석이 올 수 있어 매직 넘버보다 넉넉히 읽는다. */
    private static final int HEADER_BYTES = 1024;
    public static final String SVG_CONTENT_TYPE = "image/svg+xml";

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
        return looksLikeSvg(h) ? SVG_CONTENT_TYPE : null;
    }

    /** 앞의 BOM/공백/XML 선언/주석을 건너뛴 첫 요소가 &lt;svg 이면 SVG 로 본다 (실제 안전성은 SvgSanitizer 가 판단한다). */
    private static boolean looksLikeSvg(byte[] header) {
        String head = new String(header, StandardCharsets.UTF_8);
        int i = 0;
        while (i < head.length()) {
            char c = head.charAt(i);
            if (c == '\uFEFF' || Character.isWhitespace(c)) {
                i++;
            } else if (head.startsWith("<?", i)) {
                int end = head.indexOf("?>", i);
                if (end < 0) return false;
                i = end + 2;
            } else if (head.startsWith("<!--", i)) {
                int end = head.indexOf("-->", i);
                if (end < 0) return false;
                i = end + 3;
            } else {
                break;
            }
        }
        return head.regionMatches(true, i, "<svg", 0, 4) && (i + 4 >= head.length() || !Character.isLetterOrDigit(head.charAt(i + 4)));
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
            case SVG_CONTENT_TYPE -> "svg";
            default -> "webp";
        };
    }
}
