package com.doro.blog.domain.series.controller;

import com.doro.blog.common.response.ApiResponse;
import com.doro.blog.domain.series.dto.SeriesDtos.*;
import com.doro.blog.domain.series.service.SeriesService;
import com.hunnit_beasts.doro.sdk.annotation.CurrentDoroUser;
import com.hunnit_beasts.doro.sdk.annotation.DoroGuard;
import com.hunnit_beasts.doro.sdk.domain.DoroUser;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@Tag(name = "2. Series (연재 시리즈)", description = "글들을 목차/회차 순서로 묶어 연재 출간하는 시리즈 API")
@RestController
@RequestMapping("/api/v1/series")
@RequiredArgsConstructor
public class SeriesController {

    private final SeriesService seriesService;

    @Operation(summary = "새 시리즈 생성 (인증)", description = "새로운 연재 시리즈를 생성하고 소유권 ReBAC 튜플을 Guard에 등록")
    @PostMapping
    public ApiResponse<SeriesResponse> createSeries(
            @CurrentDoroUser DoroUser doroUser,
            @Valid @RequestBody CreateSeriesRequest request
    ) {
        return ApiResponse.success(seriesService.createSeries(doroUser, request));
    }

    @Operation(summary = "특정 작가의 시리즈 목록 조회 (공개)", description = "특정 작가가 출간한 모든 시리즈 목록 조회")
    @GetMapping("/users/@{username}")
    public ApiResponse<List<SeriesResponse>> getSeriesByUsername(
            @PathVariable("username") String username,
            @CurrentDoroUser DoroUser doroUser
    ) {
        return ApiResponse.success(seriesService.getSeriesByUsername(username, doroUser));
    }

    @Operation(summary = "슬러그 기반 시리즈 상세 조회 (공개)", description = "/series/users/@{username}/{slug} 주소로 시리즈 상세 및 소속 글 목록 조회")
    @GetMapping("/users/@{username}/{slug}")
    public ApiResponse<SeriesDetailResponse> getSeriesByUsernameAndSlug(
            @PathVariable("username") String username,
            @PathVariable("slug") String slug,
            @CurrentDoroUser DoroUser doroUser
    ) {
        return ApiResponse.success(seriesService.getSeriesByUsernameAndSlug(username, slug, doroUser));
    }

    @Operation(summary = "시리즈 상세 및 소속 글 목록 조회 (공개)", description = "시리즈 정보와 회차 순서(1, 2, 3...)로 정렬된 글 목록 조회")
    @GetMapping("/{seriesId}")
    public ApiResponse<SeriesDetailResponse> getSeriesDetail(
            @PathVariable("seriesId") UUID seriesId,
            @CurrentDoroUser DoroUser doroUser
    ) {
        return ApiResponse.success(seriesService.getSeriesDetail(seriesId, doroUser));
    }

    @Operation(summary = "시리즈 정보 수정 (ReBAC 인가)", description = "DORO Guard ReBAC 검증: 시리즈의 editor/owner만 수정 가능")
    @DoroGuard(namespace = "blog_series", object = "#seriesId", relation = "editor")
    @PutMapping("/{seriesId}")
    public ApiResponse<SeriesResponse> updateSeries(
            @PathVariable("seriesId") UUID seriesId,
            @Valid @RequestBody UpdateSeriesRequest request
    ) {
        return ApiResponse.success(seriesService.updateSeries(seriesId, request));
    }

    @Operation(summary = "시리즈 삭제 (ReBAC 인가)", description = "DORO Guard ReBAC 검증: 시리즈의 editor/owner만 삭제 가능")
    @DoroGuard(namespace = "blog_series", object = "#seriesId", relation = "editor")
    @DeleteMapping("/{seriesId}")
    public ApiResponse<Void> deleteSeries(@PathVariable("seriesId") UUID seriesId) {
        seriesService.deleteSeries(seriesId);
        return ApiResponse.success();
    }

    @Operation(summary = "시리즈 내 글 순서 일괄 재배치 (ReBAC 인가)", description = "포스트 ID 배열 순서대로 회차 번호를 1, 2, 3...으로 일괄 갱신")
    @DoroGuard(namespace = "blog_series", object = "#seriesId", relation = "editor")
    @PutMapping("/{seriesId}/sort")
    public ApiResponse<SeriesDetailResponse> reorderPosts(
            @PathVariable("seriesId") UUID seriesId,
            @Valid @RequestBody ReorderPostsRequest request
    ) {
        return ApiResponse.success(seriesService.reorderPosts(seriesId, request.postIds()));
    }
    @Operation(summary = "시리즈에 기존 글 추가 (ReBAC 인가)", description = "시리즈에 속하지 않은 본인의 글을 마지막 회차로 추가. 편집자 시점 상세를 반환")
    @DoroGuard(namespace = "blog_series", object = "#seriesId", relation = "editor")
    @PostMapping("/{seriesId}/posts")
    public ApiResponse<SeriesDetailResponse> addPost(
            @PathVariable("seriesId") UUID seriesId,
            @Valid @RequestBody AddSeriesPostRequest request
    ) {
        return ApiResponse.success(seriesService.addPost(seriesId, request.postId()));
    }

    @Operation(summary = "시리즈에서 글 빼기 (ReBAC 인가)", description = "글은 지우지 않고 시리즈에서만 뺀다. 남은 글의 회차를 1..n 으로 다시 매긴다")
    @DoroGuard(namespace = "blog_series", object = "#seriesId", relation = "editor")
    @DeleteMapping("/{seriesId}/posts/{postId}")
    public ApiResponse<SeriesDetailResponse> removePost(
            @PathVariable("seriesId") UUID seriesId,
            @PathVariable("postId") UUID postId
    ) {
        return ApiResponse.success(seriesService.removePost(seriesId, postId));
    }
}
