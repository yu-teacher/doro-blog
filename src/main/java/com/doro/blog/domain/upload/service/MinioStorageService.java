package com.doro.blog.domain.upload.service;

import com.doro.blog.common.exception.BlogException;
import com.doro.blog.common.exception.ErrorCode;
import com.doro.blog.domain.upload.dto.UploadResponse;
import io.minio.BucketExistsArgs;
import io.minio.MakeBucketArgs;
import io.minio.MinioClient;
import io.minio.PutObjectArgs;
import io.minio.SetBucketPolicyArgs;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.UUID;

@Slf4j
@Service
public class MinioStorageService implements StorageService {

    @Value("${doro.storage.minio.endpoint:http://localhost:9000}")
    private String endpoint;

    @Value("${doro.storage.minio.access-key:doro_admin}")
    private String accessKey;

    @Value("${doro.storage.minio.secret-key:doro_secret}")
    private String secretKey;

    @Value("${doro.storage.minio.bucket:doro-blog-media}")
    private String bucket;

    @Value("${doro.storage.minio.public-url:/media}")
    private String publicUrl;

    private MinioClient minioClient;

    @PostConstruct
    public void init() {
        try {
            this.minioClient = MinioClient.builder()
                    .endpoint(endpoint)
                    .credentials(accessKey, secretKey)
                    .build();

            boolean exists = minioClient.bucketExists(BucketExistsArgs.builder().bucket(bucket).build());
            if (!exists) {
                minioClient.makeBucket(MakeBucketArgs.builder().bucket(bucket).build());
                log.info("Created MinIO bucket: {}", bucket);
            }

            // 정책은 버킷이 이미 있어도 매번 맞춘다: 예전 버전이 만든 버킷의 익명 목록 조회 권한도 이때 제거된다.
            minioClient.setBucketPolicy(
                    SetBucketPolicyArgs.builder()
                            .bucket(bucket)
                            .config(BucketPolicies.publicReadObjectsOnly(bucket))
                            .build()
            );
            log.info("Configured public object-read policy for bucket: {}", bucket);
        } catch (Exception e) {
            log.warn("MinIO initialization warning (will retry on demand): {}", e.getMessage());
        }
    }

    @Override
    public UploadResponse uploadImage(MultipartFile file, String subDirectory) {
        if (file == null || file.isEmpty()) {
            throw new BlogException(ErrorCode.INVALID_FILE_TYPE);
        }

        String displayName = UploadPaths.displayName(file.getOriginalFilename());

        // 확장자와 Content-Type 은 클라이언트가 정하는 값이라 믿지 않고, 파일 내용으로 형식을 판별한다
        ImageValidator.DetectedImage image;
        try (InputStream header = file.getInputStream()) {
            image = ImageValidator.validate(header, file.getOriginalFilename());
        } catch (IOException e) {
            throw new BlogException(ErrorCode.INVALID_FILE_TYPE);
        }
        String contentType = image.contentType();

        String dir = UploadPaths.directory(subDirectory);
        String datePath = LocalDate.now().format(DateTimeFormatter.ofPattern("yyyy/MM"));
        String uniqueFilename = UUID.randomUUID() + "." + image.extension();
        String objectKey = "%s/%s/%s".formatted(dir, datePath, uniqueFilename);

        // SVG 는 스크립트/이벤트 핸들러/외부 참조를 담을 수 있어 원본을 저장하지 않고, 허용 목록 방식으로 정제한 결과만 저장한다.
        // (정제할 수 없으면 INVALID_FILE_TYPE 으로 거부되며, 업로드 실패(FILE_UPLOAD_FAILED)로 뭉개지지 않도록 try 밖에서 처리한다)
        byte[] sanitizedSvg = ImageValidator.SVG_CONTENT_TYPE.equals(contentType) ? sanitizeSvg(file) : null;
        long storedSize = sanitizedSvg != null ? sanitizedSvg.length : file.getSize();

        try (InputStream inputStream = sanitizedSvg != null ? new ByteArrayInputStream(sanitizedSvg) : file.getInputStream()) {
            minioClient.putObject(
                    PutObjectArgs.builder()
                            .bucket(bucket)
                            .object(objectKey)
                            .stream(inputStream, storedSize, -1)
                            .contentType(contentType)
                            .build()
            );

            String fileUrl = publicUrl.replaceAll("/+$", "") + "/" + objectKey;
            log.info("Uploaded image to MinIO: key={}, size={} bytes, url={}", objectKey, storedSize, fileUrl);

            return new UploadResponse(fileUrl, displayName, contentType, storedSize);
        } catch (Exception e) {
            log.error("Failed to upload image to MinIO: {}", e.getMessage(), e);
            throw new BlogException(ErrorCode.FILE_UPLOAD_FAILED);
        }
    }

    private static byte[] sanitizeSvg(MultipartFile file) {
        if (file.getSize() > SvgSanitizer.MAX_SVG_BYTES) {
            throw new BlogException(ErrorCode.INVALID_FILE_TYPE);
        }
        try {
            return SvgSanitizer.sanitize(file.getBytes());
        } catch (IOException e) {
            throw new BlogException(ErrorCode.INVALID_FILE_TYPE);
        }
    }
}
