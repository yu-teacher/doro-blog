package com.doro.blog.domain.upload.service;

import com.doro.blog.domain.comment.dto.CommentDtos.CreateCommentRequest;
import com.doro.blog.domain.comment.service.CommentService;
import com.doro.blog.domain.post.dto.PostDtos.CreatePostRequest;
import com.doro.blog.domain.post.dto.PostDtos.PostSummaryResponse;
import com.doro.blog.domain.post.entity.PostStatus;
import com.doro.blog.domain.post.service.PostCommandService;
import com.hunnit_beasts.doro.sdk.domain.DoroUser;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.util.UUID;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

/** 글을 지울 때, 같은 이미지를 다른 곳(소개글, 댓글)에서도 쓰고 있으면 파일을 지우지 않는다. */
@SpringBootTest
class MediaCleanupReferencesTest {

    @MockitoBean private StorageService storage;
    @Autowired private PostCommandService postCommands;
    @Autowired private CommentService commentService;
    @Autowired private JdbcTemplate jdbc;

    private DoroUser newUser() {
        UUID id = UUID.randomUUID();
        return new DoroUser(id, "mref_" + id.toString().substring(0, 8) + "@doro.local", UUID.randomUUID(), 100, "USER");
    }

    private static String newKey() {
        return "posts/2026/10/" + UUID.randomUUID() + ".png";
    }

    private PostSummaryResponse postWith(DoroUser author, String key) {
        return postCommands.createPost(author, new CreatePostRequest("제목", null, null, "![img](/media/" + key + ")",
                null, PostStatus.PUBLISHED, null, null));
    }

    @Test
    @DisplayName("작성자 소개글(about_markdown)이 같은 이미지를 쓰면 글을 지워도 파일을 지우지 않는다")
    void imageUsedInAboutMarkdownIsKept() {
        DoroUser author = newUser();
        String key = newKey();
        PostSummaryResponse post = postWith(author, key);
        jdbc.update("update blog_users set about_markdown = ? where id = ?", "소개 ![me](/media/" + key + ")", author.userId());

        postCommands.deletePost(post.id());

        verify(storage, never()).delete(key);
    }

    @Test
    @DisplayName("다른 글의 댓글 본문이 같은 이미지를 쓰면 글을 지워도 파일을 지우지 않는다")
    void imageUsedInCommentIsKept() {
        DoroUser author = newUser();
        DoroUser other = newUser();
        String key = newKey();
        PostSummaryResponse post = postWith(author, key);
        PostSummaryResponse otherPost = postCommands.createPost(other, new CreatePostRequest("다른 글", null, null, "본문",
                null, PostStatus.PUBLISHED, null, null));
        commentService.createRootComment(otherPost.id(), other, new CreateCommentRequest("이미지 ![x](/media/" + key + ")"));

        postCommands.deletePost(post.id());

        verify(storage, never()).delete(anyString());
    }
}
