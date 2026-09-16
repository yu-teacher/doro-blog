package com.doro.blog.domain.user.service;

import com.doro.blog.common.exception.BlogException;
import com.doro.blog.common.exception.ErrorCode;
import com.doro.blog.domain.post.repository.PostRepository;
import com.doro.blog.domain.user.dto.BlogUserDtos.*;
import com.doro.blog.domain.user.entity.BlogUser;
import com.doro.blog.domain.user.entity.UserFollow;
import com.doro.blog.domain.user.repository.BlogUserRepository;
import com.doro.blog.domain.user.repository.UserFollowRepository;
import com.hunnit_beasts.doro.sdk.client.DoroGuardClient;
import com.hunnit_beasts.doro.sdk.domain.DoroUser;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class BlogUserService {

    private final BlogUserRepository userRepository;
    private final UserFollowRepository followRepository;
    private final PostRepository postRepository;
    private final DoroGuardClient guardClient;

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
    public UserProfileResponse getProfileByUsername(String username, DoroUser currentUser) {
        String cleanUsername = username.startsWith("@") ? username.substring(1) : username;
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
        return UserProfileResponse.from(user, null);
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
                request.websiteUrl(),
                request.publicEmail(),
                request.linkedinUrl(),
                request.aboutMarkdown()
        );
        return UserProfileResponse.from(user, null);
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
        return UserProfileResponse.from(user, null);
    }

    @Transactional
    public UserProfileResponse followUser(DoroUser currentUser, String targetUsername) {
        BlogUser me = getOrCreateUser(currentUser);
        String cleanUsername = targetUsername.startsWith("@") ? targetUsername.substring(1) : targetUsername;
        BlogUser target = userRepository.findByUsername(cleanUsername.toLowerCase().trim())
                .orElseThrow(() -> new BlogException(ErrorCode.USER_NOT_FOUND));

        if (me.getId().equals(target.getId())) {
            throw new BlogException(ErrorCode.INVALID_INPUT, "자신을 팔로우할 수 없습니다.");
        }

        if (!followRepository.existsByFollowerIdAndFollowingId(me.getId(), target.getId())) {
            followRepository.save(UserFollow.builder()
                    .followerId(me.getId())
                    .followingId(target.getId())
                    .build());

            target.incrementFollowerCount();
            me.incrementFollowingCount();

            try {
                guardClient.writeTuple("blog_user", target.getId().toString(), "follower", "user", me.getId().toString());
            } catch (Exception e) {
                log.warn("Failed to sync follow relation tuple to Guard: {}", e.getMessage());
            }
        }

        return UserProfileResponse.from(target, true);
    }

    @Transactional
    public UserProfileResponse unfollowUser(DoroUser currentUser, String targetUsername) {
        BlogUser me = getOrCreateUser(currentUser);
        String cleanUsername = targetUsername.startsWith("@") ? targetUsername.substring(1) : targetUsername;
        BlogUser target = userRepository.findByUsername(cleanUsername.toLowerCase().trim())
                .orElseThrow(() -> new BlogException(ErrorCode.USER_NOT_FOUND));

        if (followRepository.existsByFollowerIdAndFollowingId(me.getId(), target.getId())) {
            followRepository.deleteByFollowerIdAndFollowingId(me.getId(), target.getId());

            target.decrementFollowerCount();
            me.decrementFollowingCount();

            try {
                guardClient.deleteTuple("blog_user", target.getId().toString(), "follower", "user", me.getId().toString());
            } catch (Exception e) {
                log.warn("Failed to delete follow relation tuple from Guard: {}", e.getMessage());
            }
        }

        return UserProfileResponse.from(target, false);
    }

    @Transactional(readOnly = true)
    public Page<FollowUserDto> getFollowers(String username, Pageable pageable, DoroUser currentUser) {
        String cleanUsername = username.startsWith("@") ? username.substring(1) : username;
        BlogUser target = userRepository.findByUsername(cleanUsername.toLowerCase().trim())
                .orElseThrow(() -> new BlogException(ErrorCode.USER_NOT_FOUND));

        Page<UserFollow> followPage = followRepository.findByFollowingIdOrderByCreatedAtDesc(target.getId(), pageable);
        List<UUID> followerIds = followPage.map(UserFollow::getFollowerId).toList();
        if (followerIds.isEmpty()) {
            return Page.empty(pageable);
        }

        Map<UUID, BlogUser> userMap = userRepository.findAllById(followerIds).stream()
                .collect(Collectors.toMap(BlogUser::getId, u -> u));

        Set<UUID> myFollowingSet = Collections.emptySet();
        if (currentUser != null && currentUser.isAuthenticated()) {
            myFollowingSet = followRepository.findByFollowerIdAndFollowingIdIn(currentUser.userId(), followerIds)
                    .stream().map(UserFollow::getFollowingId).collect(Collectors.toSet());
        }

        final Set<UUID> followingSet = myFollowingSet;
        List<FollowUserDto> dtoList = followPage.getContent().stream()
                .map(f -> {
                    BlogUser u = userMap.get(f.getFollowerId());
                    if (u == null) return null;
                    boolean isFollowing = followingSet.contains(u.getId());
                    return new FollowUserDto(
                            u.getId(),
                            u.getUsername(),
                            u.getNickname(),
                            u.getProfileImageUrl(),
                            u.getBio(),
                            isFollowing,
                            f.getCreatedAt()
                    );
                })
                .filter(Objects::nonNull)
                .toList();

        return new PageImpl<>(dtoList, pageable, followPage.getTotalElements());
    }

    @Transactional(readOnly = true)
    public Page<FollowUserDto> getFollowing(String username, Pageable pageable, DoroUser currentUser) {
        String cleanUsername = username.startsWith("@") ? username.substring(1) : username;
        BlogUser target = userRepository.findByUsername(cleanUsername.toLowerCase().trim())
                .orElseThrow(() -> new BlogException(ErrorCode.USER_NOT_FOUND));

        Page<UserFollow> followPage = followRepository.findByFollowerIdOrderByCreatedAtDesc(target.getId(), pageable);
        List<UUID> followingIds = followPage.map(UserFollow::getFollowingId).toList();
        if (followingIds.isEmpty()) {
            return Page.empty(pageable);
        }

        Map<UUID, BlogUser> userMap = userRepository.findAllById(followingIds).stream()
                .collect(Collectors.toMap(BlogUser::getId, u -> u));

        Set<UUID> myFollowingSet = Collections.emptySet();
        if (currentUser != null && currentUser.isAuthenticated()) {
            myFollowingSet = followRepository.findByFollowerIdAndFollowingIdIn(currentUser.userId(), followingIds)
                    .stream().map(UserFollow::getFollowingId).collect(Collectors.toSet());
        }

        final Set<UUID> followingSet = myFollowingSet;
        List<FollowUserDto> dtoList = followPage.getContent().stream()
                .map(f -> {
                    BlogUser u = userMap.get(f.getFollowingId());
                    if (u == null) return null;
                    boolean isFollowing = followingSet.contains(u.getId());
                    return new FollowUserDto(
                            u.getId(),
                            u.getUsername(),
                            u.getNickname(),
                            u.getProfileImageUrl(),
                            u.getBio(),
                            isFollowing,
                            f.getCreatedAt()
                    );
                })
                .filter(Objects::nonNull)
                .toList();

        return new PageImpl<>(dtoList, pageable, followPage.getTotalElements());
    }

    @Transactional(readOnly = true)
    public List<UserTagSummaryDto> getUserTags(String username) {
        String cleanUsername = username.startsWith("@") ? username.substring(1) : username;
        BlogUser target = userRepository.findByUsername(cleanUsername.toLowerCase().trim())
                .orElseThrow(() -> new BlogException(ErrorCode.USER_NOT_FOUND));

        List<Object[]> rawList = postRepository.countTagsByUserId(target.getId());
        return rawList.stream()
                .map(r -> new UserTagSummaryDto((String) r[0], ((Number) r[1]).longValue()))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<UserActivityDto> getUserActivity(String username) {
        String cleanUsername = username.startsWith("@") ? username.substring(1) : username;
        BlogUser target = userRepository.findByUsername(cleanUsername.toLowerCase().trim())
                .orElseThrow(() -> new BlogException(ErrorCode.USER_NOT_FOUND));

        Instant since = Instant.now().minus(365, ChronoUnit.DAYS);
        List<Object[]> rawList = postRepository.countDailyPostsByUserIdSince(target.getId(), since);
        return rawList.stream()
                .map(r -> new UserActivityDto((String) r[0], ((Number) r[1]).longValue()))
                .toList();
    }
}
