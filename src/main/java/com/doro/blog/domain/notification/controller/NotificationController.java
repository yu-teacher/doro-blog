package com.doro.blog.domain.notification.controller;

import com.doro.blog.common.response.ApiResponse;
import com.doro.blog.domain.notification.dto.NotificationDtos.NotificationResponse;
import com.doro.blog.domain.notification.dto.NotificationDtos.UnreadCountResponse;
import com.doro.blog.domain.notification.service.NotificationService;
import com.hunnit_beasts.doro.sdk.annotation.CurrentDoroUser;
import com.hunnit_beasts.doro.sdk.domain.DoroUser;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@Tag(name = "10. Notification (알림)", description = "실시간 소셜 알림 (댓글, 좋아요, 팔로우 등) API")
@RestController
@RequestMapping("/api/v1/notifications")
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationService notificationService;

    @Operation(summary = "알림 목록 조회 (페이징)", description = "로그인 유저의 알림 목록을 최신순으로 페이징 조회합니다.")
    @GetMapping
    public ApiResponse<Page<NotificationResponse>> getNotifications(
            @RequestParam(name = "page", defaultValue = "0") int page,
            @RequestParam(name = "size", defaultValue = "20") int size,
            @CurrentDoroUser DoroUser doroUser
    ) {
        Page<NotificationResponse> result = notificationService.getNotifications(doroUser, PageRequest.of(page, size));
        return ApiResponse.success(result);
    }

    @Operation(summary = "안 읽은 알림 개수 조회", description = "로그인 유저의 읽지 않은 알림 개수를 조회합니다.")
    @GetMapping("/unread-count")
    public ApiResponse<UnreadCountResponse> getUnreadCount(
            @CurrentDoroUser DoroUser doroUser
    ) {
        UnreadCountResponse result = notificationService.getUnreadCount(doroUser);
        return ApiResponse.success(result);
    }

    @Operation(summary = "단일 알림 읽음 처리", description = "특정 알림을 읽음 상태로 변경합니다.")
    @PatchMapping("/{id}/read")
    public ApiResponse<Void> markAsRead(
            @PathVariable("id") UUID id,
            @CurrentDoroUser DoroUser doroUser
    ) {
        notificationService.markAsRead(id, doroUser);
        return ApiResponse.success(null);
    }

    @Operation(summary = "모든 알림 읽음 처리", description = "로그인 유저의 모든 읽지 않은 알림을 일괄 읽음 처리합니다.")
    @PostMapping("/read-all")
    public ApiResponse<Void> markAllAsRead(
            @CurrentDoroUser DoroUser doroUser
    ) {
        notificationService.markAllAsRead(doroUser);
        return ApiResponse.success(null);
    }

    @Operation(summary = "알림 삭제", description = "특정 알림을 삭제합니다.")
    @DeleteMapping("/{id}")
    public ApiResponse<Void> deleteNotification(
            @PathVariable("id") UUID id,
            @CurrentDoroUser DoroUser doroUser
    ) {
        notificationService.deleteNotification(id, doroUser);
        return ApiResponse.success(null);
    }
}
