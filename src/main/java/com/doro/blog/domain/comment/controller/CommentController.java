package com.doro.blog.domain.comment.controller;

import com.doro.blog.common.response.ApiResponse;
import com.doro.blog.domain.comment.dto.CommentDtos.*;
import com.doro.blog.domain.comment.service.CommentService;
import com.hunnit_beasts.doro.sdk.annotation.CurrentDoroUser;
import com.hunnit_beasts.doro.sdk.domain.DoroUser;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@Tag(name = "4. Comment & Reply (댓글 및 대댓글)", description = "2-Level 부모-자식 계층형 대댓글 및 소프트 삭제 API")
@RestController
@RequiredArgsConstructor
public class CommentController {

    private final CommentService commentService;

    @Operation(summary = "루트 댓글 작성 (인증)", description = "특정 글에 최상위 댓글 작성")
    @PostMapping("/api/v1/posts/{postId}/comments")
    public ApiResponse<CommentResponse> createRootComment(
            @PathVariable("postId") UUID postId,
            @CurrentDoroUser DoroUser doroUser,
            @Valid @RequestBody CreateCommentRequest request
    ) {
        return ApiResponse.success(commentService.createRootComment(postId, doroUser, request));
    }

    @Operation(summary = "대댓글(답글) 작성 (인증)", description = "부모 댓글에 대댓글 작성 (2-Level 제한 강제)")
    @PostMapping("/api/v1/posts/{postId}/comments/{commentId}/replies")
    public ApiResponse<CommentResponse> createReply(
            @PathVariable("postId") UUID postId,
            @PathVariable("commentId") UUID parentCommentId,
            @CurrentDoroUser DoroUser doroUser,
            @Valid @RequestBody CreateReplyRequest request
    ) {
        return ApiResponse.success(commentService.createReply(postId, parentCommentId, doroUser, request));
    }

    @Operation(summary = "글의 전체 계층형 댓글 트리 조회 (공개)", description = "부모 댓글 아래 자식 대댓글 배열이 중첩된 트리 구조 반환")
    @GetMapping("/api/v1/posts/{postId}/comments")
    public ApiResponse<List<CommentResponse>> getCommentsByPostId(
            @PathVariable("postId") UUID postId,
            @CurrentDoroUser DoroUser doroUser
    ) {
        return ApiResponse.success(commentService.getCommentsByPostId(postId, doroUser));
    }

    @Operation(summary = "댓글 수정 (작성자 본인)", description = "댓글 본문 수정")
    @PutMapping("/api/v1/comments/{commentId}")
    public ApiResponse<CommentResponse> updateComment(
            @PathVariable("commentId") UUID commentId,
            @CurrentDoroUser DoroUser doroUser,
            @Valid @RequestBody UpdateCommentRequest request
    ) {
        return ApiResponse.success(commentService.updateComment(commentId, doroUser, request));
    }

    @Operation(summary = "댓글 삭제 (ReBAC 인가)", description = "댓글 작성자 본인 OR 해당 원글의 작성자(post#author) 권한 허용. 자식이 있으면 소프트 삭제 처리")
    @DeleteMapping("/api/v1/comments/{commentId}")
    public ApiResponse<Void> deleteComment(
            @PathVariable("commentId") UUID commentId,
            @CurrentDoroUser DoroUser doroUser
    ) {
        commentService.deleteComment(commentId, doroUser);
        return ApiResponse.success();
    }
}
