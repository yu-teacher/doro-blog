package com.doro.blog.domain.upload.service;

import com.doro.blog.common.exception.BlogException;
import com.doro.blog.common.exception.ErrorCode;
import com.doro.blog.domain.upload.dto.UploadResponse;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockMultipartFile;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** 실제 MinIO 에 SVG 를 올려, 저장되는 것이 정제된 사본이고 Content-Type 이 맞는지 확인한다. */
@SpringBootTest
class SvgUploadIntegrationTest {

    private static final String EVIL = "<?xml version=\"1.0\"?><svg xmlns=\"http://www.w3.org/2000/svg\" onload=\"alert(1)\" viewBox=\"0 0 10 10\">"
            + "<script>alert(2)</script><foreignObject><div>x</div></foreignObject><rect width=\"5\" height=\"5\" fill=\"red\" onclick=\"alert(3)\"/></svg>";

    @Autowired
    private StorageService storageService;

    @Value("${doro.storage.minio.endpoint:http://localhost:9000}")
    private String endpoint;

    @Value("${doro.storage.minio.bucket:doro-blog-media}")
    private String bucket;

    private static MockMultipartFile file(String name, String body) {
        return new MockMultipartFile("file", name, "image/svg+xml", body.getBytes(StandardCharsets.UTF_8));
    }

    private HttpResponse<String> fetch(UploadResponse uploaded) throws Exception {
        String key = uploaded.url().substring(uploaded.url().indexOf("/media/") + "/media/".length());
        return HttpClient.newHttpClient().send(
                HttpRequest.newBuilder(URI.create(endpoint + "/" + bucket + "/" + key)).GET().build(),
                HttpResponse.BodyHandlers.ofString());
    }

    @Test
    @DisplayName("악성 SVG 를 올리면 정제된 사본만 저장되고 image/svg+xml 로 서빙된다")
    void storesOnlySanitizedCopy() throws Exception {
        UploadResponse uploaded = storageService.uploadImage(file("../evil name.svg", EVIL), "thumbnails");

        assertThat(uploaded.url()).startsWith("/media/thumbnails/").endsWith(".svg");
        assertThat(uploaded.contentType()).isEqualTo("image/svg+xml");
        assertThat(uploaded.originalFilename()).isEqualTo("evil name.svg");

        HttpResponse<String> stored = fetch(uploaded);
        assertThat(stored.statusCode()).isEqualTo(200);
        assertThat(stored.headers().firstValue("Content-Type").orElse("")).startsWith("image/svg+xml");
        assertThat(stored.body()).contains("<rect", "fill=\"red\"", "viewBox=\"0 0 10 10\"")
                .doesNotContain("script", "alert", "onload", "onclick", "foreignObject");
        assertThat(uploaded.size()).isEqualTo(stored.body().getBytes(StandardCharsets.UTF_8).length);
    }

    @Test
    @DisplayName("정제할 수 없는 SVG(DOCTYPE/XXE 등)는 업로드 실패가 아니라 INVALID_FILE_TYPE 으로 거부한다")
    void rejectsUnsanitizable() {
        String xxe = "<?xml version=\"1.0\"?><!DOCTYPE svg [<!ENTITY x SYSTEM \"file:///etc/passwd\">]><svg xmlns=\"http://www.w3.org/2000/svg\"><text>&x;</text></svg>";
        assertThatThrownBy(() -> storageService.uploadImage(file("x.svg", xxe), "posts"))
                .isInstanceOf(BlogException.class)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.INVALID_FILE_TYPE);
    }

    @Test
    @DisplayName("SVG 처럼 보이게 만든 HTML 은 거부한다")
    void rejectsHtmlNamedSvg() {
        assertThatThrownBy(() -> storageService.uploadImage(file("x.svg", "<html><script>alert(1)</script></html>"), "posts"))
                .isInstanceOf(BlogException.class);
    }
}
