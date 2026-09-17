import React, { useState, useEffect, useRef } from 'react';
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
  Upload,
  Sparkles,
  Trash2,
  RefreshCw,
  Loader2,
  Link2,
} from 'lucide-react';

export const EditorPage: React.FC = () => {
  const { id } = useParams<{ id: string }>(); // Post ID if editing
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');

  // Refs
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const editorFileInputRef = useRef<HTMLInputElement>(null);
  const thumbnailFileInputRef = useRef<HTMLInputElement>(null);

  // Upload States
  const [uploadingEditorImage, setUploadingEditorImage] = useState(false);
  const [uploadingThumbnail, setUploadingThumbnail] = useState(false);
  const [thumbnailAutoDetected, setThumbnailAutoDetected] = useState(false);
  const [showManualUrlInput, setShowManualUrlInput] = useState(false);

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

  // Extract first image from markdown content
  const extractFirstImage = (text: string): string | null => {
    const match = text.match(/!\[.*?\]\(((?:https?:\/\/|\/media\/|\/uploads\/)[^\s)]+)\)/);
    return match ? match[1] : null;
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

    // Auto-detect thumbnail from first markdown image if not explicitly set
    if (!thumbnailUrl) {
      const firstImg = extractFirstImage(content);
      if (firstImg) {
        setThumbnailUrl(firstImg);
        setThumbnailAutoDetected(true);
      } else {
        setThumbnailAutoDetected(false);
      }
    }

    setShowPublishModal(true);
  };

  // Upload image to MinIO / S3 and insert markdown tag
  const uploadAndInsertImage = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('이미지 파일(PNG, JPG, GIF, WebP, SVG)만 업로드할 수 있습니다.');
      return;
    }

    // 1. Create optimistic local blob preview URL
    const blobUrl = URL.createObjectURL(file);
    const placeholder = `![${file.name} 업로드 중...](${blobUrl})\n`;

    const textarea = textareaRef.current;
    let insertPos = content.length;
    if (textarea) {
      insertPos = textarea.selectionStart ?? content.length;
    }

    // Insert optimistic placeholder
    const newContent = content.slice(0, insertPos) + placeholder + content.slice(insertPos);
    setContent(newContent);
    setUploadingEditorImage(true);

    try {
      // 2. Upload to MinIO backend
      const res = await blogApi.uploadImage(file, 'posts');

      // 3. Replace blob placeholder with permanent MinIO URL
      const finalMarkdown = `![${res.originalFilename}](${res.url})\n`;
      setContent((prev) => prev.replace(placeholder, finalMarkdown));

      // Clean up object URL
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error('Failed to upload image:', err);
      alert('이미지 업로드에 실패했습니다.');
      // Remove placeholder on error
      setContent((prev) => prev.replace(placeholder, ''));
    } finally {
      setUploadingEditorImage(false);
    }
  };

  // Paste handler for editor textarea
  const handleEditorPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        e.preventDefault();
        const file = items[i].getAsFile();
        if (file) {
          uploadAndInsertImage(file);
        }
        break;
      }
    }
  };

  // Drop handler for editor textarea
  const handleEditorDrop = (e: React.DragEvent<HTMLTextAreaElement>) => {
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('image/')) {
        e.preventDefault();
        uploadAndInsertImage(file);
      }
    }
  };

  // File input change for editor toolbar button
  const handleEditorFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      uploadAndInsertImage(e.target.files[0]);
      e.target.value = '';
    }
  };

  // Upload thumbnail handler for publish modal
  const handleThumbnailFileSelect = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('이미지 파일(PNG, JPG, GIF, WebP, SVG)만 업로드할 수 있습니다.');
      return;
    }

    try {
      setUploadingThumbnail(true);
      const res = await blogApi.uploadImage(file, 'thumbnails');
      setThumbnailUrl(res.url);
      setThumbnailAutoDetected(false);
    } catch (err) {
      console.error('Failed to upload thumbnail:', err);
      alert('썸네일 업로드에 실패했습니다.');
    } finally {
      setUploadingThumbnail(false);
    }
  };

  const handleThumbnailFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleThumbnailFileSelect(e.target.files[0]);
      e.target.value = '';
    }
  };

  const handleThumbnailDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('image/')) {
        handleThumbnailFileSelect(file);
      }
    }
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
    <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      {/* Hidden File Input for Editor Toolbar */}
      <input
        type="file"
        ref={editorFileInputRef}
        accept="image/*"
        onChange={handleEditorFileInputChange}
        className="hidden"
      />

      {/* Hidden File Input for Publish Modal Thumbnail */}
      <input
        type="file"
        ref={thumbnailFileInputRef}
        accept="image/*"
        onChange={handleThumbnailFileInputChange}
        className="hidden"
      />

      {/* Top Split Editor Area */}
      <div className="flex-1 flex flex-col lg:flex-row h-[calc(100vh-64px)]">
        {/* Left Side: Markdown Writing Pane */}
        <div className="w-full lg:w-1/2 flex flex-col p-6 sm:p-10 border-r border-slate-200 dark:border-slate-800 overflow-y-auto">
          <input
            type="text"
            placeholder="제목을 입력하세요"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600 focus:outline-none mb-4 w-full bg-transparent"
          />

          {/* Tags input bar */}
          <div className="flex flex-wrap items-center gap-2 mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
            {tags.map((t) => (
              <span
                key={t}
                onClick={() => handleRemoveTag(t)}
                className="inline-flex items-center gap-1 px-3 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950 text-slate-700 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 rounded-full text-xs font-semibold cursor-pointer transition-colors"
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
              className="text-sm text-slate-700 dark:text-slate-300 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none flex-1 min-w-[200px] bg-transparent"
            />
          </div>

          {/* Markdown Toolbar (Velog-style image upload & status) */}
          <div className="flex items-center justify-between py-2 px-1 mb-2 text-xs text-slate-400 border-b border-slate-100 dark:border-slate-800/80">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => editorFileInputRef.current?.click()}
                disabled={uploadingEditorImage}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors font-medium text-xs"
                title="이미지 파일 업로드 (또는 본문에 직접 붙여넣기/드래그)"
              >
                {uploadingEditorImage ? (
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
                ) : (
                  <ImageIcon className="w-4 h-4 text-emerald-500" />
                )}
                <span>이미지 첨부</span>
              </button>
              <span className="text-[11px] text-slate-400 hidden sm:inline">
                (Cmd+V 붙여넣기 또는 드래그앤드롭 지원)
              </span>
            </div>

            {uploadingEditorImage && (
              <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium animate-pulse">
                <Loader2 className="w-3 h-3 animate-spin" /> MinIO 스토리지 업로드 중...
              </span>
            )}
          </div>

          {/* Markdown Content Textarea */}
          <textarea
            ref={textareaRef}
            placeholder="당신의 이야기를 적어보세요... (Markdown 문법 지원, 이미지를 직접 붙여넣거나 끌어다 놓을 수 있습니다)"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onPaste={handleEditorPaste}
            onDrop={handleEditorDrop}
            onDragOver={(e) => e.preventDefault()}
            className="flex-1 w-full resize-none text-slate-800 dark:text-slate-100 text-base leading-relaxed placeholder:text-slate-300 dark:placeholder:text-slate-600 focus:outline-none font-mono min-h-[300px] bg-transparent"
          />
        </div>

        {/* Right Side: Live Markdown Preview */}
        <div className="hidden lg:block w-1/2 p-10 bg-slate-50 dark:bg-slate-900/50 overflow-y-auto">
          <div className="max-w-2xl mx-auto">
            <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white mb-6 break-words">
              {title || <span className="text-slate-300 dark:text-slate-700">제목 미리보기</span>}
            </h1>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-8">
                {tags.map((t) => (
                  <span key={t} className="text-xs px-2.5 py-1 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-full font-medium">
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
      <footer className="h-16 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 px-6 flex items-center justify-between z-20">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-medium text-sm transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> 나가기
        </button>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSaveDraft}
            disabled={saving}
            className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
          >
            임시저장
          </button>
          <button
            onClick={handleOpenPublishModal}
            disabled={saving}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition-all shadow-md hover:shadow-lg"
          >
            출간하기
          </button>
        </div>
      </footer>

      {/* Publish Settings Modal (Velog-style 2-Column with MinIO Thumbnail Upload) */}
      {showPublishModal && (
        <div
          onClick={() => setShowPublishModal(false)}
          className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden flex flex-col md:flex-row max-h-[90vh] text-slate-900 dark:text-slate-100 cursor-default"
          >
            {/* Modal Left: Post Thumbnail & Summary Preview */}
            <div className="w-full md:w-1/2 p-8 bg-slate-50 dark:bg-slate-950/50 border-r border-slate-100 dark:border-slate-800 flex flex-col justify-between overflow-y-auto">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">포스트 미리보기</h3>

                {/* Velog-style 1.91:1 (~16:9) Thumbnail Upload Box */}
                <div className="mb-5">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                    대표 썸네일
                  </label>

                  {thumbnailUrl ? (
                    <div className="relative aspect-video rounded-2xl overflow-hidden shadow-sm group border border-slate-200 dark:border-slate-800 bg-slate-950">
                      <img
                        src={thumbnailUrl}
                        alt="Thumbnail preview"
                        className="w-full h-full object-cover"
                      />

                      {/* Auto-detected badge */}
                      {thumbnailAutoDetected && (
                        <div className="absolute top-2.5 left-2.5 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-900/80 backdrop-blur-xs text-emerald-400 text-[11px] font-semibold border border-emerald-500/30">
                          <Sparkles className="w-3 h-3 text-emerald-400" />
                          본문 첫 이미지 자동 감지됨
                        </div>
                      )}

                      {/* Hover Overlay with Re-upload / Delete Buttons */}
                      <div className="absolute inset-0 bg-black/50 backdrop-blur-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                        <button
                          type="button"
                          onClick={() => thumbnailFileInputRef.current?.click()}
                          disabled={uploadingThumbnail}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-white text-slate-900 hover:bg-slate-100 rounded-xl text-xs font-bold shadow-md transition-all"
                        >
                          <RefreshCw className="w-3.5 h-3.5" /> 재업로드
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setThumbnailUrl('');
                            setThumbnailAutoDetected(false);
                          }}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> 제거
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Dropzone when no thumbnail */
                    <div
                      onClick={() => thumbnailFileInputRef.current?.click()}
                      onDrop={handleThumbnailDrop}
                      onDragOver={(e) => e.preventDefault()}
                      className="aspect-video bg-white dark:bg-slate-800/80 hover:bg-emerald-50/50 dark:hover:bg-slate-800 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-emerald-500 transition-all flex flex-col items-center justify-center cursor-pointer p-6 text-center group"
                    >
                      {uploadingThumbnail ? (
                        <div className="flex flex-col items-center gap-2 text-emerald-600 dark:text-emerald-400">
                          <Loader2 className="w-8 h-8 animate-spin" />
                          <span className="text-xs font-semibold">MinIO 스토리지로 업로드 중...</span>
                        </div>
                      ) : (
                        <>
                          <div className="p-3 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform mb-2">
                            <Upload className="w-6 h-6" />
                          </div>
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                            썸네일 이미지 업로드
                          </span>
                          <span className="text-[11px] text-slate-400 mt-1">
                            클릭하거나 이미지 파일을 끌어다 놓으세요 (16:9 권장)
                          </span>
                        </>
                      )}
                    </div>
                  )}

                  {/* Secondary manual URL toggle */}
                  <div className="mt-2 flex justify-between items-center text-[11px]">
                    <button
                      type="button"
                      onClick={() => setShowManualUrlInput(!showManualUrlInput)}
                      className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 flex items-center gap-1"
                    >
                      <Link2 className="w-3 h-3" />
                      {showManualUrlInput ? '직접 입력 닫기' : '외부 이미지 URL 직접 입력'}
                    </button>
                    {thumbnailUrl && (
                      <button
                        type="button"
                        onClick={() => {
                          setThumbnailUrl('');
                          setThumbnailAutoDetected(false);
                        }}
                        className="text-rose-500 hover:underline"
                      >
                        썸네일 비우기
                      </button>
                    )}
                  </div>

                  {showManualUrlInput && (
                    <input
                      type="text"
                      placeholder="https://... 이미지 URL"
                      value={thumbnailUrl}
                      onChange={(e) => {
                        setThumbnailUrl(e.target.value);
                        setThumbnailAutoDetected(false);
                      }}
                      className="mt-2 w-full text-xs p-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  )}
                </div>

                {/* Summary / Excerpt */}
                <div>
                  <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
                    <span>포스트 한 줄 소개</span>
                    <span>{summary.length}/150</span>
                  </div>
                  <textarea
                    rows={4}
                    maxLength={150}
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                    placeholder="당신의 포스트를 짧게 소개해 보세요."
                    className="w-full p-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none"
                  />
                </div>
              </div>
            </div>

            {/* Modal Right: URL Slug, Series, Visibility Settings */}
            <div className="w-full md:w-1/2 p-8 flex flex-col justify-between overflow-y-auto">
              <div className="space-y-6">
                {/* Visibility */}
                <div>
                  <label className="block text-sm font-bold text-slate-900 dark:text-white mb-2">공개 설정</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setStatus('PUBLISHED')}
                      className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border text-sm font-semibold transition-all ${
                        status === 'PUBLISHED'
                          ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 shadow-xs'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <Globe className="w-4 h-4" /> 전체 공개
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatus('PRIVATE')}
                      className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border text-sm font-semibold transition-all ${
                        status === 'PRIVATE'
                          ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 shadow-xs'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <Lock className="w-4 h-4" /> 비공개
                    </button>
                  </div>
                </div>

                {/* Custom Slug */}
                <div>
                  <label className="block text-sm font-bold text-slate-900 dark:text-white mb-1">URL 슬러그</label>
                  <div className="flex items-center text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700">
                    <span className="font-mono">/@{user?.username}/</span>
                    <input
                      type="text"
                      value={slug}
                      onChange={(e) => setSlug(e.target.value)}
                      className="bg-transparent font-mono text-slate-800 dark:text-slate-100 focus:outline-none flex-1 font-semibold"
                    />
                  </div>
                </div>

                {/* Series Selection */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <BookOpen className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> 시리즈 설정
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowNewSeriesInput(!showNewSeriesInput)}
                      className="text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 font-semibold"
                    >
                      {showNewSeriesInput ? '취소' : '+ 새 시리즈 생성'}
                    </button>
                  </div>

                  {showNewSeriesInput && (
                    <div className="flex gap-2 mb-3 animate-in fade-in">
                      <input
                        type="text"
                        placeholder="새 시리즈 이름"
                        value={newSeriesTitle}
                        onChange={(e) => setNewSeriesTitle(e.target.value)}
                        className="flex-1 text-xs p-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                      <button
                        type="button"
                        onClick={handleCreateSeries}
                        className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-colors"
                      >
                        추가
                      </button>
                    </div>
                  )}

                  <select
                    value={selectedSeriesId}
                    onChange={(e) => setSelectedSeriesId(e.target.value)}
                    className="w-full text-xs p-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="">(시리즈 선택 안 함)</option>
                    {seriesList.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.title} ({s.postCount}편)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-6 border-t border-slate-100 dark:border-slate-800 mt-6">
                <button
                  type="button"
                  onClick={() => setShowPublishModal(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleFinalPublish}
                  disabled={saving}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-all shadow-md hover:shadow-lg flex items-center gap-1.5"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>출간 중...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>출간하기</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
