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

    @Operation(summary = "특정 작가의 출간 글 목록 및 채널 내 검색 (공개, 페이징)", description = "특정 작가의 공개 출간 글 목록을 키워드(q) 또는 태그(tag)로 필터링하여 페이징 조회")
    @GetMapping("/users/@{username}")
    public ApiResponse<Page<PostSummaryResponse>> getUserPosts(
            @PathVariable("username") String username,
            @RequestParam(name = "q", required = false) String query,
            @RequestParam(name = "tag", required = false) String tag,
            @RequestParam(name = "page", defaultValue = "0") int page,
            @RequestParam(name = "size", defaultValue = "20") int size
    ) {
        return ApiResponse.success(postService.getUserPosts(username, query, tag, page, size));
    }


    @Operation(summary = "게시글 상세 조회 (마크다운 원문 포함)", description = "/@{username}/{slug} 주소로 글 상세 조회. 비공개 글은 ReBAC 인가 검증 수행")
    @GetMapping("/@{username}/{slug}")
    public ApiResponse<PostDetailResponse> getPostDetail(
            @PathVariable("username") String username,
            @PathVariable("slug") String slug,
            @CurrentDoroUser DoroUser doroUser,
            jakarta.servlet.http.HttpServletRequest request,
            jakarta.servlet.http.HttpServletResponse response
    ) {
        String cleanUsername = username.startsWith("@") ? username.substring(1) : username;
        boolean shouldCount = checkAndSetViewCookie(cleanUsername + "/" + slug.toLowerCase().trim(), request, response);
        return ApiResponse.success(postService.getPostDetail(username, slug, doroUser, shouldCount));
    }

    private boolean checkAndSetViewCookie(
            String targetKey,
            jakarta.servlet.http.HttpServletRequest request,
            jakarta.servlet.http.HttpServletResponse response
    ) {
        if (request == null || response == null) {
            return true;
        }

        jakarta.servlet.http.Cookie[] cookies = request.getCookies();
        jakarta.servlet.http.Cookie viewCookie = null;
        if (cookies != null) {
            for (jakarta.servlet.http.Cookie cookie : cookies) {
                if ("post_view".equals(cookie.getName())) {
                    viewCookie = cookie;
                    break;
                }
            }
        }

        String target = "[" + targetKey + "]";
        if (viewCookie != null) {
            if (!viewCookie.getValue().contains(target)) {
                viewCookie.setValue(viewCookie.getValue() + "_" + target);
                viewCookie.setPath("/");
                viewCookie.setMaxAge(60 * 60 * 24); // 24시간
                response.addCookie(viewCookie);
                return true;
            }
            return false;
        } else {
            jakarta.servlet.http.Cookie newCookie = new jakarta.servlet.http.Cookie("post_view", target);
            newCookie.setPath("/");
            newCookie.setMaxAge(60 * 60 * 24); // 24시간
            newCookie.setHttpOnly(true);
            response.addCookie(newCookie);
            return true;
        }
    }

    @Operation(summary = "게시글 ID 단건 상세 조회 (마크다운 원문 포함)", description = "수정 등을 위한 포스트 ID 단건 조회")
    @GetMapping("/{postId}")
    public ApiResponse<PostDetailResponse> getPostById(
            @PathVariable("postId") UUID postId,
            @CurrentDoroUser DoroUser doroUser
    ) {
        return ApiResponse.success(postService.getPostById(postId, doroUser));
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

    @Operation(summary = "내 포스트 관리 목록 (인증, 페이징)", description = "내가 작성한 글 목록 조회 (status: ALL, DRAFT, PUBLISHED, PRIVATE)")
    @GetMapping("/me")
    public ApiResponse<Page<PostSummaryResponse>> getMyPosts(
            @CurrentDoroUser DoroUser doroUser,
            @RequestParam(name = "status", required = false) com.doro.blog.domain.post.entity.PostStatus status,
            @RequestParam(name = "page", defaultValue = "0") int page,
            @RequestParam(name = "size", defaultValue = "20") int size
    ) {
        return ApiResponse.success(postService.getMyPosts(doroUser, status, page, size));
    }

    @Operation(summary = "트렌딩 포스트 기간별 조회 (공개, 페이징)", description = "지정 기간(day, week, month, year) 내 출간된 인기 글 랭킹 피드")
    @GetMapping("/trending")
    public ApiResponse<Page<PostSummaryResponse>> getTrendingPosts(
            @RequestParam(name = "timeframe", defaultValue = "week") String timeframe,
            @RequestParam(name = "page", defaultValue = "0") int page,
            @RequestParam(name = "size", defaultValue = "20") int size
    ) {
        return ApiResponse.success(postService.getTrendingPosts(timeframe, page, size));
    }

    @Operation(summary = "내가 좋아요한 포스트 목록 (인증, 페이징)", description = "내가 좋아요(하트)를 누른 공개 글 읽기 목록 페이징 조회")
    @GetMapping("/me/likes")
    public ApiResponse<Page<PostSummaryResponse>> getMyLikedPosts(
            @CurrentDoroUser DoroUser doroUser,
            @RequestParam(name = "page", defaultValue = "0") int page,
            @RequestParam(name = "size", defaultValue = "20") int size
    ) {
        return ApiResponse.success(postService.getMyLikedPosts(doroUser, page, size));
    }

    @Operation(summary = "키워드 검색 (공개, 페이징)", description = "제목, 요약문, 본문 키워드 대소문자 무시 검색")
    @GetMapping("/search")
    public ApiResponse<Page<PostSummaryResponse>> searchPosts(
            @RequestParam(name = "q") String query,
            @RequestParam(name = "page", defaultValue = "0") int page,
            @RequestParam(name = "size", defaultValue = "20") int size
    ) {
        return ApiResponse.success(postService.searchPosts(query, page, size));
    }
}

