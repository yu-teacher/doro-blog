package com.doro.blog.domain.upload;

import com.doro.blog.common.exception.BlogException;
import com.doro.blog.common.exception.ErrorCode;
import com.doro.blog.domain.upload.security.UploadAuthInterceptor;
import com.hunnit_beasts.doro.sdk.domain.DoroUser;
import com.hunnit_beasts.doro.sdk.domain.DoroUserContext;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class UploadAuthTest {

    private final UploadAuthInterceptor interceptor = new UploadAuthInterceptor();

    @AfterEach
    void clear() {
        DoroUserContext.clear();
    }

    @Test
    @DisplayName("로그인하지 않은 업로드 요청은 컨트롤러(파일 읽기)에 닿기 전에 401 로 거부된다")
    void anonymousIsRejectedBeforeHandler() {
        assertThatThrownBy(() -> interceptor.preHandle(new MockHttpServletRequest(), new MockHttpServletResponse(), new Object()))
                .isInstanceOf(BlogException.class)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.UNAUTHORIZED);
    }

    @Test
    @DisplayName("로그인한 사용자는 통과한다")
    void authenticatedPasses() {
        DoroUserContext.setCurrentUser(new DoroUser(UUID.randomUUID(), "u@doro.local", UUID.randomUUID(), 1, "USER"));

        assertThat(interceptor.preHandle(new MockHttpServletRequest(), new MockHttpServletResponse(), new Object())).isTrue();
    }
}
