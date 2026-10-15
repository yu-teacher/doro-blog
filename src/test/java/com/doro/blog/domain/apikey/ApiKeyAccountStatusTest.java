package com.doro.blog.domain.apikey;

import com.doro.blog.domain.apikey.dto.ApiKeyDtos.CreateApiKeyRequest;
import com.doro.blog.domain.apikey.security.AccountStatusChecker;
import com.doro.blog.domain.apikey.security.AccountStatusChecker.Status;
import com.doro.blog.domain.apikey.service.ApiKeyService;
import com.hunnit_beasts.doro.sdk.domain.DoroUser;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** 키 소유자의 계정이 정지·탈퇴 유예이면 API 키가 거부되고(403), 확인할 수 없으면 거부된다(503). 정상이면 그대로 통한다. */
@SpringBootTest
@AutoConfigureMockMvc
class ApiKeyAccountStatusTest {

    private static final String HEADER = "X-API-Key";

    @Autowired private MockMvc mockMvc;
    @Autowired private ApiKeyService apiKeyService;
    @MockitoBean private AccountStatusChecker accountStatus;

    private String issueKey() {
        UUID id = UUID.randomUUID();
        DoroUser owner = new DoroUser(id, "acct_" + id.toString().substring(0, 8) + "@doro.local", UUID.randomUUID(), 100, "USER");
        return apiKeyService.createApiKey(owner, new CreateApiKeyRequest("acct-key", 1)).apiKey();
    }

    private void createPost(String key, int expectedStatus) throws Exception {
        mockMvc.perform(post("/api/v1/posts").header(HEADER, key).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"acct post\",\"content\":\"c\",\"status\":\"DRAFT\"}"))
                .andExpect(status().is(expectedStatus));
    }

    @Test
    @DisplayName("정상 계정의 키는 그대로 통한다")
    void activeAccountKeyWorks() throws Exception {
        when(accountStatus.check(any())).thenReturn(Status.ACTIVE);

        createPost(issueKey(), 200);
    }

    @Test
    @DisplayName("계정이 정지·탈퇴 유예이면 키는 403 이고 글이 만들어지지 않는다(읽기도 막힌다)")
    void inactiveAccountKeyIsRefused() throws Exception {
        String key = issueKey();
        when(accountStatus.check(any())).thenReturn(Status.INACTIVE);

        createPost(key, 403);
        mockMvc.perform(get("/api/v1/posts").header(HEADER, key)).andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("AUTH-403-04"));
    }

    @Test
    @DisplayName("정지가 풀리면 같은 키가 다시 통한다(키를 폐기하지 않는다)")
    void reinstatedAccountKeyWorksAgain() throws Exception {
        String key = issueKey();
        when(accountStatus.check(any())).thenReturn(Status.INACTIVE);
        createPost(key, 403);

        when(accountStatus.check(any())).thenReturn(Status.ACTIVE);
        createPost(key, 200);
    }

    @Test
    @DisplayName("계정 상태를 확인할 수 없으면(IAM 장애이고 이전 판정 없음) 503 으로 거부한다")
    void unavailableStatusIsRefusedWith503() throws Exception {
        String key = issueKey();
        when(accountStatus.check(any())).thenReturn(Status.UNAVAILABLE);

        createPost(key, 503);
        mockMvc.perform(get("/api/v1/posts").header(HEADER, key)).andExpect(jsonPath("$.code").value("AUTH-503-01"));
    }

    @Test
    @DisplayName("틀린 키는 계정 상태와 무관하게 401 이다(상태 확인까지 가지 않는다)")
    void invalidKeyIsStill401() throws Exception {
        when(accountStatus.check(any())).thenReturn(Status.INACTIVE);

        createPost("doro_live_invalid_key_value", 401);
    }
}
