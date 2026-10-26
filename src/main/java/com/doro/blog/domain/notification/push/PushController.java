package com.doro.blog.domain.notification.push;

import com.doro.blog.common.response.ApiResponse;
import com.doro.blog.domain.notification.push.PushDtos.PreferencesDto;
import com.doro.blog.domain.notification.push.PushDtos.PushConfigResponse;
import com.doro.blog.domain.notification.push.PushDtos.SubscribeRequest;
import com.doro.blog.domain.notification.push.PushDtos.TestResult;
import com.doro.blog.domain.notification.push.PushDtos.UnsubscribeRequest;
import com.doro.blog.domain.user.service.BlogUserService;
import com.hunnit_beasts.doro.sdk.annotation.CurrentDoroUser;
import com.hunnit_beasts.doro.sdk.domain.DoroUser;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "11. Push (푸시 알림)", description = "이 기기로 알림 받기: 구독 등록·해제, 알림 종류 설정. 플랫폼 알림 서비스로 넘겨 처리한다")
@RestController
@RequestMapping("/api/v1/push")
@RequiredArgsConstructor
public class PushController {

    private final PushCentral central;

    @Operation(summary = "푸시 설정 (로그인)", description = "enabled 가 false 면 이 서버에서 푸시를 켤 수 없다. publicKey 는 브라우저가 구독할 때 쓴다")
    @GetMapping("/config")
    public ApiResponse<PushConfigResponse> config(@CurrentDoroUser DoroUser user) {
        BlogUserService.requireAuthenticated(user);
        return ApiResponse.success(central.config());
    }

    @Operation(summary = "이 기기를 알림 기기로 등록 (로그인)", description = "브라우저의 PushSubscription.toJSON() 을 그대로 보낸다")
    @PutMapping("/subscription")
    public ApiResponse<Void> subscribe(@CurrentDoroUser DoroUser user, @Valid @RequestBody SubscribeRequest body, HttpServletRequest request) {
        BlogUserService.requireAuthenticated(user);
        central.subscribe(user, body.endpoint(), body.keys().p256dh(), body.keys().auth(), request.getHeader(HttpHeaders.USER_AGENT));
        return ApiResponse.success();
    }

    @Operation(summary = "이 기기의 알림 해제 (로그인)", description = "없어도 성공. 내 구독만 지울 수 있다")
    @DeleteMapping("/subscription")
    public ApiResponse<Void> unsubscribe(@CurrentDoroUser DoroUser user, @Valid @RequestBody UnsubscribeRequest body) {
        BlogUserService.requireAuthenticated(user);
        central.unsubscribe(user, body.endpoint());
        return ApiResponse.success();
    }

    @Operation(summary = "알림 종류 설정 보기 (로그인)")
    @GetMapping("/preferences")
    public ApiResponse<PreferencesDto> preferences(@CurrentDoroUser DoroUser user) {
        BlogUserService.requireAuthenticated(user);
        return ApiResponse.success(central.preferences(user));
    }

    @Operation(summary = "알림 종류 설정 바꾸기 (로그인)")
    @PutMapping("/preferences")
    public ApiResponse<PreferencesDto> updatePreferences(@CurrentDoroUser DoroUser user, @RequestBody PreferencesDto body) {
        BlogUserService.requireAuthenticated(user);
        return ApiResponse.success(central.updatePreferences(user, body));
    }

    @Operation(summary = "시험 알림 보내기 (로그인)", description = "내 모든 기기로 알림을 보내고 결과(기기 수, 전달 수)를 돌려준다")
    @PostMapping("/test")
    public ApiResponse<TestResult> test(@CurrentDoroUser DoroUser user) {
        BlogUserService.requireAuthenticated(user);
        return ApiResponse.success(central.sendTest(user));
    }
}
