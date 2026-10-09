package com.doro.blog.domain.post;

import com.doro.blog.domain.comment.dto.CommentDtos.CreateCommentRequest;
import com.doro.blog.domain.comment.service.CommentService;
import com.doro.blog.domain.post.dto.PostDtos.CreatePostRequest;
import com.doro.blog.domain.post.dto.PostDtos.PostSummaryResponse;
import com.doro.blog.domain.post.entity.Post;
import com.doro.blog.domain.post.entity.PostStatus;
import com.doro.blog.domain.post.repository.PostRepository;
import com.doro.blog.domain.post.service.PostAccess;
import com.doro.blog.domain.post.service.PostCommandService;
import com.hunnit_beasts.doro.sdk.client.DoroGuardClient;
import com.hunnit_beasts.doro.sdk.domain.DoroUser;
import com.hunnit_beasts.doro.sdk.exception.DoroGuardUnavailableException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.reset;

/**
 * Guard 에 닿지 못하는 장애는 "권한 없음"이 아니라 "일시적으로 확인 불가(503)"로 전달돼야 한다.
 * 장애를 거부로 바꾸면 정상 권한을 가진 사람이 영문 모를 403/404 를 받고, 운영자는 장애를 권한 문제로 오해한다.
 */
@SpringBootTest
class GuardOutageAccessTest {

    @MockitoSpyBean private DoroGuardClient guardClient;
    @Autowired private PostAccess postAccess;
    @Autowired private PostCommandService postCommands;
    @Autowired private PostRepository postRepository;
    @Autowired private CommentService commentService;

    private DoroUser newUser(String prefix) {
        UUID id = UUID.randomUUID();
        return new DoroUser(id, prefix + "_" + id.toString().substring(0, 8) + "@doro.local", UUID.randomUUID(), 100, "USER");
    }

    private PostSummaryResponse create(DoroUser author, PostStatus status) {
        return postCommands.createPost(author, new CreatePostRequest("제목", null, null, "본문", null, status, null, null));
    }

    private void guardIsDown() {
        doThrow(new DoroGuardUnavailableException("down", new RuntimeException("boom")))
                .when(guardClient).checkOrThrow(anyString(), anyString(), anyString(), anyString(), anyString(), any());
        doThrow(new DoroGuardUnavailableException("down", new RuntimeException("boom")))
                .when(guardClient).checkOrThrow(anyString(), anyString(), anyString(), anyString());
    }

    @AfterEach
    void restore() {
        reset(guardClient);
    }

    @Test
    @DisplayName("작성자가 아닌 사람이 비공개 글을 볼 수 있는지 확인하다 Guard 가 장애면 거부가 아니라 장애로 전달한다")
    void postAccessPropagatesOutage() {
        DoroUser author = newUser("pa_author");
        DoroUser reader = newUser("pa_reader");
        Post secret = postRepository.findById(create(author, PostStatus.PRIVATE).id()).orElseThrow();
        guardIsDown();

        assertThatThrownBy(() -> postAccess.canView(secret, reader)).isInstanceOf(DoroGuardUnavailableException.class);
    }

    @Test
    @DisplayName("작성자 본인이나 공개 글은 Guard 를 거치지 않으므로 Guard 가 장애여도 그대로 동작한다")
    void ownerAndPublishedDoNotNeedGuard() {
        DoroUser author = newUser("pa2_author");
        Post secret = postRepository.findById(create(author, PostStatus.PRIVATE).id()).orElseThrow();
        Post open = postRepository.findById(create(author, PostStatus.PUBLISHED).id()).orElseThrow();
        guardIsDown();

        assertThat(postAccess.canView(secret, author)).isTrue();
        assertThat(postAccess.canView(open, newUser("pa2_reader"))).isTrue();
    }

    @Test
    @DisplayName("댓글 삭제 권한을 Guard 로 확인하다 장애가 나면 '권한 없음'이 아니라 장애로 전달한다")
    void commentDeletePropagatesOutage() {
        DoroUser postAuthor = newUser("cd_post");
        DoroUser commenter = newUser("cd_commenter");
        DoroUser stranger = newUser("cd_stranger");
        PostSummaryResponse post = create(postAuthor, PostStatus.PUBLISHED);
        UUID commentId = commentService.createRootComment(post.id(), commenter, new CreateCommentRequest("댓글")).id();
        guardIsDown();

        assertThatThrownBy(() -> commentService.deleteComment(commentId, stranger))
                .isInstanceOf(DoroGuardUnavailableException.class);
    }
}
