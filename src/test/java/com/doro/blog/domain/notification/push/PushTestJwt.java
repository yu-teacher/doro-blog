package com.doro.blog.domain.notification.push;

import com.hunnit_beasts.doro.sdk.security.jwks.JwksKeyProvider;
import io.jsonwebtoken.Jwts;

import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.util.Date;
import java.util.UUID;

/** 푸시 설정 API 시험용: 로그인한 사용자의 Bearer 토큰(서명은 시험용 키, JWKS 에 등록해서 검증을 통과시킨다). 블로그는 API 키로는 푸시 API 를 쓸 수 없다. */
final class PushTestJwt {

    private static final String KID = "push-test-kid";
    private static final KeyPair KEYS = generate();

    private PushTestJwt() {
    }

    private static KeyPair generate() {
        try {
            KeyPairGenerator gen = KeyPairGenerator.getInstance("RSA");
            gen.initialize(2048);
            return gen.generateKeyPair();
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    static void register(JwksKeyProvider jwks) {
        jwks.registerKey(KID, KEYS.getPublic());
    }

    static String bearer(UUID userId) {
        return "Bearer " + Jwts.builder()
                .header().keyId(KID).and()
                .subject(userId.toString())
                .claim("email", "push_" + userId.toString().substring(0, 8) + "@doro.local")
                .claim("sid", UUID.randomUUID().toString())
                .claim("role", "USER")
                .claim("cid", "doro-blog")
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + 600_000))
                .signWith(KEYS.getPrivate(), Jwts.SIG.RS256)
                .compact();
    }
}
