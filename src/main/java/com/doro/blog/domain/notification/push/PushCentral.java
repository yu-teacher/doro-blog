package com.doro.blog.domain.notification.push;

import com.doro.blog.common.exception.BlogException;
import com.doro.blog.common.exception.ErrorCode;
import com.doro.blog.domain.notification.push.PushDtos.PreferencesDto;
import com.doro.blog.domain.notification.push.PushDtos.PushConfigResponse;
import com.doro.blog.domain.notification.push.PushDtos.TestResult;
import com.fasterxml.jackson.databind.JsonNode;
import com.hunnit_beasts.doro.sdk.domain.DoroUser;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 블로그의 푸시 설정 API(/api/v1/push/*)를 알림 서비스의 위임 API 로 넘기는 어댑터. 블로그는 구독·설정 데이터를 갖지 않고,
 * 알림 서비스가 기기·설정의 기준이다. 블로그의 설정 이름은 알림 서비스의 종류로 바꿔 전달한다
 * (comments→comment, replies→reply, likes→like, follows→follow). 알림 서비스를 쓰지 않는 상태(토큰 없음)에서는
 * 설정 조회만 enabled=false 로 답하고 나머지는 거절한다.
 */
@Service
@RequiredArgsConstructor
public class PushCentral {

    private final NotifyClient client;
    private final NotifyProperties properties;

    public PushConfigResponse config() {
        if (!properties.enabled()) {
            return new PushConfigResponse(false, null);
        }
        JsonNode data = require(client.config()).data();
        return new PushConfigResponse(data.path("enabled").asBoolean(false), data.path("publicKey").asText(null));
    }

    /** 이 기기를 내 알림 기기로 등록한다. 기기 표식은 구독 주소로 만든 안정된 값이다(같은 기기를 다시 등록하면 같은 표식). */
    public void subscribe(DoroUser user, String endpoint, String p256dh, String auth, String userAgent) {
        requireEnabled();
        require(client.subscribe(user.userId(), deviceId(endpoint.strip()), endpoint.strip(), p256dh, auth, userAgent));
    }

    public void unsubscribe(DoroUser user, String endpoint) {
        requireEnabled();
        require(client.unsubscribe(user.userId(), endpoint.strip()));
    }

    public PreferencesDto preferences(DoroUser user) {
        requireEnabled();
        return toDto(require(client.preferences(user.userId())).data());
    }

    public PreferencesDto updatePreferences(DoroUser user, PreferencesDto update) {
        requireEnabled();
        Map<String, Boolean> byType = new LinkedHashMap<>();
        byType.put("comment", update.comments());
        byType.put("reply", update.replies());
        byType.put("like", update.likes());
        byType.put("follow", update.follows());
        return toDto(require(client.updatePreferences(user.userId(), byType)).data());
    }

    public TestResult sendTest(DoroUser user) {
        requireEnabled();
        JsonNode data = require(client.test(user.userId())).data();
        return new TestResult(data.path("devices").asInt(), data.path("delivered").asInt());
    }

    /** 알림 서비스가 돌려준 설정(앱 하나)에서 블로그의 네 종류를 읽는다. 없는 종류는 켜짐(기본값). */
    static PreferencesDto toDto(JsonNode data) {
        Map<String, Boolean> enabled = new LinkedHashMap<>();
        for (JsonNode app : data.path("apps")) {
            if (NotifyClient.APP.equals(app.path("app").asText())) {
                for (JsonNode type : app.path("types")) {
                    enabled.put(type.path("type").asText(), type.path("enabled").asBoolean(true));
                }
            }
        }
        return new PreferencesDto(enabled.getOrDefault("comment", true), enabled.getOrDefault("reply", true),
                enabled.getOrDefault("like", true), enabled.getOrDefault("follow", true));
    }

    static String deviceId(String endpoint) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(endpoint.getBytes(StandardCharsets.UTF_8));
            return "blog-" + HexFormat.of().formatHex(digest, 0, 8);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    private void requireEnabled() {
        if (!properties.enabled()) {
            throw new BlogException(ErrorCode.INVALID_INPUT, "푸시 알림을 사용할 수 없어요.");
        }
    }

    private NotifyClient.Reply require(NotifyClient.Reply reply) {
        if (!reply.ok()) {
            throw NotifyClient.toBlogException(reply);
        }
        return reply;
    }
}
