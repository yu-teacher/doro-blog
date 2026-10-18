package com.doro.blog.domain.user.sync;

import com.doro.blog.domain.comment.dto.CommentDtos.CommentResponse;
import com.doro.blog.domain.comment.dto.CommentDtos.CreateCommentRequest;
import com.doro.blog.domain.comment.service.CommentService;
import com.doro.blog.domain.post.dto.PostDtos.CreatePostRequest;
import com.doro.blog.domain.post.dto.PostDtos.PostSummaryResponse;
import com.doro.blog.domain.post.entity.PostStatus;
import com.doro.blog.domain.post.service.PostCommandService;
import com.doro.blog.domain.user.service.FollowService;
import com.hunnit_beasts.doro.sdk.client.DoroGuardClient;
import com.hunnit_beasts.doro.sdk.exception.DoroGuardWriteFailedException;
import com.hunnit_beasts.doro.sdk.domain.DoroUser;
import com.hunnit_beasts.doro.sdk.sync.DeletedUsersClient;
import com.hunnit_beasts.doro.sdk.sync.DeletedUsersClient.DeletedUser;
import com.hunnit_beasts.doro.sdk.sync.DeletedUsersClient.DeletedUsersPage;
import com.hunnit_beasts.doro.sdk.sync.DeletedUsersSync;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.clearInvocations;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * 영구 탈퇴 동기화가 블로그 데이터를 익명화할 때, 탈퇴한 사용자를 주체로 하는 Guard 튜플(글·댓글 작성자, 팔로우)도 지운다.
 * 지우지 못하면 익명화하지 않고 예외로 알려 다음 주기에 다시 처리한다(익명화가 먼저면 '처리 완료'가 되어 튜플을 다시 못 찾는다).
 */
@SpringBootTest
class DeletedAccountGuardCleanupTest {

    @Autowired private DeletedUsersSync sync;
    @Autowired private IamSyncStateRepository states;
    @Autowired private PostCommandService posts;
    @Autowired private CommentService comments;
    @Autowired private FollowService follows;
    @Autowired private JdbcTemplate jdbc;
    @MockitoBean private DeletedUsersClient iam;
    @MockitoSpyBean private DoroGuardClient guard;

    @BeforeEach
    void resetState() {
        reset(iam);
        states.deleteAll();
    }

    @AfterEach
    void restoreGuard() {
        reset(guard);
    }

    private DoroUser newUser(String prefix) {
        UUID id = UUID.randomUUID();
        return new DoroUser(id, prefix + "_" + id.toString().substring(0, 8) + "@doro.local", UUID.randomUUID(), 100, "USER");
    }

    private PostSummaryResponse publish(DoroUser author, String title) {
        return posts.createPost(author, new CreatePostRequest(title, null, null, "본문", null, PostStatus.PUBLISHED, null, null));
    }

    private void iamReports(DoroUser... users) {
        Instant at = Instant.now();
        List<DeletedUser> items = java.util.Arrays.stream(users).map(u -> new DeletedUser(u.userId(), at)).toList();
        when(iam.fetchDeletedUsers(any(), anyInt())).thenReturn(new DeletedUsersPage(items, at));
    }

    private boolean anonymized(DoroUser u) {
        return jdbc.queryForObject("select deleted_at is not null from blog_users where id = ?", Boolean.class, u.userId());
    }

    private void verifyDeleted(String ns, Object objectId, String relation, Object subjectId) {
        verify(guard, atLeastOnce()).deleteTupleOrThrow(eq(ns), eq(objectId.toString()), eq(relation), eq("user"), eq(subjectId.toString()), any());
    }

    @Test
    @DisplayName("탈퇴 동기화는 글·댓글 작성자 튜플과 양방향 팔로우 튜플을 지우고, 다른 사람의 튜플은 건드리지 않는다")
    void removesTheDeletedUsersTuples() {
        DoroUser victim = newUser("victim");
        DoroUser other = newUser("other");
        DoroUser fan = newUser("fan");
        PostSummaryResponse victimPost = publish(victim, "내 글");
        PostSummaryResponse otherPost = publish(other, "남의 글");
        CommentResponse comment = comments.createRootComment(otherPost.id(), victim, new CreateCommentRequest("댓글"));
        follows.followUser(fan, victimPost.username());          // fan -> victim
        follows.followUser(victim, otherPost.username());        // victim -> other
        clearInvocations(guard);
        iamReports(victim);

        assertThat(sync.sync()).isEqualTo(1);

        assertThat(anonymized(victim)).isTrue();
        verifyDeleted("blog_post", victimPost.id(), "author", victim.userId());
        verifyDeleted("blog_comment", comment.id(), "author", victim.userId());
        verifyDeleted("blog_user", victim.userId(), "follower", fan.userId());
        verify(guard, atLeastOnce()).deleteTupleOrThrow(eq("blog_user"), anyString(), eq("follower"), eq("user"), eq(victim.userId().toString()), any());
        // 다른 사람의 글 작성자 튜플은 지우지 않는다
        verify(guard, never()).deleteTupleOrThrow(eq("blog_post"), eq(otherPost.id().toString()), anyString(), anyString(), anyString(), any());
    }

    @Test
    @DisplayName("Guard 삭제가 실패하면 익명화하지 않고 기준 시각도 나아가지 않으며, 다음 주기에 이어서 처리한다")
    void guardFailureLeavesTheAccountForRetry() {
        DoroUser victim = newUser("retry");
        publish(victim, "글");
        iamReports(victim);
        doThrow(new DoroGuardWriteFailedException("guard down", new RuntimeException()))
                .when(guard).deleteTupleOrThrow(anyString(), anyString(), anyString(), anyString(), anyString(), any());

        assertThatThrownBy(() -> sync.sync()).isInstanceOf(DoroGuardWriteFailedException.class);

        assertThat(anonymized(victim)).isFalse();
        assertThat(states.findAll()).isEmpty();

        reset(guard);
        assertThat(sync.sync()).isEqualTo(1);
        assertThat(anonymized(victim)).isTrue();
    }

    @Test
    @DisplayName("이미 처리했거나 블로그에 없는 사용자가 다시 와도 Guard 를 부르지 않는다")
    void redeliveryDoesNotCallGuard() {
        DoroUser victim = newUser("again");
        publish(victim, "글");
        iamReports(victim);
        assertThat(sync.sync()).isEqualTo(1);
        clearInvocations(guard);

        assertThat(sync.sync()).isZero();
        iamReports(newUser("never-in-blog"));
        assertThat(sync.sync()).isZero();

        verify(guard, never()).deleteTupleOrThrow(anyString(), anyString(), anyString(), anyString(), anyString(), any());
    }
}
