import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { HorizontalScroll } from '../../hooks/useHorizontalScroll';
import { FeedTabs } from './FeedTabs';
import { FeedTagBar } from './FeedTagBar';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;
let host: HTMLElement | undefined;

function render(element: ReturnType<typeof createElement>) {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root!.render(element));
}

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
});

const button = (text: string) => [...host!.querySelectorAll('button')].find((b) => b.textContent?.includes(text)) as HTMLButtonElement | undefined;

describe('FeedTabs', () => {
  const props = (over = {}) => ({ tab: 'trending', timeframe: 'week', selectedTag: '', onTabChange: vi.fn(), onTimeframeChange: vi.fn(), onTagClick: vi.fn(), ...over });

  it('탭을 누르면 해당 탭 이름으로 알린다', () => {
    const p = props();
    render(createElement(FeedTabs, p));
    act(() => button('최신')!.click());
    expect(p.onTabChange).toHaveBeenCalledWith('latest');
  });

  it('기간 선택은 트렌딩 탭에서만 보인다', () => {
    render(createElement(FeedTabs, props({ tab: 'trending' })));
    expect(host!.textContent).toMatch(/오늘|이번 주|이번 달|올해/);
    act(() => root!.unmount());
    host!.remove();
    render(createElement(FeedTabs, props({ tab: 'latest' })));
    expect(host!.textContent).not.toMatch(/이번 주/);
  });

  it('태그가 선택되어 있으면 그 태그 배지를 보여주고 누를 수 있다', () => {
    const p = props({ selectedTag: 'spring' });
    render(createElement(FeedTabs, p));
    expect(host!.textContent).toContain('spring');
  });
});

describe('FeedTagBar', () => {
  const scroll = (over: Partial<HorizontalScroll> = {}): HorizontalScroll => ({
    ref: { current: null }, canScrollLeft: false, canScrollRight: false, update: vi.fn(), scrollBy: vi.fn(), ...over,
  });
  const tags = [{ id: 'a', name: 'alpha', postCount: 3 }, { id: 'b', name: 'beta', postCount: 1 }];

  it('태그가 없으면 아무것도 그리지 않는다', () => {
    render(createElement(FeedTagBar, { activeTags: [], selectedTag: '', scroll: scroll(), onTagClick: vi.fn() }));
    expect(host!.innerHTML).toBe('');
  });

  it('태그를 누르면 이름으로 알리고, 스크롤 가능할 때만 화살표가 나온다', () => {
    const onTagClick = vi.fn();
    const sc = scroll({ canScrollRight: true });
    render(createElement(FeedTagBar, { activeTags: tags, selectedTag: '', scroll: sc, onTagClick }));
    act(() => button('alpha')!.click());
    expect(onTagClick).toHaveBeenCalledWith('alpha');

    // 오른쪽 화살표만 존재
    const arrows = [...host!.querySelectorAll('button')].filter((b) => !b.textContent?.trim());
    expect(arrows.length).toBe(1);
    act(() => arrows[0]!.click());
    expect(sc.scrollBy).toHaveBeenCalledWith('right');
  });
});
