/** 서버 검증과 같은 한도 (CommentDtos @Size). */
export const COMMENT_MAX_LENGTH = 2000;

/** 댓글과 답글을 합친 전체 개수 (삭제 표시된 댓글도 포함). */
export function countComments(comments: ReadonlyArray<{ replies?: ReadonlyArray<unknown> | null }>): number {
  return comments.reduce((total, c) => total + 1 + (c.replies?.length ?? 0), 0);
}

/** 아바타에 보여줄 첫 글자. 닉네임이 비어 있어도 깨지지 않는다. */
export function avatarInitial(nickname: string | null | undefined): string {
  return nickname?.trim().charAt(0).toUpperCase() || '?';
}
