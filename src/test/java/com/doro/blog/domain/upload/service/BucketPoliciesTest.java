package com.doro.blog.domain.upload.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class BucketPoliciesTest {

    @Test
    @DisplayName("익명 정책은 객체 읽기(GetObject)만 허용하고 버킷 목록 조회는 허용하지 않는다")
    void anonymousCanReadObjectsButNotListBucket() throws Exception {
        JsonNode policy = new ObjectMapper().readTree(BucketPolicies.publicReadObjectsOnly("media-bucket"));

        assertThat(policy.get("Statement")).hasSize(1);
        JsonNode statement = policy.get("Statement").get(0);
        assertThat(statement.get("Action")).hasSize(1);
        assertThat(statement.get("Action").get(0).asText()).isEqualTo("s3:GetObject");
        assertThat(statement.get("Resource").get(0).asText()).isEqualTo("arn:aws:s3:::media-bucket/*");
        assertThat(policy.toString()).doesNotContain("ListBucket");
    }
}
