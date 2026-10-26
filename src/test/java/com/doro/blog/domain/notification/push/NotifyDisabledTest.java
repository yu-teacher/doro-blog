package com.doro.blog.domain.notification.push;

import com.doro.blog.domain.comment.dto.CommentDtos.CreateCommentRequest;
import com.doro.blog.domain.comment.service.CommentService;
import com.doro.blog.domain.post.dto.PostDtos.CreatePostRequest;
import com.doro.blog.domain.post.entity.PostStatus;
import com.doro.blog.domain.post.service.PostCommandService;
import com.hunnit_beasts.doro.sdk.domain.DoroUser;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** 기본 설정(blog.notify.service-token 없음)에서는 기존 동작이 그대로다: 아웃박스에 쌓지 않고, 알림 서비스를 부르지 않고, 설정 API 는 꺼져 있다. */
@SpringBootTest(properties = "doro.iam.revocation-check=OFF")
@AutoConfigureMockMvc
class NotifyDisabledTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private NotifyOutboxRetrier retrier;
    @Autowired private PostCommandService postCommands;
    @Autowired private CommentService comments;
    @Autowired private com.hunnit_beasts.doro.sdk.security.jwks.JwksKeyProvider jwks;
    @Autowired private NotifyProperties properties;

    private DoroUser newUser() {
        UUID id = UUID.randomUUID();
        return new DoroUser(id, "nd_" + id.toString().substring(0, 8) + "@doro.local", UUID.randomUUID(), 100, "USER");
    }

    @Test
    @DisplayName("토큰이 없으면 꺼져 있다: 알림은 저장되지만 아웃박스 행이 없고 재시도기는 아무것도 하지 않는다")
    void nothingHappensWithoutToken() {
        assertThat(properties.enabled()).isFalse();
        DoroUser author = newUser();
        var post = postCommands.createPost(author, new CreatePostRequest("꺼짐", null, null, "본문", null, PostStatus.PUBLISHED, null, null));
        comments.createRootComment(post.id(), newUser(), new CreateCommentRequest("댓글"));

        assertThat(jdbc.queryForObject("select count(*) from notifications where recipient_id = ?", Integer.class, author.userId())).isEqualTo(1);   // 앱 안 알림은 그대로
        assertThat(jdbc.queryForObject("select count(*) from notify_outbox where recipient_id = ?", Integer.class, author.userId())).isZero();
        assertThat(retrier.processDue()).isEqualTo(new NotifyOutboxRetrier.Result(0, 0, 0));
    }

    @Test
    @DisplayName("설정 조회는 enabled=false 로 답하고, 나머지 푸시 설정 API 는 400 으로 거절한다")
    void settingsApiRefusesWhenOff() throws Exception {
        DoroUser user = newUser();
        PushTestJwt.register(jwks);
        String bearer = PushTestJwt.bearer(user.userId());

        mockMvc.perform(get("/api/v1/push/config").header("Authorization", bearer)).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.enabled").value(false));
        mockMvc.perform(put("/api/v1/push/subscription").header("Authorization", bearer).contentType(MediaType.APPLICATION_JSON)
                .content("{\"endpoint\":\"https://example.test/x\",\"keys\":{\"p256dh\":\"a\",\"auth\":\"b\"}}")).andExpect(status().isBadRequest());
        mockMvc.perform(get("/api/v1/push/preferences").header("Authorization", bearer)).andExpect(status().isBadRequest());
        mockMvc.perform(post("/api/v1/push/test").header("Authorization", bearer)).andExpect(status().isBadRequest());
    }
}
