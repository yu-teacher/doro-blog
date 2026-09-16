package com.doro.blog.domain.user.service;

import com.doro.blog.common.exception.BlogException;
import com.doro.blog.common.exception.ErrorCode;
import com.doro.blog.domain.user.dto.BlogUserDtos.UpdateProfileRequest;
import com.doro.blog.domain.user.dto.BlogUserDtos.UserProfileResponse;
import com.doro.blog.domain.user.entity.BlogUser;
import com.doro.blog.domain.user.repository.BlogUserRepository;
import com.hunnit_beasts.doro.sdk.domain.DoroUser;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class BlogUserService {

    private final BlogUserRepository userRepository;

    @Transactional
    public BlogUser getOrCreateUser(DoroUser doroUser) {
        if (!doroUser.isAuthenticated()) {
            throw new BlogException(ErrorCode.UNAUTHORIZED);
        }

        return userRepository.findById(doroUser.userId()).orElseGet(() -> {
            log.info("JIT Provisioning new BlogUser for IAM userId={}", doroUser.userId());

            String baseUsername = doroUser.email().split("@")[0].toLowerCase().replaceAll("[^a-z0-9_-]", "");
            if (baseUsername.length() < 3) {
                baseUsername = "user" + doroUser.userIndex();
            }

            String finalUsername = baseUsername;
            int counter = 1;
            while (userRepository.existsByUsername(finalUsername)) {
                finalUsername = baseUsername + counter++;
            }

            BlogUser newUser = BlogUser.builder()
                    .id(doroUser.userId())
                    .username(finalUsername)
                    .email(doroUser.email())
                    .nickname(finalUsername)
                    .blogTitle(finalUsername + ".log")
                    .build();

            return userRepository.save(newUser);
        });
    }

    @Transactional(readOnly = true)
    public UserProfileResponse getProfileByUsername(String username) {
        String cleanUsername = username.startsWith("@") ? username.substring(1) : username;
        BlogUser user = userRepository.findByUsername(cleanUsername.toLowerCase().trim())
                .orElseThrow(() -> new BlogException(ErrorCode.USER_NOT_FOUND));
        return UserProfileResponse.from(user);
    }

    @Transactional(readOnly = true)
    public UserProfileResponse getProfileById(UUID userId) {
        BlogUser user = userRepository.findById(userId)
                .orElseThrow(() -> new BlogException(ErrorCode.USER_NOT_FOUND));
        return UserProfileResponse.from(user);
    }

    @Transactional
    public UserProfileResponse updateProfile(DoroUser doroUser, UpdateProfileRequest request) {
        BlogUser user = getOrCreateUser(doroUser);
        user.updateProfile(
                request.nickname(),
                request.bio(),
                request.profileImageUrl(),
                request.blogTitle(),
                request.githubUrl(),
                request.twitterUrl(),
                request.websiteUrl()
        );
        return UserProfileResponse.from(user);
    }

    @Transactional
    public UserProfileResponse updateUsername(DoroUser doroUser, String newUsername) {
        BlogUser user = getOrCreateUser(doroUser);
        String cleanUsername = newUsername.startsWith("@") ? newUsername.substring(1) : newUsername;
        cleanUsername = cleanUsername.toLowerCase().trim();

        if (!cleanUsername.matches("^[a-z0-9_-]{3,50}$")) {
            throw new BlogException(ErrorCode.INVALID_INPUT, "username은 3~50자의 영문 소문자, 숫자, '-', '_'만 사용 가능합니다.");
        }

        if (!user.getUsername().equals(cleanUsername) && userRepository.existsByUsername(cleanUsername)) {
            throw new BlogException(ErrorCode.SLUG_ALREADY_EXISTS, "이미 사용 중인 username입니다.");
        }

        user.updateUsername(cleanUsername);
        return UserProfileResponse.from(user);
    }
}
