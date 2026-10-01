package com.doro.blog.domain.post.service;

import com.doro.blog.domain.post.dto.PostDtos.*;
import com.doro.blog.domain.post.entity.Post;
import com.doro.blog.domain.tag.service.TagService;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.stereotype.Component;

/** 글 목록을 응답으로 바꾼다. 태그는 글마다 조회하지 않고 한 번의 쿼리로 가져온다. */
@Component
@RequiredArgsConstructor
public class PostSummaryMapper {

    private final TagService tagService;

    /** 목록의 글들을 응답으로 바꾼다. 태그는 글마다 조회하지 않고 한 번의 쿼리로 가져온다. */
    public List<PostSummaryResponse> toSummaries(List<Post> posts) {
        Map<UUID, List<String>> tagsByPost = tagService.getTagNamesByPostIds(posts.stream().map(Post::getId).toList());
        return posts.stream()
                .map(p -> PostSummaryResponse.from(p, tagsByPost.getOrDefault(p.getId(), List.of())))
                .toList();
    }

    public Page<PostSummaryResponse> toSummaries(Page<Post> page) {
        Map<UUID, List<String>> tagsByPost = tagService.getTagNamesByPostIds(page.getContent().stream().map(Post::getId).toList());
        return page.map(p -> PostSummaryResponse.from(p, tagsByPost.getOrDefault(p.getId(), List.of())));
    }
}
