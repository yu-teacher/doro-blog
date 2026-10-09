package com.doro.blog.domain.upload;

import com.doro.blog.domain.apikey.dto.ApiKeyDtos.CreateApiKeyRequest;
import com.doro.blog.domain.apikey.service.ApiKeyService;
import com.hunnit_beasts.doro.sdk.domain.DoroUser;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** 잘못된 multipart 본문은 서버 오류(500)가 아니라 클라이언트 오류(4xx)다. 실제 Tomcat 에서만 재현되므로 내장 서버로 시험한다. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class MalformedMultipartTest {

    @Value("${local.server.port}")
    private int port;
    @Autowired
    private ApiKeyService apiKeyService;

    @Test
    @DisplayName("경계가 맞지 않는 쓰레기 multipart 본문은 4xx")
    void garbageMultipartIsAClientError() throws Exception {
        UUID id = UUID.randomUUID();
        DoroUser owner = new DoroUser(id, "mp_" + id.toString().substring(0, 8) + "@doro.local", UUID.randomUUID(), 100, "USER");
        String key = apiKeyService.createApiKey(owner, new CreateApiKeyRequest("mp", 1)).apiKey();

        HttpRequest request = HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + "/api/v1/uploads"))
                .header("X-API-Key", key)
                .header("Content-Type", "multipart/form-data; boundary=XYZ")
                .POST(HttpRequest.BodyPublishers.ofString("this is not a multipart body at all"))
                .build();
        int status = HttpClient.newHttpClient().send(request, HttpResponse.BodyHandlers.ofString()).statusCode();

        assertThat(status).as("서버 오류로 응답하면 안 된다").isBetween(400, 499);
    }
}
