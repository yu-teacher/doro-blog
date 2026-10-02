package com.doro.blog.domain.user.dto;

import com.doro.blog.domain.user.entity.BlogUser;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class UserProfileResponseTest {

    private static final String ACCOUNT_EMAIL = "private.account@example.com";
    private static final String PUBLIC_EMAIL = "contact@example.com";

    private final ObjectMapper mapper = new ObjectMapper().registerModule(new JavaTimeModule());

    private BlogUser user() {
        return BlogUser.builder()
                .id(UUID.randomUUID())
                .username("alice")
                .email(ACCOUNT_EMAIL)
                .nickname("alice")
                .publicEmail(PUBLIC_EMAIL)
                .build();
    }

    private JsonNode json(BlogUserDtos.UserProfileResponse response) {
        return mapper.valueToTree(response);
    }

    @Test
    @DisplayName("공개 프로필 응답에는 IAM 계정 이메일 키가 없고, 공개용 연락처만 있다")
    void publicProfileOmitsAccountEmail() {
        JsonNode body = json(BlogUserDtos.UserProfileResponse.from(user(), null));

        assertThat(body.has("email")).isFalse();
        assertThat(body.toString()).doesNotContain(ACCOUNT_EMAIL);
        assertThat(body.get("publicEmail").asText()).isEqualTo(PUBLIC_EMAIL);
    }

    @Test
    @DisplayName("팔로우 대상 프로필(팔로우 여부 포함)도 계정 이메일을 담지 않는다")
    void followTargetProfileOmitsAccountEmail() {
        JsonNode body = json(BlogUserDtos.UserProfileResponse.from(user(), true));

        assertThat(body.has("email")).isFalse();
        assertThat(body.get("isFollowing").asBoolean()).isTrue();
    }

    @Test
    @DisplayName("본인 프로필 응답에서만 계정 이메일을 돌려준다")
    void ownerProfileIncludesAccountEmail() {
        JsonNode body = json(BlogUserDtos.UserProfileResponse.forOwner(user()));

        assertThat(body.get("email").asText()).isEqualTo(ACCOUNT_EMAIL);
    }
}
