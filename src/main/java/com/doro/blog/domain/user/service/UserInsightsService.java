package com.doro.blog.domain.user.service;

import com.doro.blog.common.exception.BlogException;
import com.doro.blog.common.exception.ErrorCode;
import com.doro.blog.common.util.Handles;
import com.doro.blog.domain.post.repository.PostRepository;
import com.doro.blog.domain.user.dto.BlogUserDtos.*;
import com.doro.blog.domain.user.entity.BlogUser;
import com.doro.blog.domain.user.repository.BlogUserRepository;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 채널 소개 화면용 통계: 태그별 글 수와 날짜별 활동. */
@Slf4j
@Service
@RequiredArgsConstructor
public class UserInsightsService {

    private final BlogUserRepository userRepository;
    private final PostRepository postRepository;

    @Transactional(readOnly = true)
    public List<UserTagSummaryDto> getUserTags(String username) {
        String cleanUsername = Handles.stripAt(username);
        BlogUser target = userRepository.findByUsername(cleanUsername.toLowerCase().trim())
                .orElseThrow(() -> new BlogException(ErrorCode.USER_NOT_FOUND));

        List<Object[]> rawList = postRepository.countTagsByUserId(target.getId());
        return rawList.stream()
                .map(r -> new UserTagSummaryDto((String) r[0], ((Number) r[1]).longValue()))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<UserActivityDto> getUserActivity(String username) {
        String cleanUsername = Handles.stripAt(username);
        BlogUser target = userRepository.findByUsername(cleanUsername.toLowerCase().trim())
                .orElseThrow(() -> new BlogException(ErrorCode.USER_NOT_FOUND));

        Instant since = Instant.now().minus(365, ChronoUnit.DAYS);
        List<Object[]> rawList = postRepository.countDailyPostsByUserIdSince(target.getId(), since);
        return rawList.stream()
                .map(r -> new UserActivityDto((String) r[0], ((Number) r[1]).longValue()))
                .toList();
    }
}
