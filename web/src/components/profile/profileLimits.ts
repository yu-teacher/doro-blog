/** 서버 검증(BlogUserDtos)과 같은 입력 한도. 넘기 전에 입력창에서 막아 서버 400 을 줄인다. */
export const PROFILE_LIMITS = {
  nickname: 50,
  blogTitle: 100,
  bio: 255,
  profileImageUrl: 500,
  publicEmail: 100,
  githubUrl: 255,
  twitterUrl: 255,
  websiteUrl: 255,
  linkedinUrl: 255,
} as const;
