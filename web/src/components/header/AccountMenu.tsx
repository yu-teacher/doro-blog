import React from 'react';
import { Link } from 'react-router-dom';
import type { UserProfile } from '../../api/types';
import { NotificationDropdown } from '../NotificationDropdown';
import { BookOpen, Bookmark, ChevronDown, ExternalLink, LayoutGrid, LogOut, Moon, PenSquare, ShieldCheck, Sun, Terminal, User } from 'lucide-react';

const DORO_SIGNUP_URL = '/portal/signup';

interface AccountMenuProps {
  isAuthenticated: boolean;
  isAdmin: boolean;
  user: UserProfile | null;
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  onLogin: () => void;
  onLogout: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
}

/** 로그인 상태에 따른 우측 메뉴: 글쓰기/알림/사용자 메뉴, 비로그인 시 로그인·회원가입 버튼. */
export const AccountMenu: React.FC<AccountMenuProps> = ({ isAuthenticated, isAdmin, user, isOpen, onToggle, onClose, onLogin, onLogout, theme, onToggleTheme }) => (
  <>
    {isAuthenticated ? (
      <>
        <Link
          to="/write"
          className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-gray-900 dark:border-slate-600 text-gray-900 dark:text-slate-200 text-sm font-medium hover:bg-gray-900 hover:text-white dark:hover:bg-emerald-600 dark:hover:border-emerald-600 transition-all shadow-xs"
        >
          <PenSquare className="w-4 h-4" />
          새 글 작성
        </Link>

        {/* 모바일: 헤더가 좁아 "새 글 작성" 글자 버튼 대신 아이콘 버튼을 둔다. 모바일에서 글쓰기를 시작할 유일한 입구다. */}
        <Link
          to="/write"
          title="새 글 작성"
          aria-label="새 글 작성"
          className="sm:hidden p-2 rounded-full text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors"
        >
          <PenSquare className="w-5 h-5" />
        </Link>

        {/* Notifications Dropdown */}
        <NotificationDropdown />

        {/* User Dropdown */}
        <div className="relative">
          <button
            onClick={() => {
              onToggle();
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
            <ChevronDown className="hidden sm:block w-4 h-4 text-gray-500 dark:text-slate-400" />
          </button>

          {isOpen && (
            <div
              className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-gray-100 dark:border-slate-700 py-1.5 text-sm z-50 animate-in fade-in zoom-in-95 duration-100"
              onClick={() => onClose()}
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

              {/* 다른 DORO 서비스(파티·게임·메뉴 등)는 포털 허브에 모여 있다 */}
              <a
                href="/"
                className="flex items-center gap-2.5 px-4 py-2 text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
              >
                <LayoutGrid className="w-4 h-4 text-gray-400 dark:text-slate-400" />
                DORO 서비스 전체 보기
              </a>

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

              {/* 모바일: 헤더의 테마 전환 버튼 대신 여기서 바꾼다 */}
              <button
                onClick={onToggleTheme}
                className="sm:hidden w-full flex items-center gap-2.5 px-4 py-2 text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors text-left"
              >
                {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-gray-400" />}
                {theme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'}
              </button>

              <div className="border-t border-gray-100 dark:border-slate-700 my-1"></div>

              <button
                onClick={onLogout}
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
      <div className="flex items-center gap-1 sm:gap-2">
        <button
          onClick={onLogin}
          className="whitespace-nowrap px-2 sm:px-3.5 py-1.5 rounded-full text-slate-700 dark:text-slate-200 text-sm font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          로그인
        </button>
        <a
          href={DORO_SIGNUP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="hidden sm:inline-flex whitespace-nowrap items-center gap-1.5 px-4 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors shadow-xs"
        >
          <span>회원가입</span>
          <ExternalLink className="w-3.5 h-3.5 opacity-85" />
        </a>
      </div>
    )}
  </>
);
