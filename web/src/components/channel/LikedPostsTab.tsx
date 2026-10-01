import React from 'react';
import type { PostSummary } from '../../api/types';
import { PostCard } from '../PostCard';
import { Heart } from 'lucide-react';

interface LikedPostsTabProps {
  likedPosts: PostSummary[];
  loading: boolean;
}

/** 좋아요한 글 보관함 탭. */
export const LikedPostsTab: React.FC<LikedPostsTabProps> = ({ likedPosts, loading }) => (
  <>
    <div className="animate-in fade-in duration-200">
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-48 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-6" />
          ))}
        </div>
      ) : likedPosts.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {likedPosts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      ) : (
        <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800">
          <Heart className="w-10 h-10 text-rose-400 mx-auto mb-3" />
          <p className="text-slate-500 dark:text-slate-400 font-medium">아직 좋아요를 누른 관심 글이 없습니다.</p>
          <p className="text-slate-400 dark:text-slate-500 text-xs mt-1">
            피드에서 마음에 드는 기술 글에 좋아요(하트)를 누르면 이곳에 보관됩니다.
          </p>
        </div>
      )}
    </div>
      
  </>
);
