package com.doro.blog.domain.auth;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.net.URI;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

/**
 * 로그인 후 돌아갈 경로는 콜백에서 URI 로 만들어 302 로 보낸다. 사이트 경로로는 허용되지만 URI 문법에 맞지 않는 값(공백, |, ", {, %zz …)이
 * 통과하면 세션이 이미 저장된 뒤에 URI 생성이 실패해 로그인이 깨진다. 허용하는 값은 항상 유효한 URI 여야 한다.
 */
class ReturnPathUriValidityTest {

    @Test
    @DisplayName("safeReturnPath 가 돌려주는 값은 어떤 입력이든 URI 로 만들 수 있다")
    void alwaysProducesAValidUri() {
        String[] inputs = {"/a b", "/q?x=a|b", "/x%zz", "/a\"b", "/{x}", "/a<b>", "/a^b", "/a`b", "/한글 경로", "/search?q=한글&page=1", "/ok/path?x=1#h"};
        for (String input : inputs) {
            String safe = BffAuthService.safeReturnPath(input);
            assertThatCode(() -> URI.create(safe)).as("입력 %s -> %s", input, safe).doesNotThrowAnyException();
            assertThat(safe).startsWith("/").doesNotStartWith("//");
        }
    }
}
