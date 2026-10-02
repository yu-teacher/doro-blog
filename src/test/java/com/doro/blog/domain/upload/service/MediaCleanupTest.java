package com.doro.blog.domain.upload.service;

import com.doro.blog.domain.post.dto.PostDtos.CreatePostRequest;
import com.doro.blog.domain.post.entity.PostStatus;
import com.doro.blog.domain.post.service.PostCommandService;
import com.hunnit_beasts.doro.sdk.domain.DoroUser;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.util.UUID;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

@SpringBootTest
class MediaCleanupTest {

    @MockitoBean private StorageService storage;
    @Autowired private PostCommandService postCommands;

    private DoroUser newUser() {
        UUID id = UUID.randomUUID();
        return new DoroUser(id, "media_" + id.toString().substring(0, 8) + "@doro.local", UUID.randomUUID(), 100, "USER");
    }

    private static String newKey(String folder) {
        return folder + "/2026/10/" + UUID.randomUUID() + ".png";
    }

    private com.doro.blog.domain.post.dto.PostDtos.PostSummaryResponse post(DoroUser author, String content, String thumbnail) {
        return postCommands.createPost(author, new CreatePostRequest("제목", null, null, content, thumbnail, PostStatus.PUBLISHED, null, null));
    }

    @Test
    @DisplayName("글을 지우면 그 글만 쓰던 본문 이미지와 썸네일이 스토리지에서 지워진다")
    void deletesFilesOnlyThisPostUsed() {
        DoroUser author = newUser();
        String bodyKey = newKey("posts");
        String thumbKey = newKey("thumbnails");
        var created = post(author, "![img](/media/" + bodyKey + ")", "/media/" + thumbKey);

        postCommands.deletePost(created.id());

        verify(storage).delete(bodyKey);
        verify(storage).delete(thumbKey);
    }

    @Test
    @DisplayName("다른 글이 같은 이미지를 쓰고 있으면 지우지 않는다")
    void keepsFilesSharedWithAnotherPost() {
        DoroUser author = newUser();
        String sharedKey = newKey("posts");
        var first = post(author, "![img](/media/" + sharedKey + ")", null);
        var second = post(author, "같은 이미지 ![img](/media/" + sharedKey + ")", null);

        postCommands.deletePost(first.id());
        verify(storage, never()).delete(anyString());

        postCommands.deletePost(second.id());
        verify(storage).delete(sharedKey);
    }

    @Test
    @DisplayName("스토리지 삭제가 실패해도 글 삭제는 성공한다")
    void storageFailureDoesNotFailPostDeletion() {
        DoroUser author = newUser();
        String key = newKey("posts");
        var created = post(author, "![img](/media/" + key + ")", null);
        org.mockito.Mockito.doThrow(new IllegalStateException("minio down")).when(storage).delete(key);

        postCommands.deletePost(created.id());

        verify(storage).delete(key);
    }
}
