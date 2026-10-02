package com.doro.blog.domain.upload.service;

import com.doro.blog.domain.upload.dto.UploadResponse;
import org.springframework.web.multipart.MultipartFile;

public interface StorageService {
    UploadResponse uploadImage(MultipartFile file, String subDirectory);

    /** 오브젝트 키(예: posts/2026/10/uuid.png)의 파일을 지운다. 없으면 무시한다. */
    void delete(String objectKey);
}
