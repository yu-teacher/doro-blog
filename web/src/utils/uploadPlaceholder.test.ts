import { describe, expect, it } from 'vitest';
import { altText, replacePlaceholder, uploadPlaceholder } from './uploadPlaceholder';

describe('이미지 업로드 자리표시자', () => {
  it('파일 이름의 대괄호·소괄호는 마크다운 이미지 문법을 깨지 않도록 바꾼다', () => {
    expect(altText('내 사진 [최종] (1).png')).toBe('내 사진 최종 1.png');
    expect(uploadPlaceholder('a]b(c).png', 'blob:1')).toBe('![abc.png 업로드 중...](blob:1)\n');
  });

  it('치환 문자열의 $&, $`, $\', $$ 가 특수 패턴으로 해석되지 않는다', () => {
    const placeholder = uploadPlaceholder('x.png', 'blob:1');
    const content = `앞\n${placeholder}뒤`;

    const result = replacePlaceholder(content, placeholder, "![a$&b$`c$'d$$e](https://u/x.png)\n");

    expect(result).toBe("앞\n![a$&b$`c$'d$$e](https://u/x.png)\n뒤");
  });

  it('자리표시자가 이미 사라졌으면(사용자가 지웠으면) 본문을 그대로 둔다', () => {
    expect(replacePlaceholder('그냥 본문', '![x 업로드 중...](blob:1)\n', '![y](u)\n')).toBe('그냥 본문');
  });

  it('같은 자리표시자가 두 번 있어도 하나만 바꾼다', () => {
    const p = '![x 업로드 중...](blob:1)\n';
    expect(replacePlaceholder(`${p}${p}`, p, 'OK\n')).toBe(`OK\n${p}`);
  });
});
