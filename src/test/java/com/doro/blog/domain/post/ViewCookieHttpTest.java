package com.doro.blog.domain.post;

import com.doro.blog.domain.apikey.dto.ApiKeyDtos.CreateApiKeyRequest;
import com.doro.blog.domain.apikey.service.ApiKeyService;
import com.doro.blog.domain.post.dto.PostDtos.CreatePostRequest;
import com.doro.blog.domain.post.dto.PostDtos.PostSummaryResponse;
import com.doro.blog.domain.post.entity.PostStatus;
import com.doro.blog.domain.post.service.PostCommandService;
import com.doro.blog.domain.post.service.PostQueryService;
import com.doro.blog.domain.post.service.ViewCookie;
import com.hunnit_beasts.doro.sdk.domain.DoroUser;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import com.doro.blog.domain.user.service.UsernamePolicy;

/** 조회수 쿠키: 중복 조회 방지는 하되, 없는 글에는 쿠키를 만들지 않고, 값이 무한히 늘지 않으며, 작성자 본인의 조회는 세지 않는다. */
@SpringBootTest
@AutoConfigureMockMvc
class ViewCookieHttpTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private PostCommandService commands;
    @Autowired private PostQueryService queries;
    @Autowired private ApiKeyService apiKeyService;

    private DoroUser newUser() {
        UUID id = UUID.randomUUID();
        return new DoroUser(id, "view_" + id.toString().substring(0, 8) + "@doro.local", UUID.randomUUID(), 100, "USER");
    }

    private static String usernameOf(DoroUser u) {
        return UsernamePolicy.generated(u.userId());
    }

    private PostSummaryResponse published(DoroUser author) {
        return commands.createPost(author, new CreatePostRequest("조회 시험", null, "요약", "본문", null, PostStatus.PUBLISHED, null, null));
    }

    private long views(UUID postId, DoroUser viewer) {
        return queries.getPostById(postId, viewer).post().viewCount();
    }

    private static String postViewSetCookie(MockHttpServletResponse response) {
        return response.getHeaders("Set-Cookie").stream().filter(h -> h.startsWith("post_view=")).findFirst().orElse(null);
    }

    @Test
    @DisplayName("없는 글 주소로 요청해도 조회 쿠키를 만들지 않는다")
    void noCookieForMissingPost() throws Exception {
        MockHttpServletResponse response = mockMvc.perform(get("/api/v1/posts/@{u}/{s}", "nobody-here", "no-such-slug"))
                .andReturn().getResponse();

        assertThat(response.getStatus()).isEqualTo(404);
        assertThat(postViewSetCookie(response)).as("없는 글에는 쿠키를 발급하지 않는다").isNull();
    }

    @Test
    @DisplayName("공개 글을 처음 보면 조회수가 1 늘고 HttpOnly 쿠키가 발급되며, 그 쿠키로 다시 보면 늘지 않는다")
    void firstViewCountsOnce() throws Exception {
        DoroUser author = newUser();
        PostSummaryResponse post = published(author);

        MockHttpServletResponse first = mockMvc.perform(get("/api/v1/posts/@{u}/{s}", usernameOf(author), post.slug()))
                .andReturn().getResponse();
        assertThat(first.getStatus()).isEqualTo(200);
        String cookieHeader = postViewSetCookie(first);
        assertThat(cookieHeader).isNotNull().contains("HttpOnly");
        assertThat(views(post.id(), DoroUser.anonymous())).isEqualTo(1);

        String value = cookieHeader.substring("post_view=".length(), cookieHeader.indexOf(';'));
        MockHttpServletResponse second = mockMvc.perform(get("/api/v1/posts/@{u}/{s}", usernameOf(author), post.slug())
                .cookie(new Cookie("post_view", value))).andReturn().getResponse();

        assertThat(second.getStatus()).isEqualTo(200);
        assertThat(views(post.id(), DoroUser.anonymous())).as("같은 쿠키로 다시 봐도 늘지 않는다").isEqualTo(1);
    }

    @Test
    @DisplayName("작성자 본인이 자기 글을 봐도 조회수가 늘지 않는다")
    void authorsOwnViewsAreNotCounted() throws Exception {
        DoroUser author = newUser();
        PostSummaryResponse post = published(author);
        String key = apiKeyService.createApiKey(author, new CreateApiKeyRequest("view-author", 1)).apiKey();

        mockMvc.perform(get("/api/v1/posts/@{u}/{s}", usernameOf(author), post.slug()).header("X-API-Key", key));

        assertThat(views(post.id(), author)).isZero();
    }

    @Test
    @DisplayName("쿠키 값에는 최근에 본 글만 일정 개수까지 남는다 (무한히 늘어 헤더 한도를 넘지 않는다)")
    void cookieValueIsCapped() {
        String value = "";
        for (int i = 0; i < ViewCookie.MAX_ENTRIES + 25; i++) {
            value = ViewCookie.withViewed(value, "user/post-" + i);
        }

        List<String> entries = ViewCookie.entries(value);
        assertThat(entries).hasSize(ViewCookie.MAX_ENTRIES);
        assertThat(entries).contains("user/post-" + (ViewCookie.MAX_ENTRIES + 24)).doesNotContain("user/post-0");
        assertThat(value.length()).isLessThan(3500);
    }

    @Test
    @DisplayName("본 글인지는 항목이 정확히 같을 때만 본 것으로 친다 (이름이 일부만 겹쳐도 다른 글)")
    void alreadyViewedMatchesWholeEntries() {
        String value = ViewCookie.withViewed("", "alice/spring");

        assertThat(ViewCookie.hasViewed(value, "alice/spring")).isTrue();
        assertThat(ViewCookie.hasViewed(value, "alice/spring-boot")).isFalse();
        assertThat(ViewCookie.hasViewed(value, "alice/spri")).isFalse();
        assertThat(ViewCookie.hasViewed(null, "alice/spring")).isFalse();
    }
}
