package com.doro.blog.domain.user.service;

import com.doro.blog.common.exception.BlogException;
import com.doro.blog.common.exception.ErrorCode;
import com.doro.blog.common.util.Handles;
import com.doro.blog.domain.user.dto.BlogUserDtos.*;
import com.doro.blog.domain.user.entity.BlogUser;
import com.doro.blog.domain.user.repository.BlogUserRepository;
import com.doro.blog.domain.user.repository.UserFollowRepository;
import com.hunnit_beasts.doro.sdk.domain.DoroUser;
import java.util.*;
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

    @Transactional
    public BlogUser getOrCreateUser(DoroUser doroUser) {
        if (!doroUser.isAuthenticated()) {
            throw new BlogException(ErrorCode.UNAUTHORIZED);
        }

        return userRepository.findById(doroUser.userId()).orElseGet(() -> {
            log.info("JIT Provisioning new BlogUser for IAM userId={}", doroUser.userId());

            String baseUsername = UsernamePolicy.baseFromEmail(doroUser.email(), doroUser.userIndex());

            String finalUsername = baseUsername;
            int counter = 1;
            while (userRepository.existsByUsername(finalUsername)) {
                finalUsername = baseUsername + counter++;
            }

            // 첫 요청이 동시에 여러 개 들어와도 한 번만 만들고 나머지는 만들어진 행을 읽는다.
            userRepository.insertIfAbsent(doroUser.userId(), finalUsername, doroUser.email(),
                    finalUsername, finalUsername + ".log");
            return userRepository.findById(doroUser.userId())
                    .orElseThrow(() -> new BlogException(ErrorCode.USER_NOT_FOUND));
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

        user.updateUsername(cleanUsername);
        return UserProfileResponse.forOwner(user);
    }
}
