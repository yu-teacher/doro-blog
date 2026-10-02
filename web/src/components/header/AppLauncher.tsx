import React from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Code2, LayoutGrid, ShieldCheck, Terminal } from 'lucide-react';

interface AppLauncherProps {
  isOpen: boolean;
  isAdmin: boolean;
  onToggle: () => void;
  onClose: () => void;
}

/** 구글 스타일 9점 앱 런처: DORO 서비스 바로가기 (관리자에게는 관제 로그도 보인다). */
export const AppLauncher: React.FC<AppLauncherProps> = ({ isOpen, isAdmin, onToggle, onClose }) => (
  <>
    {/* App Launcher Button (Google-style 9-dots LayoutGrid) */}
    <div className="relative">
      <button
        onClick={() => {
          onToggle();
        }}
        className={`p-2 rounded-full transition-colors relative z-50 ${
          isOpen
            ? 'bg-slate-100 dark:bg-slate-800 text-emerald-600 dark:text-emerald-400'
            : 'text-gray-500 hover:text-gray-900 dark:text-slate-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800'
        }`}
        title="DORO 서비스 바로가기 (앱 런처)"
        aria-label="DORO 서비스 바로가기 (앱 런처)"
      >
        <LayoutGrid className="w-5 h-5" />
      </button>

      {isOpen && (
        <div
          className="absolute right-0 mt-2 w-72 bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-gray-100 dark:border-slate-800 p-4 z-50 animate-in fade-in zoom-in-95 duration-100"
          onClick={() => onClose()}
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
  </>
);
