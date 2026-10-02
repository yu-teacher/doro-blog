package com.doro.blog.domain.user.dto;

import com.doro.blog.domain.user.entity.BlogUser;
import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.UUID;

public class BlogUserDtos {

    /** 빈 값(삭제) 또는 http(s) 절대 URL 만 허용한다. javascript:, data: 같은 스킴은 저장 단계에서 거부한다. */
    public static final String HTTP_URL_OR_EMPTY = "^$|^https?://\\S+$";
    /** 이미지: 빈 값, http(s) 절대 URL, 또는 자체 미디어 경로(/media/...)만 허용한다. ('//host' 형태는 거부) */
    public static final String IMAGE_URL_OR_EMPTY = "^$|^https?://\\S+$|^/(?!/)\\S*$";
    /** DB 컬럼 길이에 맞춘다: 이미지 주소 VARCHAR(500), 소셜/웹사이트 링크 VARCHAR(255). 넘는 값은 500 이 아니라 400 으로 거부한다. */
    public static final int MAX_IMAGE_URL_LENGTH = 500;
    public static final int MAX_LINK_URL_LENGTH = 255;

    public record UserProfileResponse(
            UUID id,
            String username,
            /** IAM 계정 이메일(비공개). 본인 응답({@link #forOwner})에서만 채워지고, 공개 응답에서는 키 자체가 빠진다. */
            @JsonInclude(JsonInclude.Include.NON_NULL) String email,
            String nickname,
            String bio,
            String profileImageUrl,
            String blogTitle,
            String githubUrl,
            String twitterUrl,
            String websiteUrl,
            String publicEmail,
            String linkedinUrl,
            String aboutMarkdown,
            int followerCount,
            int followingCount,
            Boolean isFollowing,
            Instant createdAt
    ) {
        /** 공개 프로필: 계정 이메일을 담지 않는다. 방문자용 연락처는 {@code publicEmail} 이다. */
        public static UserProfileResponse from(BlogUser user, Boolean isFollowing) {
            return build(user, isFollowing, null);
        }

        /** 본인 프로필: 계정 이메일을 포함한다. */
        public static UserProfileResponse forOwner(BlogUser user) {
            return build(user, null, user.getEmail());
        }

        private static UserProfileResponse build(BlogUser user, Boolean isFollowing, String accountEmail) {
            return new UserProfileResponse(
                    user.getId(),
                    user.getUsername(),
                    accountEmail,
                    user.getNickname(),
                    user.getBio(),
                    user.getProfileImageUrl(),
                    user.getBlogTitle(),
                    user.getGithubUrl(),
                    user.getTwitterUrl(),
                    user.getWebsiteUrl(),
                    user.getPublicEmail(),
                    user.getLinkedinUrl(),
                    user.getAboutMarkdown(),
                    user.getFollowerCount(),
                    user.getFollowingCount(),
                    isFollowing,
                    user.getCreatedAt()
            );
        }
    }

    public record UpdateProfileRequest(
            @Size(max = 50, message = "닉네임은 최대 50자입니다.")
            String nickname,

            @Size(max = 50, message = "이름은 최대 50자입니다.")
            String name,

            @Size(max = 255, message = "한 줄 소개는 최대 255자입니다.")
            String bio,

            @Size(max = MAX_IMAGE_URL_LENGTH, message = "프로필 이미지 주소는 최대 500자입니다.")
            @Pattern(regexp = IMAGE_URL_OR_EMPTY, flags = Pattern.Flag.CASE_INSENSITIVE,
                    message = "프로필 이미지 주소는 http(s) 또는 /media 경로만 허용됩니다.")
            String profileImageUrl,

            @Size(max = 100, message = "블로그 타이틀은 최대 100자입니다.")
            String blogTitle,

            @Size(max = MAX_LINK_URL_LENGTH, message = "GitHub 주소는 최대 255자입니다.")
            @Pattern(regexp = HTTP_URL_OR_EMPTY, flags = Pattern.Flag.CASE_INSENSITIVE, message = "GitHub 주소는 http(s) 주소여야 합니다.")
            String githubUrl,

            @Size(max = MAX_LINK_URL_LENGTH, message = "Twitter 주소는 최대 255자입니다.")
            @Pattern(regexp = HTTP_URL_OR_EMPTY, flags = Pattern.Flag.CASE_INSENSITIVE, message = "Twitter 주소는 http(s) 주소여야 합니다.")
            String twitterUrl,

            @Size(max = MAX_LINK_URL_LENGTH, message = "웹사이트 주소는 최대 255자입니다.")
            @Pattern(regexp = HTTP_URL_OR_EMPTY, flags = Pattern.Flag.CASE_INSENSITIVE, message = "웹사이트 주소는 http(s) 주소여야 합니다.")
            String websiteUrl,

            @Email(message = "공개 이메일 형식이 올바르지 않습니다.")
            @Size(max = 100, message = "공개 이메일은 최대 100자입니다.")
            String publicEmail,

            @Size(max = MAX_LINK_URL_LENGTH, message = "LinkedIn 주소는 최대 255자입니다.")
            @Pattern(regexp = HTTP_URL_OR_EMPTY, flags = Pattern.Flag.CASE_INSENSITIVE, message = "LinkedIn 주소는 http(s) 주소여야 합니다.")
            String linkedinUrl,

            String aboutMarkdown
    ) {
        public String effectiveNickname() {
            if (nickname != null && !nickname.isBlank()) {
                return nickname;
            }
            return name;
        }
    }

    public record UpdateUsernameRequest(
            @NotBlank(message = "username은 필수입니다.")
            @Size(min = 3, max = 50, message = "username은 3~50자 사이여야 합니다.")
            String username
    ) {}

    public record UserTagSummaryDto(
            String name,
            long postCount
    ) {}

    public record UserActivityDto(
            String date,
            long count
    ) {}

    public record FollowUserDto(
            UUID id,
            String username,
            String nickname,
            String profileImageUrl,
            String bio,
            boolean isFollowing,
            Instant followedAt
    ) {}
}
