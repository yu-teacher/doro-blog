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

                // Set public download policy
                String policy = """
                        {
                          "Version": "2012-10-17",
                          "Statement": [
                            {
                              "Effect": "Allow",
                              "Principal": {"AWS": ["*"]},
                              "Action": ["s3:GetBucketLocation", "s3:ListBucket"],
                              "Resource": ["arn:aws:s3:::%s"]
                            },
                            {
                              "Effect": "Allow",
                              "Principal": {"AWS": ["*"]},
                              "Action": ["s3:GetObject"],
                              "Resource": ["arn:aws:s3:::%s/*"]
                            }
                          ]
                        }
                        """.formatted(bucket, bucket);

                minioClient.setBucketPolicy(
                        SetBucketPolicyArgs.builder()
                                .bucket(bucket)
                                .config(policy)
                                .build()
                );
                log.info("Configured public read policy for bucket: {}", bucket);
            }
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

        try (InputStream inputStream = file.getInputStream()) {
            minioClient.putObject(
                    PutObjectArgs.builder()
                            .bucket(bucket)
                            .object(objectKey)
                            .stream(inputStream, file.getSize(), -1)
                            .contentType(contentType)
                            .build()
            );

            String fileUrl = publicUrl.replaceAll("/+$", "") + "/" + objectKey;
            log.info("Uploaded image to MinIO: key={}, size={} bytes, url={}", objectKey, file.getSize(), fileUrl);

            return new UploadResponse(fileUrl, displayName, contentType, file.getSize());
        } catch (Exception e) {
            log.error("Failed to upload image to MinIO: {}", e.getMessage(), e);
            throw new BlogException(ErrorCode.FILE_UPLOAD_FAILED);
        }
    }
}
