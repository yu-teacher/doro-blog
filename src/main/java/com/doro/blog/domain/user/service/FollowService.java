package com.doro.blog.domain.user.service;

import com.doro.blog.common.exception.BlogException;
import com.doro.blog.common.exception.ErrorCode;
import com.doro.blog.common.util.Handles;
import com.doro.blog.domain.notification.entity.NotificationType;
import com.doro.blog.domain.notification.service.NotificationService;
import com.doro.blog.domain.user.dto.BlogUserDtos.*;
import com.doro.blog.domain.user.entity.BlogUser;
import com.doro.blog.domain.user.entity.UserFollow;
import com.doro.blog.domain.user.repository.BlogUserRepository;
import com.doro.blog.domain.user.repository.UserFollowRepository;
import com.hunnit_beasts.doro.sdk.client.DoroGuardClient;
import com.hunnit_beasts.doro.sdk.domain.DoroUser;
import jakarta.persistence.EntityManager;
import java.util.*;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 팔로우/언팔로우와 팔로워·팔로잉 목록. */
@Slf4j
@Service
@RequiredArgsConstructor
public class FollowService {

    private final BlogUserRepository userRepository;
    private final UserFollowRepository followRepository;
    private final BlogUserService userService;
    private final DoroGuardClient guardClient;
    private final NotificationService notificationService;
    private final EntityManager entityManager;

    @Transactional
    public UserProfileResponse followUser(DoroUser currentUser, String targetUsername) {
        BlogUser me = userService.getOrCreateUser(currentUser);
        String cleanUsername = Handles.stripAt(targetUsername);
        BlogUser target = userRepository.findByUsername(cleanUsername.toLowerCase().trim())
                .orElseThrow(() -> new BlogException(ErrorCode.USER_NOT_FOUND));

        if (me.getId().equals(target.getId())) {
            throw new BlogException(ErrorCode.INVALID_INPUT, "자신을 팔로우할 수 없습니다.");
        }

        // 확인 후 저장하면 더블클릭 시 둘 다 "없음"으로 보고 중복 삽입(unique 위반)이 난다.
        // 삽입 결과 행 수로 판단해, 실제로 팔로우가 생긴 요청만 카운터를 움직인다.
        if (followRepository.insertFollowIfAbsent(UUID.randomUUID(), me.getId(), target.getId()) > 0) {
            userRepository.adjustFollowerCount(target.getId(), 1);
            userRepository.adjustFollowingCount(me.getId(), 1);
            entityManager.refresh(target);

            try {
                guardClient.writeTuple("blog_user", target.getId().toString(), "follower", "user", me.getId().toString());
            } catch (Exception e) {
                log.warn("Failed to sync follow relation tuple to Guard: {}", e.getMessage());
            }

            // 알림 발송: 팔로우 대상자에게 알림
            notificationService.sendNotification(
                    target,
                    me,
                    NotificationType.FOLLOW,
                    null,
                    target.getUsername(),
                    null
            );
        }

        return UserProfileResponse.from(target, true);
    }

    @Transactional
    public UserProfileResponse unfollowUser(DoroUser currentUser, String targetUsername) {
        BlogUser me = userService.getOrCreateUser(currentUser);
        String cleanUsername = Handles.stripAt(targetUsername);
        BlogUser target = userRepository.findByUsername(cleanUsername.toLowerCase().trim())
                .orElseThrow(() -> new BlogException(ErrorCode.USER_NOT_FOUND));

        if (followRepository.deleteFollow(me.getId(), target.getId()) > 0) {
            userRepository.adjustFollowerCount(target.getId(), -1);
            userRepository.adjustFollowingCount(me.getId(), -1);
            entityManager.refresh(target);

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
        BlogUser target = findByHandle(username);
        Page<UserFollow> page = followRepository.findByFollowingIdOrderByCreatedAtDesc(target.getId(), pageable);
        return toFollowDtos(page, UserFollow::getFollowerId, pageable, currentUser);
    }

    @Transactional(readOnly = true)
    public Page<FollowUserDto> getFollowing(String username, Pageable pageable, DoroUser currentUser) {
        BlogUser target = findByHandle(username);
        Page<UserFollow> page = followRepository.findByFollowerIdOrderByCreatedAtDesc(target.getId(), pageable);
        return toFollowDtos(page, UserFollow::getFollowingId, pageable, currentUser);
    }

    private BlogUser findByHandle(String username) {
        return userRepository.findByUsername(Handles.stripAt(username).toLowerCase().trim())
                .orElseThrow(() -> new BlogException(ErrorCode.USER_NOT_FOUND));
    }

    /**
     * 팔로우 한 페이지를 사용자 목록 응답으로 바꾼다. otherSide 는 각 팔로우에서 목록에 보여줄 상대방(팔로워 목록이면 follower,
     * 팔로잉 목록이면 following)의 id 이고, 현재 로그인한 사용자가 그 상대를 팔로우 중인지도 함께 채운다.
     */
    private Page<FollowUserDto> toFollowDtos(Page<UserFollow> page, Function<UserFollow, UUID> otherSide, Pageable pageable, DoroUser currentUser) {
        List<UUID> otherIds = page.getContent().stream().map(otherSide).toList();
        if (otherIds.isEmpty()) {
            return Page.empty(pageable);
        }

        Map<UUID, BlogUser> usersById = userRepository.findAllById(otherIds).stream()
                .collect(Collectors.toMap(BlogUser::getId, u -> u));

        Set<UUID> followedByMe = Collections.emptySet();
        if (currentUser != null && currentUser.isAuthenticated()) {
            followedByMe = followRepository.findByFollowerIdAndFollowingIdIn(currentUser.userId(), otherIds).stream()
                    .map(UserFollow::getFollowingId)
                    .collect(Collectors.toSet());
        }

        List<FollowUserDto> dtos = new ArrayList<>();
        for (UserFollow follow : page.getContent()) {
            BlogUser other = usersById.get(otherSide.apply(follow));
            if (other == null) {
                continue;
            }
            dtos.add(new FollowUserDto(other.getId(), other.getUsername(), other.getNickname(), other.getProfileImageUrl(),
                    other.getBio(), followedByMe.contains(other.getId()), follow.getCreatedAt()));
        }
        return new PageImpl<>(dtos, pageable, page.getTotalElements());
    }
}
