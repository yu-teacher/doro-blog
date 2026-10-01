import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { AuthModal } from './AuthModal';
import { useThemeStore } from '../store/themeStore';
import { blogApi } from '../api/blogApi';
import type { TagItem } from '../api/types';
import { NotificationDropdown } from './NotificationDropdown';
import {
  PenSquare,
  Search,
  User,
  LogOut,
  Bookmark,
  BookOpen,
  ChevronDown,
  ShieldCheck,
  Sun,
  Moon,
  ExternalLink,
  Terminal,
  Tag as TagIcon,
  Hash,
  LayoutGrid,
  Code2,
} from 'lucide-react';

const DORO_SIGNUP_URL = '/portal/signup';

export const Header: React.FC = () => {
  const { user, isAuthenticated, isAdmin, openLoginModal, logout } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();
  const [appLauncherOpen, setAppLauncherOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  // Pre-load popular tags for search autocomplete
  const [allTags, setAllTags] = useState<TagItem[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    if (searchOpen && allTags.length === 0) {
      blogApi.getPopularTags().then((tags) => {
        setAllTags(tags || []);
      }).catch((err) => console.error('Failed to load tags for autocomplete', err));
    }
  }, [searchOpen, allTags.length]);

  // Tag autocomplete suggestions matching searchQuery
  const matchingTags = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const clean = searchQuery.trim().replace(/^#/, '').toLowerCase();
    return allTags
      .filter((t) => t.name.toLowerCase().includes(clean))
      .slice(0, 6);
  }, [searchQuery, allTags]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      const q = searchQuery.trim();
      if (q.startsWith('#') && q.length > 1) {
        navigate(`/tags?tag=${encodeURIComponent(q.substring(1))}`);
      } else {
        navigate(`/search?q=${encodeURIComponent(q)}`);
      }
      setSearchOpen(false);
      setSearchQuery('');
    }
  };

  const handleSelectAutocompleteTag = (tagName: string) => {
    navigate(`/tags?tag=${encodeURIComponent(tagName)}`);
    setSearchOpen(false);
    setSearchQuery('');
  };

  return (
    <>
      <header className="sticky top-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-gray-200 dark:border-slate-800 transition-colors">
        <div className="max-w-[1728px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 font-black text-2xl tracking-tighter text-gray-900 dark:text-white group">
            <img
              src="/doro-logo.png"
              alt="DORO"
              className="w-8 h-8 sm:w-9 sm:h-9 object-contain group-hover:scale-110 transition-transform drop-shadow-sm shrink-0"
            />
            <span>
              DORO<span className="text-emerald-500">.log</span>
            </span>
          </Link>

          {/* Backdrop to close popovers on outside click */}
          {(dropdownOpen || appLauncherOpen) && (
            <div
              className="fixed inset-0 z-40 bg-transparent cursor-default"
              onClick={() => {
                setDropdownOpen(false);
                setAppLauncherOpen(false);
              }}
            />
          )}

          {/* Right Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* App Launcher Button (Google-style 9-dots LayoutGrid) */}
            <div className="relative">
              <button
                onClick={() => {
                  setAppLauncherOpen(!appLauncherOpen);
                  setDropdownOpen(false);
                }}
                className={`p-2 rounded-full transition-colors relative z-50 ${
                  appLauncherOpen
                    ? 'bg-slate-100 dark:bg-slate-800 text-emerald-600 dark:text-emerald-400'
                    : 'text-gray-500 hover:text-gray-900 dark:text-slate-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800'
                }`}
                title="DORO 서비스 바로가기 (앱 런처)"
              >
                <LayoutGrid className="w-5 h-5" />
              </button>

              {appLauncherOpen && (
                <div
                  className="absolute right-0 mt-2 w-72 bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-gray-100 dark:border-slate-800 p-4 z-50 animate-in fade-in zoom-in-95 duration-100"
                  onClick={() => setAppLauncherOpen(false)}
                >
                  <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-gray-100 dark:border-slate-800">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">DORO 서비스</span>
                    {isAdmin ? (
                      <span className="text-[10px] text-amber-700 dark:text-amber-300 font-bold bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800/50">
                        관리자 (ADMIN)
                      </span>
                    ) : (
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800/50">
                        통합 플랫폼
                      </span>
                    )}
                  </div>

                  <div className={`grid ${isAdmin ? 'grid-cols-2' : 'grid-cols-3'} gap-2`}>
                    <a
                      href="/account"
                      className="group flex flex-col items-center justify-center p-3 rounded-2xl hover:bg-indigo-50/60 dark:hover:bg-indigo-950/30 transition-all text-center border border-transparent hover:border-indigo-100 dark:hover:border-indigo-900/50"
                    >
                      <div className="w-11 h-11 rounded-2xl flex items-center justify-center bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 mb-1.5 shadow-xs group-hover:scale-105 group-hover:shadow-md transition-all">
                        <ShieldCheck className="w-5 h-5" />
                      </div>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">통합 포털 홈</span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">계정 & 보안</span>
                    </a>

                    <Link
                      to="/"
                      className="group flex flex-col items-center justify-center p-3 rounded-2xl hover:bg-emerald-50/60 dark:hover:bg-emerald-950/30 transition-all text-center border border-transparent hover:border-emerald-100 dark:hover:border-emerald-900/50"
                    >
                      <div className="w-11 h-11 rounded-2xl flex items-center justify-center bg-emerald-50 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400 mb-1.5 shadow-xs group-hover:scale-105 group-hover:shadow-md transition-all">
                        <BookOpen className="w-5 h-5" />
                      </div>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-emerald-600 dark:group-hover:text-emerald-400">DORO.log</span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">기술 블로그</span>
                    </Link>

                    <Link
                      to="/developers"
                      className="group flex flex-col items-center justify-center p-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-all text-center border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
                    >
                      <div className="w-11 h-11 rounded-2xl flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 mb-1.5 shadow-xs group-hover:scale-105 group-hover:shadow-md transition-all">
                        <Code2 className="w-5 h-5" />
                      </div>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-slate-900 dark:group-hover:text-white">개발자 센터</span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">API & 연동</span>
                    </Link>

                    {/* 관리자(ADMIN / SUPER_ADMIN) 전용 관제 로그 */}
                    {isAdmin && (
                      <a
                        href="/logs"
                        className="group flex flex-col items-center justify-center p-3 rounded-2xl hover:bg-amber-50/60 dark:hover:bg-amber-950/30 transition-all text-center border border-transparent hover:border-amber-100 dark:hover:border-amber-900/50 relative"
                      >
                        <span className="absolute top-2 right-2 text-[9px] font-black px-1.5 py-0.2 bg-amber-500 text-white rounded-md tracking-tighter">
                          ADMIN
                        </span>
                        <div className="w-11 h-11 rounded-2xl flex items-center justify-center bg-amber-50 dark:bg-amber-950/70 text-amber-600 dark:text-amber-400 mb-1.5 shadow-xs group-hover:scale-105 group-hover:shadow-md transition-all">
                          <Terminal className="w-5 h-5" />
                        </div>
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-amber-600 dark:group-hover:text-amber-400">관제 로그</span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">Loki 실시간 로그</span>
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              className="p-2 text-gray-500 hover:text-gray-900 dark:text-slate-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors"
              title={theme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'}
            >
              {theme === 'dark' ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5" />}
            </button>

            {/* Search Trigger */}
            <button
              onClick={() => setSearchOpen(!searchOpen)}
              className="p-2 text-gray-500 hover:text-gray-900 dark:text-slate-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors"
              title="검색"
            >
              <Search className="w-5 h-5" />
            </button>

            {/* Developers API Link */}
            <Link
              to="/developers"
              className="p-2 text-gray-500 hover:text-gray-900 dark:text-slate-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors flex items-center gap-1 text-xs font-semibold"
              title="개발자 센터 (API & 자동화)"
            >
              <Terminal className="w-4 h-4 text-emerald-500" />
              <span className="hidden md:inline text-slate-700 dark:text-slate-300">API</span>
            </Link>

            {isAuthenticated ? (
              <>
                <Link
                  to="/write"
                  className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-gray-900 dark:border-slate-600 text-gray-900 dark:text-slate-200 text-sm font-medium hover:bg-gray-900 hover:text-white dark:hover:bg-emerald-600 dark:hover:border-emerald-600 transition-all shadow-xs"
                >
                  <PenSquare className="w-4 h-4" />
                  새 글 작성
                </Link>

                {/* Notifications Dropdown */}
                <NotificationDropdown />

                {/* User Dropdown */}
                <div className="relative">
                  <button
                    onClick={() => {
                      setDropdownOpen(!dropdownOpen);
                      setAppLauncherOpen(false);
                    }}
                    className="flex items-center gap-2 p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors relative z-50"
                  >
                    <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-bold flex items-center justify-center border border-emerald-300 dark:border-emerald-700 overflow-hidden">
                      {user?.profileImageUrl ? (
                        <img src={user.profileImageUrl} alt={user.nickname} className="w-full h-full object-cover" />
                      ) : (
                        user?.nickname?.charAt(0).toUpperCase() || 'U'
                      )}
                    </div>
                    <ChevronDown className="w-4 h-4 text-gray-500 dark:text-slate-400" />
                  </button>

                  {dropdownOpen && (
                    <div
                      className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-gray-100 dark:border-slate-700 py-1.5 text-sm z-50 animate-in fade-in zoom-in-95 duration-100"
                      onClick={() => setDropdownOpen(false)}
                    >
                      <div className="px-4 py-2 border-b border-gray-100 dark:border-slate-700">
                        <div className="font-semibold text-gray-900 dark:text-white truncate">{user?.nickname}</div>
                        <div className="text-xs text-gray-500 dark:text-slate-400 truncate">@{user?.username}</div>
                      </div>

                      {/* DORO Central Portal Account Hub Link */}
                      <a
                        href="/account"
                        className="flex items-center justify-between px-4 py-2.5 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50/60 dark:hover:bg-indigo-950/30 transition-colors font-semibold text-xs border-b border-gray-100 dark:border-slate-700/60"
                      >
                        <span className="flex items-center gap-2">
                          <ShieldCheck className="w-4 h-4" />
                          DORO 계정 관리 (중앙 홈)
                        </span>
                        <ExternalLink className="w-3.5 h-3.5 text-indigo-400" />
                      </a>

                      {/* 관리자(ADMIN / SUPER_ADMIN) 전용 관제 로그 바로가기 */}
                      {isAdmin && (
                        <a
                          href="/logs"
                          className="flex items-center justify-between px-4 py-2 text-amber-600 dark:text-amber-400 hover:bg-amber-50/60 dark:hover:bg-amber-950/30 transition-colors font-semibold text-xs border-b border-gray-100 dark:border-slate-700/60"
                        >
                          <span className="flex items-center gap-2">
                            <Terminal className="w-4 h-4" />
                            관제 로그 (관리자 전용)
                          </span>
                          <ExternalLink className="w-3.5 h-3.5 text-amber-400" />
                        </a>
                      )}

                      <Link
                        to={`/@${user?.username}`}
                        className="flex items-center gap-2.5 px-4 py-2 text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
                      >
                        <User className="w-4 h-4 text-gray-400 dark:text-slate-400" />
                        내 블로그
                      </Link>

                      <Link
                        to="/me/posts"
                        className="flex items-center gap-2.5 px-4 py-2 text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
                      >
                        <BookOpen className="w-4 h-4 text-gray-400 dark:text-slate-400" />
                        내 글 관리
                      </Link>

                      <Link
                        to="/me/posts?tab=likes"
                        className="flex items-center gap-2.5 px-4 py-2 text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
                      >
                        <Bookmark className="w-4 h-4 text-gray-400 dark:text-slate-400" />
                        읽기 목록 (좋아요)
                      </Link>

                      <Link
                        to="/developers"
                        className="flex items-center gap-2.5 px-4 py-2 text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
                      >
                        <Terminal className="w-4 h-4 text-emerald-500" />
                        개발자 센터 (API)
                      </Link>

                      <div className="border-t border-gray-100 dark:border-slate-700 my-1"></div>

                      <button
                        onClick={logout}
                        className="w-full flex items-center gap-2.5 px-4 py-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors text-left"
                      >
                        <LogOut className="w-4 h-4" />
                        로그아웃
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={openLoginModal}
                  className="px-3.5 py-1.5 rounded-full text-slate-700 dark:text-slate-200 text-sm font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  로그인
                </button>
                <a
                  href={DORO_SIGNUP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors shadow-xs"
                >
                  <span>회원가입</span>
                  <ExternalLink className="w-3.5 h-3.5 opacity-85" />
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Expandable Search Input */}
        {searchOpen && (
          <div className="border-t border-gray-100 dark:border-slate-800 bg-gray-50/90 dark:bg-slate-900/90 px-4 py-3 animate-in slide-in-from-top-1">
            <div className="max-w-xl mx-auto">
              <form onSubmit={handleSearch} className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    placeholder="검색어 또는 #태그 입력..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    autoFocus
                    className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-white shadow-2xs"
                  />
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                </div>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-2xs"
                >
                  검색
                </button>
              </form>

              {/* Tag Autocomplete Suggestions Popover */}
              {matchingTags.length > 0 && (
                <div className="mt-2.5 pt-2 border-t border-slate-200/60 dark:border-slate-800 flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 flex items-center gap-1 mr-1">
                    <TagIcon className="w-3 h-3" /> 추천 태그:
                  </span>
                  {matchingTags.map((tag) => (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => handleSelectAutocompleteTag(tag.name)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-white dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 hover:text-emerald-600 dark:hover:text-emerald-400 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-semibold border border-slate-200 dark:border-slate-700 hover:border-emerald-300 dark:hover:border-emerald-800 transition-all shadow-2xs"
                    >
                      <Hash className="w-3 h-3 text-emerald-500" />
                      <span>{tag.name}</span>
                      <span className="opacity-50 text-[10px]">({tag.postCount})</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </header>

      <AuthModal />
    </>
  );
};
