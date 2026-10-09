/**
 * 목록에서 from 번째 항목을 to 번째 자리로 옮긴 새 배열을 돌려준다(원본은 바꾸지 않는다).
 * 범위를 벗어난 인덱스이거나 제자리면 같은 배열 그대로 돌려줘서 호출 측이 "바뀐 것이 없음"을 === 로 알 수 있다.
 */
export function moveItem<T>(list: readonly T[], from: number, to: number): readonly T[] {
  const inRange = (i: number) => Number.isInteger(i) && i >= 0 && i < list.length;
  if (!inRange(from) || !inRange(to) || from === to) {
    return list;
  }
  const next = list.slice();
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}
