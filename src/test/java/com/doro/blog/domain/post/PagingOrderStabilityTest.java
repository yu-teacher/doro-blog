package com.doro.blog.domain.post;

import com.doro.blog.domain.post.dto.PostDtos.CreatePostRequest;
import com.doro.blog.domain.post.dto.PostDtos.PostSummaryResponse;
import com.doro.blog.domain.post.entity.PostStatus;
import com.doro.blog.domain.post.service.PostCommandService;
import com.doro.blog.domain.post.service.PostQueryService;
import com.hunnit_beasts.doro.sdk.domain.DoroUser;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import com.doro.blog.domain.user.service.UsernamePolicy;

/** 게시 시각이 같은 글이 많아도(일괄 등록, 같은 밀리초의 API 키 등록) 페이지를 넘기며 읽으면 글이 중복되거나 빠지지 않는다. */
@SpringBootTest
class PagingOrderStabilityTest {

    private static final int POSTS = 37;
    private static final int PAGE_SIZE = 10;

    @Autowired private PostCommandService commands;
    @Autowired private PostQueryService queries;
    @Autowired private JdbcTemplate jdbc;

    private DoroUser newUser() {
        UUID id = UUID.randomUUID();
        return new DoroUser(id, "tie_" + id.toString().substring(0, 8) + "@doro.local", UUID.randomUUID(), 100, "USER");
    }

    private Set<UUID> createWithSameTimestamp(DoroUser author, String tag) {
        Set<UUID> ids = new HashSet<>();
        for (int i = 0; i < POSTS; i++) {
            PostSummaryResponse p = commands.createPost(author, new CreatePostRequest(
                    "동점 " + i, null, null, "본문 " + i, null, PostStatus.PUBLISHED, null, List.of(tag)));
            ids.add(p.id());
        }
        // 모든 글의 게시 시각을 똑같이 만든다
        jdbc.update("update posts set published_at = timestamp with time zone '2026-01-01 00:00:00+00', like_count = 0, view_count = 0 where user_id = ?", author.userId());
        return ids;
    }

    private void assertPagesCoverExactly(Set<UUID> expected, java.util.function.IntFunction<List<PostSummaryResponse>> page) {
        Set<UUID> seen = new HashSet<>();
        int total = 0;
        for (int p = 0; p * PAGE_SIZE < POSTS; p++) {
            for (PostSummaryResponse post : page.apply(p)) {
                total++;
                seen.add(post.id());
            }
        }
        assertThat(total).as("페이지를 모두 합친 글 수").isEqualTo(POSTS);
        assertThat(seen).as("중복 없이 모든 글이 한 번씩").isEqualTo(expected);
    }

    @Test
    @DisplayName("사용자 글 목록: 게시 시각이 모두 같아도 페이지마다 겹치거나 빠지는 글이 없다")
    void userPostsPagesAreStable() {
        DoroUser author = newUser();
        String username = UsernamePolicy.generated(author.userId());
        Set<UUID> expected = createWithSameTimestamp(author, "tie" + UUID.randomUUID().toString().substring(0, 8));

        assertPagesCoverExactly(expected, p -> queries.getUserPosts(username, null, null, p, PAGE_SIZE).getContent());
    }

    @Test
    @DisplayName("태그 피드: 게시 시각이 모두 같아도 페이지마다 겹치거나 빠지는 글이 없다 (최신순과 인기순 모두)")
    void tagFeedPagesAreStable() {
        DoroUser author = newUser();
        String tag = "tie" + UUID.randomUUID().toString().substring(0, 8);
        Set<UUID> expected = createWithSameTimestamp(author, tag);

        assertPagesCoverExactly(expected, p -> queries.getFeed("latest", List.of(tag), p, PAGE_SIZE).getContent());
        assertPagesCoverExactly(expected, p -> queries.getFeed("popular", List.of(tag), p, PAGE_SIZE).getContent());
    }

    @Test
    @DisplayName("내 글 목록: 게시 시각이 모두 같아도 페이지마다 겹치거나 빠지는 글이 없다")
    void myPostsPagesAreStable() {
        DoroUser author = newUser();
        Set<UUID> expected = createWithSameTimestamp(author, "tie" + UUID.randomUUID().toString().substring(0, 8));

        assertPagesCoverExactly(expected, p -> queries.getMyPosts(author, PostStatus.PUBLISHED, p, PAGE_SIZE).getContent());
    }
}
