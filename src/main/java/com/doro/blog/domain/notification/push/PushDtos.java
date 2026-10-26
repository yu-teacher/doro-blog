package com.doro.blog.domain.notification.push;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** 브라우저의 {@code PushSubscription.toJSON()} 모양을 그대로 받는다. */
public final class PushDtos {

    /** 구독 주소 길이 한도. */
    static final int ENDPOINT_MAX = 2048;

    private PushDtos() {
    }

    public record Keys(@NotBlank @Size(max = 128) String p256dh, @NotBlank @Size(max = 64) String auth) {
    }

    public record SubscribeRequest(@NotBlank @Size(max = ENDPOINT_MAX) String endpoint, @NotNull @Valid Keys keys) {
    }

    public record UnsubscribeRequest(@NotBlank @Size(max = ENDPOINT_MAX) String endpoint) {
    }

    /** enabled 가 false 면 이 서버에서 푸시를 켤 수 없다(알림 서비스를 쓰지 않거나 알림 서비스에 VAPID 가 없다). */
    public record PushConfigResponse(boolean enabled, String publicKey) {
    }

    /** 알림 종류별 받기 설정. 알림 서비스의 comment/reply/like/follow 와 같다. */
    public record PreferencesDto(boolean comments, boolean replies, boolean likes, boolean follows) {
    }

    /** 이 기기들로 시험 알림을 보낸 결과. */
    public record TestResult(int devices, int delivered) {
    }
}
