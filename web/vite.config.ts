import { defineConfig } from 'vitest/config';
import { loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';
import { navigateDenylist, normalizeBasePath } from './src/utils/basePath';

const THEME_COLOR = '#0f172a';

/**
 * VITE_PUBLIC_ORIGIN 이 설정된 빌드에서만 절대 경로가 필요한 head 태그(og:image 등). canonical 은 라우트마다 달라 useDocumentMeta 가 페이지에서 넣는다를 넣는다.
 * 설정이 없으면 태그를 생략해 도메인을 코드에 박지 않는다.
 */
function publicOriginTags(origin: string | undefined, basePath: string): Plugin {
  const base = origin?.trim().replace(/\/+$/, '');
  return {
    name: 'public-origin-tags',
    transformIndexHtml() {
      if (!base) return [];
      return [
        { tag: 'meta', attrs: { property: 'og:image', content: `${base}${basePath}doro-logo.png` }, injectTo: 'head' },
        { tag: 'meta', attrs: { name: 'twitter:image', content: `${base}${basePath}doro-logo.png` }, injectTo: 'head' },
      ];
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, 'VITE_');
  // 게이트웨이의 공개 하위 경로(예: /blog/). 비우면 루트('/')다. 서버 배포 스크립트가 서버 .env 의 BLOG_WEB_BASE_PATH 를 VITE_BASE_PATH 로 넘긴다.
  const BASE = normalizeBasePath(process.env.VITE_BASE_PATH ?? env.VITE_BASE_PATH);
  const BASE_WITHOUT_SLASH = BASE.replace(/\/+$/, '');
  return {
  base: BASE,
  plugins: [
    react(),
    tailwindcss(),
    publicOriginTags(env.VITE_PUBLIC_ORIGIN, BASE),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['apple-touch-icon.png'],
      manifest: {
        name: 'DORO.log',
        short_name: 'DORO.log',
        description: '개발자를 위한 오픈 기술 블로그',
        lang: 'ko',
        start_url: BASE,
        scope: BASE,
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: THEME_COLOR,
        icons: [
          { src: `${BASE}icon-192.png`, sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: `${BASE}icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        // 앱 셸(정적 파일)만 캐시한다. 글·댓글·프로필 같은 API 응답과 업로드 미디어(/media/)는 캐시하지 않는다(런타임 캐시 없음).
        // 로그인(BFF) 이동은 서버 리다이렉트가 필요해 API 경로 이동은 앱 셸로 바꾸지 않는다.
        navigateFallback: `${BASE}index.html`,
        navigateFallbackDenylist: navigateDenylist(BASE),
        runtimeCaching: [],
      },
    }),
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
      // base 가 하위 경로(/blog)면 브라우저가 /blog/api/... 를 부른다. 게이트웨이가 접두사를 떼는 것과 같이 /api/... 로 바꿔 백엔드로 보낸다.
      [`${BASE_WITHOUT_SLASH}/api`]: {
        target: env.VITE_DEV_API_TARGET || 'http://localhost:8082',
        changeOrigin: true,
        rewrite: (p: string) => p.slice(BASE_WITHOUT_SLASH.length),
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
  };
});
