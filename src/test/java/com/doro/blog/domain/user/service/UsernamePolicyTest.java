package com.doro.blog.domain.user.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class UsernamePolicyTest {

    private static final String USERNAME_PATTERN = "^[a-z0-9_-]{3,50}$";

    @Test
    @DisplayName("처음 정하는 사용자명은 사용자 ID 에서 만들어, 이메일의 어떤 부분도 담지 않는다")
    void generatedFromTheUserIdOnly() {
        UUID id = UUID.fromString("8f3a1c2d-1111-2222-3333-444455556666");

        assertThat(UsernamePolicy.generated(id)).isEqualTo("user-8f3a1c2d");
    }

    @Test
    @DisplayName("같은 ID 는 늘 같은 이름이고, 다른 ID 는 다른 이름이다")
    void deterministicAndDistinct() {
        UUID a = UUID.randomUUID();
        UUID b = UUID.randomUUID();

        assertThat(UsernamePolicy.generated(a)).isEqualTo(UsernamePolicy.generated(a));
        assertThat(UsernamePolicy.generated(a)).isNotEqualTo(UsernamePolicy.generated(b));
    }

    @Test
    @DisplayName("만들어진 이름은 항상 사용자명 규칙을 지키고 예약어가 아니며, 중복 꼬리표를 붙여도 최대 길이를 넘지 않는다")
    void alwaysValid() {
        for (int i = 0; i < 200; i++) {
            String name = UsernamePolicy.generated(UUID.randomUUID());

            assertThat(name).matches(USERNAME_PATTERN);
            assertThat(UsernamePolicy.isReserved(name)).isFalse();
            assertThat((name + 999_999_999).length()).isLessThanOrEqualTo(UsernamePolicy.MAX_LENGTH);
        }
    }

    @Test
    @DisplayName("예약어(admin, api, write 등)는 선점할 수 없다")
    void reservedWordsAreNotClaimable() {
        assertThat(UsernamePolicy.isReserved("Admin")).isTrue();
        assertThat(UsernamePolicy.isReserved("write")).isTrue();
        assertThat(UsernamePolicy.isReserved("alice")).isFalse();
    }
}
