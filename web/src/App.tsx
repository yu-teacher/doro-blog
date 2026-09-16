import React from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { Header } from './components/Header';
import { FeedPage } from './pages/FeedPage';
import { PostDetailPage } from './pages/PostDetailPage';
import { EditorPage } from './pages/EditorPage';
import { ChannelPage } from './pages/ChannelPage';
import { SeriesDetailPage } from './pages/SeriesDetailPage';
import { MyPostsPage } from './pages/MyPostsPage';
import { SearchPage } from './pages/SearchPage';

const AppContent: React.FC = () => {
  const location = useLocation();
  const isEditor = location.pathname.startsWith('/write') || location.pathname.startsWith('/edit');

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-200">
      {!isEditor && <Header />}

      <main className="flex-1">
        <Routes>
          <Route path="/" element={<FeedPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/write" element={<EditorPage />} />
          <Route path="/edit/:id" element={<EditorPage />} />
          <Route path="/me/posts" element={<MyPostsPage />} />
          <Route path="/:username/series/:slug" element={<SeriesDetailPage />} />
          <Route path="/:username/:slug" element={<PostDetailPage />} />
          <Route path="/:username" element={<ChannelPage />} />
        </Routes>
      </main>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
};

export default App;
