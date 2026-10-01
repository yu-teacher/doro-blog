/** 제목으로 URL 슬러그를 만든다 (한글 허용, 공백은 '-'). */
export function generateSlug(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/[^\w\s가-힣-]/g, '')
    .replace(/\s+/g, '-');
}
