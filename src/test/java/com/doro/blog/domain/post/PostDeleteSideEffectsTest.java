package com.doro.blog.domain.post;

import com.doro.blog.common.exception.BlogException;
import com.doro.blog.common.exception.ErrorCode;
import com.doro.blog.domain.comment.dto.CommentDtos.CreateCommentRequest;
import com.doro.blog.domain.comment.dto.CommentDtos.CreateReplyRequest;
import com.doro.blog.domain.comment.service.CommentService;
import com.doro.blog.domain.post.dto.PostDtos.CreatePostRequest;
import com.doro.blog.domain.post.entity.PostStatus;
import com.doro.blog.domain.post.repository.PostRepository;
import com.doro.blog.domain.post.service.PostCommandService;
import com.doro.blog.domain.tag.repository.TagRepository;
import com.hunnit_beasts.doro.sdk.domain.DoroUser;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** 삭제가 카운터에 남기는 부수효과를 검증한다 (이름만 '정합성' 인 테스트가 값을 단정하지 않던 공백을 메운다). */
@SpringBootTest
class PostDeleteSideEffectsTest {

    @Autowired private PostCommandService postCommands;
    @Autowired private CommentService commentService;
    @Autowired private PostRepository postRepository;
    @Autowired private TagRepository tagRepository;

    private DoroUser newUser(String prefix) {
        UUID id = UUID.randomUUID();
        return new DoroUser(id, prefix + "_" + id.toString().substring(0, 8) + "@doro.local", UUID.randomUUID(), 100, "USER");
    }

    private int tagCount(String name) {
        return tagRepository.findByName(name).map(t -> t.getPostCount()).orElse(0);
    }

    @Test
    @DisplayName("글을 삭제하면 그 글에 붙어 있던 태그의 글 수가 줄어든다")
    void deletingPostDecrementsTagCounts() {
        String tag = "t" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        DoroUser author = newUser("tagdel");
        var first = postCommands.createPost(author, new CreatePostRequest("첫째", null, null, "본문", null, PostStatus.PUBLISHED, null, List.of(tag)));
        var second = postCommands.createPost(author, new CreatePostRequest("둘째", null, null, "본문", null, PostStatus.PUBLISHED, null, List.of(tag)));
        assertThat(tagCount(tag)).isEqualTo(2);

        postCommands.deletePost(first.id());
        assertThat(tagCount(tag)).isEqualTo(1);

        postCommands.deletePost(second.id());
        assertThat(tagCount(tag)).isZero();
    }

    @Test
    @DisplayName("삭제 표시된 루트 댓글을 다시 삭제하면 404 이고 댓글 수는 다시 줄지 않는다")
    void doubleDeleteDoesNotDecrementTwice() {
        DoroUser author = newUser("cmtauthor");
        DoroUser reader = newUser("cmtreader");
        var post = postCommands.createPost(author, new CreatePostRequest("글", null, null, "본문", null, PostStatus.PUBLISHED, null, null));
        var root = commentService.createRootComment(post.id(), reader, new CreateCommentRequest("루트"));
        commentService.createReply(post.id(), root.id(), author, new CreateReplyRequest("답글"));
        assertThat(postRepository.findById(post.id()).orElseThrow().getCommentCount()).isEqualTo(2);

        commentService.deleteComment(root.id(), reader); // 답글이 남아 있어 소프트 삭제
        assertThat(postRepository.findById(post.id()).orElseThrow().getCommentCount()).isEqualTo(1);

        assertThatThrownBy(() -> commentService.deleteComment(root.id(), reader))
                .isInstanceOf(BlogException.class)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.COMMENT_NOT_FOUND);
        assertThat(postRepository.findById(post.id()).orElseThrow().getCommentCount()).isEqualTo(1);
    }
}
