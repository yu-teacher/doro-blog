package com.doro.blog.domain.notification.push;

import com.doro.blog.domain.comment.dto.CommentDtos.CreateCommentRequest;
import com.doro.blog.domain.comment.dto.CommentDtos.CreateReplyRequest;
import com.doro.blog.domain.comment.service.CommentService;
import com.doro.blog.domain.like.service.PostLikeService;
import com.doro.blog.domain.notification.entity.NotificationType;
import com.doro.blog.domain.notification.service.NotificationService;
import com.doro.blog.domain.post.dto.PostDtos.CreatePostRequest;
import com.doro.blog.domain.post.dto.PostDtos.PostSummaryResponse;
import com.doro.blog.domain.post.entity.PostStatus;
import com.doro.blog.domain.post.repository.PostRepository;
import com.doro.blog.domain.post.service.PostCommandService;
import com.doro.blog.domain.user.repository.BlogUserRepository;
import com.doro.blog.domain.user.service.FollowService;
import com.doro.blog.domain.user.sync.DeletedAccountAnonymizer;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hunnit_beasts.doro.sdk.domain.DoroUser;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 알림 서비스가 켜진 상태(blog.notify.service-token 있음): 알림이 저장될 때 같은 트랜잭션에서 아웃박스에 쌓이고, 재시도기가 알림 서비스에
 * 요청하며, 푸시 설정 API 는 알림 서비스의 위임 API 로 넘어간다. 알림 서비스는 가짜 HTTP 서버로 흉내 낸다.
 */
@SpringBootTest(properties = "doro.iam.revocation-check=OFF")
@AutoConfigureMockMvc
class NotifyCentralTest {

    private record Seen(String method, String path, String token, String userAgent, String body) {
    }

    private static final String TOKEN = "blog-central-token-" + "t".repeat(40);
    private static final List<Seen> SEEN = new CopyOnWriteArrayList<>();
    private static volatile int sendStatus = 200;
    private static volatile String prefsReply = "{\"success\":true,\"data\":{\"apps\":[{\"app\":\"blog\",\"displayName\":\"도로 블로그\",\"types\":["
            + "{\"type\":\"comment\",\"enabled\":false},{\"type\":\"reply\",\"enabled\":true},{\"type\":\"like\",\"enabled\":false}]}]}}";
    private static final HttpServer NOTIFY = startNotify();
    private static final ObjectMapper JSON = new ObjectMapper();

    private static HttpServer startNotify() {
        try {
            HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
            server.createContext("/", exchange -> {
                String path = exchange.getRequestURI().getPath();
                SEEN.add(new Seen(exchange.getRequestMethod(), path, exchange.getRequestHeaders().getFirst("X-Doro-Service-Token"),
                        exchange.getRequestHeaders().getFirst("User-Agent"), new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8)));
                int code = 200;
                String reply = "{\"success\":true,\"data\":{}}";
                if (path.equals("/internal/v1/notifications")) {
                    code = sendStatus;
                    reply = code == 200 ? "{\"success\":true,\"data\":{\"outcome\":\"ACCEPTED\",\"accepted\":1}}" : "{\"success\":false,\"code\":\"NOTIFY-X\",\"message\":\"x\"}";
                } else if (path.endsWith("/preferences")) {
                    reply = prefsReply;
                } else if (path.endsWith("/test")) {
                    reply = "{\"success\":true,\"data\":{\"devices\":2,\"delivered\":1}}";
                } else if (path.equals("/api/v1/notify/config")) {
                    reply = "{\"success\":true,\"data\":{\"enabled\":true,\"publicKey\":\"PUBKEY\"}}";
                }
                byte[] out = reply.getBytes(StandardCharsets.UTF_8);
                exchange.getResponseHeaders().add("Content-Type", "application/json");
                exchange.sendResponseHeaders(code, out.length);
                exchange.getResponseBody().write(out);
                exchange.close();
            });
            server.start();
            Runtime.getRuntime().addShutdownHook(new Thread(() -> server.stop(0)));
            return server;
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    @DynamicPropertySource
    static void central(DynamicPropertyRegistry registry) {
        registry.add("blog.notify.base-url", () -> "http://127.0.0.1:" + NOTIFY.getAddress().getPort());
        registry.add("blog.notify.service-token", () -> TOKEN);
        registry.add("blog.notify.base-path", () -> "/blog");
        // 배경 재시도기가 시험 도중 행을 가져가지 않게 한다(시험이 retrier.processDue() 를 직접 부른다)
        registry.add("blog.notify.outbox-interval", () -> "PT24H");
    }

    @Autowired private MockMvc mockMvc;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private NotifyOutbox outbox;
    @Autowired private NotifyOutboxRetrier retrier;
    @Autowired private PostCommandService postCommands;
    @Autowired private CommentService comments;
    @Autowired private PostLikeService likes;
    @Autowired private FollowService follows;
    @Autowired private NotificationService notifications;
    @Autowired private PostRepository postRepository;
    @Autowired private BlogUserRepository userRepository;
    @Autowired private com.hunnit_beasts.doro.sdk.security.jwks.JwksKeyProvider jwks;
    @Autowired private DeletedAccountAnonymizer anonymizer;
    @Autowired private PlatformTransactionManager txManager;

    @BeforeEach
    void reset() {
        SEEN.clear();
        sendStatus = 200;
        jdbc.update("delete from notify_outbox");
    }

    private DoroUser newUser() {
        UUID id = UUID.randomUUID();
        return new DoroUser(id, "nc_" + id.toString().substring(0, 8) + "@doro.local", UUID.randomUUID(), 100, "USER");
    }

    private PostSummaryResponse publish(DoroUser author, String title) {
        return postCommands.createPost(author, new CreatePostRequest(title, null, null, "본문", null, PostStatus.PUBLISHED, null, null));
    }

    /** 알림 주소의 경로 조각은 퍼센트 인코딩된다(한글 슬러그). */
    private static String seg(String value) {
        return org.springframework.web.util.UriUtils.encodePathSegment(value, StandardCharsets.UTF_8);
    }

    private List<Seen> sent() {
        return SEEN.stream().filter(s -> s.path().equals("/internal/v1/notifications")).toList();
    }

    private JsonNode lastRequest() throws Exception {
        return JSON.readTree(sent().get(sent().size() - 1).body());
    }

    @Test
    @DisplayName("알림 종류 4개가 시작할 때 알림 서비스에 등록된다(토큰 있음)")
    void typesRegisteredOnStartup() throws Exception {
        // 시험 시작 전 reset() 이 SEEN 을 비웠을 수 있어, 등록기를 직접 한 번 더 불러 같은 요청을 확인한다
        assertThat(new NotifyTypeRegistrar(new NotifyProperties("http://127.0.0.1:" + NOTIFY.getAddress().getPort(), TOKEN, "/blog", null, null, null),
                new NotifyClient(new NotifyProperties("http://127.0.0.1:" + NOTIFY.getAddress().getPort(), TOKEN, "/blog", null, null, null))).register()).isTrue();
        Seen request = SEEN.stream().filter(s -> s.method().equals("PUT") && s.path().equals("/internal/v1/apps/blog/types")).findFirst().orElseThrow();
        assertThat(request.token()).isEqualTo(TOKEN);
        JsonNode types = JSON.readTree(request.body()).path("types");
        assertThat(types).hasSize(4);
        assertThat(List.of(types.get(0).path("type").asText(), types.get(1).path("type").asText(), types.get(2).path("type").asText(), types.get(3).path("type").asText()))
                .containsExactlyInAnyOrder("comment", "reply", "like", "follow");
        types.forEach(t -> assertThat(t.path("defaultOn").asBoolean()).isTrue());
    }

    @Test
    @DisplayName("댓글: 알림이 저장되면 아웃박스에 한 줄 쌓이고, 재시도기가 알림 서비스에 올바른 요청을 보낸 뒤 행을 지운다")
    void commentGoesThroughOutbox() throws Exception {
        DoroUser author = newUser();
        DoroUser reader = newUser();
        PostSummaryResponse post = publish(author, "첫 글");

        comments.createRootComment(post.id(), reader, new CreateCommentRequest("잘 읽었어요"));
        assertThat(outbox.count()).isEqualTo(1);
        assertThat(sent()).isEmpty();   // 재시도기를 부르기 전에는 보내지 않았다

        assertThat(retrier.processDue().sent()).isEqualTo(1);
        assertThat(outbox.count()).isZero();
        Seen request = sent().get(0);
        assertThat(request.token()).isEqualTo(TOKEN);
        JsonNode body = JSON.readTree(request.body());
        assertThat(body.path("app").asText()).isEqualTo("blog");
        assertThat(body.path("type").asText()).isEqualTo("comment");
        assertThat(body.path("recipients").get(0).asText()).isEqualTo(author.userId().toString());
        assertThat(body.path("title").asText()).isEqualTo("첫 글");
        assertThat(body.path("body").asText()).endsWith(": 잘 읽었어요");
        assertThat(body.path("url").asText()).isEqualTo("/blog/@" + post.username() + "/" + seg(post.slug())).startsWith("/blog/");
        assertThat(body.path("tag").asText()).isEqualTo("comment:" + post.id());
        assertThat(body.path("urgency").asText()).isEqualTo("high");
        assertThat(body.path("idempotencyKey").asText()).startsWith("blog:");
        assertThat(body.has("dryRun")).isFalse();
    }

    @Test
    @DisplayName("답글: 부모 댓글 작성자에게 reply, 글 작성자(다른 사람)에게 comment 요청이 쌓인다")
    void replyAndCommentOnReply() throws Exception {
        DoroUser author = newUser();
        DoroUser parentWriter = newUser();
        DoroUser replier = newUser();
        PostSummaryResponse post = publish(author, "답글 글");
        UUID parentId = comments.createRootComment(post.id(), parentWriter, new CreateCommentRequest("원 댓글")).id();
        jdbc.update("delete from notify_outbox");

        comments.createReply(post.id(), parentId, replier, new CreateReplyRequest("답글이에요"));
        assertThat(outbox.count()).isEqualTo(2);
        retrier.processDue();
        List<JsonNode> bodies = sent().stream().map(s -> {
            try {
                return JSON.readTree(s.body());
            } catch (Exception e) {
                throw new IllegalStateException(e);
            }
        }).toList();
        JsonNode reply = bodies.stream().filter(b -> b.path("type").asText().equals("reply")).findFirst().orElseThrow();
        JsonNode comment = bodies.stream().filter(b -> b.path("type").asText().equals("comment")).findFirst().orElseThrow();
        assertThat(reply.path("recipients").get(0).asText()).isEqualTo(parentWriter.userId().toString());
        assertThat(reply.path("tag").asText()).isEqualTo("reply:" + post.id());
        assertThat(reply.path("url").asText()).startsWith("/blog/@");
        assertThat(comment.path("recipients").get(0).asText()).isEqualTo(author.userId().toString());
    }

    @Test
    @DisplayName("좋아요·팔로우: 각각 like/follow 로 쌓이고 normal 긴급도, follow 는 보낸 사람 프로필로 이동한다. 반복 토글은 한 줄만")
    void likeAndFollow() throws Exception {
        DoroUser author = newUser();
        DoroUser fan = newUser();
        PostSummaryResponse post = publish(author, "좋아요 글");

        likes.toggleLike(post.id(), fan);
        likes.toggleLike(post.id(), fan);
        likes.toggleLike(post.id(), fan);   // 다시 좋아요: 24시간 중복이라 알림도 아웃박스도 늘지 않는다
        assertThat(outbox.count()).isEqualTo(1);
        follows.followUser(fan, post.username());
        assertThat(outbox.count()).isEqualTo(2);

        retrier.processDue();
        List<JsonNode> bodies = sent().stream().map(s -> {
            try {
                return JSON.readTree(s.body());
            } catch (Exception e) {
                throw new IllegalStateException(e);
            }
        }).toList();
        JsonNode like = bodies.stream().filter(b -> b.path("type").asText().equals("like")).findFirst().orElseThrow();
        JsonNode follow = bodies.stream().filter(b -> b.path("type").asText().equals("follow")).findFirst().orElseThrow();
        assertThat(like.path("tag").asText()).isEqualTo("like:" + post.id());
        assertThat(like.path("urgency").asText()).isEqualTo("normal");
        assertThat(like.path("url").asText()).isEqualTo("/blog/@" + post.username() + "/" + seg(post.slug()));
        String fanUsername = userRepository.findById(fan.userId()).orElseThrow().getUsername();
        assertThat(follow.path("tag").asText()).isEqualTo("follow:" + fan.userId());
        assertThat(follow.path("url").asText()).isEqualTo("/blog/@" + fanUsername);
        assertThat(follow.path("urgency").asText()).isEqualTo("normal");
        assertThat(follow.path("recipients").get(0).asText()).isEqualTo(author.userId().toString());
    }

    @Test
    @DisplayName("자기 알림·비공개 글은 알림도 아웃박스 행도 만들지 않는다")
    void filteredNotificationsLeaveNoRow() {
        DoroUser author = newUser();
        DoroUser other = newUser();
        PostSummaryResponse post = publish(author, "공개 글");
        comments.createRootComment(post.id(), author, new CreateCommentRequest("내 글에 내가"));
        assertThat(outbox.count()).isZero();

        PostSummaryResponse hidden = postCommands.createPost(author, new CreatePostRequest("비밀 글", null, null, "본문", null, PostStatus.PRIVATE, null, null));
        var privatePost = postRepository.findById(hidden.id()).orElseThrow();
        var authorUser = userRepository.findById(author.userId()).orElseThrow();
        likes.toggleLike(post.id(), other);   // 다른 사람 알림 하나(기준선)
        jdbc.update("delete from notify_outbox");
        notifications.sendNotification(authorUser, userRepository.findById(other.userId()).orElseThrow(), NotificationType.COMMENT, privatePost, authorUser.getUsername(), "몰래");
        assertThat(outbox.count()).isZero();
    }

    @Test
    @DisplayName("아웃박스 행은 알림과 같은 트랜잭션이다: 롤백되면 행도 남지 않는다")
    void outboxIsInTheSameTransaction() {
        DoroUser author = newUser();
        DoroUser reader = newUser();
        PostSummaryResponse post = publish(author, "롤백 글");
        var authorUser = userRepository.findById(author.userId()).orElseThrow();
        var readerUser = comments.createRootComment(post.id(), reader, new CreateCommentRequest("먼저 사용자 만들기"));
        jdbc.update("delete from notify_outbox");
        var reader2 = userRepository.findById(reader.userId()).orElseThrow();
        var postEntity = postRepository.findById(post.id()).orElseThrow();

        new TransactionTemplate(txManager).execute(status -> {
            notifications.sendNotification(authorUser, reader2, NotificationType.COMMENT, postEntity, authorUser.getUsername(), "곧 취소");
            assertThat(outbox.count()).isEqualTo(1);   // 같은 트랜잭션 안에서는 보인다
            status.setRollbackOnly();
            return null;
        });
        assertThat(outbox.count()).isZero();
        assertThat(readerUser).isNotNull();
    }

    @Test
    @DisplayName("알림 서비스가 5xx 면 행이 남아 다시 시도하고(같은 멱등 키), 나아지면 보낸 뒤 지운다")
    void retriesUntilItWorks() {
        DoroUser author = newUser();
        PostSummaryResponse post = publish(author, "재시도");
        sendStatus = 503;
        comments.createRootComment(post.id(), newUser(), new CreateCommentRequest("안녕"));

        assertThat(retrier.processDue().retry()).isEqualTo(1);
        assertThat(outbox.count()).isEqualTo(1);
        assertThat(jdbc.queryForObject("select attempts from notify_outbox", Integer.class)).isEqualTo(1);
        assertThat(retrier.processDue().retry()).isZero();   // 다음 시도 시각 전에는 건드리지 않는다

        jdbc.update("update notify_outbox set next_attempt_at = now() - interval '1 second'");
        sendStatus = 200;
        assertThat(retrier.processDue().sent()).isEqualTo(1);
        assertThat(outbox.count()).isZero();
        List<Seen> requests = sent();
        assertThat(requests).hasSize(2);
        String key = requests.get(0).body().replaceAll(".*\"idempotencyKey\":\"([^\"]+)\".*", "$1");
        assertThat(requests.get(1).body()).contains(key);
    }

    @Test
    @DisplayName("요청 자체가 거절되면(400) 버리고, 만료된 행은 보내지 않고 버린다. 인증 오류(401)는 다시 시도한다")
    void dropsRejectedAndExpiredButRetriesAuth() {
        DoroUser author = newUser();
        PostSummaryResponse post = publish(author, "버림");
        sendStatus = 400;
        comments.createRootComment(post.id(), newUser(), new CreateCommentRequest("하나"));
        assertThat(retrier.processDue().dropped()).isEqualTo(1);
        assertThat(outbox.count()).isZero();

        sendStatus = 401;
        comments.createRootComment(post.id(), newUser(), new CreateCommentRequest("둘"));
        assertThat(retrier.processDue().retry()).isEqualTo(1);
        assertThat(outbox.count()).isEqualTo(1);

        jdbc.update("update notify_outbox set expires_at = now() - interval '1 second', next_attempt_at = now() - interval '1 second'");
        SEEN.clear();
        sendStatus = 200;
        assertThat(retrier.processDue().dropped()).isEqualTo(1);
        assertThat(sent()).isEmpty();
    }

    @Test
    @DisplayName("탈퇴 익명화는 그 사용자에게 아직 못 보낸 푸시 요청을 지운다")
    void anonymizeClearsOutboxRows() {
        DoroUser author = newUser();
        PostSummaryResponse post = publish(author, "탈퇴 글");
        comments.createRootComment(post.id(), newUser(), new CreateCommentRequest("안녕"));
        assertThat(outbox.count()).isEqualTo(1);
        assertThat(anonymizer.anonymize(author.userId(), Instant.now())).isTrue();
        assertThat(outbox.count()).isZero();
    }

    @Test
    @DisplayName("푸시 설정 API 는 알림 서비스의 위임 API 로 넘어간다: 구독(기기 표식·UA), 해제, 설정(이름 변환), 시험, config")
    void settingsApiIsForwarded() throws Exception {
        DoroUser user = newUser();
        PushTestJwt.register(jwks);
        String bearer = PushTestJwt.bearer(user.userId());
        String endpoint = "https://fcm.googleapis.com/fcm/send/abc123";

        mockMvc.perform(put("/api/v1/push/subscription").header("Authorization", bearer).header("User-Agent", "TestBrowser/1").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"endpoint\":\"" + endpoint + "\",\"keys\":{\"p256dh\":\"BPK\",\"auth\":\"AUTHK\"}}"))
                .andExpect(status().isOk());
        Seen subscribe = SEEN.stream().filter(s -> s.method().equals("PUT") && s.path().endsWith("/subscriptions")).findFirst().orElseThrow();
        assertThat(subscribe.path()).isEqualTo("/internal/v1/apps/blog/users/" + user.userId() + "/subscriptions");
        assertThat(subscribe.token()).isEqualTo(TOKEN);
        assertThat(subscribe.userAgent()).isEqualTo("TestBrowser/1");
        assertThat(subscribe.body()).contains("\"deviceId\":\"blog-").contains("\"endpoint\":\"" + endpoint + "\"").contains("\"p256dh\":\"BPK\"");

        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete("/api/v1/push/subscription").header("Authorization", bearer)
                .contentType(MediaType.APPLICATION_JSON).content("{\"endpoint\":\"" + endpoint + "\"}")).andExpect(status().isOk());
        Seen unsubscribe = SEEN.stream().filter(s -> s.method().equals("DELETE")).findFirst().orElseThrow();
        assertThat(unsubscribe.path()).isEqualTo("/internal/v1/apps/blog/users/" + user.userId() + "/subscriptions");
        assertThat(unsubscribe.body()).contains(endpoint);

        mockMvc.perform(get("/api/v1/push/preferences").header("Authorization", bearer)).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.comments").value(false)).andExpect(jsonPath("$.data.replies").value(true))
                .andExpect(jsonPath("$.data.likes").value(false)).andExpect(jsonPath("$.data.follows").value(true));   // 없는 종류(follow)는 켜짐
        mockMvc.perform(put("/api/v1/push/preferences").header("Authorization", bearer).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"comments\":false,\"replies\":true,\"likes\":false,\"follows\":true}")).andExpect(status().isOk());
        Seen update = SEEN.stream().filter(s -> s.method().equals("PUT") && s.path().endsWith("/preferences")).findFirst().orElseThrow();
        assertThat(update.body()).contains("\"app\":\"blog\"").contains("\"type\":\"comment\"").contains("\"type\":\"reply\"")
                .contains("\"type\":\"like\"").contains("\"type\":\"follow\"");

        mockMvc.perform(post("/api/v1/push/test").header("Authorization", bearer)).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.devices").value(2)).andExpect(jsonPath("$.data.delivered").value(1));
        mockMvc.perform(get("/api/v1/push/config").header("Authorization", bearer)).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.enabled").value(true)).andExpect(jsonPath("$.data.publicKey").value("PUBKEY"));
        mockMvc.perform(get("/api/v1/push/config")).andExpect(status().isUnauthorized());   // 로그인 필요
        mockMvc.perform(get("/api/v1/push/config").header("X-API-Key", "dk_whatever")).andExpect(status().is4xxClientError());   // API 키로는 쓸 수 없다

    }
}
