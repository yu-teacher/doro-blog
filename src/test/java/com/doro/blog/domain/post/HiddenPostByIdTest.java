package com.doro.blog.domain.post;

import com.doro.blog.domain.apikey.dto.ApiKeyDtos.CreateApiKeyRequest;
import com.doro.blog.domain.apikey.service.ApiKeyService;
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

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 볼 수 없는 글(임시저장·비공개)은 글 ID 로 접근해도 존재 여부가 드러나지 않는다: 없는 ID 와 똑같은 404.
 * 볼 수 있는 사람(작성자)이 출간되지 않은 글에 좋아요·댓글을 시도하는 경우만 "발행된 글에만 가능"이라는 403 을 받는다.
 */
@SpringBootTest
@AutoConfigureMockMvc
class HiddenPostByIdTest {

    private static final String HEADER = "X-API-Key";

    @Autowired private MockMvc mockMvc;
    @Autowired private PostCommandService postCommands;
    @Autowired private ApiKeyService apiKeyService;

    private DoroUser newUser(String prefix) {
        UUID id = UUID.randomUUID();
        return new DoroUser(id, prefix + "_" + id.toString().substring(0, 8) + "@doro.local", UUID.randomUUID(), 100, "USER");
    }

    private String keyOf(DoroUser user) {
        return apiKeyService.createApiKey(user, new CreateApiKeyRequest("hidden-by-id", 1)).apiKey();
    }

    private PostSummaryResponse draftOf(DoroUser author) {
        return postCommands.createPost(author, new CreatePostRequest("초안", null, "요약", "본문", null, PostStatus.DRAFT, null, null));
    }

    private static String withoutTimestamp(String body) {
        return body.replaceAll("\"timestamp\":\"[^\"]*\"", "");
    }

    private String bodyOf(org.springframework.test.web.servlet.ResultActions actions) throws Exception {
        return actions.andReturn().getResponse().getContentAsString();
    }

    @Test
    @DisplayName("임시저장 글을 ID 로 조회하면 비로그인·다른 사용자 모두 없는 ID 와 똑같은 404")
    void draftByIdLooksLikeMissing() throws Exception {
        DoroUser author = newUser("idauthor");
        PostSummaryResponse draft = draftOf(author);
        String stranger = keyOf(newUser("idstranger"));

        String missing = bodyOf(mockMvc.perform(get("/api/v1/posts/" + UUID.randomUUID())).andExpect(status().isNotFound()));
        String anonymous = bodyOf(mockMvc.perform(get("/api/v1/posts/" + draft.id())).andExpect(status().isNotFound()));
        String other = bodyOf(mockMvc.perform(get("/api/v1/posts/" + draft.id()).header(HEADER, stranger)).andExpect(status().isNotFound()));

        assertThat(withoutTimestamp(anonymous)).isEqualTo(withoutTimestamp(missing));
        assertThat(withoutTimestamp(other)).isEqualTo(withoutTimestamp(missing));
    }

    @Test
    @DisplayName("작성자는 자기 임시저장 글을 ID 로 볼 수 있다")
    void ownerStillSeesOwnDraft() throws Exception {
        DoroUser author = newUser("idowner");
        PostSummaryResponse draft = draftOf(author);

        mockMvc.perform(get("/api/v1/posts/" + draft.id()).header(HEADER, keyOf(author)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.post.id").value(draft.id().toString()));
    }

    @Test
    @DisplayName("다른 사용자가 임시저장 글에 좋아요·댓글을 시도하면 없는 글과 같은 404")
    void likeAndCommentOnHiddenPostLookLikeMissing() throws Exception {
        DoroUser author = newUser("actauthor");
        PostSummaryResponse draft = draftOf(author);
        String stranger = keyOf(newUser("actstranger"));
        String commentBody = "{\"content\":\"hi\"}";

        for (String suffix : new String[]{"/likes", "/comments"}) {
            String missing = bodyOf(mockMvc.perform(post("/api/v1/posts/" + UUID.randomUUID() + suffix).header(HEADER, stranger)
                    .contentType(MediaType.APPLICATION_JSON).content(commentBody)).andExpect(status().isNotFound()));
            String hidden = bodyOf(mockMvc.perform(post("/api/v1/posts/" + draft.id() + suffix).header(HEADER, stranger)
                    .contentType(MediaType.APPLICATION_JSON).content(commentBody)).andExpect(status().isNotFound()));
            assertThat(withoutTimestamp(hidden)).as(suffix).isEqualTo(withoutTimestamp(missing));
        }
    }

    @Test
    @DisplayName("작성자 본인이 자기 임시저장 글에 좋아요·댓글을 시도하면 이유를 알려 주는 403 (본인은 글이 있다는 걸 이미 안다)")
    void ownerGetsAnExplanatory403() throws Exception {
        DoroUser author = newUser("selfact");
        PostSummaryResponse draft = draftOf(author);
        String key = keyOf(author);

        mockMvc.perform(post("/api/v1/posts/" + draft.id() + "/likes").header(HEADER, key)).andExpect(status().isForbidden());
        mockMvc.perform(post("/api/v1/posts/" + draft.id() + "/comments").header(HEADER, key)
                .contentType(MediaType.APPLICATION_JSON).content("{\"content\":\"hi\"}")).andExpect(status().isForbidden());
    }
}
