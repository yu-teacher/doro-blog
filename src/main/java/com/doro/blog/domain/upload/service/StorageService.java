package com.doro.blog.domain.upload.service;

import com.doro.blog.domain.upload.dto.UploadResponse;
import org.springframework.web.multipart.MultipartFile;

public interface StorageService {
    UploadResponse uploadImage(MultipartFile file, String subDirectory);
}
