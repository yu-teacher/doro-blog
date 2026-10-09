package com.doro.blog.domain.apikey;

import com.doro.blog.domain.apikey.dto.ApiKeyDtos.CreateApiKeyRequest;
import com.doro.blog.domain.apikey.service.ApiKeyLogCleanup;
import com.doro.blog.domain.apikey.service.ApiKeyService;
import com.hunnit_beasts.doro.sdk.domain.DoroUser;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** API 키 사용 기록은 보존 기간이 지나면 지운다(요청마다 한 행씩 쌓이므로 정리하지 않으면 무한히 늘어난다). */
@SpringBootTest(properties = "blog.api-key.log-retention-days=30")
class ApiKeyLogCleanupTest {

    @Autowired private ApiKeyService apiKeyService;
    @Autowired private ApiKeyLogCleanup cleanup;
    @Autowired private JdbcTemplate jdbc;

    private void insertLog(UUID userId, UUID keyId, String ageInterval) {
        jdbc.update("insert into api_key_logs (api_key_id, user_id, method, endpoint, status_code, duration_ms, created_at) "
                + "values (?, ?, 'GET', '/api/v1/posts', 200, 1, now() - ?::interval)", keyId, userId, ageInterval);
    }

    @Test
    @DisplayName("보존 기간(30일)이 지난 사용 기록만 지워지고, 최근 기록은 남는다")
    void purgesOnlyLogsOlderThanRetention() {
        UUID id = UUID.randomUUID();
        DoroUser owner = new DoroUser(id, "logs_" + id.toString().substring(0, 8) + "@doro.local", UUID.randomUUID(), 100, "USER");
        UUID keyId = apiKeyService.createApiKey(owner, new CreateApiKeyRequest("log-cleanup", 1)).id();
        insertLog(id, keyId, "31 days");
        insertLog(id, keyId, "100 days");
        insertLog(id, keyId, "29 days");
        insertLog(id, keyId, "1 hour");

        cleanup.purgeOld();

        assertThat(jdbc.queryForObject("select count(*) from api_key_logs where user_id = ?", Integer.class, id))
                .as("30일 안의 두 건만 남는다").isEqualTo(2);
        assertThat(jdbc.queryForObject("select count(*) from api_key_logs where user_id = ? and created_at < now() - interval '30 days'",
                Integer.class, id)).isZero();
    }
}
