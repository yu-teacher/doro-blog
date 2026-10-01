import React from 'react';
import type { PostSummary } from '../../api/types';
import { PostCard } from '../PostCard';
import { Sparkles } from 'lucide-react';

interface RelatedPostsProps {
  relatedPosts: PostSummary[];
}

/** 함께 읽으면 좋은 연관 글 그리드. */
export const RelatedPosts: React.FC<RelatedPostsProps> = ({ relatedPosts }) => (
  <>
    {/* Related Posts Recommendation Grid */}
    {relatedPosts.length > 0 && (
      <section className="mt-14 mb-8">
        <div className="flex items-center gap-2 mb-6">
          <Sparkles className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            함께 읽으면 좋은 연관 글
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {relatedPosts.map((rel) => (
            <PostCard key={rel.id} post={rel} />
          ))}
        </div>
      </section>
    )}
  </>
);
