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

import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
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
            tagRepository.adjustPostCount(pt.getTag().getId(), -1);
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
            tagRepository.insertIfAbsent(UUID.randomUUID(), name);
            Tag tag = tagRepository.findByName(name).orElseThrow();

            tagRepository.adjustPostCount(tag.getId(), 1);

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

    /** 글 id → 태그 이름 목록. 태그가 없는 글도 빈 목록으로 포함한다. */
    @Transactional(readOnly = true)
    public Map<UUID, List<String>> getTagNamesByPostIds(Collection<UUID> postIds) {
        Map<UUID, List<String>> result = new HashMap<>();
        postIds.forEach(id -> result.put(id, new ArrayList<>()));
        if (postIds.isEmpty()) {
            return result;
        }
        for (PostTag pt : postTagRepository.findAllByPostIdsWithTag(postIds)) {
            result.get(pt.getPost().getId()).add(pt.getTag().getName());
        }
        return result;
    }

    @Transactional(readOnly = true)
    public List<TagResponse> getPopularTags() {
        return tagRepository.findTop30ByOrderByPostCountDesc().stream()
                .map(TagResponse::from)
                .toList();
    }
}
