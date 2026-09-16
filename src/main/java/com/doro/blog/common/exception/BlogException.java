package com.doro.blog.common.exception;

import lombok.Getter;

@Getter
public class BlogException extends RuntimeException {

    private final ErrorCode errorCode;

    public BlogException(ErrorCode errorCode) {
        super(errorCode.getMessage());
        this.errorCode = errorCode;
    }

    public BlogException(ErrorCode errorCode, String detailMessage) {
        super(detailMessage);
        this.errorCode = errorCode;
    }
}
