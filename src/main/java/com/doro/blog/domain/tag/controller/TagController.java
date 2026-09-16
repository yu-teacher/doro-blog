package com.doro.blog.domain.tag.controller;

import com.doro.blog.common.response.ApiResponse;
import com.doro.blog.domain.tag.dto.TagDtos.TagResponse;
import com.doro.blog.domain.tag.service.TagService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@Tag(name = "5. Tag (태그 및 키워드)", description = "인기 태그 랭킹 및 글 분류 태그 API")
@RestController
@RequestMapping("/api/v1/tags")
@RequiredArgsConstructor
public class TagController {

    private final TagService tagService;

    @Operation(summary = "인기 태그 목록 및 등록된 글 수 랭킹 조회 (공개)", description = "등록된 글 수가 많은 상위 인기 태그 목록 반환")
    @GetMapping
    public ApiResponse<List<TagResponse>> getPopularTags() {
        return ApiResponse.success(tagService.getPopularTags());
    }
}
