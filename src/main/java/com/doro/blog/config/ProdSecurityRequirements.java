package com.doro.blog.config;

import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

/**
 * 운영(prod)에서 서버 간 인증에 필요한 비밀값이 비어 있으면 기동을 중단한다.
 * 이 값들은 비어 있어도 서비스가 뜨기 때문에(기본값이 빈 문자열), 빠뜨리면 Guard 호출이 거부되거나
 * 탈퇴 동기화가 조용히 401 만 받으면서도 겉으로는 정상으로 보인다. 배포 직후 바로 드러나게 한다.
 */
@Slf4j
@Component
@Profile("prod")
public class ProdSecurityRequirements {

    private final String guardServiceToken;
    private final String iamInternalToken;
    private final boolean deletedSyncEnabled;

    public ProdSecurityRequirements(
            @Value("${doro.guard.service-token:}") String guardServiceToken,
            @Value("${doro.iam.internal-token:}") String iamInternalToken,
            @Value("${blog.deleted-sync.enabled:true}") boolean deletedSyncEnabled) {
        this.guardServiceToken = guardServiceToken;
        this.iamInternalToken = iamInternalToken;
        this.deletedSyncEnabled = deletedSyncEnabled;
    }

    @PostConstruct
    void validate() {
        List<String> missing = new ArrayList<>();
        if (isBlank(guardServiceToken)) {
            missing.add("DORO_GUARD_SERVICE_TOKEN (Guard 호출 인증)");
        }
        if (deletedSyncEnabled && isBlank(iamInternalToken)) {
            missing.add("DORO_IAM_INTERNAL_TOKEN (탈퇴 사용자 동기화 — 쓰지 않으려면 BLOG_DELETED_SYNC_ENABLED=false)");
        }
        if (!missing.isEmpty()) {
            String message = "운영 설정에 필요한 비밀값이 비어 있다: " + String.join(", ", missing);
            log.error(message);
            throw new IllegalStateException(message);
        }
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
