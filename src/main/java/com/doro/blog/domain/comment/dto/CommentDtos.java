package com.doro.blog.domain.comment.dto;

import com.doro.blog.domain.comment.entity.Comment;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.Collections;
import java.util.List;
import java.util.UUID;

public class CommentDtos {

    public record CreateCommentRequest(
            @NotBlank(message = "댓글 내용은 필수입니다.")
            @Size(max = 2000, message = "댓글은 최대 2000자까지 작성 가능합니다.")
            String content
    ) {}

    public record CreateReplyRequest(
            @NotBlank(message = "답글 내용은 필수입니다.")
            @Size(max = 2000, message = "답글은 최대 2000자까지 작성 가능합니다.")
            String content
    ) {}

    public record UpdateCommentRequest(
            @NotBlank(message = "수정할 댓글 내용은 필수입니다.")
            @Size(max = 2000, message = "댓글은 최대 2000자까지 작성 가능합니다.")
            String content
    ) {}

    public record CommentResponse(
            UUID id,
            UUID postId,
            UUID userId,
            String username,
            String nickname,
            String profileImageUrl,
            String content,
            boolean isDeleted,
            Instant createdAt,
            Instant updatedAt,
            List<CommentResponse> replies
    ) {
        public static CommentResponse from(Comment comment) {
            String displayContent = comment.isDeleted() ? "삭제된 댓글입니다." : comment.getContent();

            List<CommentResponse> childResponses = (comment.getChildren() != null && !comment.getChildren().isEmpty())
                    ? comment.getChildren().stream().map(CommentResponse::from).toList()
                    : Collections.emptyList();

            return new CommentResponse(
                    comment.getId(),
                    comment.getPost().getId(),
                    comment.getUser().getId(),
                    comment.getUser().getUsername(),
                    comment.getUser().getNickname(),
                    comment.getUser().getProfileImageUrl(),
                    displayContent,
                    comment.isDeleted(),
                    comment.getCreatedAt(),
                    comment.getUpdatedAt(),
                    childResponses
            );
        }
    }
}
