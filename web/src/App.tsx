import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { Header } from './components/Header';
import { LoginErrorNotice } from './components/LoginErrorNotice';
import { ToastHost } from './components/ToastHost';
import { FeedPage } from './pages/FeedPage';
import { ROUTER_BASENAME } from './config';

// 첫 화면(피드)은 즉시 로드하고 나머지 라우트는 필요할 때 내려받는다.
const PostDetailPage = lazy(() => import('./pages/PostDetailPage').then((m) => ({ default: m.PostDetailPage })));
const EditorPage = lazy(() => import('./pages/EditorPage').then((m) => ({ default: m.EditorPage })));
const ChannelPage = lazy(() => import('./pages/ChannelPage').then((m) => ({ default: m.ChannelPage })));
const SeriesDetailPage = lazy(() => import('./pages/SeriesDetailPage').then((m) => ({ default: m.SeriesDetailPage })));
const MyPostsPage = lazy(() => import('./pages/MyPostsPage').then((m) => ({ default: m.MyPostsPage })));
const SearchPage = lazy(() => import('./pages/SearchPage').then((m) => ({ default: m.SearchPage })));
const TagSearchPage = lazy(() => import('./pages/TagSearchPage').then((m) => ({ default: m.TagSearchPage })));
const DevelopersPage = lazy(() => import('./pages/DevelopersPage').then((m) => ({ default: m.DevelopersPage })));

const RouteFallback: React.FC = () => (
  <div role="status" aria-live="polite" className="flex justify-center py-24">
    <span className="sr-only">페이지를 불러오는 중입니다</span>
    <div aria-hidden="true" className="w-8 h-8 rounded-full border-4 border-slate-200 dark:border-slate-700 border-t-emerald-500 animate-spin" />
  </div>
);

const AppContent: React.FC = () => {
  const location = useLocation();
  const isEditor = location.pathname.startsWith('/write') || location.pathname.startsWith('/edit');

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-200">
      <LoginErrorNotice />
      <ToastHost />
      {!isEditor && <Header />}

      <main className="flex-1">
        <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<FeedPage />} />
          <Route path="/tags" element={<TagSearchPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/write" element={<EditorPage />} />
          <Route path="/edit/:id" element={<EditorPage />} />
          <Route path="/me/posts" element={<MyPostsPage />} />
          <Route path="/developers" element={<DevelopersPage />} />
          <Route path="/@:username/series/:slug" element={<SeriesDetailPage />} />
          <Route path="/@:username/:slug" element={<PostDetailPage />} />
          <Route path="/@:username" element={<ChannelPage />} />
          <Route path="/:username/series/:slug" element={<SeriesDetailPage />} />
          <Route path="/:username/:slug" element={<PostDetailPage />} />
          <Route path="/:username" element={<ChannelPage />} />
        </Routes>
        </Suspense>
      </main>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <BrowserRouter basename={ROUTER_BASENAME}>
      <AppContent />
    </BrowserRouter>
  );
};

export default App;
