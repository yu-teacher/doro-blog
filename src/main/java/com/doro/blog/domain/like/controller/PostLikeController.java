package com.doro.blog.domain.like.controller;

import com.doro.blog.common.response.ApiResponse;
import com.doro.blog.domain.like.service.PostLikeService;
import com.hunnit_beasts.doro.sdk.annotation.CurrentDoroUser;
import com.hunnit_beasts.doro.sdk.domain.DoroUser;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.UUID;

@Tag(name = "6. Like (좋아요)", description = "게시글 좋아요 토글 API")
@RestController
@RequestMapping("/api/v1/posts/{postId}/likes")
@RequiredArgsConstructor
public class PostLikeController {

    private final PostLikeService likeService;

    @Operation(summary = "좋아요 토글 (인증)", description = "1인 1좋아요 토글 (이미 좋아요 시 취소, 미좋아요 시 등록)")
    @PostMapping
    public ApiResponse<Map<String, Object>> toggleLike(
            @PathVariable("postId") UUID postId,
            @CurrentDoroUser DoroUser doroUser
    ) {
        boolean liked = likeService.toggleLike(postId, doroUser);
        return ApiResponse.success(Map.of("liked", liked));
    }
}
