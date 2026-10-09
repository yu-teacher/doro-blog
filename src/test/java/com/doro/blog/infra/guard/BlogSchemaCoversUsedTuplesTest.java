package com.doro.blog.infra.guard;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 코드가 Guard 에 쓰거나(튜플) 묻는(check, @DoroGuard) 모든 (타입, 릴레이션)이 blog-schema.doro 에 선언돼 있어야 한다.
 * Guard 의 검증 모드가 ENFORCE 가 되면 선언되지 않은 튜플은 거부되고, GuardTuples.writeThen 은 예외를 던져 글/댓글 저장까지
 * 롤백되기 때문이다. (블로그 팔로우가 쓰던 blog_user#follower 가 스키마에 없던 문제를 막는 회귀 테스트)
 */
class BlogSchemaCoversUsedTuplesTest {

    private static final Path SOURCES = Path.of("src/main/java");
    private static final Path SCHEMA = Path.of("src/main/resources/blog-schema.doro");

    /** GuardTuples.Tuple.of("ns", id, "rel", ...), guardTuples.deleteAfterCommit(...), guardClient.writeTuple/deleteTuple(...) */
    private static final Pattern TUPLE_CALL = Pattern.compile(
            "(?:guardTuples\\.deleteAfterCommit|Tuple\\.of|guardClient\\.(?:writeTuple|writeTupleOrThrow|deleteTuple|deleteTupleOrThrow))"
                    + "\\(\\s*\"([a-z_]+)\"\\s*,[^,]+,\\s*\"([a-z_]+)\"");
    /** guardClient.check("ns", id, "rel", ...) */
    private static final Pattern CHECK_CALL = Pattern.compile(
            "guardClient\\.check\\(\\s*\"([a-z_]+)\"\\s*,[^,]+,\\s*\"([a-z_]+)\"");
    /** @DoroGuard(namespace = "ns", object = "...", relation = "rel") */
    private static final Pattern ANNOTATION = Pattern.compile(
            "@DoroGuard\\(\\s*namespace\\s*=\\s*\"([a-z_]+)\"[^)]*?relation\\s*=\\s*\"([a-z_]+)\"");

    private static Set<String> declared() throws IOException {
        Set<String> result = new LinkedHashSet<>();
        String type = null;
        for (String raw : Files.readAllLines(SCHEMA, StandardCharsets.UTF_8)) {
            String line = raw.strip();
            Matcher t = Pattern.compile("^type\\s+([A-Za-z0-9_]+)\\s*\\{$").matcher(line);
            if (t.matches()) {
                type = t.group(1);
                result.add(type + "#");
            } else if (line.equals("}")) {
                type = null;
            } else if (type != null && line.startsWith("relation ")) {
                result.add(type + "#" + line.substring("relation ".length(), line.indexOf(':')).strip());
            }
        }
        return result;
    }

    private static List<String> used() throws IOException {
        List<String> found = new ArrayList<>();
        try (Stream<Path> files = Files.walk(SOURCES)) {
            for (Path file : (Iterable<Path>) files.filter(p -> p.toString().endsWith(".java"))::iterator) {
                String source = Files.readString(file, StandardCharsets.UTF_8);
                for (Pattern pattern : List.of(TUPLE_CALL, CHECK_CALL, ANNOTATION)) {
                    Matcher m = pattern.matcher(source);
                    while (m.find()) {
                        found.add(m.group(1) + "#" + m.group(2) + "  (" + SOURCES.relativize(file) + ")");
                    }
                }
            }
        }
        return found;
    }

    @Test
    @DisplayName("코드가 쓰는 모든 튜플/판정의 타입과 릴레이션이 blog-schema.doro 에 선언돼 있다")
    void everyUsedTupleAndCheckIsDeclaredInTheSchema() throws IOException {
        Set<String> declared = declared();
        List<String> used = used();

        assertThat(used).as("소스에서 Guard 호출을 하나도 찾지 못했다면 이 테스트의 정규식이 깨진 것이다").hasSizeGreaterThan(8);
        List<String> undeclared = used.stream()
                .filter(u -> !declared.contains(u.substring(0, u.indexOf("  ("))))
                .toList();
        assertThat(undeclared).as("스키마에 선언되지 않은 타입/릴레이션").isEmpty();
    }

    @Test
    @DisplayName("팔로우 튜플(blog_user#follower)이 실제로 소스에서 발견되고 스키마에도 있다 (이 테스트가 이전 결함을 잡는지 확인용)")
    void followerTupleIsDetectedAndDeclared() throws IOException {
        assertThat(used()).anyMatch(u -> u.startsWith("blog_user#follower"));
        assertThat(declared()).contains("blog_user#follower");
    }
}
