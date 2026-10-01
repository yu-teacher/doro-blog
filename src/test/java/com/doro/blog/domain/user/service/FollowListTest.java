package com.doro.blog.domain.user.service;

import com.hunnit_beasts.doro.sdk.domain.DoroUser;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.PageRequest;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
class FollowListTest {

    @Autowired
    private BlogUserService userService;

    @Autowired
    private FollowService followService;

    private DoroUser mockUser(String prefix) {
        UUID id = UUID.randomUUID();
        return new DoroUser(id, prefix + "_" + id.toString().substring(0, 8) + "@doro.local", UUID.randomUUID(), 100, "USER");
    }

    @Test
    @DisplayName("팔로워/팔로잉 목록이 상대방을 올바르게 보여주고, 현재 사용자가 그 상대를 팔로우 중인지 표시한다")
    void listsShowTheOtherSideAndMyFollowState() {
        DoroUser alice = mockUser("alice");
        DoroUser bob = mockUser("bob");
        DoroUser carol = mockUser("carol");
        String aliceName = userService.getOrCreateUser(alice).getUsername();
        String bobName = userService.getOrCreateUser(bob).getUsername();
        String carolName = userService.getOrCreateUser(carol).getUsername();

        followService.followUser(bob, aliceName);    // bob -> alice
        followService.followUser(carol, aliceName);  // carol -> alice
        followService.followUser(alice, carolName);  // alice -> carol
        followService.followUser(carol, bobName);    // carol -> bob (carol 의 팔로우 상태 확인용)

        // alice 의 팔로워: bob, carol (상대방 = 팔로우한 사람)
        var followers = followService.getFollowers(aliceName, PageRequest.of(0, 10), carol);
        assertThat(followers.getContent()).extracting(f -> f.username()).containsExactlyInAnyOrder(bobName, carolName);
        // 보는 사람(carol)이 bob 은 팔로우 중, 자기 자신은 팔로우 중이 아님
        assertThat(followers.getContent().stream().filter(f -> f.username().equals(bobName)).findFirst().orElseThrow().isFollowing()).isTrue();
        assertThat(followers.getContent().stream().filter(f -> f.username().equals(carolName)).findFirst().orElseThrow().isFollowing()).isFalse();

        // alice 의 팔로잉: carol 하나 (상대방 = 팔로우 받은 사람)
        var following = followService.getFollowing(aliceName, PageRequest.of(0, 10), null);
        assertThat(following.getContent()).extracting(f -> f.username()).containsExactly(carolName);
        assertThat(following.getContent().get(0).isFollowing()).isFalse();   // 비로그인이면 항상 false
        assertThat(following.getTotalElements()).isEqualTo(1);
    }

    @Test
    @DisplayName("팔로워가 없으면 빈 페이지")
    void emptyList() {
        DoroUser lonely = mockUser("lonely");
        String name = userService.getOrCreateUser(lonely).getUsername();
        assertThat(followService.getFollowers(name, PageRequest.of(0, 10), null).getContent()).isEmpty();
    }
}
