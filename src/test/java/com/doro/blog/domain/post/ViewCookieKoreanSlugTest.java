package com.doro.blog.domain.post;

import com.doro.blog.domain.post.dto.PostDtos.CreatePostRequest;
import com.doro.blog.domain.post.dto.PostDtos.PostSummaryResponse;
import com.doro.blog.domain.post.entity.PostStatus;
import com.doro.blog.domain.post.service.PostCommandService;
import com.hunnit_beasts.doro.sdk.domain.DoroUser;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** 한글 슬러그 글을 실제 서버(Tomcat)로 조회해도 조회수 쿠키 때문에 실패하지 않는다. (쿠키 값에는 ASCII 만 쓸 수 있다) */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class ViewCookieKoreanSlugTest {

    @Value("${local.server.port}")
    private int port;
    @Autowired
    private PostCommandService commands;

    @Test
    @DisplayName("한글 슬러그 글: 200 으로 보이고 조회 쿠키가 ASCII 로 발급된다")
    void koreanSlugPostIsServedWithAnAsciiCookie() throws Exception {
        UUID id = UUID.randomUUID();
        DoroUser author = new DoroUser(id, "kor_" + id.toString().substring(0, 8) + "@doro.local", UUID.randomUUID(), 100, "USER");
        PostSummaryResponse post = commands.createPost(author, new CreatePostRequest("한글 제목입니다", null, "요약", "본문", null, PostStatus.PUBLISHED, null, null));
        assertThat(post.slug()).as("한글이 남는 슬러그").matches(".*[가-힣].*");

        String username = author.email().split("@")[0].toLowerCase();
        String path = "/api/v1/posts/@" + username + "/" + URLEncoder.encode(post.slug(), StandardCharsets.UTF_8).replace("+", "%20");
        HttpResponse<String> response = HttpClient.newHttpClient().send(
                HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + path)).GET().build(), HttpResponse.BodyHandlers.ofString());

        assertThat(response.statusCode()).isEqualTo(200);
        String setCookie = response.headers().allValues("Set-Cookie").stream().filter(h -> h.startsWith("post_view=")).findFirst().orElse(null);
        assertThat(setCookie).isNotNull();
        assertThat(setCookie.chars().allMatch(c -> c < 0x80)).as("쿠키 헤더는 ASCII 만").isTrue();
    }
}
