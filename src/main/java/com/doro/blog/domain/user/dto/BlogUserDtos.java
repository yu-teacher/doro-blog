package com.doro.blog.domain.user.dto;

import com.doro.blog.domain.user.entity.BlogUser;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.UUID;

public class BlogUserDtos {

    public record UserProfileResponse(
            UUID id,
            String username,
            String email,
            String nickname,
            String bio,
            String profileImageUrl,
            String blogTitle,
            String githubUrl,
            String twitterUrl,
            String websiteUrl,
            Instant createdAt
    ) {
        public static UserProfileResponse from(BlogUser user) {
            return new UserProfileResponse(
                    user.getId(),
                    user.getUsername(),
                    user.getEmail(),
                    user.getNickname(),
                    user.getBio(),
                    user.getProfileImageUrl(),
                    user.getBlogTitle(),
                    user.getGithubUrl(),
                    user.getTwitterUrl(),
                    user.getWebsiteUrl(),
                    user.getCreatedAt()
            );
        }
    }

    public record UpdateProfileRequest(
            @Size(max = 50, message = "닉네임은 최대 50자입니다.")
            String nickname,

            @Size(max = 255, message = "한 줄 소개는 최대 255자입니다.")
            String bio,

            String profileImageUrl,

            @Size(max = 100, message = "블로그 타이틀은 최대 100자입니다.")
            String blogTitle,

            String githubUrl,
            String twitterUrl,
            String websiteUrl
    ) {}

    public record UpdateUsernameRequest(
            @NotBlank(message = "username은 필수입니다.")
            @Size(min = 3, max = 50, message = "username은 3~50자 사이여야 합니다.")
            String username
    ) {}
}
