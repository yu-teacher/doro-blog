package com.doro.blog.domain.user.controller;

import com.doro.blog.common.web.PageLimits;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import com.doro.blog.common.response.ApiResponse;
import com.doro.blog.domain.user.dto.BlogUserDtos.*;
import com.doro.blog.domain.user.service.BlogUserService;
import com.doro.blog.domain.user.service.FollowService;
import com.doro.blog.domain.user.service.UserInsightsService;
import com.hunnit_beasts.doro.sdk.annotation.CurrentDoroUser;
import com.hunnit_beasts.doro.sdk.domain.DoroUser;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Tag(name = "1. User & Blog Channel", description = "작가 프로필 및 블로그 홈 채널 API")
@RestController
@RequestMapping("/api/v1/users")
@RequiredArgsConstructor
public class BlogUserController {

    private final BlogUserService userService;
    private final FollowService followService;
    private final UserInsightsService insightsService;

    @Operation(summary = "작가 채널 프로필 조회 (공개)", description = "/@{username} 주소로 작가 프로필 정보 조회")
    @GetMapping("/@{username}")
    public ApiResponse<UserProfileResponse> getProfileByUsername(
            @PathVariable("username") String username,
            @CurrentDoroUser DoroUser currentUser
    ) {
        return ApiResponse.success(userService.getProfileByUsername(username, currentUser));
    }

    @Operation(summary = "내 프로필 조회 (인증)", description = "현재 로그인된 작가의 프로필 조회 및 JIT 동기화")
    @GetMapping("/me")
    public ApiResponse<UserProfileResponse> getMyProfile(@CurrentDoroUser DoroUser doroUser) {
        userService.getOrCreateUser(doroUser);
        return ApiResponse.success(userService.getProfileById(doroUser.userId()));
    }

    @Operation(summary = "내 프로필 수정", description = "한 줄 소개, 블로그 타이틀, 소셜 링크, 소개글 수정 (PUT/PATCH 지원)")
    @RequestMapping(value = "/me", method = {RequestMethod.PUT, RequestMethod.PATCH})
    public ApiResponse<UserProfileResponse> updateMyProfile(
            @CurrentDoroUser DoroUser doroUser,
            @Valid @RequestBody UpdateProfileRequest request
    ) {
        return ApiResponse.success(userService.updateProfile(doroUser, request));
    }

    @Operation(summary = "내 고유 username 슬러그 변경", description = "URL 경로 식별자(@username) 변경")
    @PutMapping("/me/username")
    public ApiResponse<UserProfileResponse> updateMyUsername(
            @CurrentDoroUser DoroUser doroUser,
            @Valid @RequestBody UpdateUsernameRequest request
    ) {
        return ApiResponse.success(userService.updateUsername(doroUser, request.username()));
    }

    @Operation(summary = "작가 팔로우", description = "지정한 작가를 팔로우")
    @PostMapping("/@{username}/follow")
    public ApiResponse<UserProfileResponse> followUser(
            @PathVariable("username") String username,
            @CurrentDoroUser DoroUser currentUser
    ) {
        return ApiResponse.success(followService.followUser(currentUser, username));
    }

    @Operation(summary = "작가 언팔로우", description = "지정한 작가를 언팔로우")
    @DeleteMapping("/@{username}/follow")
    public ApiResponse<UserProfileResponse> unfollowUser(
            @PathVariable("username") String username,
            @CurrentDoroUser DoroUser currentUser
    ) {
        return ApiResponse.success(followService.unfollowUser(currentUser, username));
    }

    @Operation(summary = "작가의 팔로워 목록 조회", description = "해당 작가를 팔로우하는 사용자 목록 조회")
    @GetMapping("/@{username}/followers")
    public ApiResponse<Page<FollowUserDto>> getFollowers(
            @PathVariable("username") String username,
            @RequestParam(defaultValue = "0") @Min(PageLimits.MIN_PAGE) int page,
            @RequestParam(defaultValue = "20") @Min(PageLimits.MIN_SIZE) @Max(PageLimits.MAX_SIZE) int size,
            @CurrentDoroUser DoroUser currentUser
    ) {
        return ApiResponse.success(followService.getFollowers(username, PageRequest.of(page, size), currentUser));
    }

    @Operation(summary = "작가의 팔로잉 목록 조회", description = "해당 작가가 팔로우하는 사용자 목록 조회")
    @GetMapping("/@{username}/following")
    public ApiResponse<Page<FollowUserDto>> getFollowing(
            @PathVariable("username") String username,
            @RequestParam(defaultValue = "0") @Min(PageLimits.MIN_PAGE) int page,
            @RequestParam(defaultValue = "20") @Min(PageLimits.MIN_SIZE) @Max(PageLimits.MAX_SIZE) int size,
            @CurrentDoroUser DoroUser currentUser
    ) {
        return ApiResponse.success(followService.getFollowing(username, PageRequest.of(page, size), currentUser));
    }

    @Operation(summary = "작가의 태그 목록 및 글 수 집계", description = "채널 좌측 사이드바에 표시할 작가의 사용 태그 목록")
    @GetMapping("/@{username}/tags")
    public ApiResponse<List<UserTagSummaryDto>> getUserTags(@PathVariable("username") String username) {
        return ApiResponse.success(insightsService.getUserTags(username));
    }

    @Operation(summary = "작가의 연간 글 작성 히트맵 데이터", description = "최근 1년간 일자별 발행 글 개수 (잔디밭 데이터)")
    @GetMapping("/@{username}/activity")
    public ApiResponse<List<UserActivityDto>> getUserActivity(@PathVariable("username") String username) {
        return ApiResponse.success(insightsService.getUserActivity(username));
    }
}
