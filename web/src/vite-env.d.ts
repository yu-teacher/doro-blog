/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 사이트의 공개 origin (예: https://example.com, 끝 슬래시 없이). canonical/og:image 절대 경로에 쓰이며 없으면 해당 태그를 생략한다. */
  readonly VITE_PUBLIC_ORIGIN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
