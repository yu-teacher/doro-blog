package com.doro.blog.domain.auth;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.ApplicationContext;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Arrays;
import java.util.Objects;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 로그인·세션·토큰 갱신은 별도 BFF(doro-bff)가 하고, 이 서비스에는 BFF 코드가 돌지 않는다(설정 없이 기본이 이렇다).
 * 서비스는 게이트웨이가 붙여 주는 Bearer 만 검증하므로, 쿠키만 보내면 익명이다.
 */
@SpringBootTest
@AutoConfigureMockMvc
class BffGatewayModeTest {

    /** Doro SDK 의 최상위 패키지. 예전 내장 BFF 는 그 아래 bff 패키지에 있었다(클래스를 직접 참조하지 않아야 SDK 에서 사라진 뒤에도 이 시험이 그대로 돈다). */
    private static final String SDK_PACKAGE = "com.hunnit_beasts.doro.sdk";

    @Autowired private ApplicationContext context;
    @Autowired private MockMvc mockMvc;

    @Test
    @DisplayName("SDK 의 내장 BFF 구성 요소(저장소·컨트롤러·세션 필터)가 하나도 만들어지지 않는다")
    void noEmbeddedBffBeans() {
        assertThat(Arrays.stream(context.getBeanDefinitionNames())
                .map(context::getType)
                .filter(Objects::nonNull)
                .map(Class::getPackageName)
                .filter(pkg -> pkg.startsWith(SDK_PACKAGE) && pkg.endsWith(".bff")))
                .isEmpty();
    }

    @Test
    @DisplayName("로그인 경로는 이 서비스에 없다(게이트웨이가 BFF 로 보낸다)")
    void loginIsNotServedHere() throws Exception {
        mockMvc.perform(get("/api/v1/bff/login")).andExpect(status().is4xxClientError());
    }

    @Test
    @DisplayName("세션 조회는 여전히 이 서비스가 제공하고, Bearer 가 없으면 익명이다(쿠키는 이 서비스가 해석하지 않는다)")
    void sessionEndpointIsAnonymousWithoutBearer() throws Exception {
        mockMvc.perform(get("/api/v1/bff/session").cookie(new jakarta.servlet.http.Cookie("doro_blog_session", "whatever")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.authenticated").value(false));
    }
}
