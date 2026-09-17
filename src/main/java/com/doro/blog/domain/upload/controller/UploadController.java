package com.doro.blog.domain.upload.controller;

import com.doro.blog.common.response.ApiResponse;
import com.doro.blog.common.exception.BlogException;
import com.doro.blog.common.exception.ErrorCode;
import com.doro.blog.domain.upload.dto.UploadResponse;
import com.doro.blog.domain.upload.service.StorageService;
import com.hunnit_beasts.doro.sdk.annotation.CurrentDoroUser;
import com.hunnit_beasts.doro.sdk.domain.DoroUser;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@Tag(name = "Uploads", description = "이미지 및 미디어 파일 업로드 API (MinIO / S3)")
@RestController
@RequestMapping("/api/v1/uploads")
@RequiredArgsConstructor
public class UploadController {

    private final StorageService storageService;

    @Operation(summary = "이미지 파일 업로드", description = "게시글 본문 또는 썸네일용 이미지를 업로드하고 영구 접근 URL을 반환합니다.")
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<UploadResponse> uploadImage(
            @CurrentDoroUser DoroUser doroUser,
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "subDirectory", required = false, defaultValue = "posts") String subDirectory
    ) {
        if (doroUser == null || !doroUser.isAuthenticated()) {
            throw new BlogException(ErrorCode.UNAUTHORIZED);
        }

        UploadResponse response = storageService.uploadImage(file, subDirectory);
        return ApiResponse.success(response);
    }
}
