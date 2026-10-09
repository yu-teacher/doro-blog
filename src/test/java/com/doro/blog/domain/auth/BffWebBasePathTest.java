package com.doro.blog.domain.auth;

import com.doro.blog.domain.user.service.BlogUserService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

/**
 * 블로그를 공개 하위 경로(예: /blog)에 마운트할 때 BFF 가 브라우저에 내려주는 값이 그 경로를 따르는지 확인한다.
 * 로그인 시도 쿠키의 Path 가 공개 콜백 경로(/blog/api/v1/bff)와 다르면 브라우저가 콜백에 쿠키를 보내지 않아 로그인이 실패한다.
 */
class BffWebBasePathTest {

    private static BffProperties props(String basePath) {
        BffProperties props = new BffProperties();
        props.setWebBasePath(basePath);
        return props;
    }

    @ParameterizedTest(name = "기준 경로 [{0}] -> 웹 경로 [{1}], 쿠키 Path [{2}]")
    @CsvSource(value = {"'' , / , /api/v1/bff", "/blog , /blog/ , /blog/api/v1/bff", "/blog/ , /blog/ , /blog/api/v1/bff"})
    @DisplayName("공개 경로 설정이 웹 경로와 로그인 시도 쿠키 Path 를 만든다")
    void derivesPaths(String base, String expectedRoot, String expectedCookiePath) {
        BffProperties props = props(base == null ? "" : base.trim());
        assertThat(props.webPath("/")).isEqualTo(expectedRoot.trim());
        assertThat(props.loginCookiePath()).isEqualTo(expectedCookiePath.trim());
    }

    @Test
    @DisplayName("공개 경로를 설정하지 않으면(null 포함) 지금과 같은 루트 기준이다")
    void defaultsToRoot() {
        BffProperties unset = new BffProperties();
        assertThat(unset.webPath("/")).isEqualTo("/");
        assertThat(unset.loginCookiePath()).isEqualTo("/api/v1/bff");
        unset.setWebBasePath(null);
        assertThat(unset.webPath("/@alice")).isEqualTo("/@alice");
    }

    private static MockMvc mockMvc(String basePath) {
        BffController controller = new BffController(mock(BffAuthService.class), props(basePath), mock(BlogUserService.class));
        return MockMvcBuilders.standaloneSetup(controller).build();
    }

    @Test
    @DisplayName("사용자가 취소하면 공개 하위 경로의 첫 화면으로 보내고 로그인 시도 쿠키를 그 Path 로 지운다")
    void cancelRedirectsUnderBasePath() throws Exception {
        var response = mockMvc("/blog").perform(get("/api/v1/bff/callback").param("error", "access_denied")).andReturn().getResponse();
        assertThat(response.getHeader("Location")).isEqualTo("/blog/?login_error=cancelled");
        assertThat(response.getHeaders("Set-Cookie")).anySatisfy(cookie ->
                assertThat(cookie).startsWith("doro_blog_login=;").contains("Path=/blog/api/v1/bff").contains("Max-Age=0"));
    }

    @Test
    @DisplayName("루트 마운트에서는 기존과 똑같이 / 로 보내고 /api/v1/bff Path 로 지운다")
    void rootMountKeepsExistingBehavior() throws Exception {
        var response = mockMvc("").perform(get("/api/v1/bff/callback").param("error", "access_denied")).andReturn().getResponse();
        assertThat(response.getHeader("Location")).isEqualTo("/?login_error=cancelled");
        assertThat(response.getHeaders("Set-Cookie")).anySatisfy(cookie -> assertThat(cookie).contains("Path=/api/v1/bff"));
    }
}
