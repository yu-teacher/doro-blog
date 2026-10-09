package com.doro.blog.domain.post;

import com.doro.blog.domain.post.dto.PostDtos.CreatePostRequest;
import com.doro.blog.domain.post.dto.PostDtos.PostSummaryResponse;
import com.doro.blog.domain.post.entity.PostStatus;
import com.doro.blog.domain.post.service.PostCommandService;
import com.hunnit_beasts.doro.sdk.domain.DoroUser;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** 로그인하지 않고 글·시리즈·댓글·답글을 만들려 하면 500 이 아니라 401 이다(Guard 쓰기 순서를 바꾼 뒤 생긴 회귀의 방지). */
@SpringBootTest
@AutoConfigureMockMvc
class AnonymousCreateHttpTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private PostCommandService postCommands;

    @Test
    @DisplayName("익명의 글·시리즈·댓글·답글 생성은 모두 401")
    void anonymousCreatesAreUnauthorized() throws Exception {
        UUID authorId = UUID.randomUUID();
        PostSummaryResponse post = postCommands.createPost(
                new DoroUser(authorId, "anon_" + authorId.toString().substring(0, 8) + "@doro.local", UUID.randomUUID(), 100, "USER"),
                new CreatePostRequest("제목", null, null, "본문", null, PostStatus.PUBLISHED, null, null));
        String json = "{\"title\":\"x\",\"content\":\"y\",\"status\":\"DRAFT\"}";

        mockMvc.perform(post("/api/v1/posts").contentType(MediaType.APPLICATION_JSON).content(json)).andExpect(status().isUnauthorized());
        mockMvc.perform(post("/api/v1/series").contentType(MediaType.APPLICATION_JSON).content("{\"title\":\"x\"}")).andExpect(status().isUnauthorized());
        mockMvc.perform(post("/api/v1/posts/" + post.id() + "/comments").contentType(MediaType.APPLICATION_JSON).content("{\"content\":\"hi\"}"))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(post("/api/v1/posts/" + post.id() + "/comments/" + UUID.randomUUID() + "/replies")
                        .contentType(MediaType.APPLICATION_JSON).content("{\"content\":\"hi\"}"))
                .andExpect(status().isUnauthorized());
    }
}
