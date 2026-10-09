/** 마크다운 이미지의 대체 글자(alt)에 넣을 수 있게 파일 이름에서 [ ] ( ) 를 뺀다. 남겨 두면 이미지 문법이 깨진다. */
export function altText(fileName: string): string {
  return fileName.replace(/[[\]()]/g, '');
}

/** 업로드하는 동안 본문에 끼워 넣는 로컬 미리보기(blob) 이미지. 업로드가 끝나면 영구 주소로 바꾼다. */
export function uploadPlaceholder(fileName: string, blobUrl: string): string {
  return `![${altText(fileName)} 업로드 중...](${blobUrl})\n`;
}

/**
 * 본문에서 placeholder 를 처음 나온 한 곳만 replacement 로 바꾼다.
 * String.prototype.replace 에 문자열을 그대로 넘기면 replacement 속의 $&, $`, $\', $$ 가 특수 패턴으로 해석돼
 * 파일 이름이나 주소에 이런 글자가 있을 때 본문이 깨지므로 직접 잘라 이어 붙인다.
 */
export function replacePlaceholder(content: string, placeholder: string, replacement: string): string {
  const index = content.indexOf(placeholder);
  if (index < 0) return content;
  return content.slice(0, index) + replacement + content.slice(index + placeholder.length);
}
