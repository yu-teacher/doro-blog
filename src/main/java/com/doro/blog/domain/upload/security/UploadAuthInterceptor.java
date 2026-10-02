package com.doro.blog.domain.upload.security;

import com.doro.blog.common.exception.BlogException;
import com.doro.blog.common.exception.ErrorCode;
import com.hunnit_beasts.doro.sdk.domain.DoroUser;
import com.hunnit_beasts.doro.sdk.domain.DoroUserContext;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

/**
 * 업로드는 로그인한 사용자만 할 수 있다. 컨트롤러 인자(파일)를 읽기 전에 검사해서,
 * 로그인하지 않은 요청이 큰 파일을 올리게 두지 않고 바로 401 로 끊는다.
 */
@Component
public class UploadAuthInterceptor implements HandlerInterceptor {

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        DoroUser user = DoroUserContext.getCurrentUser();
        if (user == null || !user.isAuthenticated()) {
            throw new BlogException(ErrorCode.UNAUTHORIZED);
        }
        return true;
    }
}
