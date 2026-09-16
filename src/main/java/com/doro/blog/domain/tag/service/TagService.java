package com.doro.blog.domain.tag.service;

import com.doro.blog.domain.post.entity.Post;
import com.doro.blog.domain.tag.dto.TagDtos.TagResponse;
import com.doro.blog.domain.tag.entity.PostTag;
import com.doro.blog.domain.tag.entity.Tag;
import com.doro.blog.domain.tag.repository.PostTagRepository;
import com.doro.blog.domain.tag.repository.TagRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collections;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class TagService {

    private final TagRepository tagRepository;
    private final PostTagRepository postTagRepository;

    @Transactional
    public void syncPostTags(Post post, List<String> rawTagNames) {
        // 기존 태그 연결 조회 및 카운트 감소
        List<PostTag> currentPostTags = postTagRepository.findAllByPostIdWithTag(post.getId());
        for (PostTag pt : currentPostTags) {
            pt.getTag().decrementPostCount();
        }
        postTagRepository.deleteAllByPostId(post.getId());

        if (rawTagNames == null || rawTagNames.isEmpty()) {
            return;
        }

        // 중복 제거 및 정규화
        List<String> normalizedNames = rawTagNames.stream()
                .filter(name -> name != null && !name.isBlank())
                .map(name -> name.trim().toLowerCase().replaceAll("[^a-z0-9가-힣_-]", ""))
                .filter(name -> !name.isEmpty())
                .distinct()
                .toList();

        for (String name : normalizedNames) {
            Tag tag = tagRepository.findByName(name).orElseGet(() ->
                    tagRepository.save(Tag.builder().name(name).postCount(0).build())
            );

            tag.incrementPostCount();

            PostTag postTag = PostTag.builder()
                    .post(post)
                    .tag(tag)
                    .build();
            postTagRepository.save(postTag);
        }
    }

    @Transactional(readOnly = true)
    public List<String> getPostTagNames(UUID postId) {
        return postTagRepository.findAllByPostIdWithTag(postId).stream()
                .map(pt -> pt.getTag().getName())
                .toList();
    }

    @Transactional(readOnly = true)
    public List<TagResponse> getPopularTags() {
        return tagRepository.findTop30ByOrderByPostCountDesc().stream()
                .map(TagResponse::from)
                .toList();
    }
}
