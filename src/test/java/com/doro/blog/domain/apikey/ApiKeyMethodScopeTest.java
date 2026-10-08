package com.doro.blog.domain.apikey;

import com.doro.blog.domain.apikey.dto.ApiKeyDtos.CreateApiKeyRequest;
import com.doro.blog.domain.apikey.security.ApiKeyScope;
import com.doro.blog.domain.apikey.service.ApiKeyService;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hunnit_beasts.doro.sdk.domain.DoroUser;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * API 키는 글을 조회·작성·수정하는 자동화용이다(CRU). 유출된 키로 글·시리즈를 지울 수 없도록 삭제는 JWT 로그인으로만 가능하다.
 */
@SpringBootTest
@AutoConfigureMockMvc
class ApiKeyMethodScopeTest {

    private static final String HEADER = "X-API-Key";

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private ApiKeyService apiKeyService;

    private final ObjectMapper objectMapper = new ObjectMapper();

    private String issueKey() {
        UUID id = UUID.randomUUID();
        DoroUser owner = new DoroUser(id, "cru_" + id.toString().substring(0, 8) + "@doro.local", UUID.randomUUID(), 100, "USER");
        return apiKeyService.createApiKey(owner, new CreateApiKeyRequest("cru-key", 1)).apiKey();
    }

    @Test
    @DisplayName("메서드 판별: 조회·작성·수정은 허용하고 삭제와 알 수 없는 메서드는 거부한다")
    void methodAllowlist() {
        for (String ok : new String[]{"GET", "HEAD", "POST", "PUT", "PATCH", "get", "Put"}) {
            assertThat(ApiKeyScope.allowsMethod(ok)).as(ok).isTrue();
        }
        for (String no : new String[]{"DELETE", "delete", "TRACE", "CONNECT", "OPTIONS", "", null}) {
            assertThat(ApiKeyScope.allowsMethod(no)).as(String.valueOf(no)).isFalse();
        }
    }

    @Test
    @DisplayName("키로 글을 작성·조회·수정할 수 있다")
    void keyCanCreateReadAndUpdate() throws Exception {
        String key = issueKey();

        String body = mockMvc.perform(post("/api/v1/posts").header(HEADER, key).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"cru create\",\"content\":\"c\",\"status\":\"DRAFT\"}"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        String postId = objectMapper.readTree(body).path("data").path("id").asText();
        assertThat(postId).isNotBlank();

        mockMvc.perform(get("/api/v1/posts/" + postId).header(HEADER, key)).andExpect(status().isOk());

        mockMvc.perform(put("/api/v1/posts/" + postId).header(HEADER, key).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"cru updated\",\"content\":\"c2\",\"status\":\"DRAFT\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.title").value("cru updated"));
    }

    @Test
    @DisplayName("키로는 글을 삭제할 수 없고(403), 글은 그대로 남아 있다")
    void keyCannotDeletePost() throws Exception {
        String key = issueKey();
        String body = mockMvc.perform(post("/api/v1/posts").header(HEADER, key).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"keep me\",\"content\":\"c\",\"status\":\"DRAFT\"}"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        String postId = objectMapper.readTree(body).path("data").path("id").asText();

        mockMvc.perform(delete("/api/v1/posts/" + postId).header(HEADER, key))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("AUTH-403-03"))
                .andExpect(jsonPath("$.status").value(403));

        mockMvc.perform(get("/api/v1/posts/" + postId).header(HEADER, key)).andExpect(status().isOk());
    }

    @Test
    @DisplayName("시리즈·태그·업로드 삭제도 키로는 거부된다 (대상이 없어도 404 가 아니라 403 — 삭제 시도 자체를 막는다)")
    void keyCannotDeleteAnyResource() throws Exception {
        String key = issueKey();
        for (String path : new String[]{"/api/v1/series/" + UUID.randomUUID(), "/api/v1/tags/x", "/api/v1/uploads/x"}) {
            mockMvc.perform(delete(path).header(HEADER, key))
                    .andExpect(status().isForbidden())
                    .andExpect(jsonPath("$.code").value("AUTH-403-03"));
        }
    }

    @Test
    @DisplayName("삭제 금지는 키 관리 API 의 기존 범위 제한(AUTH-403-02)과 구분되는 코드로 응답한다")
    void deleteDenialHasItsOwnCode() throws Exception {
        String key = issueKey();
        mockMvc.perform(delete("/api/v1/api-keys/" + UUID.randomUUID()).header(HEADER, key))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("AUTH-403-02"));
    }
}
