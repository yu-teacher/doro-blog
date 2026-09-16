import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { blogApi } from '../api/blogApi';
import type { UserProfile, PostSummary, PageResponse, Series } from '../api/types';
import { PostCard } from '../components/PostCard';
import {
  FileText,
  BookOpen,
  Search,
  Globe,
  Tag as TagIcon,
  ChevronLeft,
  ChevronRight,
  User,
} from 'lucide-react';

export const ChannelPage: React.FC = () => {
  const { username } = useParams<{ username: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  const cleanUsername = username?.startsWith('@') ? username.substring(1) : username;
  const currentTab = searchParams.get('tab') || 'posts'; // 'posts' | 'series'
  const tagFilter = searchParams.get('tag') || '';
  const keyword = searchParams.get('q') || '';
  const page = parseInt(searchParams.get('page') || '0', 10);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [postsPage, setPostsPage] = useState<PageResponse<PostSummary> | null>(null);
  const [seriesList, setSeriesList] = useState<Series[]>([]);
  const [searchInput, setSearchInput] = useState(keyword);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (cleanUsername) {
      loadProfile();
    }
  }, [cleanUsername]);

  useEffect(() => {
    if (cleanUsername) {
      if (currentTab === 'posts') {
        loadPosts();
      } else {
        loadSeries();
      }
    }
  }, [cleanUsername, currentTab, tagFilter, keyword, page]);

  const loadProfile = async () => {
    if (!cleanUsername) return;
    try {
      const res = await blogApi.getUserProfile(cleanUsername);
      setProfile(res);
    } catch (err) {
      console.error('Failed to load profile', err);
    }
  };

  const loadPosts = async () => {
    if (!cleanUsername) return;
    setLoading(true);
    try {
      const res = await blogApi.getUserPosts(
        cleanUsername,
        keyword || undefined,
        tagFilter || undefined,
        page,
        10
      );
      setPostsPage(res);
    } catch (err) {
      console.error('Failed to load user posts', err);
    } finally {
      setLoading(false);
    }
  };

  const loadSeries = async () => {
    if (!cleanUsername) return;
    setLoading(true);
    try {
      const res = await blogApi.getUserSeries(cleanUsername);
      setSeriesList(res || []);
    } catch (err) {
      console.error('Failed to load user series', err);
    } finally {
      setLoading(false);
    }
  };


  const handleTabChange = (newTab: 'posts' | 'series') => {
    const p = new URLSearchParams();
    p.set('tab', newTab);
    setSearchParams(p);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const p = new URLSearchParams(searchParams);
    if (searchInput.trim()) {
      p.set('q', searchInput.trim());
    } else {
      p.delete('q');
    }
    p.set('page', '0');
    setSearchParams(p);
  };

  const handleClearFilter = () => {
    setSearchInput('');
    const p = new URLSearchParams();
    p.set('tab', 'posts');
    setSearchParams(p);
  };

  const handlePageChange = (newPage: number) => {
    const p = new URLSearchParams(searchParams);
    p.set('page', newPage.toString());
    setSearchParams(p);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Author Profile Header */}
      <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 pb-10 border-b border-slate-200 dark:border-slate-800">
        <div className="w-28 h-28 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold flex items-center justify-center text-3xl overflow-hidden shadow-sm flex-shrink-0 border border-emerald-200 dark:border-emerald-800">
          {profile?.profileImageUrl ? (
            <img src={profile.profileImageUrl} alt={profile.nickname} className="w-full h-full object-cover" />
          ) : (
            profile?.nickname ? profile.nickname[0] : <User className="w-12 h-12" />
          )}
        </div>

        <div className="flex-1 text-center sm:text-left">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
                {profile?.nickname || cleanUsername}
              </h1>
              <p className="text-sm font-mono text-slate-400 dark:text-slate-500 mt-0.5">@{cleanUsername}</p>
            </div>
          </div>

          <p className="text-slate-600 dark:text-slate-300 text-sm sm:text-base mt-3 max-w-2xl leading-relaxed">
            {profile?.bio || '아직 소개글이 작성되지 않았습니다.'}
          </p>

          {/* Social Links */}
          <div className="flex items-center justify-center sm:justify-start gap-4 mt-4 text-slate-400 dark:text-slate-500">
            {profile?.githubUrl && (
              <a
                href={profile.githubUrl}
                target="_blank"
                rel="noreferrer"
                className="hover:text-slate-900 dark:hover:text-white transition-colors"
                title="GitHub"
              >
                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                </svg>
              </a>
            )}
            {profile?.twitterUrl && (
              <a
                href={profile.twitterUrl}
                target="_blank"
                rel="noreferrer"
                className="hover:text-sky-500 transition-colors"
                title="Twitter"
              >
                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
            )}
            {profile?.websiteUrl && (
              <a
                href={profile.websiteUrl}
                target="_blank"
                rel="noreferrer"
                className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                title="Website"
              >
                <Globe className="w-5 h-5" />
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Tabs: 글 vs 시리즈 */}
      <div className="flex items-center justify-between mt-8 mb-6 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-8">
          <button
            onClick={() => handleTabChange('posts')}
            className={`flex items-center gap-2 pb-3 text-lg font-bold transition-all relative ${
              currentTab === 'posts'
                ? 'text-emerald-600 dark:text-emerald-400 border-b-2 border-emerald-600 dark:border-emerald-400'
                : 'text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <FileText className="w-5 h-5" />
            <span>글</span>
          </button>

          <button
            onClick={() => handleTabChange('series')}
            className={`flex items-center gap-2 pb-3 text-lg font-bold transition-all relative ${
              currentTab === 'series'
                ? 'text-emerald-600 dark:text-emerald-400 border-b-2 border-emerald-600 dark:border-emerald-400'
                : 'text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <BookOpen className="w-5 h-5" />
            <span>시리즈</span>
          </button>
        </div>

        {/* In-channel search input (when on Posts tab) */}
        {currentTab === 'posts' && (
          <form onSubmit={handleSearchSubmit} className="relative w-48 sm:w-64 pb-2">
            <input
              type="text"
              placeholder="블로그 내 검색..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-100 dark:bg-slate-800 rounded-full text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white dark:focus:bg-slate-900 border border-transparent focus:border-emerald-500 transition-all"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute left-2.5 top-2.5" />
          </form>
        )}
      </div>

      {/* Active Search / Filter Indicator */}
      {currentTab === 'posts' && (keyword || tagFilter) && (
        <div className="flex items-center justify-between bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 px-4 py-2 rounded-lg text-sm mb-6 border border-emerald-100 dark:border-emerald-800">
          <span>
            {keyword && <>검색어 <strong>"{keyword}"</strong> </>}
            {tagFilter && <>태그 <strong>#{tagFilter}</strong> </>}
            결과
          </span>
          <button onClick={handleClearFilter} className="text-xs text-emerald-700 dark:text-emerald-400 underline font-semibold">
            필터 초기화
          </button>
        </div>
      )}

      {/* Tab Content: Posts */}
      {currentTab === 'posts' && (
        <div>
          {loading ? (
            <div className="space-y-4 animate-pulse">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-40 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 p-6" />
              ))}
            </div>
          ) : postsPage && postsPage.content.length > 0 ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {postsPage.content.map((post) => (
                  <PostCard key={post.id} post={post} />
                ))}
              </div>

              {/* Pagination */}
              {postsPage.totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-12">
                  <button
                    onClick={() => handlePageChange(page - 1)}
                    disabled={postsPage.first}
                    className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>

                  <div className="flex items-center gap-1">
                    {[...Array(postsPage.totalPages)].map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => handlePageChange(idx)}
                        className={`w-9 h-9 rounded-lg text-sm font-semibold transition-colors ${
                          page === idx
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                        }`}
                      >
                        {idx + 1}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={() => handlePageChange(page + 1)}
                    disabled={postsPage.last}
                    className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800">
              <p className="text-slate-400 dark:text-slate-500">작성된 글이 없습니다.</p>
            </div>
          )}
        </div>
      )}

      {/* Tab Content: Series */}
      {currentTab === 'series' && (
        <div>
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 animate-pulse">
              {[...Array(2)].map((_, i) => (
                <div key={i} className="h-44 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 p-6" />
              ))}
            </div>
          ) : seriesList.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {seriesList.map((series) => (
                <Link
                  key={series.id}
                  to={`/@${cleanUsername}/series/${series.slug}`}
                  className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 hover:shadow-md dark:hover:border-slate-700 transition-all group flex flex-col justify-between"
                >
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors mb-2">
                      {series.title}
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2">
                      {series.description || '시리즈 설명이 없습니다.'}
                    </p>
                  </div>
                  <div className="mt-6 flex items-center justify-between text-xs text-slate-400 dark:text-slate-500 border-t border-slate-100 dark:border-slate-800 pt-3">
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">{series.postCount}개의 포스트</span>
                    <span>최근 업데이트: {new Date(series.updatedAt).toLocaleDateString('ko-KR')}</span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800">
              <p className="text-slate-400 dark:text-slate-500">등록된 시리즈가 없습니다.</p>
            </div>
          )}
        </div>
      )}

    </div>
  );
};
