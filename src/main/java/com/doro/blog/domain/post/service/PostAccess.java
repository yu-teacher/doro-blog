package com.doro.blog.domain.post.service;

import com.doro.blog.domain.post.entity.Post;
import com.doro.blog.domain.post.entity.PostStatus;
import com.hunnit_beasts.doro.sdk.client.DoroGuardClient;
import com.hunnit_beasts.doro.sdk.domain.DoroUser;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * 글을 볼 수 있는 사람의 단일 판단 지점.
 * 출간(PUBLISHED)된 글은 누구나, 비공개/임시저장 글은 작성자와 Guard 가 viewer 로 인정한 사람만 볼 수 있다.
 * 글의 하위 자원(댓글, 연관 글 등)도 같은 규칙을 따라야 하므로 여기서 한 번만 정의한다.
 */
@Component
@RequiredArgsConstructor
public class PostAccess {

    private final DoroGuardClient guardClient;

    public boolean canView(Post post, DoroUser viewer) {
        if (post.getStatus() == PostStatus.PUBLISHED) {
            return true;
        }
        if (viewer == null || !viewer.isAuthenticated()) {
            return false;
        }
        if (viewer.userId().equals(post.getUser().getId())) {
            return true;
        }
        return guardClient.check("blog_post", post.getId().toString(), "viewer", viewer.userId().toString());
    }
}
