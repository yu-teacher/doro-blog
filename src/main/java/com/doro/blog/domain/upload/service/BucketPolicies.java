package com.doro.blog.domain.upload.service;

/** 업로드 버킷의 익명 접근 정책. */
final class BucketPolicies {

    private BucketPolicies() {
    }

    /**
     * 익명 사용자는 키를 아는 객체를 읽을 수만 있다 (GetObject).
     * 버킷 목록 조회(ListBucket)는 주지 않는다. 주면 /media/ 로 모든 업로드 파일의 키를 열거할 수 있다.
     */
    static String publicReadObjectsOnly(String bucket) {
        return """
                {
                  "Version": "2012-10-17",
                  "Statement": [
                    {
                      "Effect": "Allow",
                      "Principal": {"AWS": ["*"]},
                      "Action": ["s3:GetObject"],
                      "Resource": ["arn:aws:s3:::%s/*"]
                    }
                  ]
                }
                """.formatted(bucket);
    }
}
