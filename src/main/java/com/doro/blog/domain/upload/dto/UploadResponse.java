package com.doro.blog.domain.upload.dto;

public record UploadResponse(
        String url,
        String originalFilename,
        String contentType,
        long size
) {}
