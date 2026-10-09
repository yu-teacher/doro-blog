package com.doro.blog.domain.comment.service;

import com.doro.blog.common.exception.BlogException;
import com.doro.blog.common.exception.ErrorCode;
import com.doro.blog.domain.comment.dto.CommentDtos.*;
import com.doro.blog.domain.comment.entity.Comment;
import com.doro.blog.domain.comment.repository.CommentRepository;
import com.doro.blog.domain.post.entity.Post;
import com.doro.blog.domain.post.service.PostAccess;
import com.doro.blog.domain.post.entity.PostStatus;
import com.doro.blog.domain.post.repository.PostRepository;
import com.doro.blog.domain.post.service.PostCounterService;
import com.doro.blog.domain.user.entity.BlogUser;
import com.doro.blog.domain.user.service.BlogUserService;
import com.doro.blog.domain.notification.entity.NotificationType;
import com.doro.blog.domain.notification.service.NotificationService;
import com.hunnit_beasts.doro.sdk.client.DoroGuardClient;
import com.doro.blog.infra.guard.GuardTuples;
import com.hunnit_beasts.doro.sdk.client.DoroGuardClient;
import com.hunnit_beasts.doro.sdk.domain.DoroUser;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class CommentService {

    private final CommentRepository commentRepository;
    private final PostRepository postRepository;
    private final BlogUserService userService;
    private final DoroGuardClient guardClient;
    private final GuardTuples guardTuples;
    private final NotificationService notificationService;
    private final PostCounterService counterService;
    private final PostAccess postAccess;

    @Transactional
    public CommentResponse createRootComment(UUID postId, DoroUser doroUser, CreateCommentRequest request) {
        Post post = postRepository.findById(postId)
                .orElseThrow(() -> new BlogException(ErrorCode.POST_NOT_FOUND));

        // 볼 수 없는 글은 없는 글과 똑같이 404, 볼 수 있지만 출간되지 않은 글(작성자 본인)에만 이유를 알려 주는 403
        if (!postAccess.canView(post, doroUser)) {
            throw new BlogException(ErrorCode.POST_NOT_FOUND);
        }
        if (post.getStatus() != PostStatus.PUBLISHED) {
            throw new BlogException(ErrorCode.ACCESS_DENIED, "발행된 글에만 댓글을 작성할 수 있습니다.");
        }

        BlogUser user = userService.getOrCreateUser(doroUser);

        Comment comment = Comment.builder()
                .post(post)
                .user(user)
                .parent(null)
                .content(request.content())
                .build();

        Comment saved = commentRepository.save(comment);
        counterService.incrementComment(post);

        // Zanzibar ReBAC 튜플 등록:
        // 1. blog_comment:<id>#author@user:<userId>
        // 2. blog_comment:<id>#post@blog_post:<postId> (이를 통해 post#author가 can_delete 권한을 획득)
        guardTuples.write("blog_comment", saved.getId().toString(), "author", "user", user.getId().toString());
        guardTuples.write("blog_comment", saved.getId().toString(), "post", "blog_post", post.getId().toString());

        // 알림 발송: 글 작성자에게 댓글 알림
        notificationService.sendNotification(
                post.getUser(),
                user,
                NotificationType.COMMENT,
                post,
                post.getUser().getUsername(),
                request.content()
        );

        return CommentResponse.from(saved);
    }

    @Transactional
    public CommentResponse createReply(UUID postId, UUID parentCommentId, DoroUser doroUser, CreateReplyRequest request) {
        Post post = postRepository.findById(postId)
                .orElseThrow(() -> new BlogException(ErrorCode.POST_NOT_FOUND));

        if (!postAccess.canView(post, doroUser)) {
            throw new BlogException(ErrorCode.POST_NOT_FOUND);
        }
        if (post.getStatus() != PostStatus.PUBLISHED) {
            throw new BlogException(ErrorCode.ACCESS_DENIED, "발행된 글에만 댓글을 작성할 수 있습니다.");
        }

        BlogUser user = userService.getOrCreateUser(doroUser);

        Comment parent = commentRepository.findById(parentCommentId)
                .orElseThrow(() -> new BlogException(ErrorCode.COMMENT_NOT_FOUND));

        // 부모 댓글은 같은 글에 속해야 하고, 삭제된 댓글에는 답글을 달 수 없다
        if (!parent.getPost().getId().equals(postId)) {
            throw new BlogException(ErrorCode.COMMENT_NOT_FOUND);
        }
        if (parent.isDeleted()) {
            throw new BlogException(ErrorCode.COMMENT_NOT_FOUND);
        }

        // 2-Level 계층 제한: 이미 부모가 있는 댓글(대댓글)에는 추가 답글 불가
        if (parent.getParent() != null) {
            throw new BlogException(ErrorCode.INVALID_COMMENT_DEPTH);
        }

        Comment reply = Comment.builder()
                .post(post)
                .user(user)
                .parent(parent)
                .content(request.content())
                .build();

        Comment saved = commentRepository.save(reply);
        counterService.incrementComment(post);

        guardTuples.write("blog_comment", saved.getId().toString(), "author", "user", user.getId().toString());
        guardTuples.write("blog_comment", saved.getId().toString(), "post", "blog_post", post.getId().toString());

        // 알림 발송 1: 부모 댓글 작성자에게 대댓글(REPLY) 알림
        notificationService.sendNotification(
                parent.getUser(),
                user,
                NotificationType.REPLY,
                post,
                post.getUser().getUsername(),
                request.content()
        );

        // 알림 발송 2: 글 작성자가 부모 댓글 작성자와 다르면 글 작성자에게도 COMMENT 알림
        if (!post.getUser().getId().equals(parent.getUser().getId())) {
            notificationService.sendNotification(
                    post.getUser(),
                    user,
                    NotificationType.COMMENT,
                    post,
                    post.getUser().getUsername(),
                    request.content()
            );
        }

        return CommentResponse.from(saved);
    }

    @Transactional(readOnly = true)
    public List<CommentResponse> getCommentsByPostId(UUID postId, DoroUser viewer) {
        Post post = postRepository.findById(postId)
                .orElseThrow(() -> new BlogException(ErrorCode.POST_NOT_FOUND));
        // 비공개/임시저장 글의 댓글은 글을 볼 수 있는 사람에게만 보인다
        if (!postAccess.canView(post, viewer)) {
            throw new BlogException(ErrorCode.POST_NOT_FOUND);
        }

        List<Comment> rootComments = commentRepository.findRootCommentsWithChildren(postId);
        return rootComments.stream().map(CommentResponse::from).toList();
    }

    @Transactional
    public CommentResponse updateComment(UUID commentId, DoroUser doroUser, UpdateCommentRequest request) {
        Comment comment = commentRepository.findById(commentId)
                .orElseThrow(() -> new BlogException(ErrorCode.COMMENT_NOT_FOUND));

        if (comment.isDeleted()) {
            throw new BlogException(ErrorCode.COMMENT_NOT_FOUND);
        }
        if (!comment.getUser().getId().equals(doroUser.userId())) {
            throw new BlogException(ErrorCode.ACCESS_DENIED, "댓글 작성자 본인만 수정할 수 있습니다.");
        }

        comment.updateContent(request.content());
        return CommentResponse.from(comment);
    }

    @Transactional
    public void deleteComment(UUID commentId, DoroUser doroUser) {
        // 행을 잠그고 읽는다: 작성자와 글쓴이가 동시에 지워도 먼저 처리된 쪽의 결과(삭제 표시·삭제됨)를 보고 판단해 댓글 수가 두 번 줄지 않는다
        Comment comment = commentRepository.findByIdForUpdate(commentId)
                .orElseThrow(() -> new BlogException(ErrorCode.COMMENT_NOT_FOUND));

        // 이미 삭제 표시된 댓글(자식이 남아 있어 행만 남은 루트)은 없는 댓글로 본다: 다시 지우면 댓글 수가 또 줄어든다
        if (comment.isDeleted()) {
            throw new BlogException(ErrorCode.COMMENT_NOT_FOUND);
        }

        // Zanzibar ReBAC: 댓글 작성자 본인 OR 원글 작성자(post#author) 권한 확인
        boolean canDelete = doroUser.isAuthenticated() && (
                comment.getUser().getId().equals(doroUser.userId()) ||
                comment.getPost().getUser().getId().equals(doroUser.userId()) ||
                // Guard 장애는 '권한 없음'이 아니라 '확인 불가(503)'로 전달한다(check 는 장애를 거부로 삼킨다)
                guardClient.checkOrThrow("blog_comment", commentId.toString(), "can_delete", doroUser.userId().toString())
        );

        if (!canDelete) {
            throw new BlogException(ErrorCode.ACCESS_DENIED, "댓글 삭제 권한이 없습니다.");
        }

        counterService.decrementComment(comment.getPost());

        // 자식 대댓글이 남아있는 경우 소프트 삭제, 없으면 영구 삭제
        if (comment.isRoot() && !comment.getChildren().isEmpty()) {
            comment.markDeleted();
        } else {
            guardTuples.deleteAfterCommit("blog_comment", commentId.toString(), "author", "user", comment.getUser().getId().toString());
            guardTuples.deleteAfterCommit("blog_comment", commentId.toString(), "post", "blog_post", comment.getPost().getId().toString());
            commentRepository.delete(comment);

            // 삭제 표시만 되어 있던 부모(루트)는 마지막 답글이 사라지면 더 보여 줄 게 없으므로 함께 지운다(자리만 영구히 남지 않게)
            Comment parent = comment.getParent();
            if (parent != null) {
                parent.getChildren().remove(comment);
                if (parent.isDeleted() && parent.getChildren().isEmpty()) {
                    guardTuples.deleteAfterCommit("blog_comment", parent.getId().toString(), "author", "user", parent.getUser().getId().toString());
                    guardTuples.deleteAfterCommit("blog_comment", parent.getId().toString(), "post", "blog_post", parent.getPost().getId().toString());
                    commentRepository.delete(parent);
                }
            }
        }
    }
}
