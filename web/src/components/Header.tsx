import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
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
} from 'lucide-react';

export const Header: React.FC = () => {
  const { user, isAuthenticated, loginWithIam, signupWithIam, loginWithMock, logout } = useAuthStore();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [isSignUpMode, setIsSignUpMode] = useState(false);

  // Form states
  const [email, setEmail] = useState('yusm@doro.local');
  const [password, setPassword] = useState('password1234!');
  const [name, setName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [showMockOptions, setShowMockOptions] = useState(false);

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
      setLoginModalOpen(false);
    } catch (err: any) {
      console.error('Auth error', err);
      const msg = err.response?.data?.error?.message || err.response?.data?.message || '로그인에 실패했습니다. 이메일과 비밀번호를 확인해주세요.';
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 font-black text-2xl tracking-tighter text-gray-900 group">
            <span className="bg-emerald-600 text-white w-8 h-8 rounded-lg flex items-center justify-center text-lg font-mono shadow-sm group-hover:scale-105 transition-transform">
              D
            </span>
            <span>DORO<span className="text-emerald-600">.log</span></span>
          </Link>

          {/* Right Actions */}
          <div className="flex items-center gap-3">
            {/* Search Trigger */}
            <button
              onClick={() => setSearchOpen(!searchOpen)}
              className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors"
              title="검색"
            >
              <Search className="w-5 h-5" />
            </button>

            {isAuthenticated ? (
              <>
                <Link
                  to="/write"
                  className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-gray-900 text-gray-900 text-sm font-medium hover:bg-gray-900 hover:text-white transition-all shadow-xs"
                >
                  <PenSquare className="w-4 h-4" />
                  새 글 작성
                </Link>

                {/* User Dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setDropdownOpen(!dropdownOpen)}
                    className="flex items-center gap-2 p-1.5 rounded-full hover:bg-gray-100 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center border border-emerald-300 overflow-hidden">
                      {user?.profileImageUrl ? (
                        <img src={user.profileImageUrl} alt={user.nickname} className="w-full h-full object-cover" />
                      ) : (
                        user?.nickname?.charAt(0).toUpperCase() || 'U'
                      )}
                    </div>
                    <ChevronDown className="w-4 h-4 text-gray-500" />
                  </button>

                  {dropdownOpen && (
                    <div
                      className="absolute right-0 mt-2 w-52 bg-white rounded-xl shadow-xl border border-gray-100 py-1.5 text-sm z-50 animate-in fade-in zoom-in-95 duration-100"
                      onClick={() => setDropdownOpen(false)}
                    >
                      <div className="px-4 py-2 border-b border-gray-100">
                        <div className="font-semibold text-gray-900 truncate">{user?.nickname}</div>
                        <div className="text-xs text-gray-500 truncate">@{user?.username}</div>
                      </div>

                      <Link
                        to={`/@${user?.username}`}
                        className="flex items-center gap-2.5 px-4 py-2 text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        <User className="w-4 h-4 text-gray-400" />
                        내 블로그
                      </Link>

                      <Link
                        to="/me/posts"
                        className="flex items-center gap-2.5 px-4 py-2 text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        <BookOpen className="w-4 h-4 text-gray-400" />
                        내 글 관리
                      </Link>

                      <Link
                        to="/me/posts?tab=likes"
                        className="flex items-center gap-2.5 px-4 py-2 text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        <Bookmark className="w-4 h-4 text-gray-400" />
                        읽기 목록 (좋아요)
                      </Link>

                      <div className="border-t border-gray-100 my-1"></div>

                      <button
                        onClick={logout}
                        className="w-full flex items-center gap-2.5 px-4 py-2 text-red-600 hover:bg-red-50 transition-colors text-left"
                      >
                        <LogOut className="w-4 h-4" />
                        로그아웃
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <button
                onClick={() => {
                  setErrorMsg('');
                  setLoginModalOpen(true);
                }}
                className="px-4 py-1.5 rounded-full bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors shadow-xs"
              >
                로그인
              </button>
            )}
          </div>
        </div>

        {/* Expandable Search Input */}
        {searchOpen && (
          <div className="border-t border-gray-100 bg-gray-50/90 px-4 py-3">
            <form onSubmit={handleSearch} className="max-w-xl mx-auto flex items-center gap-2">
              <input
                type="text"
                placeholder="검색어를 입력하세요..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
                className="flex-1 px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white text-sm"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors"
              >
                검색
              </button>
            </form>
          </div>
        )}
      </header>

      {/* Real DORO IAM Login / SignUp Modal */}
      {loginModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center gap-2 text-emerald-600 font-black text-lg mb-1">
              <ShieldCheck className="w-6 h-6" />
              <span>DORO ID {isSignUpMode ? '회원가입' : '로그인'}</span>
            </div>
            <p className="text-xs text-gray-500 mb-6">
              {isSignUpMode
                ? '새로운 DORO 통합 계정을 생성합니다.'
                : 'DORO IAM 통합 계정으로 로그인하여 블로그 서비스를 이용하세요.'}
            </p>

            {errorMsg && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-medium">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleAuthSubmit} className="space-y-3.5">
              {isSignUpMode && (
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">이름</label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="홍길동"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <UserCheck className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">이메일 (DORO ID)</label>
                <div className="relative">
                  <input
                    type="email"
                    placeholder="name@doro.local"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">비밀번호</label>
                <div className="relative">
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
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

            {/* Toggle Mode */}
            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => {
                  setIsSignUpMode(!isSignUpMode);
                  setErrorMsg('');
                }}
                className="text-xs text-emerald-600 hover:underline font-semibold"
              >
                {isSignUpMode
                  ? '이미 계정이 있으신가요? 로그인하기'
                  : '계정이 없으신가요? 1초 회원가입'}
              </button>
            </div>

            {/* Dev Fast Switch Accordion */}
            <div className="mt-6 pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setShowMockOptions(!showMockOptions)}
                className="w-full flex items-center justify-between text-[11px] text-gray-400 hover:text-gray-600"
              >
                <span>개발 테스트용 모크 계정 전환</span>
                <ChevronRight className={`w-3.5 h-3.5 transition-transform ${showMockOptions ? 'rotate-90' : ''}`} />
              </button>

              {showMockOptions && (
                <div className="mt-3 space-y-1.5 animate-in fade-in">
                  <button
                    type="button"
                    onClick={() => {
                      loginWithMock('yu-teacher', 'yu-teacher@doro.local', '9fa5f6cd-2327-4207-b973-40c185c161da');
                      setLoginModalOpen(false);
                    }}
                    className="w-full text-left px-3 py-1.5 bg-gray-50 hover:bg-gray-100 rounded-lg text-xs text-gray-700 flex justify-between items-center"
                  >
                    <span>@yu-teacher (작가)</span>
                    <span className="text-[10px] text-gray-400">Mock</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      loginWithMock('reader', 'reader@doro.local', '4e3cef2d-644b-4981-8bdc-7ca71ce67ec3');
                      setLoginModalOpen(false);
                    }}
                    className="w-full text-left px-3 py-1.5 bg-gray-50 hover:bg-gray-100 rounded-lg text-xs text-gray-700 flex justify-between items-center"
                  >
                    <span>@reader (독자)</span>
                    <span className="text-[10px] text-gray-400">Mock</span>
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={() => setLoginModalOpen(false)}
              className="mt-4 w-full text-center text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </>
  );
};
