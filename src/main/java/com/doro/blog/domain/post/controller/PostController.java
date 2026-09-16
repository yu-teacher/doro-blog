package com.doro.blog.domain.post.controller;

import com.doro.blog.common.response.ApiResponse;
import com.doro.blog.domain.post.dto.PostDtos.*;
import com.doro.blog.domain.post.service.PostService;
import com.hunnit_beasts.doro.sdk.annotation.CurrentDoroUser;
import com.hunnit_beasts.doro.sdk.annotation.DoroGuard;
import com.hunnit_beasts.doro.sdk.domain.DoroUser;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@Tag(name = "3. Post (게시글 및 출간)", description = "마크다운 아티클 작성, 출간, 피드 및 상세 조회 API")
@RestController
@RequestMapping("/api/v1/posts")
@RequiredArgsConstructor
public class PostController {

    private final PostService postService;

    @Operation(summary = "새 글 작성 (인증)", description = "글을 임시저장(DRAFT) 또는 즉시 출간(PUBLISHED)하고 ReBAC 튜플 등록")
    @PostMapping
    public ApiResponse<PostSummaryResponse> createPost(
            @CurrentDoroUser DoroUser doroUser,
            @Valid @RequestBody CreatePostRequest request
    ) {
        return ApiResponse.success(postService.createPost(doroUser, request));
    }

    @Operation(summary = "전체 피드 목록 조회 (공개)", description = "최신순/인기순 및 태그 필터 페이징 피드 조회")
    @GetMapping
    public ApiResponse<Page<PostSummaryResponse>> getFeed(
            @RequestParam(name = "sort", defaultValue = "latest") String sort,
            @RequestParam(name = "tag", required = false) String tag,
            @RequestParam(name = "page", defaultValue = "0") int page,
            @RequestParam(name = "size", defaultValue = "20") int size
    ) {
        return ApiResponse.success(postService.getFeed(sort, tag, page, size));
    }

    @Operation(summary = "특정 작가의 출간 글 목록 조회 (공개)", description = "특정 작가의 공개 출간 글 목록 페이징 조회")
    @GetMapping("/users/@{username}")
    public ApiResponse<Page<PostSummaryResponse>> getUserPosts(
            @PathVariable("username") String username,
            @RequestParam(name = "page", defaultValue = "0") int page,
            @RequestParam(name = "size", defaultValue = "20") int size
    ) {
        return ApiResponse.success(postService.getUserPosts(username, page, size));
    }

    @Operation(summary = "게시글 상세 조회 (마크다운 원문 포함)", description = "/@{username}/{slug} 주소로 글 상세 조회. 비공개 글은 ReBAC 인가 검증 수행")
    @GetMapping("/@{username}/{slug}")
    public ApiResponse<PostDetailResponse> getPostDetail(
            @PathVariable("username") String username,
            @PathVariable("slug") String slug,
            @CurrentDoroUser DoroUser doroUser
    ) {
        return ApiResponse.success(postService.getPostDetail(username, slug, doroUser));
    }

    @Operation(summary = "게시글 수정 (ReBAC 인가)", description = "DORO Guard ReBAC 검증: 글의 editor/author만 수정 가능")
    @DoroGuard(namespace = "blog_post", object = "#postId", relation = "editor")
    @PutMapping("/{postId}")
    public ApiResponse<PostSummaryResponse> updatePost(
            @PathVariable("postId") UUID postId,
            @Valid @RequestBody UpdatePostRequest request
    ) {
        return ApiResponse.success(postService.updatePost(postId, request));
    }

    @Operation(summary = "게시글 삭제 (ReBAC 인가)", description = "DORO Guard ReBAC 검증: 글의 editor/author만 삭제 가능")
    @DoroGuard(namespace = "blog_post", object = "#postId", relation = "editor")
    @DeleteMapping("/{postId}")
    public ApiResponse<Void> deletePost(@PathVariable("postId") UUID postId) {
        postService.deletePost(postId);
        return ApiResponse.success();
    }
}
