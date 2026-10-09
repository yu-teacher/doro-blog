package com.doro.blog.domain.apikey.service;

import com.doro.blog.domain.apikey.repository.ApiKeyLogRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;

/** 보존 기간이 지난 API 키 사용 기록을 주기적으로 지운다. 키로 요청할 때마다 한 행이 쌓이므로 정리하지 않으면 계속 늘어난다. */
@Slf4j
@Component
@RequiredArgsConstructor
public class ApiKeyLogCleanup {

    private final ApiKeyLogRepository logs;

    @Value("${blog.api-key.log-retention-days:90}")
    private long retentionDays;

    @Scheduled(fixedDelayString = "PT6H", initialDelayString = "PT10M")
    @Transactional
    public void purgeOld() {
        Instant cutoff = Instant.now().minus(Duration.ofDays(retentionDays));
        int deleted = logs.deleteOlderThan(cutoff);
        if (deleted > 0) {
            log.info("Purged API key usage logs older than {} days: rows={}", retentionDays, deleted);
        }
    }
}
