import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { blogApi } from '../api/blogApi';
import { useAuthStore } from '../store/authStore';
import type { Series, PostStatus } from '../api/types';
import { MarkdownViewer } from '../components/MarkdownViewer';
import {
  ArrowLeft,
  Image as ImageIcon,
  Globe,
  Lock,
  BookOpen,
  Plus,
  Check,
} from 'lucide-react';

export const EditorPage: React.FC = () => {
  const { id } = useParams<{ id: string }>(); // Post ID if editing
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');

  // Publish Modal State
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [summary, setSummary] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [slug, setSlug] = useState('');
  const [status, setStatus] = useState<PostStatus>('PUBLISHED');
  const [selectedSeriesId, setSelectedSeriesId] = useState<string>('');
  const [seriesList, setSeriesList] = useState<Series[]>([]);
  const [newSeriesTitle, setNewSeriesTitle] = useState('');
  const [showNewSeriesInput, setShowNewSeriesInput] = useState(false);

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      alert('로그인이 필요한 서비스입니다.');
      navigate('/');
      return;
    }

    // Load series for current user
    if (user?.username) {
      blogApi.getUserSeries(user.username).then((res) => {
        setSeriesList(res || []);
      });
    }

    // If editing existing post
    if (id) {
      loadPostForEdit(id);
    }
  }, [id, isAuthenticated, user]);

  const loadPostForEdit = async (postId: string) => {
    try {
      const data = await blogApi.getPostById(postId);
      setTitle(data.post.title);

      setContent(data.content);
      setTags(data.post.tags || []);
      setSummary(data.post.summary || '');
      setThumbnailUrl(data.post.thumbnailUrl || '');
      setSlug(data.post.slug);
      setStatus(data.post.status);
      if (data.post.seriesId) setSelectedSeriesId(data.post.seriesId);
    } catch (err) {
      console.error('Failed to load post for editing', err);
      alert('게시글을 불러올 수 없습니다.');
      navigate('/');
    }
  };

  // Generate slug from title automatically if not set
  const generateSlug = (t: string) => {
    return t
      .trim()
      .toLowerCase()
      .replace(/[^\w\s가-힣-]/g, '')
      .replace(/\s+/g, '-');
  };

  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const val = tagInput.trim().replace(/^#/, '');
      if (val && !tags.includes(val)) {
        setTags([...tags, val]);
      }
      setTagInput('');
    } else if (e.key === 'Backspace' && !tagInput && tags.length > 0) {
      setTags(tags.slice(0, -1));
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const handleOpenPublishModal = () => {
    if (!title.trim()) {
      alert('제목을 입력해주세요.');
      return;
    }
    if (!content.trim()) {
      alert('내용을 입력해주세요.');
      return;
    }

    if (!slug) {
      setSlug(generateSlug(title) || 'post');
    }
    if (!summary) {
      // Auto-extract first 120 chars as summary
      const plain = content.replace(/[#*`_\[\]()]/g, '').slice(0, 120);
      setSummary(plain);
    }

    setShowPublishModal(true);
  };

  const handleCreateSeries = async () => {
    if (!newSeriesTitle.trim()) return;
    try {
      const created = await blogApi.createSeries({
        title: newSeriesTitle.trim(),
        slug: generateSlug(newSeriesTitle.trim()),
      });
      setSeriesList([created, ...seriesList]);

      setSelectedSeriesId(created.id);
      setNewSeriesTitle('');
      setShowNewSeriesInput(false);
    } catch (err: any) {
      alert(err.response?.data?.error?.message || '시리즈 생성에 실패했습니다.');
    }
  };

  const handleSaveDraft = async () => {
    if (!title.trim()) {
      alert('제목을 입력해주세요.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        content: content,
        slug: slug || generateSlug(title) || 'draft-' + Date.now(),
        summary: summary || title,
        thumbnailUrl: thumbnailUrl || undefined,
        status: 'DRAFT' as PostStatus,
        tags: tags,
        seriesId: selectedSeriesId || undefined,
      };

      if (id) {
        await blogApi.updatePost(id, payload);
      } else {
        await blogApi.createPost(payload);
      }
      alert('임시 저장되었습니다.');
      navigate('/me/posts');
    } catch (err: any) {
      alert(err.response?.data?.error?.message || '임시 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleFinalPublish = async () => {
    if (!title.trim()) return;
    setSaving(true);

    try {
      const finalSlug = slug.trim() || generateSlug(title) || 'post-' + Date.now();
      const payload = {
        title: title.trim(),
        content: content,
        slug: finalSlug,
        summary: summary.trim() || title,
        thumbnailUrl: thumbnailUrl.trim() || undefined,
        status: status,
        tags: tags,
        seriesId: selectedSeriesId || undefined,
      };

      if (id) {
        await blogApi.updatePost(id, payload);
      } else {
        await blogApi.createPost(payload);
      }

      setShowPublishModal(false);
      navigate(`/@${user?.username}/${finalSlug}`);
    } catch (err: any) {
      alert(err.response?.data?.error?.message || '글 출간에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Top Split Editor Area */}
      <div className="flex-1 flex flex-col lg:flex-row h-[calc(100vh-64px)]">
        {/* Left Side: Markdown Writing Pane */}
        <div className="w-full lg:w-1/2 flex flex-col p-6 sm:p-10 border-r border-slate-200 overflow-y-auto">
          <input
            type="text"
            placeholder="제목을 입력하세요"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="text-3xl sm:text-4xl font-extrabold text-slate-900 placeholder:text-slate-300 focus:outline-none mb-4 w-full"
          />

          {/* Tags input bar */}
          <div className="flex flex-wrap items-center gap-2 mb-6 pb-4 border-b border-slate-100">
            {tags.map((t) => (
              <span
                key={t}
                onClick={() => handleRemoveTag(t)}
                className="inline-flex items-center gap-1 px-3 py-1 bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-600 rounded-full text-xs font-semibold cursor-pointer transition-colors"
                title="클릭하여 태그 삭제"
              >
                #{t} ✕
              </span>
            ))}
            <input
              type="text"
              placeholder="태그를 입력하세요 (Enter 또는 쉼표)"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleAddTag}
              className="text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none flex-1 min-w-[200px]"
            />
          </div>

          {/* Markdown Content Textarea */}
          <textarea
            placeholder="당신의 이야기를 적어보세요... (Markdown 문법 지원)"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="flex-1 w-full resize-none text-slate-800 text-base leading-relaxed placeholder:text-slate-300 focus:outline-none font-mono min-h-[300px]"
          />
        </div>

        {/* Right Side: Live Markdown Preview */}
        <div className="hidden lg:block w-1/2 p-10 bg-slate-50 overflow-y-auto">
          <div className="max-w-2xl mx-auto">
            <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mb-6 break-words">
              {title || <span className="text-slate-300">제목 미리보기</span>}
            </h1>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-8">
                {tags.map((t) => (
                  <span key={t} className="text-xs px-2.5 py-1 bg-slate-200 text-slate-700 rounded-full font-medium">
                    #{t}
                  </span>
                ))}
              </div>
            )}
            <MarkdownViewer content={content || '*작성 중인 내용이 여기에 실시간으로 표시됩니다.*'} />
          </div>
        </div>
      </div>

      {/* Bottom Sticky Action Toolbar */}
      <footer className="h-16 bg-white border-t border-slate-200 px-6 flex items-center justify-between z-20">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-slate-600 hover:text-slate-900 font-medium text-sm transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> 나가기
        </button>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSaveDraft}
            disabled={saving}
            className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
          >
            임시저장
          </button>
          <button
            onClick={handleOpenPublishModal}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm"
          >
            출간하기
          </button>
        </div>
      </footer>

      {/* Velog-style Publish Dialog Modal */}
      {showPublishModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row max-h-[90vh]">
            {/* Modal Left: Post Thumbnail & Summary Preview */}
            <div className="w-full md:w-1/2 p-8 bg-slate-50 border-r border-slate-100 flex flex-col justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900 mb-4">포스트 미리보기</h3>

                {/* Thumbnail input/preview */}
                <div className="mb-4">
                  {thumbnailUrl ? (
                    <div className="relative aspect-video rounded-xl overflow-hidden shadow-xs group mb-2">
                      <img src={thumbnailUrl} alt="Thumbnail preview" className="w-full h-full object-cover" />
                      <button
                        onClick={() => setThumbnailUrl('')}
                        className="absolute top-2 right-2 bg-slate-900/70 text-white p-1 rounded-full text-xs hover:bg-rose-600"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <div className="aspect-video bg-slate-200 rounded-xl flex flex-col items-center justify-center text-slate-400 gap-2 mb-2">
                      <ImageIcon className="w-8 h-8" />
                      <span className="text-xs">썸네일 이미지 URL을 입력하세요</span>
                    </div>
                  )}

                  <input
                    type="text"
                    placeholder="썸네일 이미지 URL (https://...)"
                    value={thumbnailUrl}
                    onChange={(e) => setThumbnailUrl(e.target.value)}
                    className="w-full text-xs p-2.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                {/* Summary / Excerpt */}
                <div>
                  <div className="flex justify-between text-xs text-slate-500 mb-1">
                    <span>포스트 한 줄 소개</span>
                    <span>{summary.length}/150</span>
                  </div>
                  <textarea
                    rows={4}
                    maxLength={150}
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                    placeholder="당신의 포스트를 짧게 소개해 보세요."
                    className="w-full p-3 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none text-slate-800"
                  />
                </div>
              </div>
            </div>

            {/* Modal Right: URL Slug, Series, Visibility Settings */}
            <div className="w-full md:w-1/2 p-8 flex flex-col justify-between overflow-y-auto">
              <div className="space-y-6">
                {/* Visibility */}
                <div>
                  <label className="block text-sm font-bold text-slate-900 mb-2">공개 설정</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setStatus('PUBLISHED')}
                      className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border text-sm font-semibold transition-all ${
                        status === 'PUBLISHED'
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-700 shadow-xs'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <Globe className="w-4 h-4" /> 전체 공개
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatus('PRIVATE')}
                      className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border text-sm font-semibold transition-all ${
                        status === 'PRIVATE'
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-700 shadow-xs'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <Lock className="w-4 h-4" /> 비공개
                    </button>
                  </div>
                </div>

                {/* Custom Slug */}
                <div>
                  <label className="block text-sm font-bold text-slate-900 mb-1">URL 슬러그</label>
                  <div className="flex items-center text-xs text-slate-500 bg-slate-100 px-3 py-2 rounded-lg border border-slate-200">
                    <span className="font-mono">/@{user?.username}/</span>
                    <input
                      type="text"
                      value={slug}
                      onChange={(e) => setSlug(e.target.value)}
                      className="bg-transparent font-mono text-slate-800 focus:outline-none flex-1 font-semibold"
                    />
                  </div>
                </div>

                {/* Series Selection */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                      <BookOpen className="w-4 h-4 text-emerald-600" /> 시리즈 설정
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowNewSeriesInput(!showNewSeriesInput)}
                      className="text-xs text-emerald-600 hover:text-emerald-700 font-semibold"
                    >
                      {showNewSeriesInput ? '취소' : '+ 새 시리즈 생성'}
                    </button>
                  </div>

                  {showNewSeriesInput && (
                    <div className="flex gap-2 mb-3">
                      <input
                        type="text"
                        placeholder="새 시리즈 이름"
                        value={newSeriesTitle}
                        onChange={(e) => setNewSeriesTitle(e.target.value)}
                        className="flex-1 text-xs p-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                      <button
                        type="button"
                        onClick={handleCreateSeries}
                        className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700"
                      >
                        생성
                      </button>
                    </div>
                  )}

                  <select
                    value={selectedSeriesId}
                    onChange={(e) => setSelectedSeriesId(e.target.value)}
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="">시리즈에 추가하지 않음</option>
                    {seriesList.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.title} ({s.postCount}편)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Bottom Buttons */}
              <div className="flex items-center justify-end gap-3 mt-8 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowPublishModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-medium transition-colors"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleFinalPublish}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-bold shadow-md transition-colors disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  <span>{saving ? '출간 중...' : '출간하기'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
