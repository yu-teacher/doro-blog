package com.doro.blog.common.web;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** 실제 요청 경로(필터 → 컨트롤러 → 예외 핸들러)에서 잘못된 파라미터가 500 이 아닌 400 으로 처리되는지 검증한다. */
@SpringBootTest
@AutoConfigureMockMvc
class RequestParameterValidationTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    @DisplayName("size 가 상한을 넘으면 전체 조회 대신 400")
    void oversizedPageIsRejected() throws Exception {
        mockMvc.perform(get("/api/v1/posts").param("size", String.valueOf(PageLimits.MAX_SIZE + 1)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.error.code").value("COMMON-400-01"));
    }

    @Test
    @DisplayName("size 0 이하, page 음수는 400")
    void nonPositiveSizeAndNegativePageAreRejected() throws Exception {
        mockMvc.perform(get("/api/v1/posts").param("size", "0")).andExpect(status().isBadRequest());
        mockMvc.perform(get("/api/v1/posts").param("page", "-1")).andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("허용 범위의 최대 size 는 정상 처리")
    void maxSizeIsAccepted() throws Exception {
        mockMvc.perform(get("/api/v1/posts").param("size", String.valueOf(PageLimits.MAX_SIZE)))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("UUID 형식이 아닌 경로 변수는 500 이 아니라 400")
    void malformedUuidIs400() throws Exception {
        mockMvc.perform(get("/api/v1/posts/not-a-uuid"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("COMMON-400-01"));
    }

    @Test
    @DisplayName("연관 글 limit 가 상한을 넘으면 400")
    void relatedLimitIsCapped() throws Exception {
        mockMvc.perform(get("/api/v1/posts/@someone/some-slug/related")
                        .param("limit", String.valueOf(PageLimits.MAX_LIMIT + 1)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("필수 쿼리 파라미터(검색어) 누락은 400")
    void missingRequiredQueryIsRejected() throws Exception {
        mockMvc.perform(get("/api/v1/posts/search")).andExpect(status().isBadRequest());
    }
}
