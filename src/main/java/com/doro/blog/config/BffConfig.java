package com.doro.blog.config;

import com.doro.blog.domain.auth.BffProperties;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

@Configuration
@EnableConfigurationProperties(BffProperties.class)
@EnableScheduling
public class BffConfig {
}
