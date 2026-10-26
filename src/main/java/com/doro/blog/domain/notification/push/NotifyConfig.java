package com.doro.blog.domain.notification.push;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/** 알림 서비스 연결 설정(blog.notify.*)을 등록한다. */
@Configuration
@EnableConfigurationProperties(NotifyProperties.class)
public class NotifyConfig {
}
