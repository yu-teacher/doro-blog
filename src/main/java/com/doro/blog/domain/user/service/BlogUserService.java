package com.doro.blog.domain.user.service;

import com.doro.blog.common.exception.BlogException;
import com.doro.blog.common.exception.ErrorCode;
import com.doro.blog.common.util.Handles;
import com.doro.blog.domain.user.dto.BlogUserDtos.*;
import com.doro.blog.domain.notification.repository.NotificationRepository;
import com.doro.blog.domain.user.entity.BlogUser;
import com.doro.blog.domain.user.repository.BlogUserRepository;
import com.doro.blog.domain.user.repository.UserFollowRepository;
import com.hunnit_beasts.doro.sdk.domain.DoroUser;
import java.util.*;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class BlogUserService {

    private final BlogUserRepository userRepository;
    private final UserFollowRepository followRepository;
    private final NotificationRepository notificationRepository;

    /** 사용자명 후보를 이만큼까지 바꿔 가며 시도한다(이름, 이름1, 이름2 …). */
    private static final int MAX_USERNAME_ATTEMPTS = 200;

    /**
     * 로그인한 사용자만 통과시킨다. 글·댓글·시리즈 생성은 Guard 에 튜플을 쓰기 전에(= 사용자 ID 를 쓰기 전에) 이 검사를 먼저 해야 한다.
     * 익명 사용자는 ID 가 없어 그대로 쓰면 NPE(500)가 나고, 의미 없는 Guard 호출도 일어난다.
     */
    public static void requireAuthenticated(DoroUser doroUser) {
        if (doroUser == null || !doroUser.isAuthenticated()) {
            throw new BlogException(ErrorCode.UNAUTHORIZED);
        }
    }

    @Transactional
    public BlogUser getOrCreateUser(DoroUser doroUser) {
        requireAuthenticated(doroUser);

        return userRepository.findById(doroUser.userId()).orElseGet(() -> {
            log.info("JIT Provisioning new BlogUser for IAM userId={}", doroUser.userId());

            String baseUsername = UsernamePolicy.generated(doroUser.userId());

            // 같은 사용자의 첫 요청이 동시에 여러 개여도 한 번만 만들고 나머지는 만들어진 행을 읽는다.
            // 사용자명은 ID 로 만들어 사실상 겹치지 않지만, 겹쳐서 insert 가 충돌(반환 0)하면
            // 만들어졌는지 확인하고 아니면 다음 후보(이름1, 이름2, …)로 다시 시도한다.
            for (int attempt = 0; attempt < MAX_USERNAME_ATTEMPTS; attempt++) {
                String candidate = attempt == 0 ? baseUsername : baseUsername + attempt;
                if (userRepository.existsByUsername(candidate)) {
                    continue;
                }
                userRepository.insertIfAbsent(doroUser.userId(), candidate, doroUser.email(), candidate, candidate + ".log");
                Optional<BlogUser> created = userRepository.findById(doroUser.userId());
                if (created.isPresent()) {
                    return created.get();
                }
            }
            throw new BlogException(ErrorCode.DUPLICATE_RESOURCE, "사용자 이름을 정하지 못했습니다. 잠시 후 다시 시도해 주세요.");
        });
    }

    @Transactional(readOnly = true)
    public UserProfileResponse getProfileByUsername(String username, DoroUser currentUser) {
        String cleanUsername = Handles.stripAt(username);
        BlogUser user = userRepository.findByUsername(cleanUsername.toLowerCase().trim())
                .orElseThrow(() -> new BlogException(ErrorCode.USER_NOT_FOUND));

        Boolean isFollowing = null;
        if (currentUser != null && currentUser.isAuthenticated() && !currentUser.userId().equals(user.getId())) {
            isFollowing = followRepository.existsByFollowerIdAndFollowingId(currentUser.userId(), user.getId());
        }

        return UserProfileResponse.from(user, isFollowing);
    }

    @Transactional(readOnly = true)
    public UserProfileResponse getProfileById(UUID userId) {
        BlogUser user = userRepository.findById(userId)
                .orElseThrow(() -> new BlogException(ErrorCode.USER_NOT_FOUND));
        return UserProfileResponse.forOwner(user);
    }

    @Transactional
    public UserProfileResponse updateProfile(DoroUser doroUser, UpdateProfileRequest request) {
        BlogUser user = getOrCreateUser(doroUser);
        user.updateProfile(
                request.effectiveNickname(),
                request.bio(),
                request.profileImageUrl(),
                request.blogTitle(),
                request.githubUrl(),
                request.twitterUrl(),
                request.websiteUrl(),
                request.publicEmail(),
                request.linkedinUrl(),
                request.aboutMarkdown()
        );
        return UserProfileResponse.forOwner(user);
    }

    @Transactional
    public UserProfileResponse updateUsername(DoroUser doroUser, String newUsername) {
        BlogUser user = getOrCreateUser(doroUser);
        String cleanUsername = Handles.stripAt(newUsername);
        cleanUsername = cleanUsername.toLowerCase().trim();

        if (UsernamePolicy.isReserved(cleanUsername)) {
            throw new BlogException(ErrorCode.INVALID_INPUT, "사용할 수 없는 username입니다.");
        }
        if (!cleanUsername.matches("^[a-z0-9_-]{3,50}$")) {
            throw new BlogException(ErrorCode.INVALID_INPUT, "username은 3~50자의 영문 소문자, 숫자, '-', '_'만 사용 가능합니다.");
        }

        if (!user.getUsername().equals(cleanUsername) && userRepository.existsByUsername(cleanUsername)) {
            throw new BlogException(ErrorCode.SLUG_ALREADY_EXISTS, "이미 사용 중인 username입니다.");
        }

        String previousUsername = user.getUsername();
        user.updateUsername(cleanUsername);
        if (!previousUsername.equals(cleanUsername)) {
            // 알림은 글 링크를 만들려고 사용자명을 복사해 둔다. 안 바꾸면 이미 받은 알림이 옛 이름을 가리켜 깨지고,
            // 그 이름을 다른 사람이 가져가면 엉뚱한 프로필로 연결된다.
            notificationRepository.renameTargetUsername(previousUsername, cleanUsername);
        }
        return UserProfileResponse.forOwner(user);
    }
}
