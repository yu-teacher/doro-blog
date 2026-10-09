import { isValidElement } from 'react';
import type { ReactNode } from 'react';

/**
 * React 노드에서 화면에 보이는 글자만 이어 붙여 꺼낸다.
 * rehype-highlight 로 문법 강조된 코드는 자식이 문자열이 아니라 <span> 요소의 배열이라 String(children) 하면 "[object Object]" 가 되기 때문에,
 * 코드 복사 버튼은 이 함수로 원문 코드를 만든다.
 */
export function nodeText(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(nodeText).join('');
  if (isValidElement(node)) return nodeText((node.props as { children?: ReactNode }).children);
  return '';
}
