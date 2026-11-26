package com.doro.blog.common.exception;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.HttpMediaTypeNotAcceptableException;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import java.util.List;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 스캐너는 JSON 을 받지 않는 Accept(text/html, image/* 등)로 없는 경로를 찌른다.
 * 그때도 예외 핸들러가 직접 JSON 오류를 돌려줘야 한다. 형식 협상에 실패하면 핸들러가 다시 예외를 던져
 * 스택트레이스가 WARN 으로 남고 응답은 스프링 기본 처리로 넘어간다(운영 로그에서 확인된 현상).
 * DB 없이 돌도록 예외 핸들러와 예외만 던지는 컨트롤러로 실제 MVC 처리 경로를 재현한다.
 */
class NotFoundAcceptHeaderTest {

    @RestController
    static class ThrowingController {
        @GetMapping("/.git/HEAD")
        void missing() throws NoResourceFoundException {
            throw new NoResourceFoundException(HttpMethod.GET, "/.git/HEAD", ".git/HEAD");
        }

        @GetMapping("/not-acceptable")
        void notAcceptable() throws HttpMediaTypeNotAcceptableException {
            throw new HttpMediaTypeNotAcceptableException(List.of(MediaType.APPLICATION_JSON));
        }
    }

    private final MockMvc mockMvc = MockMvcBuilders.standaloneSetup(new ThrowingController())
            .setControllerAdvice(new GlobalExceptionHandler())
            .build();

    @Test
    @DisplayName("JSON 을 받지 않는 Accept 로 없는 경로를 요청해도 핸들러의 404 JSON 으로 응답한다")
    void unknownPathWithNonJsonAccept() throws Exception {
        for (String accept : new String[]{"text/html", "image/png", "application/xml"}) {
            mockMvc.perform(get("/.git/HEAD").accept(accept))
                    .andExpect(status().isNotFound())
                    .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                    .andExpect(jsonPath("$.code").value("NOT_FOUND"));
        }
    }

    @Test
    @DisplayName("받을 수 없는 응답 형식을 요구한 경우(406)도 핸들러 응답이 그대로 나간다")
    void notAcceptableIsAnsweredByHandler() throws Exception {
        mockMvc.perform(get("/not-acceptable").accept(MediaType.IMAGE_PNG))
                .andExpect(status().isNotAcceptable())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.code").value("NOT_ACCEPTABLE"));
    }
}
