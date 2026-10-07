package com.doro.blog.domain.user.sync;

import com.doro.blog.domain.apikey.dto.ApiKeyDtos.CreateApiKeyRequest;
import com.doro.blog.domain.apikey.service.ApiKeyService;
import com.doro.blog.domain.auth.entity.AuthSession;
import com.doro.blog.domain.auth.repository.AuthSessionRepository;
import com.doro.blog.domain.comment.dto.CommentDtos.CreateCommentRequest;
import com.doro.blog.domain.comment.service.CommentService;
import com.doro.blog.domain.post.dto.PostDtos.CreatePostRequest;
import com.doro.blog.domain.post.dto.PostDtos.PostSummaryResponse;
import com.doro.blog.domain.post.entity.PostStatus;
import com.doro.blog.domain.post.service.PostCommandService;
import com.doro.blog.domain.user.service.FollowService;
import com.doro.blog.domain.user.sync.DoroIamClient.DeletedUser;
import com.doro.blog.domain.user.sync.DoroIamClient.DeletedUsersPage;
import com.hunnit_beasts.doro.sdk.domain.DoroUser;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Doro 에서 영구 탈퇴한 사용자의 블로그 프로필을 익명화하고, 주기 동기화가 안전하게 이어지는지 검증한다. */
@SpringBootTest(properties = "blog.deleted-sync.page-size=2")
class DeletedAccountSyncTest {

    @Autowired private DeletedAccountAnonymizer anonymizer;
    @Autowired private DeletedAccountSync sync;
    @Autowired private IamSyncStateRepository states;
    @Autowired private PostCommandService posts;
    @Autowired private CommentService comments;
    @Autowired private FollowService follows;
    @Autowired private ApiKeyService apiKeys;
    @Autowired private AuthSessionRepository authSessions;
    @Autowired private JdbcTemplate jdbc;
    @MockitoBean private DoroIamClient iam;

    @BeforeEach
    void resetState() {
        reset(iam);
        states.deleteAll();
    }

    private DoroUser newUser(String prefix) {
        UUID id = UUID.randomUUID();
        return new DoroUser(id, prefix + "_" + id.toString().substring(0, 8) + "@doro.local", UUID.randomUUID(), 100, "USER");
    }

    private PostSummaryResponse publish(DoroUser author, String title) {
        return posts.createPost(author, new CreatePostRequest(title, null, null, "본문", null, PostStatus.PUBLISHED, null, null));
    }

    private String fanUsername(DoroUser fan) {
        return publish(fan, "fan 글").username();
    }

    private Map<String, Object> blogUser(UUID id) {
        return jdbc.queryForMap("select * from blog_users where id = ?", id);
    }

    private int count(String sql, Object... args) {
        Integer n = jdbc.queryForObject(sql, Integer.class, args);
        return n == null ? 0 : n;
    }

    // ---------------- 익명화 ----------------

    @Test
    @DisplayName("익명화하면 프로필 개인정보와 본인 전용 데이터는 지워지고, 글·댓글은 남아 작성자가 '탈퇴한 사용자'로 보인다")
    void anonymizeRemovesPersonalDataAndKeepsContent() {
        DoroUser author = newUser("author");
        DoroUser victim = newUser("victim");
        DoroUser follower = newUser("follower");
        var authorPost = publish(author, "남의 글");
        var victimPost = publish(victim, "내 글");
        String oldUsername = victimPost.username();
        comments.createRootComment(authorPost.id(), victim, new CreateCommentRequest("남긴 댓글"));
        follows.followUser(follower, oldUsername);          // follower -> victim
        follows.followUser(victim, authorPost.username());  // victim -> author
        apiKeys.createApiKey(victim, new CreateApiKeyRequest("키", null));
        jdbc.update("update blog_users set bio = '소개', profile_image_url = 'https://img.example/me.png', "
                + "github_url = 'https://github.com/me', public_email = 'me@example.com', about_markdown = '# me' where id = ?",
                victim.userId());
        authSessions.save(new AuthSession("hash-" + victim.userId(), victim.userId(), "enc", Instant.now().plusSeconds(900),
                "enc", Instant.now(), Instant.now().plus(Duration.ofDays(30))));
        assertThat(count("select count(*) from notifications where recipient_id = ?", victim.userId())).isPositive();
        int authorFollowers = count("select follower_count from blog_users where id = ?", author.userId());
        int followerFollowing = count("select following_count from blog_users where id = ?", follower.userId());

        assertThat(anonymizer.anonymize(victim.userId(), Instant.now())).isTrue();

        Map<String, Object> row = blogUser(victim.userId());
        assertThat((String) row.get("username")).isEqualTo("deleted-" + victim.userId().toString().replace("-", ""));
        assertThat((String) row.get("email")).endsWith("@deleted.invalid").doesNotContain(victim.email());
        assertThat(row.get("nickname")).isEqualTo("탈퇴한 사용자");
        assertThat(row.get("bio")).isNull();
        assertThat(row.get("profile_image_url")).isNull();
        assertThat(row.get("github_url")).isNull();
        assertThat(row.get("public_email")).isNull();
        assertThat(row.get("about_markdown")).isNull();
        assertThat(row.get("deleted_at")).isNotNull();
        // 본인 전용 데이터는 삭제
        assertThat(count("select count(*) from api_keys where user_id = ?", victim.userId())).isZero();
        assertThat(count("select count(*) from api_key_logs where user_id = ?", victim.userId())).isZero();
        assertThat(count("select count(*) from auth_sessions where user_id = ?", victim.userId())).isZero();
        assertThat(count("select count(*) from notifications where recipient_id = ?", victim.userId())).isZero();
        assertThat(count("select count(*) from user_follows where follower_id = ? or following_id = ?", victim.userId(), victim.userId())).isZero();
        // 상대방의 팔로우 수는 맞춰진다
        assertThat(count("select follower_count from blog_users where id = ?", author.userId())).isEqualTo(authorFollowers - 1);
        assertThat(count("select following_count from blog_users where id = ?", follower.userId())).isEqualTo(followerFollowing - 1);
        // 글·댓글은 남는다
        assertThat(count("select count(*) from posts where user_id = ? and status = 'PUBLISHED'", victim.userId())).isEqualTo(1);
        assertThat(count("select count(*) from comments where user_id = ?", victim.userId())).isEqualTo(1);
        assertThat(oldUsername).isNotEqualTo(row.get("username"));
    }

    @Test
    @DisplayName("다른 사람 알림에 복사된 글 작성자 사용자명도 새 사용자명으로 바뀌어 링크가 깨지지 않는다")
    void notificationLinksFollowTheRenamedAuthor() {
        DoroUser author = newUser("linkauthor");
        DoroUser fan = newUser("fan");
        var post = publish(author, "링크 글");
        String oldUsername = post.username();
        // 익명화 대상의 알림함은 비워지므로, 남아 있어야 하는 '다른 사람'(fan)의 알림함에 있는 알림으로 검증한다.
        follows.followUser(author, fanUsername(fan));
        jdbc.update("update notifications set target_username = ? where recipient_id = ?", oldUsername, fan.userId());
        assertThat(count("select count(*) from notifications where recipient_id = ?", fan.userId())).isPositive();

        anonymizer.anonymize(author.userId(), Instant.now());

        assertThat(count("select count(*) from notifications where target_username = ?", oldUsername)).isZero();
        assertThat(count("select count(*) from notifications where target_username = ?",
                "deleted-" + author.userId().toString().replace("-", ""))).isPositive();
    }

    @Test
    @DisplayName("이미 익명화했거나 블로그에 없는 사용자에게 다시 호출해도 아무것도 바꾸지 않는다")
    void anonymizeIsIdempotent() {
        DoroUser user = newUser("idem");
        publish(user, "글");

        assertThat(anonymizer.anonymize(user.userId(), Instant.now())).isTrue();
        Object firstDeletedAt = blogUser(user.userId()).get("deleted_at");
        assertThat(anonymizer.anonymize(user.userId(), Instant.now().plusSeconds(60))).isFalse();

        assertThat(blogUser(user.userId()).get("deleted_at")).isEqualTo(firstDeletedAt);
        assertThat(anonymizer.anonymize(UUID.randomUUID(), Instant.now())).isFalse();
    }

    // ---------------- 주기 동기화 ----------------

    @Test
    @DisplayName("동기화는 Doro 목록의 사용자를 익명화하고 기준 시각을 저장한다")
    void syncAnonymizesListedUsersAndStoresTheCursor() {
        DoroUser user = newUser("synced");
        publish(user, "글");
        Instant deletedAt = Instant.now();
        when(iam.fetchDeletedUsers(any(), anyInt())).thenReturn(
                new DeletedUsersPage(List.of(new DeletedUser(user.userId(), deletedAt)), deletedAt));

        assertThat(sync.sync()).isEqualTo(1);

        assertThat(blogUser(user.userId()).get("deleted_at")).isNotNull();
        assertThat(states.findById(DeletedAccountSync.STATE_NAME)).isPresent();
        assertThat(states.findById(DeletedAccountSync.STATE_NAME).orElseThrow().getCursorAt()).isBefore(deletedAt);
    }

    @Test
    @DisplayName("Doro 목록이 여러 페이지면 끝까지 따라가고, 블로그 사용자가 아닌 ID 는 무시한다")
    void syncFollowsPages() {
        DoroUser a = newUser("pagea");
        DoroUser b = newUser("pageb");
        DoroUser c = newUser("pagec");
        publish(a, "a");
        publish(b, "b");
        publish(c, "c");
        Instant t1 = Instant.now().minusSeconds(30);
        Instant t2 = Instant.now().minusSeconds(20);
        Instant t3 = Instant.now().minusSeconds(10);
        when(iam.fetchDeletedUsers(any(), anyInt()))
                .thenReturn(new DeletedUsersPage(List.of(new DeletedUser(a.userId(), t1), new DeletedUser(UUID.randomUUID(), t2)), t2))
                .thenReturn(new DeletedUsersPage(List.of(new DeletedUser(b.userId(), t2), new DeletedUser(c.userId(), t3)), t3))
                .thenReturn(new DeletedUsersPage(List.of(), t3));

        assertThat(sync.sync()).isEqualTo(3);

        verify(iam, times(3)).fetchDeletedUsers(any(), anyInt());
        for (DoroUser u : List.of(a, b, c)) {
            assertThat(blogUser(u.userId()).get("deleted_at")).isNotNull();
        }
    }

    @Test
    @DisplayName("Doro 에 닿지 못하면 예외로 알리고 아무것도 바꾸지 않으며, 예약 실행은 예외를 밖으로 내지 않는다")
    void syncSurvivesIamOutage() {
        DoroUser user = newUser("outage");
        publish(user, "글");
        when(iam.fetchDeletedUsers(any(), anyInt())).thenThrow(new IllegalStateException("iam down"));

        assertThatThrownBy(() -> sync.sync()).isInstanceOf(IllegalStateException.class);
        sync.scheduledRun();

        assertThat(blogUser(user.userId()).get("deleted_at")).isNull();
        assertThat(states.findById(DeletedAccountSync.STATE_NAME)).isEmpty();
    }

    @Test
    @DisplayName("중간 페이지에서 실패하면 이미 처리한 페이지까지만 진행되고, 다음 실행이 이어서 처리한다")
    void syncResumesAfterAPartialFailure() {
        DoroUser a = newUser("resumea");
        DoroUser b = newUser("resumeb");
        publish(a, "a");
        publish(b, "b");
        Instant t1 = Instant.now().minusSeconds(20);
        Instant t2 = Instant.now().minusSeconds(10);
        when(iam.fetchDeletedUsers(any(), anyInt()))
                .thenReturn(new DeletedUsersPage(List.of(new DeletedUser(a.userId(), t1), new DeletedUser(UUID.randomUUID(), t1)), t1))
                .thenThrow(new IllegalStateException("iam down"));
        assertThatThrownBy(() -> sync.sync()).isInstanceOf(IllegalStateException.class);
        assertThat(blogUser(a.userId()).get("deleted_at")).isNotNull();
        assertThat(blogUser(b.userId()).get("deleted_at")).isNull();

        reset(iam);
        when(iam.fetchDeletedUsers(any(), anyInt())).thenReturn(
                new DeletedUsersPage(List.of(new DeletedUser(a.userId(), t1), new DeletedUser(b.userId(), t2)), t2));
        assertThat(sync.sync()).isEqualTo(1); // a 는 이미 처리돼 다시 세지 않는다

        assertThat(blogUser(b.userId()).get("deleted_at")).isNotNull();
    }
}
