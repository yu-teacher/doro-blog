package com.doro.blog.domain.tag.dto;

import com.doro.blog.domain.tag.entity.Tag;

import java.util.UUID;

public class TagDtos {

    public record TagResponse(
            UUID id,
            String name,
            int postCount
    ) {
        public static TagResponse from(Tag tag) {
            return new TagResponse(tag.getId(), tag.getName(), tag.getPostCount());
        }
    }
}
