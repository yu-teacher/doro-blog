package com.doro.blog.domain.tag.service;

import com.doro.blog.domain.post.entity.Post;
import com.doro.blog.domain.post.entity.PostStatus;
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

    /**
     * 글 삭제 시 태그별 글 수에서 이 글을 뺀다. 연결 행 자체는 글 삭제와 함께 DB 가 지운다.
     * 태그 글 수는 공개된(PUBLISHED) 글만 세므로, 지우는 글이 공개 상태였을 때만 뺀다.
     */
    @Transactional
    public void releasePostTags(UUID postId, boolean wasCounted) {
        if (!wasCounted) {
            return;
        }
        postTagRepository.findTagIdsByPostId(postId).stream()
                .sorted()
                .forEach(tagId -> tagRepository.adjustPostCount(tagId, -1));
    }

    /**
     * 글의 태그를 바꾼다. 태그별 글 수는 공개된 글만 센다.
     *
     * @param countedBefore 바꾸기 전에 이 글이 글 수에 포함돼 있었는지(= 이전 상태가 PUBLISHED). 옛 연결을 뺄 때만 쓴다.
     *                      새 연결을 더할지는 이 글의 현재 상태(post.getStatus())로 정한다.
     */
    @Transactional
    public void syncPostTags(Post post, List<String> rawTagNames, boolean countedBefore) {
        // 기존 태그 연결 조회 및 카운트 감소
        List<PostTag> currentPostTags = postTagRepository.findAllByPostIdWithTag(post.getId());
        // 동시 요청끼리 같은 태그 행을 서로 다른 순서로 잠그면 교착이 나므로 항상 id 순으로 갱신한다
        if (countedBefore) {
            currentPostTags.stream()
                    .map(pt -> pt.getTag().getId())
                    .sorted()
                    .forEach(tagId -> tagRepository.adjustPostCount(tagId, -1));
        }
        postTagRepository.deleteAllByPostId(post.getId());
        boolean countNow = post.getStatus() == PostStatus.PUBLISHED;

        if (rawTagNames == null || rawTagNames.isEmpty()) {
            return;
        }

        // 중복 제거 및 정규화
        List<String> normalizedNames = rawTagNames.stream()
                .filter(name -> name != null && !name.isBlank())
                .map(TagNames::normalize)
                .filter(name -> !name.isEmpty())
                .distinct()
                .sorted()
                .toList();

        for (String name : normalizedNames) {
            tagRepository.insertIfAbsent(UUID.randomUUID(), name);
            Tag tag = tagRepository.findByName(name).orElseThrow();

            if (countNow) {
                tagRepository.adjustPostCount(tag.getId(), 1);
            }

            PostTag postTag = PostTag.builder()
                    .post(post)
                    .tag(tag)
                    .build();
            postTagRepository.save(postTag);
        }
    }

    /** 태그는 그대로 두고 글의 공개 여부만 바뀌었을 때, 태그별 글 수를 맞춘다. */
    @Transactional
    public void adjustForStatusChange(Post post, boolean wasPublished) {
        boolean isPublished = post.getStatus() == PostStatus.PUBLISHED;
        if (wasPublished == isPublished) {
            return;
        }
        int delta = isPublished ? 1 : -1;
        postTagRepository.findTagIdsByPostId(post.getId()).stream()
                .sorted()
                .forEach(tagId -> tagRepository.adjustPostCount(tagId, delta));
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
        // 글이 하나도 없는 태그(모두 지워졌거나 비공개뿐)는 목록에 올리지 않는다
        return tagRepository.findTop30ByPostCountGreaterThanOrderByPostCountDesc(0).stream()
                .map(TagResponse::from)
                .toList();
    }
}
