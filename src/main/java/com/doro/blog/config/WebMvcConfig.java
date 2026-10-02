package com.doro.blog.config;

import com.doro.blog.domain.upload.security.UploadAuthInterceptor;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
@RequiredArgsConstructor
public class WebMvcConfig implements WebMvcConfigurer {

    private final UploadAuthInterceptor uploadAuthInterceptor;

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(uploadAuthInterceptor).addPathPatterns("/api/v1/uploads/**", "/api/v1/uploads");
    }
}
