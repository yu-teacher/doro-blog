import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useThemeStore } from '../store/themeStore';
import {
  PenSquare,
  Search,
  User,
  LogOut,
  Bookmark,
  BookOpen,
  ChevronDown,
  Lock,
  Mail,
  UserCheck,
  ShieldCheck,
  ChevronRight,
  Sun,
  Moon,
  ExternalLink,
} from 'lucide-react';

const DORO_PORTAL_URL = import.meta.env.VITE_DORO_PORTAL_URL || 'http://localhost:3000';
const DORO_SIGNUP_URL = `${DORO_PORTAL_URL}/signup`;

export const Header: React.FC = () => {
  const { user, isAuthenticated, loginModalOpen, openLoginModal, closeLoginModal, loginWithIam, signupWithIam, loginWithMock, logout } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [isSignUpMode, setIsSignUpMode] = useState(false);

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [showMockOptions, setShowMockOptions] = useState(false);

  const handleOpenLoginModal = () => {
    setErrorMsg('');
    setIsSignUpMode(false);
    setEmail('');
    setPassword('');
    setName('');
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
  const navigate = useNavigate();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchOpen(false);
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
    } catch (err: any) {
      console.error('Auth error', err);
      const msg =
        err.response?.data?.error?.message ||
        err.response?.data?.message ||
        '로그인에 실패했습니다. 이메일과 비밀번호를 확인해주세요.';
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleFastRealLogin = async (fastEmail: string) => {
    setErrorMsg('');
    setLoading(true);
    try {
      await loginWithIam(fastEmail, 'Password1234!');
      closeLoginModal();
    } catch (err: any) {
      console.error('Fast login error', err);
      setErrorMsg('빠른 로그인에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <header className="sticky top-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-gray-200 dark:border-slate-800 transition-colors">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 font-black text-2xl tracking-tighter text-gray-900 dark:text-white group">
            <span className="bg-emerald-600 text-white w-8 h-8 rounded-lg flex items-center justify-center text-lg font-mono shadow-sm group-hover:scale-105 transition-transform">
              D
            </span>
            <span>
              DORO<span className="text-emerald-500">.log</span>
            </span>
          </Link>

          {/* Right Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
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

            {isAuthenticated ? (
              <>
                <Link
                  to="/write"
                  className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-gray-900 dark:border-slate-600 text-gray-900 dark:text-slate-200 text-sm font-medium hover:bg-gray-900 hover:text-white dark:hover:bg-emerald-600 dark:hover:border-emerald-600 transition-all shadow-xs"
                >
                  <PenSquare className="w-4 h-4" />
                  새 글 작성
                </Link>

                {/* User Dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setDropdownOpen(!dropdownOpen)}
                    className="flex items-center gap-2 p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
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
                      className="absolute right-0 mt-2 w-52 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-gray-100 dark:border-slate-700 py-1.5 text-sm z-50 animate-in fade-in zoom-in-95 duration-100"
                      onClick={() => setDropdownOpen(false)}
                    >
                      <div className="px-4 py-2 border-b border-gray-100 dark:border-slate-700">
                        <div className="font-semibold text-gray-900 dark:text-white truncate">{user?.nickname}</div>
                        <div className="text-xs text-gray-500 dark:text-slate-400 truncate">@{user?.username}</div>
                      </div>

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
          <div className="border-t border-gray-100 dark:border-slate-800 bg-gray-50/90 dark:bg-slate-900/90 px-4 py-3">
            <form onSubmit={handleSearch} className="max-w-xl mx-auto flex items-center gap-2">
              <input
                type="text"
                placeholder="검색어를 입력하세요..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
                className="flex-1 px-4 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-white"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                검색
              </button>
            </form>
          </div>
        )}
      </header>

      {/* Real DORO IAM Login / SignUp Modal */}
      {loginModalOpen && (
        <div
          onClick={handleCloseLoginModal}
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-900 rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-gray-100 dark:border-slate-800 animate-in zoom-in-95 text-slate-900 dark:text-slate-100 cursor-default"
          >
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-black text-lg mb-1">
              <ShieldCheck className="w-6 h-6" />
              <span>DORO ID {isSignUpMode ? '회원가입' : '로그인'}</span>
            </div>
            <p className="text-xs text-gray-500 dark:text-slate-400 mb-6">
              {isSignUpMode
                ? '새로운 DORO 통합 계정을 생성합니다.'
                : 'DORO IAM 통합 계정으로 로그인하여 블로그 서비스를 이용하세요.'}
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
                className="w-full mt-2 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl font-bold text-sm transition-all shadow-md flex items-center justify-center gap-2"
              >
                <span>{loading ? '인증 처리 중...' : isSignUpMode ? 'DORO ID 회원가입' : 'DORO ID로 로그인'}</span>
              </button>
            </form>

            {/* DORO Central Portal Sign Up Guidance */}
            <div className="mt-5 pt-4 border-t border-gray-100 dark:border-slate-800 text-center space-y-2">
              <div className="text-xs text-gray-600 dark:text-slate-400 flex items-center justify-center gap-1.5 flex-wrap">
                <span>계정이 없으신가요?</span>
                <a
                  href={DORO_SIGNUP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold hover:underline"
                >
                  <span>도로(DORO) 통합 회원가입</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
              <p className="text-[11px] text-gray-400 dark:text-slate-500">
                DORO 통합 ID 가입 시 블로그 및 도로 플랫폼 전체 서비스를 이용할 수 있습니다.
              </p>
              <div>
                <button
                  type="button"
                  onClick={() => {
                    setIsSignUpMode(!isSignUpMode);
                    setErrorMsg('');
                  }}
                  className="text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 underline"
                >
                  {isSignUpMode ? '← 로그인 폼으로 돌아가기' : '모달에서 바로 빠른 가입하기'}
                </button>
              </div>
            </div>

            {/* Dev Fast Switch Accordion */}
            <div className="mt-6 pt-4 border-t border-gray-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowMockOptions(!showMockOptions)}
                className="w-full flex items-center justify-between text-[11px] text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300"
              >
                <span>테스트 계정 5개 빠른 로그인 (DORO IAM 실계정)</span>
                <ChevronRight className={`w-3.5 h-3.5 transition-transform ${showMockOptions ? 'rotate-90' : ''}`} />
              </button>

              {showMockOptions && (
                <div className="mt-3 space-y-1.5 animate-in fade-in max-h-56 overflow-y-auto">
                  {[
                    { email: 'frontend_dev@doro.local', name: '김리액트 (@frontend_dev)', role: '프론트엔드' },
                    { email: 'backend_hero@doro.local', name: '박스프링 (@backend_hero)', role: '백엔드' },
                    { email: 'ai_researcher@doro.local', name: '이러닝 (@ai_researcher)', role: 'AI리서처' },
                    { email: 'devops_ninja@doro.local', name: '최쿠버 (@devops_ninja)', role: '데브옵스' },
                    { email: 'fullstack_star@doro.local', name: '정풀스택 (@fullstack_star)', role: '풀스택' },
                  ].map((u) => (
                    <button
                      key={u.email}
                      type="button"
                      disabled={loading}
                      onClick={() => handleFastRealLogin(u.email)}
                      className="w-full text-left px-3 py-1.5 bg-slate-50 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-slate-700/60 rounded-lg text-xs text-slate-700 dark:text-slate-300 flex justify-between items-center transition-colors"
                    >
                      <span className="font-medium truncate">{u.name}</span>
                      <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded flex-shrink-0 ml-2">
                        {u.role}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={handleCloseLoginModal}
              className="mt-4 w-full text-center text-xs text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 transition-colors"
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </>
  );
};
