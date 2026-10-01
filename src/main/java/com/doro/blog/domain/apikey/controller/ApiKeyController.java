package com.doro.blog.domain.apikey.controller;

import com.doro.blog.common.web.PageLimits;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import com.doro.blog.common.response.ApiResponse;
import com.doro.blog.domain.apikey.dto.ApiKeyDtos.*;
import com.doro.blog.domain.apikey.service.ApiKeyService;
import com.hunnit_beasts.doro.sdk.annotation.CurrentDoroUser;
import com.hunnit_beasts.doro.sdk.domain.DoroUser;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@Tag(name = "7. API Key (개인용 API 키 & 자동화)", description = "헤드리스 자동 글 작성을 위한 개인용 API Key 발급, 관리 및 호출 로그 API")
@RestController
@RequestMapping("/api/v1/api-keys")
@RequiredArgsConstructor
public class ApiKeyController {

    private final ApiKeyService apiKeyService;

    @Operation(summary = "새 API 키 발급 (인증)", description = "자동 글 발행에 사용할 doro_live_... 시크릿 키를 1회 발급합니다.")
    @PostMapping
    public ApiResponse<CreateApiKeyResponse> createApiKey(
            @CurrentDoroUser DoroUser doroUser,
            @Valid @RequestBody CreateApiKeyRequest request
    ) {
        return ApiResponse.success(apiKeyService.createApiKey(doroUser, request));
    }

    @Operation(summary = "내 API 키 목록 조회 (인증)", description = "현재 발급된 API 키 목록을 조회합니다.")
    @GetMapping
    public ApiResponse<List<ApiKeyResponse>> getMyApiKeys(
            @CurrentDoroUser DoroUser doroUser
    ) {
        return ApiResponse.success(apiKeyService.getMyApiKeys(doroUser));
    }

    @Operation(summary = "API 키 삭제 및 폐기 (인증)", description = "지정한 API 키를 즉시 폐기하여 더 이상 호출되지 않도록 합니다.")
    @DeleteMapping("/{id}")
    public ApiResponse<Void> revokeApiKey(
            @CurrentDoroUser DoroUser doroUser,
            @PathVariable("id") UUID apiKeyId
    ) {
        apiKeyService.revokeApiKey(doroUser, apiKeyId);
        return ApiResponse.success();
    }

    @Operation(summary = "API 키 호출 감사 로그 조회 (인증, 페이징)", description = "내 API 키로 실행된 요청 이력(상태코드, 엔드포인트, 소요시간)을 페이징 조회합니다.")
    @GetMapping("/logs")
    public ApiResponse<Page<ApiKeyLogResponse>> getMyLogs(
            @CurrentDoroUser DoroUser doroUser,
            @RequestParam(name = "page", defaultValue = "0") @Min(PageLimits.MIN_PAGE) int page,
            @RequestParam(name = "size", defaultValue = "20") @Min(PageLimits.MIN_SIZE) @Max(PageLimits.MAX_SIZE) int size
    ) {
        return ApiResponse.success(apiKeyService.getMyLogs(doroUser, page, size));
    }
}
