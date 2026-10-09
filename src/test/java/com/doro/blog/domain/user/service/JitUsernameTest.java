package com.doro.blog.domain.user.service;

import com.doro.blog.domain.user.entity.BlogUser;
import com.hunnit_beasts.doro.sdk.domain.DoroUser;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** 처음 로그인한 사용자의 공개 사용자명(@username, URL 에 노출)에 이메일이 새어 나가지 않는다. */
@SpringBootTest
class JitUsernameTest {

    @Autowired private BlogUserService users;

    @Test
    @DisplayName("처음 로그인하면 이메일 앞부분이 아니라 ID 로 만든 이름이 되고, 다시 불러도 같다")
    void newUserDoesNotGetTheEmailLocalPart() {
        UUID id = UUID.randomUUID();
        String local = "jit-secret-" + id.toString().substring(0, 8);
        DoroUser user = new DoroUser(id, local + "@private-mail.example", UUID.randomUUID(), 7, "USER");

        BlogUser created = users.getOrCreateUser(user);

        assertThat(created.getUsername()).isEqualTo(UsernamePolicy.generated(id));
        assertThat(created.getUsername()).doesNotContain("secret");
        assertThat(created.getNickname()).doesNotContain("secret");
        assertThat(created.getBlogTitle()).doesNotContain("secret");
        assertThat(users.getOrCreateUser(user).getUsername()).isEqualTo(created.getUsername());
    }
}
