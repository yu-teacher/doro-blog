import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { PenSquare, Search, User, LogOut, Bookmark, BookOpen, ChevronDown } from 'lucide-react';

export const Header: React.FC = () => {
  const { user, isAuthenticated, loginWithMock, logout } = useAuthStore();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [loginModalOpen, setLoginModalOpen] = useState(false);
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
                        to="/me/likes"
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
                onClick={() => setLoginModalOpen(true)}
                className="px-4 py-1.5 rounded-full bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-colors shadow-xs"
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

      {/* Quick Login Modal */}
      {loginModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-in zoom-in-95">
            <h3 className="text-xl font-bold text-gray-900 mb-2">DORO.log 로그인</h3>
            <p className="text-xs text-gray-500 mb-6">
              DORO IAM 계정으로 간편하게 로그인하여 글을 작성하고 댓글을 남겨보세요.
            </p>

            <div className="space-y-2.5">
              <button
                onClick={() => {
                  loginWithMock('yu-teacher', 'yu-teacher@doro.local', '9fa5f6cd-2327-4207-b973-40c185c161da');
                  setLoginModalOpen(false);
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl font-medium text-sm hover:bg-emerald-700 transition-colors shadow-xs"
              >
                <span>@yu-teacher 계정으로 시작</span>
              </button>

              <button
                onClick={() => {
                  loginWithMock('developer', 'developer@doro.local', 'c7f0e38b-a70f-4586-ba06-e75f0988aa62');
                  setLoginModalOpen(false);
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-100 text-gray-800 rounded-xl font-medium text-sm hover:bg-gray-200 transition-colors"
              >
                <span>@developer 계정으로 시작</span>
              </button>

              <button
                onClick={() => {
                  loginWithMock('reader', 'reader@doro.local', '4e3cef2d-644b-4981-8bdc-7ca71ce67ec3');
                  setLoginModalOpen(false);
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-100 text-gray-800 rounded-xl font-medium text-sm hover:bg-gray-200 transition-colors"
              >
                <span>@reader (독자) 계정으로 시작</span>
              </button>
            </div>

            <button
              onClick={() => setLoginModalOpen(false)}
              className="mt-6 w-full text-center text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </>
  );
};
