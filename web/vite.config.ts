import { defineConfig } from 'vitest/config';
import { loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

/**
 * VITE_PUBLIC_ORIGIN 이 설정된 빌드에서만 절대 경로가 필요한 head 태그(og:image 등). canonical 은 라우트마다 달라 useDocumentMeta 가 페이지에서 넣는다를 넣는다.
 * 설정이 없으면 태그를 생략해 도메인을 코드에 박지 않는다.
 */
function publicOriginTags(origin: string | undefined): Plugin {
  const base = origin?.trim().replace(/\/+$/, '');
  return {
    name: 'public-origin-tags',
    transformIndexHtml() {
      if (!base) return [];
      return [
        { tag: 'meta', attrs: { property: 'og:image', content: `${base}/doro-logo.png` }, injectTo: 'head' },
        { tag: 'meta', attrs: { name: 'twitter:image', content: `${base}/doro-logo.png` }, injectTo: 'head' },
      ];
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    tailwindcss(),
    publicOriginTags(loadEnv(mode, __dirname, 'VITE_').VITE_PUBLIC_ORIGIN),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return undefined;
          if (/node_modules\/(react|react-dom|react-router|react-router-dom|scheduler)\//.test(id)) return 'vendor-react';
          if (/node_modules\/(react-markdown|remark-|rehype-|unified|mdast-|hast-|micromark|unist-|vfile|highlight\.js|lowlight|devlop|decode-named|character-entities|property-information|space-separated|comma-separated|bail|trough|is-plain-obj|trim-lines|html-url|estree-util|ccount|markdown-table|zwitch|longest-streak)/.test(id)) return 'vendor-markdown';
          return undefined;
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    // 감사에서 확정된 버그를 재현하는 테스트(*.bug.test.ts)는 수정 전까지 기본 실행에서 뺀다. 따로 돌리려면: KNOWN_BUGS=1 npx vitest run
    include: process.env.KNOWN_BUGS ? ['src/**/*.bug.test.ts'] : ['src/**/*.test.ts'],
    exclude: process.env.KNOWN_BUGS ? ['**/node_modules/**'] : ['**/node_modules/**', '**/*.bug.test.ts'],
  },
  server: {
    port: 3002,
    proxy: {
      '/api': {
        target: 'http://localhost:8082',
        changeOrigin: true,
      },
      '/iam': {
        target: 'http://localhost:28080',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/iam/, ''),
      },
      '/media': {
        target: 'http://localhost:9000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/media/, '/doro-blog-media'),
      },
    },
  },
}));
