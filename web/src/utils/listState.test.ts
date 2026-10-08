import { describe, expect, it } from 'vitest';
import { listState } from './listState';

describe('목록 화면 상태 판단', () => {
  it('불러오는 중이면 데이터가 있어도 로딩으로 본다', () => {
    expect(listState({ loading: true, error: null, count: 0 })).toBe('loading');
    expect(listState({ loading: true, error: null, count: 3 })).toBe('loading');
  });

  it('조회에 실패했고 보여 줄 데이터가 없으면 "비어 있음"이 아니라 오류로 본다 (실패가 빈 목록처럼 보이면 데이터가 사라진 것으로 오해한다)', () => {
    expect(listState({ loading: false, error: '서버 오류', count: 0 })).toBe('error');
  });

  it('조회에 실패해도 이미 받아 둔 데이터가 있으면 그것을 계속 보여 준다', () => {
    expect(listState({ loading: false, error: '서버 오류', count: 2 })).toBe('list');
  });

  it('오류 없이 데이터가 0개면 비어 있음, 있으면 목록', () => {
    expect(listState({ loading: false, error: null, count: 0 })).toBe('empty');
    expect(listState({ loading: false, error: null, count: 1 })).toBe('list');
  });
});
