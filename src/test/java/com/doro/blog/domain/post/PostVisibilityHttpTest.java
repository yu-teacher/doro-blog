package com.doro.blog.domain.post;

import com.doro.blog.domain.apikey.dto.ApiKeyDtos.CreateApiKeyRequest;
import com.doro.blog.domain.apikey.service.ApiKeyService;
import com.doro.blog.domain.comment.dto.CommentDtos.CreateCommentRequest;
import com.doro.blog.domain.comment.service.CommentService;
import com.doro.blog.domain.post.dto.PostDtos.CreatePostRequest;
import com.doro.blog.domain.post.dto.PostDtos.PostSummaryResponse;
import com.doro.blog.domain.post.dto.PostDtos.UpdatePostRequest;
import com.doro.blog.domain.post.entity.PostStatus;
import com.doro.blog.domain.post.service.PostCommandService;
import com.hunnit_beasts.doro.sdk.domain.DoroUser;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import com.doro.blog.domain.user.service.UsernamePolicy;

/** 글의 하위 자원(댓글, 연관 글, 슬러그 조회)이 글의 공개 상태를 따르는지 HTTP 수준에서 검증한다. */
@SpringBootTest
@AutoConfigureMockMvc
class PostVisibilityHttpTest {

    private static final String API_KEY_HEADER = "X-API-Key";

    @Autowired private MockMvc mockMvc;
    @Autowired private PostCommandService postCommands;
    @Autowired private CommentService commentService;
    @Autowired private ApiKeyService apiKeyService;

    private DoroUser newUser(String prefix) {
        UUID id = UUID.randomUUID();
        return new DoroUser(id, prefix + "_" + id.toString().substring(0, 8) + "@doro.local", UUID.randomUUID(), 100, "USER");
    }

    private String username(DoroUser user) {
        return UsernamePolicy.generated(user.userId());
    }

    private String apiKeyOf(DoroUser user) {
        return apiKeyService.createApiKey(user, new CreateApiKeyRequest("visibility-test", 1)).apiKey();
    }

    private static String withoutTimestamp(String body) {
        return body.replaceAll("\"timestamp\":\"[^\"]*\"", "");
    }

    private PostSummaryResponse publishedPostWithComment(DoroUser author, DoroUser commenter) {
        PostSummaryResponse post = postCommands.createPost(author, new CreatePostRequest(
                "공개 글", null, "요약", "본문", null, PostStatus.PUBLISHED, null, List.of("visibility")));
        commentService.createRootComment(post.id(), commenter, new CreateCommentRequest("비밀이 될 댓글"));
        return post;
    }

    private void changeStatus(PostSummaryResponse post, PostStatus status) {
        postCommands.updatePost(post.id(), new UpdatePostRequest(
                post.title(), post.slug(), post.summary(), "본문", null, status, null, List.of("visibility")));
    }

    @Test
    @DisplayName("출간된 글의 댓글·연관 글·슬러그 조회는 비로그인으로도 열린다")
    void publishedPostIsPublic() throws Exception {
        DoroUser author = newUser("pubauthor");
        PostSummaryResponse post = publishedPostWithComment(author, newUser("pubreader"));

        mockMvc.perform(get("/api/v1/posts/{id}/comments", post.id())).andExpect(status().isOk());
        mockMvc.perform(get("/api/v1/posts/@{u}/{slug}/related", username(author), post.slug())).andExpect(status().isOk());
        mockMvc.perform(get("/api/v1/posts/@{u}/{slug}", username(author), post.slug())).andExpect(status().isOk());
    }

    @Test
    @DisplayName("비공개로 바꾼 글: 비로그인·타 사용자는 댓글, 연관 글, 슬러그 조회가 모두 404 이고 작성자는 열린다")
    void privatePostHidesCommentsRelatedAndSlug() throws Exception {
        DoroUser author = newUser("privauthor");
        DoroUser stranger = newUser("stranger");
        PostSummaryResponse post = publishedPostWithComment(author, newUser("privreader"));
        changeStatus(post, PostStatus.PRIVATE);

        String commentsUrl = "/api/v1/posts/" + post.id() + "/comments";
        String relatedUrl = "/api/v1/posts/@" + username(author) + "/" + post.slug() + "/related";
        String slugUrl = "/api/v1/posts/@" + username(author) + "/" + post.slug();

        for (String url : List.of(commentsUrl, relatedUrl, slugUrl)) {
            // 비로그인
            mockMvc.perform(get(url))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.success").value(false))
                    .andExpect(jsonPath("$.code").value("POST-404-01"));
            // 로그인했지만 작성자가 아닌 사용자
            mockMvc.perform(get(url).header(API_KEY_HEADER, apiKeyOf(stranger)))
                    .andExpect(status().isNotFound());
            // 작성자 본인
            mockMvc.perform(get(url).header(API_KEY_HEADER, apiKeyOf(author)))
                    .andExpect(status().isOk());
        }
    }

    @Test
    @DisplayName("임시저장 글의 슬러그는 존재 여부가 드러나지 않는다 (없는 슬러그와 같은 404)")
    void draftSlugDoesNotRevealExistence() throws Exception {
        DoroUser author = newUser("draftauthor");
        PostSummaryResponse draft = postCommands.createPost(author, new CreatePostRequest(
                "초안", null, "요약", "본문", null, PostStatus.DRAFT, null, null));

        String missing = mockMvc.perform(get("/api/v1/posts/@{u}/{slug}", username(author), "no-such-slug"))
                .andExpect(status().isNotFound()).andReturn().getResponse().getContentAsString();
        String hidden = mockMvc.perform(get("/api/v1/posts/@{u}/{slug}", username(author), draft.slug()))
                .andExpect(status().isNotFound()).andReturn().getResponse().getContentAsString();

        // timestamp 는 요청마다 다르므로 비교에서 뺀다
        assertThat(withoutTimestamp(hidden)).isEqualTo(withoutTimestamp(missing));
    }
}
