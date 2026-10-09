package com.doro.blog.config;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.context.annotation.Profile;

import java.util.Arrays;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * 운영(prod)에서는 서버 간 인증에 필요한 비밀값이 비어 있으면 뜨지 않는다.
 * 비어 있어도 아무 오류 없이 뜨면, Guard 호출이 거부되거나 탈퇴 동기화가 조용히 401 만 받으면서도 서비스는 정상으로 보인다.
 */
class ProdSecurityRequirementsTest {

    @Test
    @DisplayName("Guard 서비스 토큰이 비어 있으면 기동을 중단하고, 어떤 설정이 빠졌는지 알려 준다")
    void blankGuardTokenStopsStartup() {
        ProdSecurityRequirements check = new ProdSecurityRequirements("  ", "iam-token", true);

        assertThatThrownBy(check::validate)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("DORO_GUARD_SERVICE_TOKEN")
                .hasMessageNotContaining("DORO_IAM_INTERNAL_TOKEN");
    }

    @Test
    @DisplayName("탈퇴 동기화를 켰는데 IAM 내부 토큰이 비어 있으면 기동을 중단한다")
    void blankInternalTokenStopsStartupWhenSyncIsEnabled() {
        ProdSecurityRequirements check = new ProdSecurityRequirements("guard-token", "", true);

        assertThatThrownBy(check::validate)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("DORO_IAM_INTERNAL_TOKEN");
    }

    @Test
    @DisplayName("탈퇴 동기화를 끈 경우에는 IAM 내부 토큰이 없어도 된다")
    void internalTokenIsOptionalWhenSyncIsDisabled() {
        assertThatCode(new ProdSecurityRequirements("guard-token", "", false)::validate).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("필요한 값이 모두 있으면 통과하고, 빠진 값이 여럿이면 한 번에 모두 알려 준다")
    void passesWhenComplete_andListsEverythingMissing() {
        assertThatCode(new ProdSecurityRequirements("guard-token", "iam-token", true)::validate).doesNotThrowAnyException();

        assertThatThrownBy(new ProdSecurityRequirements(null, null, true)::validate)
                .hasMessageContaining("DORO_GUARD_SERVICE_TOKEN")
                .hasMessageContaining("DORO_IAM_INTERNAL_TOKEN");
    }

    @Test
    @DisplayName("이 검사는 prod 프로파일에서만 켜진다 (프로파일 표시가 실수로 빠지면 로컬·테스트가 막히거나 운영 검사가 사라진다)")
    void onlyActiveInTheProdProfile() {
        Profile profile = ProdSecurityRequirements.class.getAnnotation(Profile.class);

        assertThat(profile).isNotNull();
        assertThat(Arrays.asList(profile.value())).containsExactly("prod");
    }
}
