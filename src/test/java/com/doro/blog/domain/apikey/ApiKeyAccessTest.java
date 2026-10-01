package com.doro.blog.domain.apikey;

import com.doro.blog.domain.apikey.dto.ApiKeyDtos.CreateApiKeyRequest;
import com.doro.blog.domain.apikey.security.ApiKeyScope;
import com.doro.blog.domain.apikey.service.ApiKeyService;
import com.hunnit_beasts.doro.sdk.domain.DoroUser;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class ApiKeyAccessTest {

    private static final String HEADER = "X-API-Key";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ApiKeyService apiKeyService;

    private String issueKey() {
        UUID id = UUID.randomUUID();
        DoroUser owner = new DoroUser(id, "keyowner_" + id.toString().substring(0, 8) + "@doro.local", UUID.randomUUID(), 100, "USER");
        return apiKeyService.createApiKey(owner, new CreateApiKeyRequest("test-key", 1)).apiKey();
    }

    @Test
    @DisplayName("범위 판별: 발행 관련 경로만 허용하고 관리 경로는 거부한다")
    void scopeAllowlist() {
        assertThat(ApiKeyScope.allows("/api/v1/posts")).isTrue();
        assertThat(ApiKeyScope.allows("/api/v1/posts/me")).isTrue();
        assertThat(ApiKeyScope.allows("/api/v1/series/abc")).isTrue();
        assertThat(ApiKeyScope.allows("/api/v1/uploads")).isTrue();
        assertThat(ApiKeyScope.allows("/api/v1/api-keys")).isFalse();
        assertThat(ApiKeyScope.allows("/api/v1/users/me")).isFalse();
        assertThat(ApiKeyScope.allows("/api/v1/notifications")).isFalse();
        // 접두어만 같은 다른 경로(/api/v1/postsXYZ)나 경로 조작은 허용하지 않는다
        assertThat(ApiKeyScope.allows("/api/v1/posts-admin")).isFalse();
        assertThat(ApiKeyScope.allows(null)).isFalse();
    }

    @Test
    @DisplayName("유효한 API 키로 글 API 는 인증되지만, 키 관리 API 로 새 키를 만들거나 폐기할 수는 없다")
    void keyCannotManageKeys() throws Exception {
        String key = issueKey();

        mockMvc.perform(get("/api/v1/posts/me").header(HEADER, key)).andExpect(status().isOk());

        mockMvc.perform(post("/api/v1/api-keys").header(HEADER, key)
                        .contentType("application/json").content("{\"name\":\"minted\",\"expireDays\":30}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("AUTH-403-02"))
                .andExpect(jsonPath("$.status").value(403));
        mockMvc.perform(get("/api/v1/api-keys").header(HEADER, key)).andExpect(status().isForbidden());
        mockMvc.perform(delete("/api/v1/api-keys/" + UUID.randomUUID()).header(HEADER, key)).andExpect(status().isForbidden());
        mockMvc.perform(get("/api/v1/users/me").header(HEADER, key)).andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("잘못된 API 키는 표준 오류 형식의 401")
    void invalidKeyIs401() throws Exception {
        mockMvc.perform(get("/api/v1/posts/me").header(HEADER, "doro_live_" + "0".repeat(48)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.code").value("AUTH-401-02"))
                .andExpect(jsonPath("$.status").value(401))
                .andExpect(jsonPath("$.error.code").value("AUTH-401-02"));
    }
}
