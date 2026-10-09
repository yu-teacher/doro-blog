package com.doro.blog.domain.apikey;

import com.doro.blog.domain.apikey.entity.ApiKey;
import com.doro.blog.domain.apikey.security.ApiKeyAuthFilter;
import com.doro.blog.domain.apikey.service.ApiKeyService;
import com.doro.blog.domain.user.entity.BlogUser;
import com.hunnit_beasts.doro.sdk.domain.DoroUserContext;
import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** 사용 기록 저장이 실패해도 요청을 처리한 스레드에 키 소유자의 신원이 남아 다음 요청으로 새면 안 된다. */
class ApiKeyFilterContextCleanupTest {

    @AfterEach
    void cleanUp() {
        DoroUserContext.clear();
    }

    @Test
    @DisplayName("사용 기록 저장이 예외를 던져도 사용자 컨텍스트는 비워진다")
    void contextIsClearedWhenRecordLogFails() throws Exception {
        ApiKeyService service = mock(ApiKeyService.class);
        ApiKey key = mock(ApiKey.class);
        BlogUser owner = mock(BlogUser.class);
        UUID ownerId = UUID.randomUUID();
        when(owner.getId()).thenReturn(ownerId);
        when(owner.getEmail()).thenReturn("owner@doro.local");
        when(key.getUser()).thenReturn(owner);
        when(key.getId()).thenReturn(UUID.randomUUID());
        when(service.validateAndUseApiKey(anyString())).thenReturn(Optional.of(key));
        doThrow(new IllegalStateException("log insert failed")).when(service)
                .recordLog(any(), any(), anyString(), anyString(), anyInt(), anyString(), any(), anyLong(), any());

        ApiKeyAuthFilter filter = new ApiKeyAuthFilter(service);
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/posts/me");
        request.addHeader("X-API-Key", "doro_live_" + "a".repeat(48));
        FilterChain chain = (req, res) -> {
            // 요청 처리 중에는 키 소유자로 인증돼 있다
            assertThat(DoroUserContext.getCurrentUser().isAuthenticated()).isTrue();
        };

        try {
            filter.doFilter(request, new MockHttpServletResponse(), chain);
        } catch (RuntimeException ignored) {
            // 기록 실패가 요청을 실패시키든 말든, 아래 단정(컨텍스트 정리)이 이 테스트의 관심사다
        }

        assertThat(DoroUserContext.getCurrentUser().isAuthenticated())
                .as("필터를 빠져나온 뒤에도 키 소유자가 스레드에 남아 있다").isFalse();
    }
}
