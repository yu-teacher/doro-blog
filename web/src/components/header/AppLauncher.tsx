import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { loadServices, type LauncherService } from '../../utils/servicesManifest';
import { BookOpen, Code2, Home, LayoutGrid, ShieldCheck, Terminal } from 'lucide-react';

interface AppLauncherProps {
  isOpen: boolean;
  isAdmin: boolean;
  onToggle: () => void;
  onClose: () => void;
}

/** 구글 스타일 9점 앱 런처: DORO 서비스 바로가기 (관리자에게는 관제 로그도 보인다). */
const CURRENT_SERVICE_ID = 'blog';

export const AppLauncher: React.FC<AppLauncherProps> = ({ isOpen, isAdmin, onToggle, onClose }) => {
  // 서비스 목록은 허브의 /services.json 에서 열 때 읽는다(코드에 두지 않는다). null = 읽는 중, 빈 배열 = 못 읽음.
  const [services, setServices] = useState<LauncherService[] | null>(null);

  useEffect(() => {
    if (!isOpen || services !== null) return;
    let active = true;
    void loadServices().then((list) => {
      if (active) setServices(list);
    });
    return () => {
      active = false;
    };
  }, [isOpen, services]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  return (
  <>
    {/* App Launcher Button (Google-style 9-dots LayoutGrid) */}
    {/* 모바일(<640px)에서는 래퍼를 기준점으로 삼지 않아 팝오버가 (sticky) 헤더 기준으로 우측 여백에 붙는다. 래퍼 기준이면 헤더 중간 버튼 오른쪽 끝에 맞춰 320px 에서 왼쪽 밖으로 나간다. */}
    <div className="sm:relative">
      <button
        onClick={() => {
          onToggle();
        }}
        className={`inline-flex items-center justify-center w-11 h-11 sm:w-auto sm:h-auto p-2 rounded-full transition-colors relative z-50 ${
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
          className="absolute right-0 mr-4 sm:mr-0 top-full mt-1 sm:top-auto sm:mt-2 w-72 max-w-[calc(100vw-2rem)] bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-gray-100 dark:border-slate-800 p-4 z-50 animate-in fade-in zoom-in-95 duration-100"
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

          <div className="grid grid-cols-2 gap-2">
            {/* 허브(/)는 이 앱의 라우터 밖이라 일반 링크로 이동한다. 파티·게임·메뉴 등 다른 서비스는 허브에서 한눈에 보인다 */}
            <a
              href="/"
              className="group flex flex-col items-center justify-center p-3 rounded-2xl hover:bg-indigo-50/60 dark:hover:bg-indigo-950/30 transition-all text-center border border-transparent"
            >
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 mb-1.5 shadow-xs group-hover:shadow-md transition-shadow">
                <Home className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">Doro 홈</span>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">모든 서비스 한눈에</span>
            </a>

            {/* 허브가 주는 서비스 목록. 현재 서비스(blog)는 강조한다. 허브·다른 서비스는 라우터 밖이라 일반 링크다 */}
            {(services ?? []).map((service) => (
              <a
                key={service.id}
                href={service.href}
                // index.css 의 (pointer: coarse) a[href] 규칙(min-height 32px, 레이어 밖)이 min-h-11 을 이기므로 44px 는 style 로 건다.
                style={{ minHeight: 44 }}
                aria-current={service.id === CURRENT_SERVICE_ID ? 'page' : undefined}
                className={`col-span-2 flex min-h-11 flex-col justify-center rounded-2xl px-3 py-1.5 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60 ${
                  service.id === CURRENT_SERVICE_ID ? 'bg-emerald-50 dark:bg-emerald-950/40' : ''
                }`}
              >
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{service.name}</span>
                {service.desc !== '' && <span className="text-[10px] text-slate-500 dark:text-slate-400">{service.desc}</span>}
              </a>
            ))}
            {services === null && <p className="col-span-2 px-3 py-1 text-[10px] text-slate-500 dark:text-slate-400">서비스 목록을 불러오는 중…</p>}
            {services !== null && services.length === 0 && (
              <p className="col-span-2 px-3 py-1 text-[10px] text-slate-500 dark:text-slate-400">서비스 목록을 불러오지 못했어요. Doro 홈에서 모두 볼 수 있어요.</p>
            )}

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
};
