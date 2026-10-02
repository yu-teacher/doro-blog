package com.doro.blog.infra.guard;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class BlogSchemaMergerTest {

    private static final String PLATFORM = """
            # Doro Guard Standard Zanzibar Schema DSL
            type user {
              relation manager: user | system#admin
            }

            type system {
              relation admin: user
            }
            """;

    private static final String BLOG = """
            # DORO Blog
            type blog_post {
              relation author: user
              relation editor: author
            }

            type blog_user {
              relation follower: user
            }
            """;

    @Test
    @DisplayName("Guard 에 없는 블로그 타입만 덧붙이고, 기존 스키마는 한 글자도 바꾸지 않는다")
    void appendsOnlyMissingTypesAndKeepsTheExistingSchemaUntouched() {
        String active = PLATFORM + "\ntype blog_post {\n  relation author: user\n  relation editor: author\n}\n";

        BlogSchemaMerger.Result result = BlogSchemaMerger.merge(active, BLOG);

        assertThat(result.addedTypes()).containsExactly("blog_user");
        assertThat(result.changed()).isTrue();
        assertThat(result.mergedDsl()).startsWith(active.stripTrailing());
        assertThat(result.mergedDsl()).contains("type blog_user {").contains("relation follower: user");
        assertThat(result.mergedDsl().split("type blog_post \\{", -1)).hasSize(2); // blog_post 가 중복되지 않는다
    }

    @Test
    @DisplayName("블로그 타입이 모두 이미 있으면 아무 것도 하지 않는다 (재기동할 때마다 스키마 버전이 늘어나면 안 된다)")
    void doesNothingWhenEveryBlogTypeIsAlreadyPresent() {
        String active = PLATFORM + "\n" + BLOG;

        BlogSchemaMerger.Result result = BlogSchemaMerger.merge(active, BLOG);

        assertThat(result.changed()).isFalse();
        assertThat(result.addedTypes()).isEmpty();
        assertThat(result.mergedDsl()).isEqualTo(active);
    }

    @Test
    @DisplayName("한 번 병합한 결과에 다시 병합하면 변화가 없다 (멱등)")
    void mergingTwiceIsIdempotent() {
        BlogSchemaMerger.Result first = BlogSchemaMerger.merge(PLATFORM, BLOG);
        assertThat(first.addedTypes()).containsExactly("blog_post", "blog_user");

        BlogSchemaMerger.Result second = BlogSchemaMerger.merge(first.mergedDsl(), BLOG);
        assertThat(second.changed()).isFalse();
    }

    @Test
    @DisplayName("이름이 접두사로만 겹치는 타입(blog_post_archive)을 blog_post 가 있는 것으로 착각하지 않는다")
    void prefixOfAnotherTypeNameIsNotAMatch() {
        String active = PLATFORM + "\ntype blog_post_archive {\n  relation author: user\n}\n";

        BlogSchemaMerger.Result result = BlogSchemaMerger.merge(active, BLOG);

        assertThat(result.addedTypes()).containsExactly("blog_post", "blog_user");
    }

    @Test
    @DisplayName("활성 스키마에 같은 이름의 블로그 타입이 있지만 내용이 다르면 바꾸지 않고 differing 으로만 알린다")
    void existingTypeWithDifferentContentIsReportedNotOverwritten() {
        String active = PLATFORM + "\ntype blog_post {\n  relation author: user\n}\n\ntype blog_user {\n  relation follower: user\n}\n";

        BlogSchemaMerger.Result result = BlogSchemaMerger.merge(active, BLOG);

        assertThat(result.changed()).isFalse();
        assertThat(result.differingTypes()).containsExactly("blog_post");
        assertThat(result.mergedDsl()).isEqualTo(active);
    }

    @Test
    @DisplayName("공백/주석 차이만 있는 같은 타입은 다른 것으로 보지 않는다")
    void whitespaceAndCommentOnlyDifferencesAreIgnored() {
        String active = PLATFORM + "\ntype blog_post {\n    # 작성자\n    relation author:   user\n  relation editor: author\n}\n\ntype blog_user {\n relation follower: user\n}\n";

        BlogSchemaMerger.Result result = BlogSchemaMerger.merge(active, BLOG);

        assertThat(result.differingTypes()).isEmpty();
        assertThat(result.changed()).isFalse();
    }

    @Test
    @DisplayName("활성 스키마가 비어 있으면 블로그 타입 전부를 등록한다")
    void emptyActiveSchemaRegistersEverything() {
        BlogSchemaMerger.Result result = BlogSchemaMerger.merge("", BLOG);

        assertThat(result.addedTypes()).containsExactly("blog_post", "blog_user");
        assertThat(BlogSchemaMerger.merge(null, BLOG).addedTypes()).containsExactly("blog_post", "blog_user");
    }
}
