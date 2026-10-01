package com.doro.blog.common.exception;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class ClientErrorHandlingTest {

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

    @Test
    @DisplayName("스캐너가 요청하는 존재하지 않는 경로(/api/.env.local 등)는 500 이 아니라 404 로 응답한다")
    void unknownPathIs404() {
        var response = handler.handleNoResource(new NoResourceFoundException(HttpMethod.GET, "/api/.env.local", "api/.env.local"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(response.getBody().toString()).doesNotContain(".env");
    }

    @Test
    @DisplayName("지원하지 않는 Content-Type 은 500 이 아니라 415")
    void unsupportedMediaTypeIs415() {
        var response = handler.handleUnsupportedMediaType(
                new HttpMediaTypeNotSupportedException(MediaType.TEXT_PLAIN, List.of(MediaType.APPLICATION_JSON)));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNSUPPORTED_MEDIA_TYPE);
    }

    @Test
    @DisplayName("진짜 서버 오류만 500 으로 남는다")
    void realFailuresStayInternalServerError() {
        var response = handler.handleGenericException(new IllegalStateException("boom"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
    }
}
