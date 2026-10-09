import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { AppLauncher } from './header/AppLauncher';
import { AccountMenu } from './header/AccountMenu';
import { SearchPanel } from './header/SearchPanel';
import { useHeaderSearch } from '../hooks/useHeaderSearch';
import { useThemeStore } from '../store/themeStore';
import {
  Search,
  Sun,
  Moon,
  Terminal,
} from 'lucide-react';
import { assetUrl } from '../config';

export const Header: React.FC = () => {
  const { user, isAuthenticated, isAdmin, login, signOut } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();
  // 앱 런처와 사용자 메뉴는 동시에 하나만 열린다
  const [openMenu, setOpenMenu] = useState<'apps' | 'user' | null>(null);
  const search = useHeaderSearch();

  return (
    <>
      <header className="sticky top-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-gray-200 dark:border-slate-800 transition-colors">
        <div className="max-w-[1728px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 sm:gap-2.5 font-black text-xl sm:text-2xl tracking-tighter text-gray-900 dark:text-white group shrink-0">
            <img
              src={assetUrl('doro-logo.png')}
              alt="DORO"
              className="w-8 h-8 sm:w-9 sm:h-9 object-contain group-hover:scale-110 transition-transform drop-shadow-sm shrink-0"
            />
            <span>
              DORO<span className="text-emerald-500">.log</span>
            </span>
          </Link>

          {/* Backdrop to close popovers on outside click */}
          {openMenu !== null && (
            <div className="fixed inset-0 z-40 bg-transparent cursor-default" onClick={() => setOpenMenu(null)} />
          )}

          {/* Right Actions */}
          <div className="flex items-center gap-1 sm:gap-3 min-w-0">
            {/*
              서비스 바로가기(앱 런처)는 넓은 화면에서만 둔다. 모바일에서는 헤더 공간을 차지하는데, 내용(포털 홈·개발자 센터·관제 로그)이
              사용자 메뉴에 이미 있다. 모바일에서는 그 자리에 글쓰기 아이콘을 둔다(AccountMenu).
            */}
            <div className="hidden sm:block">
              <AppLauncher
                isOpen={openMenu === 'apps'}
                isAdmin={isAdmin}
                onToggle={() => setOpenMenu(openMenu === 'apps' ? null : 'apps')}
                onClose={() => setOpenMenu(null)}
              />
            </div>

            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              // 로그인한 모바일에서는 헤더가 좁아 테마 전환을 사용자 메뉴로 옮긴다(비로그인은 그대로 헤더에 둔다)
              className={`${isAuthenticated ? 'hidden sm:block ' : ''}p-2 text-gray-500 hover:text-gray-900 dark:text-slate-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors`}
              title={theme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'}
              aria-label={theme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'}
            >
              {theme === 'dark' ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5" />}
            </button>

            {/* Search Trigger */}
            <button
              onClick={search.toggle}
              className="p-2 text-gray-500 hover:text-gray-900 dark:text-slate-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors"
              title="검색"
              aria-label="검색"
            >
              <Search className="w-5 h-5" />
            </button>

            {/* Developers API Link */}
            <Link
              to="/developers"
              className="hidden sm:flex p-2 text-gray-500 hover:text-gray-900 dark:text-slate-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors items-center gap-1 text-xs font-semibold"
              title="개발자 센터 (API & 자동화)"
            >
              <Terminal className="w-4 h-4 text-emerald-500" />
              <span className="hidden md:inline text-slate-700 dark:text-slate-300">API</span>
            </Link>

            <AccountMenu
              isAuthenticated={isAuthenticated}
              isAdmin={isAdmin}
              user={user}
              isOpen={openMenu === 'user'}
              onToggle={() => setOpenMenu(openMenu === 'user' ? null : 'user')}
              onClose={() => setOpenMenu(null)}
              onLogin={login}
              onLogout={signOut}
              theme={theme}
              onToggleTheme={toggleTheme}
            />
          </div>
        </div>

        <SearchPanel
          isOpen={search.isOpen}
          query={search.query}
          setQuery={search.setQuery}
          suggestions={search.suggestions}
          onSubmit={search.submit}
          onSelectTag={search.selectTag}
        />
      </header>

    </>
  );
};
