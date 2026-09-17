package com.doro.blog.common.exception;

import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;

@Getter
@RequiredArgsConstructor
public enum ErrorCode {
    // 400 Bad Request
    INVALID_INPUT(HttpStatus.BAD_REQUEST, "COMMON-400-01", "잘못된 입력값입니다."),
    INVALID_COMMENT_DEPTH(HttpStatus.BAD_REQUEST, "COMMENT-400-01", "대댓글에는 추가 답글을 작성할 수 없습니다 (2-Level 제한)."),
    SLUG_ALREADY_EXISTS(HttpStatus.BAD_REQUEST, "SLUG-400-01", "이미 사용 중인 URL 슬러그입니다."),
    INVALID_FILE_TYPE(HttpStatus.BAD_REQUEST, "UPLOAD-400-01", "지원하지 않는 파일 형식이거나 유효하지 않은 이미지입니다."),
    FILE_UPLOAD_FAILED(HttpStatus.INTERNAL_SERVER_ERROR, "UPLOAD-500-01", "이미지 업로드 처리에 실패했습니다."),

    // 401 Unauthorized
    UNAUTHORIZED(HttpStatus.UNAUTHORIZED, "AUTH-401-01", "인증 자격 증명이 유효하지 않거나 누락되었습니다."),

    // 403 Forbidden
    ACCESS_DENIED(HttpStatus.FORBIDDEN, "AUTH-403-01", "요청하신 리소스에 대한 접근 권한이 없습니다."),

    // 404 Not Found
    USER_NOT_FOUND(HttpStatus.NOT_FOUND, "USER-404-01", "존재하지 않는 사용자입니다."),
    SERIES_NOT_FOUND(HttpStatus.NOT_FOUND, "SERIES-404-01", "존재하지 않는 시리즈입니다."),
    POST_NOT_FOUND(HttpStatus.NOT_FOUND, "POST-404-01", "존재하지 않는 게시글입니다."),
    COMMENT_NOT_FOUND(HttpStatus.NOT_FOUND, "COMMENT-404-01", "존재하지 않는 댓글입니다."),
    API_KEY_NOT_FOUND(HttpStatus.NOT_FOUND, "APIKEY-404-01", "존재하지 않는 API 키입니다."),

    // 409 Conflict
    DUPLICATE_RESOURCE(HttpStatus.CONFLICT, "COMMON-409-01", "이미 존재하는 리소스입니다."),

    // 500 Internal Server Error
    INTERNAL_SERVER_ERROR(HttpStatus.INTERNAL_SERVER_ERROR, "SYS-500-01", "서버 내부 오류가 발생했습니다.");

    private final HttpStatus httpStatus;
    private final String code;
    private final String message;
}
