import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore, getSavedAccounts, removeSavedAccount, type SavedAccount } from '../store/authStore';
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
  ChevronRight,
  ArrowLeft,
  Lock,
  Mail,
  UserCheck,
  ShieldCheck,
  Sun,
  Moon,
  ExternalLink,
  Terminal,
  Tag as TagIcon,
  Hash,
  Trash2,
  UserPlus,
  Sparkles,
  LayoutGrid,
  Code2,
} from 'lucide-react';

// DORO Central Portal URL via reverse proxy gateway (port 80)
const DORO_PORTAL_URL = '/portal';
const DORO_SIGNUP_URL = '/portal/signup';

export const Header: React.FC = () => {
  const { user, isAuthenticated, isAdmin, loginModalOpen, openLoginModal, closeLoginModal, loginWithIam, loginWithSavedAccount, signupWithIam, loginWithMock, logout } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();
  const [appLauncherOpen, setAppLauncherOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [isSignUpMode, setIsSignUpMode] = useState(false);

  // Saved accounts state for Google-style account chooser
  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>([]);
  const [authMode, setAuthMode] = useState<'saved_accounts' | 'direct_input'>('saved_accounts');

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const refreshSavedAccountsList = () => {
    const list = getSavedAccounts();
    setSavedAccounts(list);
    return list;
  };

  const handleOpenLoginModal = () => {
    setErrorMsg('');
    setIsSignUpMode(false);
    setEmail('');
    setPassword('');
    setName('');
    const list = refreshSavedAccountsList();
    if (list.length > 0) {
      setAuthMode('saved_accounts');
    } else {
      setAuthMode('direct_input');
    }
    openLoginModal();
  };

  const handleCloseLoginModal = () => {
    closeLoginModal();
    setErrorMsg('');
    setEmail('');
    setPassword('');
    setName('');
  };

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

  const handleSelectSavedAccount = async (account: SavedAccount) => {
    setErrorMsg('');
    setLoading(true);
    try {
      await loginWithSavedAccount(account);
      closeLoginModal();
    } catch (err: unknown) {
      console.warn('Saved account login failed, redirecting to password input', err);
      setEmail(account.email);
      setPassword('');
      setAuthMode('direct_input');
      setErrorMsg('보안을 위해 계정 비밀번호를 한 번 더 확인합니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveSavedAccount = (e: React.MouseEvent, accountEmail: string) => {
    e.stopPropagation();
    removeSavedAccount(accountEmail);
    const updated = refreshSavedAccountsList();
    if (updated.length === 0) {
      setAuthMode('direct_input');
    }
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      if (isSignUpMode) {
        if (!name.trim()) {
          setErrorMsg('이름을 입력해주세요.');
          setLoading(false);
          return;
        }
        await signupWithIam(email.trim(), password, name.trim());
        // Auto-login right after signup
        await loginWithIam(email.trim(), password);
      } else {
        await loginWithIam(email.trim(), password);
      }
      closeLoginModal();
    } catch (err: unknown) {
      console.error('Auth error', err);
      let msg = '로그인에 실패했습니다. 이메일과 비밀번호를 확인해주세요.';
      if (err && typeof err === 'object' && 'response' in err) {
        const resp = (err as { response?: { data?: { error?: { message?: string }; message?: string } } }).response;
        msg = resp?.data?.error?.message || resp?.data?.message || msg;
      }
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
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
                  onClick={handleOpenLoginModal}
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

      {/* Real DORO IAM Login / SignUp Modal (Google-style Account Chooser Support) */}
      {loginModalOpen && (
        <div
          onClick={handleCloseLoginModal}
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-gray-100 dark:border-slate-800 animate-in zoom-in-95 text-slate-900 dark:text-slate-100 cursor-default"
          >
            {authMode === 'saved_accounts' && savedAccounts.length > 0 ? (
              /* Google-style Account Chooser View */
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-black text-lg">
                    <ShieldCheck className="w-6 h-6" />
                    <span>DORO 계정 선택</span>
                  </div>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                    <Sparkles className="w-3 h-3" />
                    원클릭 로그인
                  </span>
                </div>

                <p className="text-xs text-gray-500 dark:text-slate-400 mb-5 leading-relaxed">
                  이 기기에 저장된 DORO 통합 계정입니다. 클릭 한 번으로 비밀번호 입력 없이 즉시 로그인할 수 있습니다.
                </p>

                {errorMsg && (
                  <div className="mb-4 p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-400 text-xs rounded-xl font-medium">
                    {errorMsg}
                  </div>
                )}

                {/* Account List */}
                <div className="space-y-2 mb-4 max-h-[300px] overflow-y-auto pr-0.5">
                  {savedAccounts.map((acc) => (
                    <div
                      key={acc.email}
                      onClick={() => handleSelectSavedAccount(acc)}
                      role="button"
                      tabIndex={0}
                      className="group flex items-center justify-between p-3.5 rounded-2xl border border-gray-200/90 dark:border-slate-800 hover:border-emerald-500 dark:hover:border-emerald-500 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/20 transition-all cursor-pointer shadow-xs"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {acc.profileImageUrl ? (
                          <img
                            src={acc.profileImageUrl}
                            alt={acc.name}
                            className="w-10 h-10 rounded-full object-cover border border-gray-200 dark:border-slate-700 shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-emerald-600/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-extrabold flex items-center justify-center text-sm border border-emerald-500/20 shrink-0">
                            {(acc.name || acc.email).charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="text-left min-w-0">
                          <div className="text-sm font-bold text-slate-900 dark:text-white truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                            {acc.name || acc.nickname || acc.email.split('@')[0]}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                            {acc.email}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 ml-2">
                        <button
                          type="button"
                          onClick={(e) => handleRemoveSavedAccount(e, acc.email)}
                          title="이 기기에서 계정 기록 삭제"
                          className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all" />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Switch to direct password input */}
                <div className="pt-2 border-t border-gray-100 dark:border-slate-800 space-y-2">
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('direct_input');
                      setErrorMsg('');
                    }}
                    className="w-full py-2.5 px-4 rounded-xl border border-dashed border-gray-300 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:border-emerald-500 dark:hover:border-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-all flex items-center justify-center gap-2"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>다른 계정으로 로그인 (아이디/비밀번호)</span>
                  </button>
                </div>
              </div>
            ) : (
              /* Direct Input / Sign-up View */
              <div>
                {savedAccounts.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('saved_accounts');
                      setErrorMsg('');
                    }}
                    className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 font-medium mb-3 transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>저장된 계정 목록으로</span>
                  </button>
                )}

                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-black text-lg mb-1">
                  <ShieldCheck className="w-6 h-6" />
                  <span>DORO ID {isSignUpMode ? '회원가입' : '직접 로그인'}</span>
                </div>
                <p className="text-xs text-gray-500 dark:text-slate-400 mb-6">
                  {isSignUpMode
                    ? '새로운 DORO 통합 계정을 생성합니다.'
                    : '이메일과 비밀번호를 입력하여 로그인하세요. 로그인 후 이 기기에 안전하게 저장됩니다.'}
                </p>

                {errorMsg && (
                  <div className="mb-4 p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-400 text-xs rounded-xl font-medium">
                    {errorMsg}
                  </div>
                )}

                <form onSubmit={handleAuthSubmit} className="space-y-3.5">
                  {isSignUpMode && (
                    <div>
                      <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1">이름</label>
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="홍길동"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          required
                          className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-slate-700 dark:bg-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-500"
                        />
                        <UserCheck className="w-4 h-4 text-gray-400 dark:text-slate-500 absolute left-3 top-2.5" />
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1">이메일 (DORO ID)</label>
                    <div className="relative">
                      <input
                        type="email"
                        placeholder="name@doro.local"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-slate-700 dark:bg-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-500"
                      />
                      <Mail className="w-4 h-4 text-gray-400 dark:text-slate-500 absolute left-3 top-2.5" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1">비밀번호</label>
                    <div className="relative">
                      <input
                        type="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-slate-700 dark:bg-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-500"
                      />
                      <Lock className="w-4 h-4 text-gray-400 dark:text-slate-500 absolute left-3 top-2.5" />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full mt-2 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl font-bold text-sm transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>{loading ? '인증 처리 중...' : isSignUpMode ? 'DORO ID 회원가입' : 'DORO ID로 로그인'}</span>
                  </button>
                </form>

                {/* DORO Central Portal Sign Up Guidance */}
                <div className="mt-5 pt-4 border-t border-gray-100 dark:border-slate-800 text-center space-y-2">
                  <div className="text-xs text-gray-600 dark:text-slate-400 flex items-center justify-center gap-1.5 flex-wrap">
                    <span>{isSignUpMode ? '이미 계정이 있으신가요?' : '계정이 없으신가요?'}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setIsSignUpMode(!isSignUpMode);
                        setErrorMsg('');
                      }}
                      className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold hover:underline cursor-pointer"
                    >
                      <span>{isSignUpMode ? '로그인하기' : '회원가입하기'}</span>
                    </button>
                  </div>
                  <p className="text-[11px] text-gray-400 dark:text-slate-500">
                    DORO ID 하나로 블로그 및 도로 플랫폼 전체 서비스를 이용할 수 있습니다.
                  </p>
                  <div>
                    <a
                      href={DORO_SIGNUP_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 underline"
                    >
                      <span>도로(DORO) 포털 웹에서 가입하기</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={handleCloseLoginModal}
              className="mt-4 w-full text-center text-xs text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 transition-colors cursor-pointer"
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </>
  );
};
