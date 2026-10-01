package com.doro.blog.common.util;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.HashSet;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class SlugGeneratorTest {

    @Test
    @DisplayName("소문자, 숫자, 한글, '_', '-' 만 남기고 나머지는 '-' 로 바꾼다")
    void sanitizeKeepsAllowedCharacters() {
        assertThat(SlugGenerator.sanitize("  Hello World_1  ")).isEqualTo("hello-world_1");
        assertThat(SlugGenerator.sanitize("스프링 부트")).isEqualTo("스프링-부트");
    }

    @Test
    @DisplayName("쓸 수 있는 글자가 없으면(기호뿐) 빈 문자열")
    void sanitizeOfOnlySymbolsIsEmpty() {
        assertThat(SlugGenerator.sanitize("!!! ???")).isEmpty();
        assertThat(SlugGenerator.sanitize("---")).isEmpty();
    }

    @Test
    @DisplayName("너무 긴 슬러그는 DB 컬럼 길이를 넘지 않게 자른다")
    void sanitizeCapsLength() {
        assertThat(SlugGenerator.sanitize("a".repeat(300)).length()).isLessThanOrEqualTo(100);
    }

    @Test
    @DisplayName("요청한 슬러그가 있으면 그것을, 없으면 제목을 쓴다")
    void uniquePrefersRequestedSlugThenTitle() {
        assertThat(SlugGenerator.unique("My Slug", "제목", "post", s -> false)).isEqualTo("my-slug");
        assertThat(SlugGenerator.unique(null, "Docker Guide", "post", s -> false)).isEqualTo("docker-guide");
        assertThat(SlugGenerator.unique("   ", "Docker Guide", "post", s -> false)).isEqualTo("docker-guide");
    }

    @Test
    @DisplayName("제목이 기호뿐이면 접두어로 대체한다 (예전에는 '---' 슬러그가 만들어졌다)")
    void uniqueFallsBackWhenNothingUsable() {
        assertThat(SlugGenerator.unique(null, "!!!", "post", s -> false)).isEqualTo("post");
    }

    @Test
    @DisplayName("이미 쓰는 슬러그면 무작위 접미사로 겹치지 않는 값을 찾는다")
    void uniqueAddsRandomSuffixOnCollision() {
        Set<String> taken = new HashSet<>(Set.of("docker"));
        String slug = SlugGenerator.unique(null, "docker", "post", taken::contains);
        assertThat(slug).startsWith("docker-").hasSize("docker-".length() + 6);
        assertThat(taken).doesNotContain(slug);
    }

    @Test
    @DisplayName("빈 슬러그를 찾지 못하면 무한히 돌지 않고 실패한다")
    void uniqueGivesUp() {
        assertThatThrownBy(() -> SlugGenerator.unique(null, "docker", "post", s -> true))
                .isInstanceOf(IllegalStateException.class);
    }
}
