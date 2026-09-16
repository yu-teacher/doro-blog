export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: {
    code: string;
    message: string;
  };
  timestamp: string;
}

export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
  first: boolean;
  last: boolean;
  empty: boolean;
}

export interface UserProfile {
  id: string;
  username: string;
  email: string;
  nickname: string;
  bio?: string;
  profileImageUrl?: string;
  blogTitle: string;
  githubUrl?: string;
  twitterUrl?: string;
  websiteUrl?: string;
  publicEmail?: string;
  linkedinUrl?: string;
  aboutMarkdown?: string;
  followerCount: number;
  followingCount: number;
  isFollowing?: boolean | null;
  createdAt: string;
}

export interface UpdateProfilePayload {
  nickname?: string;
  bio?: string;
  profileImageUrl?: string;
  blogTitle?: string;
  githubUrl?: string;
  twitterUrl?: string;
  websiteUrl?: string;
  publicEmail?: string;
  linkedinUrl?: string;
  aboutMarkdown?: string;
}

export interface FollowUser {
  id: string;
  username: string;
  nickname: string;
  profileImageUrl?: string;
  bio?: string;
  isFollowing: boolean;
  followedAt: string;
}

export interface UserTagSummary {
  name: string;
  postCount: number;
}

export interface UserActivity {
  date: string;
  count: number;
}

export type PostStatus = 'DRAFT' | 'PUBLISHED' | 'PRIVATE';

export interface PostSummary {
  id: string;
  userId: string;
  username: string;
  nickname: string;
  profileImageUrl?: string;
  seriesId?: string;
  seriesTitle?: string;
  seriesOrder?: number;
  title: string;
  slug: string;
  summary?: string;
  thumbnailUrl?: string;
  status: PostStatus;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  publishedAt?: string;
  createdAt: string;
  tags: string[];
}

export interface AuthorBio {
  id: string;
  username: string;
  nickname: string;
  profileImageUrl?: string;
  bio?: string;
  blogTitle?: string;
  githubUrl?: string;
  twitterUrl?: string;
  websiteUrl?: string;
  publicEmail?: string;
  linkedinUrl?: string;
  followerCount: number;
  isFollowing: boolean;
}

export interface PostDetail {
  post: PostSummary;
  content: string;
  likedByMe: boolean;
  author?: AuthorBio;
}

export interface Series {
  id: string;
  userId: string;
  username: string;
  title: string;
  slug: string;
  description?: string;
  thumbnailUrl?: string;
  postCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface SeriesItemPost {
  id: string;
  seriesOrder: number;
  title: string;
  slug: string;
  summary?: string;
  thumbnailUrl?: string;
  publishedAt?: string;
}

export interface SeriesDetail {
  series: Series;
  posts: SeriesItemPost[];
}

export interface Comment {
  id: string;
  postId: string;
  userId: string;
  username: string;
  nickname: string;
  profileImageUrl?: string;
  content: string;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
  replies: Comment[];
}

export interface TagItem {
  id: string;
  name: string;
  postCount: number;
}

export interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  expiresAt: string | null;
  lastUsedAt: string | null;
  isActive: boolean;
  isExpired: boolean;
  createdAt: string;
}

export interface CreateApiKeyRequest {
  name: string;
  expireDays?: number | null;
}

export interface CreateApiKeyResponse {
  id: string;
  name: string;
  apiKey: string;
  keyPrefix: string;
  expiresAt: string | null;
  createdAt: string;
}

export interface ApiKeyLog {
  id: string;
  apiKeyId: string;
  method: string;
  endpoint: string;
  statusCode: number;
  ipAddress: string;
  userAgent: string;
  durationMs: number;
  errorMessage: string | null;
  createdAt: string;
}
