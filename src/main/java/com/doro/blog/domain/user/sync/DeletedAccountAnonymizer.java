package com.doro.blog.domain.user.sync;

import com.doro.blog.domain.apikey.repository.ApiKeyLogRepository;
import com.doro.blog.domain.apikey.repository.ApiKeyRepository;
import com.doro.blog.domain.auth.repository.AuthSessionRepository;
import com.doro.blog.domain.notification.repository.NotificationRepository;
import com.doro.blog.domain.post.repository.PostRepository;
import com.doro.blog.domain.post.service.PostCommandService;
import com.doro.blog.domain.user.entity.BlogUser;
import com.doro.blog.domain.user.repository.BlogUserRepository;
import com.doro.blog.domain.user.repository.UserFollowRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

/**
 * Doro 에서 영구 탈퇴한 사용자의 블로그 프로필 개인정보를 익명화한다. 글·댓글·좋아요는 남기고 작성자만
 * '탈퇴한 사용자' 로 보이게 하며, 사용자 본인에게만 의미 있던 데이터(API 키·호출 기록·BFF 세션·알림함·팔로우)는 지운다.
 * 본인만 볼 수 있던 임시저장·비공개 글은 지운다(그 안의 이미지 파일 포함, 공개 글이 같이 쓰는 파일은 남긴다).
 * 이미 처리한 사용자에게 다시 호출해도 아무것도 바꾸지 않는다(멱등).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class DeletedAccountAnonymizer {

    static final String PLACEHOLDER_NICKNAME = "탈퇴한 사용자";
    static final String PLACEHOLDER_BLOG_TITLE = "탈퇴한 사용자의 블로그";

    private final BlogUserRepository users;
    private final UserFollowRepository follows;
    private final ApiKeyRepository apiKeys;
    private final ApiKeyLogRepository apiKeyLogs;
    private final AuthSessionRepository authSessions;
    private final NotificationRepository notifications;
    private final PostRepository postRepository;
    private final PostCommandService postCommands;

    /** @return 이번 호출에서 익명화했으면 true, 블로그 사용자가 아니거나 이미 처리됐으면 false */
    @Transactional
    public boolean anonymize(UUID userId, Instant now) {
        BlogUser user = users.findById(userId).orElse(null);
        if (user == null || user.isDeleted()) {
            return false;
        }

        // 공개된 적 없는 글(임시저장·비공개)은 작성자 본인만 볼 수 있던 개인 데이터라 남길 이유가 없다.
        // 글 삭제와 같은 경로를 써서 시리즈 글 수·태그 집계·Guard 튜플·업로드 파일 정리가 함께 처리된다.
        for (UUID postId : postRepository.findNonPublishedIdsByUserId(userId)) {
            postCommands.deletePost(postId);
        }

        String oldUsername = user.getUsername();
        String compactId = userId.toString().replace("-", "");
        String newUsername = "deleted-" + compactId;
        user.anonymize(newUsername, newUsername + "@deleted.invalid", PLACEHOLDER_NICKNAME, PLACEHOLDER_BLOG_TITLE, now);
        // 알림에 복사해 둔 글 작성자 사용자명도 바꿔, 다른 사람 알림의 글 링크가 깨지지 않게 한다.
        notifications.renameTargetUsername(oldUsername, newUsername);

        // 이 사용자와 맺은 팔로우를 지우고, 상대방의 팔로워/팔로잉 수를 맞춘다.
        for (UUID followerId : follows.findFollowerIds(userId)) {
            users.adjustFollowingCount(followerId, -1);
        }
        for (UUID followingId : follows.findFollowingIds(userId)) {
            users.adjustFollowerCount(followingId, -1);
        }
        follows.deleteAllInvolving(userId);

        apiKeyLogs.deleteAllByUserId(userId);
        apiKeys.deleteAllByUserId(userId);
        authSessions.deleteAllByUserId(userId);
        notifications.deleteAllByRecipientId(userId);

        log.info("Blog profile anonymized after Doro account deletion: userId={}", userId);
        return true;
    }
}
