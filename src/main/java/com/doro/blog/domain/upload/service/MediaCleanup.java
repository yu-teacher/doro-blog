package com.doro.blog.domain.upload.service;

import com.doro.blog.domain.post.repository.PostRepository;
import com.doro.blog.domain.series.repository.SeriesRepository;
import com.doro.blog.domain.user.repository.BlogUserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.Set;
import java.util.UUID;

/**
 * 글을 지운 뒤 더 이상 어디에서도 쓰이지 않는 업로드 파일을 스토리지에서 지운다.
 * 다른 글·시리즈·프로필이 같은 파일을 가리키면 남겨 두고, 실제 삭제는 DB 커밋이 확정된 뒤에 한다.
 * 글 수정 중 사라진 이미지는 지우지 않는다: 에디터에서 되돌리기(undo)로 다시 나타날 수 있기 때문이다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class MediaCleanup {

    private final StorageService storage;
    private final PostRepository postRepository;
    private final SeriesRepository seriesRepository;
    private final BlogUserRepository userRepository;

    /** 삭제되는 글(deletedPostId)을 제외하고 아무도 쓰지 않는 파일만 커밋 후 지운다. */
    public void deleteUnreferencedAfterCommit(UUID deletedPostId, Set<String> candidateKeys) {
        Set<String> orphans = candidateKeys.stream()
                .filter(key -> !isReferenced(deletedPostId, key))
                .collect(java.util.stream.Collectors.toUnmodifiableSet());
        if (orphans.isEmpty()) {
            return;
        }
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            orphans.forEach(this::deleteQuietly);
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                orphans.forEach(MediaCleanup.this::deleteQuietly);
            }
        });
    }

    private boolean isReferenced(UUID deletedPostId, String key) {
        return postRepository.existsOtherPostReferencing(deletedPostId, key)
                || seriesRepository.existsByThumbnailUrlContaining(key)
                || userRepository.existsByProfileImageUrlContaining(key);
    }

    private void deleteQuietly(String key) {
        try {
            storage.delete(key);
        } catch (RuntimeException e) {
            // 글은 이미 지워졌으므로 요청은 성공시키고, 남은 파일은 추적할 수 있게 남긴다.
            log.warn("Committed but could not delete media object: key={}", key, e);
        }
    }
}
