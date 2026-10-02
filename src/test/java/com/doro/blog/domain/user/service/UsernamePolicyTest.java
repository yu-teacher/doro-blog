package com.doro.blog.domain.user.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class UsernamePolicyTest {

    @Test
    @DisplayName("이메일 로컬파트를 소문자·허용 문자로 정리한다")
    void normalizesLocalPart() {
        assertThat(UsernamePolicy.baseFromEmail("Kim.Min+Test@Example.com", 7)).isEqualTo("kimmintest");
    }

    @Test
    @DisplayName("너무 짧거나 쓸 수 없는 문자뿐이면 user{번호} 로 대체한다")
    void fallsBackWhenTooShortOrEmpty() {
        assertThat(UsernamePolicy.baseFromEmail("ab@example.com", 12)).isEqualTo("user12");
        assertThat(UsernamePolicy.baseFromEmail("한글만@example.com", 3)).isEqualTo("user3");
    }

    @Test
    @DisplayName("이메일이 없어도(null) 예외 없이 user{번호} 를 돌려준다")
    void nullEmailDoesNotThrow() {
        assertThat(UsernamePolicy.baseFromEmail(null, 5)).isEqualTo("user5");
    }

    @Test
    @DisplayName("예약어(admin, api, write 등)는 선점할 수 없다")
    void reservedWordsAreNotClaimable() {
        assertThat(UsernamePolicy.baseFromEmail("admin@example.com", 9)).isEqualTo("user9");
        assertThat(UsernamePolicy.baseFromEmail("WRITE@example.com", 9)).isEqualTo("user9");
        assertThat(UsernamePolicy.isReserved("Admin")).isTrue();
        assertThat(UsernamePolicy.isReserved("alice")).isFalse();
    }

    @Test
    @DisplayName("아주 긴 로컬파트도 중복 꼬리표를 붙여 50자를 넘지 않는 길이로 자른다")
    void longLocalPartIsTruncated() {
        String base = UsernamePolicy.baseFromEmail("a".repeat(200) + "@example.com", 1);

        assertThat(base).hasSize(40);
        assertThat((base + 999_999_999).length()).isLessThanOrEqualTo(UsernamePolicy.MAX_LENGTH);
    }
}
