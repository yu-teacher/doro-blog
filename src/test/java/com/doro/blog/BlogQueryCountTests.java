package com.doro.blog;

import com.doro.blog.domain.post.dto.PostDtos.CreatePostRequest;
import com.doro.blog.domain.post.entity.PostStatus;
import com.doro.blog.domain.post.service.PostService;
import com.hunnit_beasts.doro.sdk.domain.DoroUser;
import jakarta.persistence.EntityManagerFactory;
import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** 목록 API 가 글 수와 무관하게 일정한 개수의 쿼리만 실행하는지 검증한다 (글마다 태그를 조회하던 N+1 방지). */
@SpringBootTest(properties = "spring.jpa.properties.hibernate.generate_statistics=true")
class BlogQueryCountTests {

    private static final int PAGE_SIZE = 50;

    @Autowired
    private PostService postService;

    @Autowired
    private EntityManagerFactory entityManagerFactory;

    private DoroUser mockUser(String prefix) {
        UUID id = UUID.randomUUID();
        return new DoroUser(id, prefix + "_" + id.toString().substring(0, 8) + "@doro.local", UUID.randomUUID(), 100, "USER");
    }

    private void createTaggedPosts(DoroUser author, String tag, int count) {
        for (int i = 0; i < count; i++) {
            postService.createPost(author, new CreatePostRequest(
                    "쿼리수 " + UUID.randomUUID(), null, null, "본문", null, PostStatus.PUBLISHED, null, List.of(tag, "common-" + tag)));
        }
    }

    private long statementsForTagPage(String tag) {
        Statistics stats = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
        stats.clear();
        var page = postService.getFeed("latest", List.of(tag), 0, PAGE_SIZE);
        assertThat(page.getContent()).allSatisfy(p -> assertThat(p.tags()).contains(tag));
        return stats.getPrepareStatementCount();
    }

    @Test
    @DisplayName("태그 목록 조회의 쿼리 수는 한 페이지의 글 수와 무관하다")
    void feedQueryCountDoesNotGrowWithPostCount() {
        DoroUser author = mockUser("author");
        String fewTag = "few" + UUID.randomUUID().toString().substring(0, 8);
        String manyTag = "many" + UUID.randomUUID().toString().substring(0, 8);
        createTaggedPosts(author, fewTag, 2);
        createTaggedPosts(author, manyTag, 12);

        long few = statementsForTagPage(fewTag);
        long many = statementsForTagPage(manyTag);

        assertThat(many).as("2개 글일 때 %d 쿼리, 12개 글일 때 %d 쿼리", few, many).isEqualTo(few);
    }
}
