package com.doro.blog.domain.user.sync;

import com.doro.blog.common.tx.Transactions;
import com.doro.blog.domain.comment.repository.CommentRepository;
import com.doro.blog.domain.post.repository.PostRepository;
import com.doro.blog.domain.series.repository.SeriesRepository;
import com.doro.blog.domain.user.repository.UserFollowRepository;
import com.hunnit_beasts.doro.sdk.client.DoroGuardClient;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.UUID;

/**
 * 영구 탈퇴한 사용자를 주체로(또는 팔로우 대상으로) 하는 블로그 Guard 튜플을 지운다. 글·댓글·시리즈는 익명화되어 남지만
 * 그 작성자·소유자 튜플은 더 이상 쓸 곳이 없고, 탈퇴마다 쌓이지 않게 한다.
 * Guard 는 주체로 지우는 API 가 없어 블로그 DB 에서 대상 ID 를 모아 하나씩 지운다. 없는 튜플을 지워도 안전하다(멱등).
 * 호출 측은 DB 트랜잭션 밖에서 부른다(Guard 호출이 연결을 쥐지 않게 조회만 짧은 읽기 트랜잭션을 쓴다).
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DeletedAccountGuardCleaner {

    private final DoroGuardClient guard;
    private final Transactions tx;
    private final PostRepository posts;
    private final CommentRepository comments;
    private final SeriesRepository series;
    private final UserFollowRepository follows;

    /** 하나라도 지우지 못하면 예외를 던진다. 호출 측이 다음 주기에 같은 사용자를 다시 처리해 마저 지운다. */
    public void removeTuplesOrThrow(UUID userId) {
        String user = userId.toString();
        Targets t = tx.read(() -> new Targets(
                posts.findIdsByUserId(userId), comments.findIdsByUserId(userId), series.findIdsByUserId(userId),
                follows.findFollowingIds(userId), follows.findFollowerIds(userId)));

        t.postIds().forEach(id -> guard.deleteTupleOrThrow("blog_post", id.toString(), "author", "user", user, null));
        t.commentIds().forEach(id -> guard.deleteTupleOrThrow("blog_comment", id.toString(), "author", "user", user, null));
        t.seriesIds().forEach(id -> guard.deleteTupleOrThrow("blog_series", id.toString(), "owner", "user", user, null));
        // 이 사용자가 팔로우하던 사람: blog_user:<대상>#follower@user:<이 사용자>
        t.followingIds().forEach(id -> guard.deleteTupleOrThrow("blog_user", id.toString(), "follower", "user", user, null));
        // 이 사용자를 팔로우하던 사람: blog_user:<이 사용자>#follower@user:<팔로워>
        t.followerIds().forEach(id -> guard.deleteTupleOrThrow("blog_user", user, "follower", "user", id.toString(), null));

        log.info("Removed Guard tuples of deleted account: userId={}, posts={}, comments={}, series={}, following={}, followers={}",
                userId, t.postIds().size(), t.commentIds().size(), t.seriesIds().size(), t.followingIds().size(), t.followerIds().size());
    }

    private record Targets(List<UUID> postIds, List<UUID> commentIds, List<UUID> seriesIds,
                           List<UUID> followingIds, List<UUID> followerIds) {
    }
}
