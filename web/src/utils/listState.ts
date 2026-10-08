/** 목록 화면이 보여 줄 상태. */
export type ListState = 'loading' | 'error' | 'empty' | 'list';

interface ListStateInput {
  loading: boolean;
  /** 마지막 조회가 실패했으면 사용자에게 보여 줄 메시지, 아니면 null */
  error: string | null;
  /** 지금 화면에 보여 줄 수 있는 항목 수 */
  count: number;
}

/**
 * 조회 실패를 "데이터가 없음"으로 보여 주면 사용자는 데이터가 사라진 줄 안다(배포·재시작 직후 잠깐의 오류, 만료된 로그인 등).
 * 그래서 보여 줄 데이터가 없을 때 실패는 빈 목록이 아니라 오류로 구분한다. 이미 받아 둔 데이터가 있으면 그대로 보여 준다.
 */
export function listState({ loading, error, count }: ListStateInput): ListState {
  if (loading) return 'loading';
  if (count > 0) return 'list';
  return error ? 'error' : 'empty';
}
