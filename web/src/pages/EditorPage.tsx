import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { blogApi } from '../api/blogApi';
import { useAuthStore } from '../store/authStore';
import type { PostStatus, PostSummary } from '../api/types';
import { stripMarkdown } from '../utils/markdown';
import { trackEvent } from '../utils/analytics';
import {
} from 'lucide-react';
import { getErrorMessage } from '../utils/errors';
import { generateSlug } from '../utils/slug';
import { useDraftAutosave, type DraftSnapshot } from '../hooks/useDraftAutosave';
import { formatDate } from '../utils/date';
import { useMarkdownEditor } from '../hooks/useMarkdownEditor';
import { useImageUpload } from '../hooks/useImageUpload';
import { useLocalDraft } from '../hooks/useLocalDraft';
import { useServerDrafts } from '../hooks/useServerDrafts';
import { useSeriesList } from '../hooks/useSeriesList';
import { suggestPublishDefaults } from '../utils/publishDefaults';
import { ServerDraftsModal } from '../components/editor/ServerDraftsModal';
import { TagInput } from '../components/editor/TagInput';
import { MarkdownToolbar } from '../components/editor/MarkdownToolbar';
import { EditorPreview } from '../components/editor/EditorPreview';
import { DraftRestoreBanner } from '../components/editor/DraftRestoreBanner';
import { EditorActionBar } from '../components/editor/EditorActionBar';
import { PublishModal } from '../components/editor/PublishModal';

const LOCAL_AUTOSAVE_DELAY_MS = 2_000;
const SERVER_AUTOSAVE_DELAY_MS = 5_000;
const DRAFT_SUMMARY_LENGTH = 120;

/** 임시 저장(DRAFT) 요청 본문. 자동 저장과 수동 임시저장이 같은 규칙을 쓰도록 한 곳에서 만든다. */
function buildDraftPayload(snap: DraftSnapshot, loadedSeriesId = '') {
  const draftTitle = snap.title.trim() || '제목 없는 임시 글';
  return {
    title: draftTitle,
    content: snap.content || '',
    slug: snap.slug || generateSlug(draftTitle) || `draft-${Date.now()}`,
    summary: snap.summary || (snap.content ? stripMarkdown(snap.content).slice(0, DRAFT_SUMMARY_LENGTH) : draftTitle),
    thumbnailUrl: snap.thumbnailUrl || undefined,
    status: 'DRAFT' as PostStatus,
    tags: snap.tags,
    seriesId: snap.seriesId || undefined,
    // 불러온 글이 시리즈에 속했는데 사용자가 시리즈를 해제했다면 분명히 요청한다(서버는 seriesId 를 생략한 것만으로는 시리즈를 바꾸지 않는다)
    removeFromSeries: loadedSeriesId && !snap.seriesId ? true : undefined,
  };
}

export const EditorPage: React.FC = () => {
  const { id } = useParams<{ id: string }>(); // Post ID if editing
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState<string[]>([]);

  // Refs
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const editorFileInputRef = useRef<HTMLInputElement>(null);
  const thumbnailFileInputRef = useRef<HTMLInputElement>(null);

  // Upload States
  const [thumbnailAutoDetected, setThumbnailAutoDetected] = useState(false);
  const [showManualUrlInput, setShowManualUrlInput] = useState(false);

  // Publish Modal State
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [summary, setSummary] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [slug, setSlug] = useState('');
  const [status, setStatus] = useState<PostStatus>('PUBLISHED');
  const [selectedSeriesId, setSelectedSeriesId] = useState<string>('');
  const [newSeriesTitle, setNewSeriesTitle] = useState('');
  const [showNewSeriesInput, setShowNewSeriesInput] = useState(false);

  const [saving, setSaving] = useState(false);
  const [currentPostId, setCurrentPostId] = useState<string | null>(id || null);
  const currentPostIdRef = useRef<string | null>(id || null);
  const [showDraftsModal, setShowDraftsModal] = useState(false);
  // 서버에서 글 본문을 불러오는 동안은 자동 저장을 멈춘다 (불완전한 내용으로 서버 글을 덮어쓰지 않도록)
  const [loadingPostContent, setLoadingPostContent] = useState(false);
  // 서버에서 불러온 글의 현재 상태. 자동 저장은 DRAFT 를 보내므로, 출간/비공개 글에는 걸지 않는다
  const [loadedPostStatus, setLoadedPostStatus] = useState<PostStatus | null>(null);
  /** 불러온 글이 속한 시리즈. 사용자가 시리즈를 해제했는지 가려 서버에 removeFromSeries 로 알린다. */
  const loadedSeriesIdRef = useRef('');
  const serverAutosaveBlocked = loadedPostStatus !== null && loadedPostStatus !== 'DRAFT';

  const draftKey = `doro_editor_draft_${user?.username || 'guest'}`;

  // Keep currentPostIdRef in sync
  useEffect(() => {
    currentPostIdRef.current = currentPostId;
  }, [currentPostId]);

  const { drafts: serverDrafts, refresh: refreshServerDrafts, removeLocally: removeServerDraft } = useServerDrafts(isAuthenticated);

  // 로컬 백업(입력이 멈추면 저장)과 새 글 화면의 복원 안내
  const localDraft = useLocalDraft({
    draftKey,
    offerRestore: !id,
    snapshot: { title, content, tags, summary, thumbnailUrl },
    delayMs: LOCAL_AUTOSAVE_DELAY_MS,
  });

  // 서버 임시글 자동 저장: 입력이 5초 멈추면 저장하고, 저장 중에 바뀐 내용은 끝난 직후 이어서 저장한다
  const draftSnapshot: DraftSnapshot = { title, content, tags, summary, thumbnailUrl, slug, seriesId: selectedSeriesId };

  const saveDraftToServer = useCallback(async (snap: DraftSnapshot, postId: string | null) => {
    const payload = buildDraftPayload(snap, loadedSeriesIdRef.current);
    if (postId) {
      await blogApi.updatePost(postId, payload);
      return { id: postId };
    }
    const created = await blogApi.createPost(payload);
    return { id: created.id };
  }, []);

  const handleDraftCreated = useCallback((newId: string) => {
    currentPostIdRef.current = newId;
    setCurrentPostId(newId);
  }, []);

  const autosave = useDraftAutosave({
    snapshot: draftSnapshot,
    postId: currentPostId,
    save: saveDraftToServer,
    onCreated: handleDraftCreated,
    paused: loadingPostContent || serverAutosaveBlocked,
    delayMs: SERVER_AUTOSAVE_DELAY_MS,
  });

  const autoSavedLabel = (() => {
    const at = autosave.error ? new Date() : autosave.lastSavedAt;
    if (!at) return null;
    const clock = formatDate(at, 'clock');
    return autosave.error ? `로컬 저장됨 (${clock})` : `DB 동기화 완료 (${clock})`;
  })();

  // 서버 저장이 성공하면 목록을 갱신한다
  useEffect(() => {
    if (autosave.lastSavedAt) {
      refreshServerDrafts();
    }
  }, [autosave.lastSavedAt, refreshServerDrafts]);

  const handleRestoreDraft = () => {
    const restored = localDraft.restore();
    if (!restored) return;
    if (restored.title) setTitle(restored.title);
    if (restored.content) setContent(restored.content);
    if (restored.tags) setTags(restored.tags);
    if (restored.summary) setSummary(restored.summary);
    if (restored.thumbnailUrl) setThumbnailUrl(restored.thumbnailUrl);
  };

  const handleSelectServerDraft = async (draft: PostSummary) => {
    setShowDraftsModal(false);
    setLoadingPostContent(true);
    try {
      // 목록에는 요약만 있으므로 전체 본문을 먼저 받은 뒤에 한 번에 반영한다
      const full = await blogApi.getPostById(draft.id);
      currentPostIdRef.current = draft.id;
      setCurrentPostId(draft.id);
      setLoadedPostStatus('DRAFT');
      setTitle(draft.title || '');
      setContent(full.content);
      setTags(draft.tags || []);
      setSummary(draft.summary || '');
      setThumbnailUrl(draft.thumbnailUrl || '');
      setSlug(draft.slug || '');
      setSelectedSeriesId(draft.seriesId || '');
      loadedSeriesIdRef.current = draft.seriesId || '';
      setStatus('PUBLISHED');
    } catch (err: unknown) {
      alert(getErrorMessage(err, '임시 저장 글을 불러오지 못했습니다.'));
    } finally {
      setLoadingPostContent(false);
    }
  };

  const handleDeleteServerDraft = async (draftId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('이 임시 저장 글을 삭제하시겠습니까?')) return;
    try {
      await blogApi.deletePost(draftId);
      removeServerDraft(draftId);
      if (currentPostIdRef.current === draftId) {
        currentPostIdRef.current = null;
        setCurrentPostId(null);
        setLoadedPostStatus(null);
      }
    } catch (err: unknown) {
      alert(getErrorMessage(err, '임시 저장 글 삭제에 실패했습니다.'));
    }
  };

  useEffect(() => {
    if (!isAuthenticated) {
      alert('로그인이 필요한 서비스입니다.');
      navigate('/');
    }
  }, [isAuthenticated, navigate]);

  const { series: seriesList, create: createSeries } = useSeriesList(user?.username, isAuthenticated);

  // 기존 글 수정: 글 id 가 바뀔 때만 불러온다 (프로필 갱신으로 편집 중인 내용이 덮어써지지 않게)
  useEffect(() => {
    if (!id || !isAuthenticated) return;
    let cancelled = false;
    setLoadingPostContent(true);
    currentPostIdRef.current = id;
    setCurrentPostId(id);
    blogApi
      .getPostById(id)
      .then((data) => {
        if (cancelled) return;
        setTitle(data.post.title);
        setContent(data.content);
        setTags(data.post.tags || []);
        setSummary(data.post.summary || '');
        setThumbnailUrl(data.post.thumbnailUrl || '');
        setSlug(data.post.slug);
        // 임시저장 글을 열었을 때 공개 범위의 기본값은 '공개'다(DRAFT 그대로 두면 출간해도 임시저장으로 저장된다)
        setStatus(data.post.status === 'DRAFT' ? 'PUBLISHED' : data.post.status);
        setLoadedPostStatus(data.post.status);
        loadedSeriesIdRef.current = data.post.seriesId || '';
        if (data.post.seriesId) setSelectedSeriesId(data.post.seriesId);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        console.error('Failed to load post for editing', err);
        alert(getErrorMessage(err, '게시글을 불러올 수 없습니다.'));
        navigate('/');
      })
      .finally(() => {
        if (!cancelled) setLoadingPostContent(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, isAuthenticated, navigate]);

  // 서식 삽입, 단축키, 되돌리기/다시 실행
  const {
    handleContentChange,
    handleEditorKeyDown,
    handleUndo,
    handleRedo,
    insertFormatting,
    insertHeading,
    insertCodeBlock,
  } = useMarkdownEditor({ content, setContent, textareaRef, resetKey: id });

  const handleOpenPublishModal = () => {
    if (!title.trim()) {
      alert('제목을 입력해주세요.');
      return;
    }
    if (!content.trim()) {
      alert('내용을 입력해주세요.');
      return;
    }

    const defaults = suggestPublishDefaults(title, content, { slug, summary, thumbnailUrl });
    setSlug(defaults.slug);
    setSummary(defaults.summary);
    setThumbnailUrl(defaults.thumbnailUrl);
    if (!thumbnailUrl) setThumbnailAutoDetected(defaults.thumbnailAutoDetected);

    setShowPublishModal(true);
  };

  // 본문 이미지(붙여넣기/드롭/버튼)와 출간 모달 썸네일 업로드
  const {
    uploadingEditorImage,
    uploadingThumbnail,
    handleEditorPaste,
    handleEditorDrop,
    handleEditorFileInputChange,
    handleThumbnailFileInputChange,
    handleThumbnailDrop,
  } = useImageUpload({ content, setContent, textareaRef, setThumbnailUrl, setThumbnailAutoDetected });

  const handleCreateSeries = async () => {
    if (!newSeriesTitle.trim()) return;
    try {
      const created = await createSeries(newSeriesTitle);
      setSelectedSeriesId(created.id);
      setNewSeriesTitle('');
      setShowNewSeriesInput(false);
    } catch (err: unknown) {
      alert(getErrorMessage(err, '시리즈 생성에 실패했습니다.'));
    }
  };

  const handleSaveDraft = async () => {
    // 이미 출간·비공개인 글은 임시저장(DRAFT)으로 되돌리지 않는다(자동 저장과 같은 규칙, 버튼도 막혀 있다)
    if (serverAutosaveBlocked) return;
    if (!title.trim() && !content.trim()) {
      alert('제목 또는 본문 내용을 입력해주세요.');
      return;
    }
    setSaving(true);
    // 자동 저장이 진행 중이면 끝나기를 기다려, 같은 글이 두 번 만들어지거나 서로 덮어쓰는 일을 막는다
    await autosave.suspend();
    try {
      const activeId = currentPostIdRef.current || id;
      const payload = buildDraftPayload(draftSnapshot, loadedSeriesIdRef.current);

      if (activeId) {
        await blogApi.updatePost(activeId, payload);
      } else {
        const created = await blogApi.createPost(payload);
        currentPostIdRef.current = created.id;
        setCurrentPostId(created.id);
      }
      alert('임시 저장되었습니다.');
      navigate('/me/posts?tab=draft');
    } catch (err: unknown) {
      autosave.resume();
      alert(getErrorMessage(err, '임시 저장에 실패했습니다.'));
    } finally {
      setSaving(false);
    }
  };

  const handleFinalPublish = async () => {
    if (!title.trim()) return;
    setSaving(true);
    // 뒤늦게 도착한 자동 저장(DRAFT)이 출간 상태를 되돌리지 않도록 먼저 멈추고 진행 중인 저장을 기다린다
    await autosave.suspend();

    try {
      const activeId = currentPostIdRef.current || id;
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
        removeFromSeries: loadedSeriesIdRef.current && !selectedSeriesId ? true : undefined,
      };

      if (activeId) {
        await blogApi.updatePost(activeId, payload);
      } else {
        await blogApi.createPost(payload);
      }

      trackEvent('post_publish', {
        title: title.trim(),
        tag_count: tags.length,
        has_series: Boolean(selectedSeriesId),
      });

      // Clear local draft upon successful publication
      localStorage.removeItem(draftKey);

      setShowPublishModal(false);
      navigate(`/@${user?.username}/${encodeURIComponent(finalSlug)}`);
    } catch (err: unknown) {
      autosave.resume();
      alert(getErrorMessage(err, '글 출간에 실패했습니다.'));
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
        accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
        onChange={handleEditorFileInputChange}
        className="hidden"
      />

      {/* Hidden File Input for Publish Modal Thumbnail */}
      <input
        type="file"
        ref={thumbnailFileInputRef}
        accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
        onChange={handleThumbnailFileInputChange}
        className="hidden"
      />

      {localDraft.hasNotice && <DraftRestoreBanner onRestore={handleRestoreDraft} onDiscard={localDraft.discard} />}

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

          <TagInput tags={tags} onChange={setTags} />

          <MarkdownToolbar
            insertHeading={insertHeading}
            insertFormatting={insertFormatting}
            insertCodeBlock={insertCodeBlock}
            onUndo={handleUndo}
            onRedo={handleRedo}
            onPickImage={() => editorFileInputRef.current?.click()}
            uploadingEditorImage={uploadingEditorImage}
          />

          {/* Markdown Content Textarea */}
          <textarea
            ref={textareaRef}
            placeholder="당신의 이야기를 적어보세요... (Markdown 문법 지원, 이미지를 직접 붙여넣거나 끌어다 놓을 수 있습니다)"
            value={content}
            onChange={handleContentChange}
            onKeyDown={handleEditorKeyDown}
            onPaste={handleEditorPaste}
            onDrop={handleEditorDrop}
            onDragOver={(e) => e.preventDefault()}
            className="flex-1 w-full resize-none text-slate-800 dark:text-slate-100 text-base leading-relaxed placeholder:text-slate-300 dark:placeholder:text-slate-600 focus:outline-none font-mono min-h-[300px] bg-transparent"
          />
        </div>

        <EditorPreview title={title} tags={tags} content={content} />
      </div>

      <EditorActionBar
        serverDraftCount={serverDrafts.length}
        autoSaving={autosave.saving}
        autoSavedLabel={autoSavedLabel}
        saving={saving}
        onExit={() => navigate(-1)}
        onOpenDrafts={() => setShowDraftsModal(true)}
        onSaveDraft={handleSaveDraft}
        canSaveDraft={!serverAutosaveBlocked}
        onOpenPublish={handleOpenPublishModal}
      />

      {showDraftsModal && (
        <ServerDraftsModal
          serverDrafts={serverDrafts}
          currentPostId={currentPostId}
          onSelect={handleSelectServerDraft}
          onDelete={handleDeleteServerDraft}
          onClose={() => setShowDraftsModal(false)}
        />
      )}

      {showPublishModal && (
        <PublishModal
          username={user?.username}
          summary={summary}
          setSummary={setSummary}
          thumbnailUrl={thumbnailUrl}
          setThumbnailUrl={setThumbnailUrl}
          slug={slug}
          setSlug={setSlug}
          status={status}
          setStatus={setStatus}
          selectedSeriesId={selectedSeriesId}
          setSelectedSeriesId={setSelectedSeriesId}
          seriesList={seriesList}
          newSeriesTitle={newSeriesTitle}
          setNewSeriesTitle={setNewSeriesTitle}
          showNewSeriesInput={showNewSeriesInput}
          setShowNewSeriesInput={setShowNewSeriesInput}
          showManualUrlInput={showManualUrlInput}
          setShowManualUrlInput={setShowManualUrlInput}
          thumbnailAutoDetected={thumbnailAutoDetected}
          setThumbnailAutoDetected={setThumbnailAutoDetected}
          uploadingThumbnail={uploadingThumbnail}
          thumbnailFileInputRef={thumbnailFileInputRef}
          handleThumbnailDrop={handleThumbnailDrop}
          saving={saving}
          onCreateSeries={handleCreateSeries}
          onPublish={handleFinalPublish}
          onClose={() => setShowPublishModal(false)}
        />
      )}
    </div>
  );
};
