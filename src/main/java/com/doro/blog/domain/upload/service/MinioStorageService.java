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

import java.io.InputStream;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;
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

    @Value("${doro.storage.minio.public-url:http://localhost:9000/doro-blog-media}")
    private String publicUrl;

    private MinioClient minioClient;

    private static final Set<String> ALLOWED_CONTENT_TYPES = new HashSet<>(Arrays.asList(
            "image/jpeg",
            "image/png",
            "image/gif",
            "image/webp",
            "image/svg+xml",
            "image/jpg"
    ));

    private static final Set<String> ALLOWED_EXTENSIONS = new HashSet<>(Arrays.asList(
            "jpg", "jpeg", "png", "gif", "webp", "svg"
    ));

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

        String originalFilename = file.getOriginalFilename() != null ? file.getOriginalFilename() : "image.png";
        String extension = extractExtension(originalFilename);
        String contentType = file.getContentType();

        // Validate type & extension
        if (!ALLOWED_EXTENSIONS.contains(extension.toLowerCase()) ||
                (contentType != null && !ALLOWED_CONTENT_TYPES.contains(contentType.toLowerCase()))) {
            throw new BlogException(ErrorCode.INVALID_FILE_TYPE);
        }

        if (contentType == null || contentType.isBlank()) {
            contentType = "image/" + extension;
        }

        String dir = (subDirectory != null && !subDirectory.isBlank()) ? subDirectory.trim() : "posts";
        String datePath = LocalDate.now().format(DateTimeFormatter.ofPattern("yyyy/MM"));
        String uniqueFilename = UUID.randomUUID().toString() + "." + extension;
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

            return new UploadResponse(fileUrl, originalFilename, contentType, file.getSize());
        } catch (Exception e) {
            log.error("Failed to upload image to MinIO: {}", e.getMessage(), e);
            throw new BlogException(ErrorCode.FILE_UPLOAD_FAILED);
        }
    }

    private String extractExtension(String filename) {
        int dotIndex = filename.lastIndexOf('.');
        if (dotIndex > 0 && dotIndex < filename.length() - 1) {
            return filename.substring(dotIndex + 1).toLowerCase();
        }
        return "png";
    }
}
