package com.doro.blog.domain.auth;

import com.doro.blog.common.response.ApiResponse;
import com.doro.blog.domain.user.dto.BlogUserDtos.UserProfileResponse;
import com.doro.blog.domain.user.service.BlogUserService;
import com.hunnit_beasts.doro.sdk.annotation.CurrentDoroUser;
import com.hunnit_beasts.doro.sdk.domain.DoroUser;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;

/**
 * Doro OAuth 로그인(BFF). 브라우저는 /login 으로 이동해 Doro 에서 로그인하고, /callback 에서 세션 쿠키를 받는다.
 * 토큰은 서버에만 있고 JavaScript 는 볼 수 없다.
 */
@Slf4j
@Tag(name = "Auth (BFF)", description = "Doro OAuth 로그인 — 세션 쿠키 기반")
@RestController
@RequestMapping("/api/v1/bff")
@RequiredArgsConstructor
public class BffController {

    /** 로그인 실패 시 돌려보내는 곳의 쿼리 값. 상세 사유는 노출하지 않는다. */
    private static final String LOGIN_ERROR_PARAM = "login_error";

    private final BffAuthService authService;
    private final BffProperties props;
    private final BlogUserService userService;

    /** 응답 본문: 현재 로그인 상태와 내 프로필. 비로그인이어도 200 이다(화면이 401 오류 처리 없이 상태를 알 수 있게). */
    public record SessionResponse(boolean authenticated, UserProfileResponse user, String role) {}

    @Operation(summary = "로그인 시작", description = "Doro 로그인 화면으로 이동한다. return 은 로그인 후 돌아올 사이트 내 경로.")
    @GetMapping("/login")
    public ResponseEntity<Void> login(@RequestParam(name = "return", required = false) String returnPath) {
        BffAuthService.StartedLogin started = authService.startLogin(returnPath);
        // 이 브라우저를 로그인 시도에 묶는다: 콜백이 같은 브라우저에서 와야 끝낼 수 있다(남이 시작한 로그인을 이 사람에게 끝내게 하는 공격 방지)
        return ResponseEntity.status(HttpStatus.FOUND).header(HttpHeaders.LOCATION, started.authorizeUrl())
                .header(HttpHeaders.SET_COOKIE, loginCookie(started.browserNonce()).toString())
                .header(HttpHeaders.CACHE_CONTROL, "no-store").build();
    }

    @Operation(summary = "로그인 콜백", description = "Doro 가 인가 코드와 함께 돌려보내는 곳. 세션 쿠키를 발급하고 원래 페이지로 이동한다.")
    @GetMapping("/callback")
    public ResponseEntity<Void> callback(
            HttpServletRequest request,
            @RequestParam(name = "code", required = false) String code,
            @RequestParam(name = "state", required = false) String state,
            @RequestParam(name = "error", required = false) String error
    ) {
        if (error != null) {
            // 사용자가 취소했거나 Doro 가 거부했다. 사유를 화면에 그대로 싣지 않는다.
            log.info("BFF login ended with an authorization error from IAM: {}", error);
            return redirect(props.webPath("/") + "?" + LOGIN_ERROR_PARAM + "=cancelled", clearedLoginCookie());
        }
        try {
            BffAuthService.LoginResult result = authService.completeLogin(code, state, sessionCookie(request), cookieValue(request, props.getLoginCookieName()));
            return redirect(result.returnPath(), sessionCookie(result.sessionCookieValue()), clearedLoginCookie());
        } catch (BffAuthService.LoginFailedException e) {
            log.warn("BFF login failed: {}", e.getMessage());
            // 이미 로그인한 사용자의 세션 쿠키는 건드리지 않는다. 가짜 콜백 링크 하나로 남을 로그아웃시킬 수 없게 한다.
            return redirect(props.webPath("/") + "?" + LOGIN_ERROR_PARAM + "=failed", clearedLoginCookie());
        }
    }

    @Operation(summary = "로그아웃", description = "세션과 Doro 세션을 종료한다. 상태를 바꾸는 요청이므로 CSRF 헤더가 필요하다.")
    @PostMapping("/logout")
    public ResponseEntity<ApiResponse<Void>> logout(HttpServletRequest request) {
        String cookieValue = sessionCookie(request);
        String csrf = request.getHeader(props.getCsrfHeader());
        if (cookieValue != null && (csrf == null || csrf.isBlank())) {
            // 필터의 CSRF 검사와 같은 규칙. (쿠키 없이 호출하면 지울 것이 없으므로 그냥 성공)
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(ApiResponse.error(HttpStatus.FORBIDDEN, "AUTH-403-03", "요청을 확인할 수 없습니다."));
        }
        authService.logout(cookieValue);
        return ResponseEntity.ok().header(HttpHeaders.SET_COOKIE, clearedCookie().toString())
                .header(HttpHeaders.CACHE_CONTROL, "no-store").body(ApiResponse.success());
    }

    @Operation(summary = "내 로그인 상태", description = "로그인했다면 내 프로필, 아니면 authenticated=false")
    @GetMapping("/session")
    public ResponseEntity<ApiResponse<SessionResponse>> session(@CurrentDoroUser DoroUser doroUser) {
        SessionResponse body = (doroUser != null && doroUser.isAuthenticated())
                ? new SessionResponse(true, userService.getProfileById(doroUser.userId()), doroUser.role())
                : new SessionResponse(false, null, null);
        return ResponseEntity.ok().header(HttpHeaders.CACHE_CONTROL, "no-store").body(ApiResponse.success(body));
    }

    // ------------------------------------------------------------------ 쿠키

    private ResponseCookie sessionCookie(String value) {
        return ResponseCookie.from(props.getCookieName(), value)
                .httpOnly(true)
                .secure(props.isCookieSecure())
                .sameSite("Lax")
                .path("/")
                .maxAge(props.getSessionTtl())
                .build();
    }

    /** 로그인을 시작한 브라우저를 표시하는 쿠키. 콜백이 올 때까지(로그인 시도 수명)만 살아 있고, 로그인 API 경로에서만 전송된다. */
    private ResponseCookie loginCookie(String value) {
        return ResponseCookie.from(props.getLoginCookieName(), value)
                .httpOnly(true)
                .secure(props.isCookieSecure())
                .sameSite("Lax")
                .path(props.loginCookiePath())
                .maxAge(props.getLoginAttemptTtl())
                .build();
    }

    private ResponseCookie clearedLoginCookie() {
        return ResponseCookie.from(props.getLoginCookieName(), "")
                .httpOnly(true)
                .secure(props.isCookieSecure())
                .sameSite("Lax")
                .path(props.loginCookiePath())
                .maxAge(0)
                .build();
    }

    private ResponseCookie clearedCookie() {
        return ResponseCookie.from(props.getCookieName(), "")
                .httpOnly(true)
                .secure(props.isCookieSecure())
                .sameSite("Lax")
                .path("/")
                .maxAge(0)
                .build();
    }

    private String sessionCookie(HttpServletRequest request) {
        return cookieValue(request, props.getCookieName());
    }

    private static String cookieValue(HttpServletRequest request, String name) {
        if (request.getCookies() == null) {
            return null;
        }
        for (jakarta.servlet.http.Cookie cookie : request.getCookies()) {
            if (name.equals(cookie.getName()) && cookie.getValue() != null && !cookie.getValue().isBlank()) {
                return cookie.getValue();
            }
        }
        return null;
    }

    private ResponseEntity<Void> redirect(String path, ResponseCookie... cookies) {
        ResponseEntity.BodyBuilder builder = ResponseEntity.status(HttpStatus.FOUND)
                .header(HttpHeaders.LOCATION, URI.create(path).toString())
                .header(HttpHeaders.CACHE_CONTROL, "no-store");
        for (ResponseCookie cookie : cookies) {
            builder.header(HttpHeaders.SET_COOKIE, cookie.toString());
        }
        return builder.build();
    }
}
