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

    @Test
    @DisplayName("Guard 장애는 500 이 아니라 503 으로 응답한다")
    void guardOutageIs503() {
        var write = handler.handleGuardUnavailable(
                new com.hunnit_beasts.doro.sdk.exception.DoroGuardWriteFailedException("down", new RuntimeException()));
        var check = handler.handleGuardUnavailable(
                new com.hunnit_beasts.doro.sdk.exception.DoroGuardUnavailableException("down", new RuntimeException()));

        assertThat(write.getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
        assertThat(check.getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
        assertThat(write.getBody().toString()).doesNotContain("down");
    }

    @Test
    @DisplayName("업로드 용량 초과는 500 이 아니라 413")
    void uploadTooLargeIs413() {
        var response = handler.handleUploadTooLarge(new org.springframework.web.multipart.MaxUploadSizeExceededException(15L));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.PAYLOAD_TOO_LARGE);
    }

    @Test
    @DisplayName("multipart 필수 파트 누락은 500 이 아니라 400")
    void missingPartIs400() {
        var response = handler.handleMissingPart(new org.springframework.web.multipart.support.MissingServletRequestPartException("file"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    @DisplayName("유니크 제약 위반만 409 이고, 그 밖의 무결성 오류는 '이미 존재' 로 가리지 않고 500")
    void onlyUniqueViolationIsConflict() {
        var unique = new org.springframework.dao.DataIntegrityViolationException("dup",
                new java.sql.SQLException("duplicate key", "23505"));
        var notNull = new org.springframework.dao.DataIntegrityViolationException("null",
                new java.sql.SQLException("null value in column", "23502"));

        assertThat(handler.handleDataIntegrity(unique).getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(handler.handleDataIntegrity(notNull).getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
    }
}
