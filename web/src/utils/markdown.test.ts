import { describe, expect, it } from 'vitest';
import { extractFirstImage } from './markdown';

describe('extractFirstImage', () => {
  it('첫 이미지의 주소를 돌려준다 (http(s), /media/, /uploads/)', () => {
    expect(extractFirstImage('앞글 ![a](https://x.test/a.png) ![b](https://x.test/b.png)')).toBe('https://x.test/a.png');
    expect(extractFirstImage('![m](/media/posts/1.png)')).toBe('/media/posts/1.png');
    expect(extractFirstImage('![u](/uploads/2.png) tail')).toBe('/uploads/2.png');
  });

  it('허용되지 않는 주소나 이미지가 없으면 null', () => {
    expect(extractFirstImage('![x](javascript:alert(1))')).toBeNull();
    expect(extractFirstImage('![x](data:image/png;base64,AAAA)')).toBeNull();
    expect(extractFirstImage('이미지 없음')).toBeNull();
  });
});
