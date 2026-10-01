import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { blogApi } from '../api/blogApi';
import { useAuthStore } from '../store/authStore';
import type { Series, PostStatus, PostSummary } from '../api/types';
import { MarkdownViewer } from '../components/MarkdownViewer';
import { stripMarkdown } from '../utils/markdown';
import { trackEvent } from '../utils/analytics';
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
  FileText,
  X,
  Bold,
  Italic,
  Strikethrough,
  Quote,
  Code,
  Minus,
  Undo2,
  Redo2,
} from 'lucide-react';
import { getErrorMessage } from '../utils/errors';
import { generateSlug } from '../utils/slug';
import { useDraftAutosave, type DraftSnapshot } from '../hooks/useDraftAutosave';

const LOCAL_AUTOSAVE_DELAY_MS = 2_000;
const SERVER_AUTOSAVE_DELAY_MS = 5_000;
const DRAFT_SUMMARY_LENGTH = 120;

/** 임시 저장(DRAFT) 요청 본문. 자동 저장과 수동 임시저장이 같은 규칙을 쓰도록 한 곳에서 만든다. */
function buildDraftPayload(snap: DraftSnapshot) {
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
  };
}

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
  const [hasDraftNotice, setHasDraftNotice] = useState(false);
  const [currentPostId, setCurrentPostId] = useState<string | null>(id || null);
  const currentPostIdRef = useRef<string | null>(id || null);
  const [serverDrafts, setServerDrafts] = useState<PostSummary[]>([]);
  const [showDraftsModal, setShowDraftsModal] = useState(false);
  // 서버에서 글 본문을 불러오는 동안은 자동 저장을 멈춘다 (불완전한 내용으로 서버 글을 덮어쓰지 않도록)
  const [loadingPostContent, setLoadingPostContent] = useState(false);

  const draftKey = `doro_editor_draft_${user?.username || 'guest'}`;

  // Keep currentPostIdRef in sync
  useEffect(() => {
    currentPostIdRef.current = currentPostId;
  }, [currentPostId]);

  // Fetch user's server drafts from DB
  const loadServerDrafts = async () => {
    try {
      const res = await blogApi.getMyPosts('DRAFT', 0, 10);
      setServerDrafts(res.content || []);
    } catch (err) {
      console.error('Failed to load server drafts', err);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadServerDrafts();
    }
  }, [isAuthenticated]);

  // Check for existing local draft when starting a new post
  useEffect(() => {
    if (!id && !currentPostIdRef.current) {
      try {
        const saved = localStorage.getItem(draftKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.title?.trim() || parsed.content?.trim()) {
            setHasDraftNotice(true);
          }
        }
      } catch (e) {
        console.error('Failed to check local draft', e);
      }
    }
  }, [id, draftKey]);

  // 로컬 백업: 입력이 2초 멈추면 localStorage 에 저장한다
  useEffect(() => {
    if (!title.trim() && !content.trim()) return;

    const localTimer = setTimeout(() => {
      try {
        localStorage.setItem(
          draftKey,
          JSON.stringify({ title, content, tags, summary, thumbnailUrl, savedAt: new Date().toISOString() })
        );
      } catch (err) {
        console.error('Local auto-save error', err);
      }
    }, LOCAL_AUTOSAVE_DELAY_MS);

    return () => clearTimeout(localTimer);
  }, [title, content, tags, summary, thumbnailUrl, draftKey]);

  // 서버 임시글 자동 저장: 입력이 5초 멈추면 저장하고, 저장 중에 바뀐 내용은 끝난 직후 이어서 저장한다
  const draftSnapshot: DraftSnapshot = { title, content, tags, summary, thumbnailUrl, slug, seriesId: selectedSeriesId };

  const saveDraftToServer = useCallback(async (snap: DraftSnapshot, postId: string | null) => {
    const payload = buildDraftPayload(snap);
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
    paused: loadingPostContent,
    delayMs: SERVER_AUTOSAVE_DELAY_MS,
  });

  const autoSavedLabel = (() => {
    const at = autosave.error ? new Date() : autosave.lastSavedAt;
    if (!at) return null;
    const clock = at.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    return autosave.error ? `로컬 저장됨 (${clock})` : `DB 동기화 완료 (${clock})`;
  })();

  // 서버 저장이 성공하면 목록을 갱신한다
  useEffect(() => {
    if (autosave.lastSavedAt) {
      loadServerDrafts();
    }
  }, [autosave.lastSavedAt]);

  const handleRestoreDraft = () => {
    try {
      const saved = localStorage.getItem(draftKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.title) setTitle(parsed.title);
        if (parsed.content) setContent(parsed.content);
        if (parsed.tags) setTags(parsed.tags);
        if (parsed.summary) setSummary(parsed.summary);
        if (parsed.thumbnailUrl) setThumbnailUrl(parsed.thumbnailUrl);
      }
    } catch (e) {
      console.error('Failed to restore draft', e);
    } finally {
      setHasDraftNotice(false);
    }
  };

  const handleDiscardDraft = () => {
    localStorage.removeItem(draftKey);
    setHasDraftNotice(false);
  };

  const handleSelectServerDraft = async (draft: PostSummary) => {
    setShowDraftsModal(false);
    setLoadingPostContent(true);
    try {
      // 목록에는 요약만 있으므로 전체 본문을 먼저 받은 뒤에 한 번에 반영한다
      const full = await blogApi.getPostById(draft.id);
      currentPostIdRef.current = draft.id;
      setCurrentPostId(draft.id);
      setTitle(draft.title || '');
      setContent(full.content);
      setTags(draft.tags || []);
      setSummary(draft.summary || '');
      setThumbnailUrl(draft.thumbnailUrl || '');
      setSlug(draft.slug || '');
      setSelectedSeriesId(draft.seriesId || '');
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
      setServerDrafts((prev) => prev.filter((d) => d.id !== draftId));
      if (currentPostIdRef.current === draftId) {
        currentPostIdRef.current = null;
        setCurrentPostId(null);
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

  // 내 시리즈 목록 (프로필 객체가 갱신될 때마다가 아니라 사용자명이 바뀔 때만 다시 불러온다)
  const username = user?.username;
  useEffect(() => {
    if (!isAuthenticated || !username) return;
    let cancelled = false;
    blogApi
      .getUserSeries(username)
      .then((res) => {
        if (!cancelled) setSeriesList(res || []);
      })
      .catch((err: unknown) => {
        if (!cancelled) console.error('Failed to load series', err);
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, username]);

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
        setStatus(data.post.status);
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

  const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Prevent duplicate firing during Korean IME composition
    if (e.nativeEvent.isComposing) {
      return;
    }

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

  // Undo / Redo History Stack
  const historyRef = useRef<{ content: string; cursor: number }[]>([]);
  const historyIndexRef = useRef<number>(-1);
  const isUndoRedoActionRef = useRef<boolean>(false);
  const typingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize history when content is first loaded
  useEffect(() => {
    if (historyRef.current.length === 0 && (content || !id)) {
      historyRef.current = [{ content, cursor: 0 }];
      historyIndexRef.current = 0;
    }
  }, [content, id]);

  const pushHistory = useCallback((newContent: string, cursor: number) => {
    if (isUndoRedoActionRef.current) return;
    const history = historyRef.current.slice(0, historyIndexRef.current + 1);
    if (history.length > 0 && history[history.length - 1].content === newContent) {
      return;
    }
    history.push({ content: newContent, cursor });
    if (history.length > 80) history.shift();
    historyRef.current = history;
    historyIndexRef.current = history.length - 1;
  }, []);

  const handleUndo = useCallback(() => {
    if (historyIndexRef.current > 0) {
      historyIndexRef.current -= 1;
      const prev = historyRef.current[historyIndexRef.current];
      isUndoRedoActionRef.current = true;
      setContent(prev.content);
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(prev.cursor, prev.cursor);
        }
        isUndoRedoActionRef.current = false;
      }, 0);
    }
  }, []);

  const handleRedo = useCallback(() => {
    if (historyIndexRef.current < historyRef.current.length - 1) {
      historyIndexRef.current += 1;
      const next = historyRef.current[historyIndexRef.current];
      isUndoRedoActionRef.current = true;
      setContent(next.content);
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(next.cursor, next.cursor);
        }
        isUndoRedoActionRef.current = false;
      }, 0);
    }
  }, []);

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    const cursor = e.target.selectionStart;
    setContent(val);

    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      pushHistory(val, cursor);
    }, 400);
  };

  const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const isCmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

    // 1. Undo: Cmd+Z (or Ctrl+Z)
    if (isCmdOrCtrl && !e.shiftKey && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      handleUndo();
      return;
    }

    // 2. Redo: Cmd+Shift+Z or Ctrl+Y
    if ((isCmdOrCtrl && e.shiftKey && e.key.toLowerCase() === 'z') || (!isMac && isCmdOrCtrl && e.key.toLowerCase() === 'y')) {
      e.preventDefault();
      handleRedo();
      return;
    }

    // 3. Shortcuts: Cmd+B (Bold)
    if (isCmdOrCtrl && e.key.toLowerCase() === 'b') {
      e.preventDefault();
      insertFormatting('**', '**', '굵은 텍스트');
      return;
    }

    // 4. Shortcuts: Cmd+I (Italic)
    if (isCmdOrCtrl && e.key.toLowerCase() === 'i') {
      e.preventDefault();
      insertFormatting('*', '*', '기울임 텍스트');
      return;
    }

    // 5. Tab key: Indent 2 spaces
    if (e.key === 'Tab') {
      e.preventDefault();
      insertFormatting('  ', '', '');
      return;
    }
  };

  // Helper to insert markdown formatting at cursor position or wrap selection
  const insertFormatting = (prefix: string, suffix: string = '', defaultText: string = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    pushHistory(content, textarea.selectionStart);

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentText = textarea.value;
    const selectedText = currentText.substring(start, end);

    const replacement = selectedText ? `${prefix}${selectedText}${suffix}` : `${prefix}${defaultText}${suffix}`;
    const newContent = currentText.substring(0, start) + replacement + currentText.substring(end);

    setContent(newContent);
    const cursorPosition = selectedText
      ? start + prefix.length + selectedText.length
      : start + prefix.length + defaultText.length;

    pushHistory(newContent, cursorPosition);

    setTimeout(() => {
      textarea.focus();
      if (selectedText) {
        textarea.setSelectionRange(start + prefix.length, start + prefix.length + selectedText.length);
      } else {
        textarea.setSelectionRange(cursorPosition, cursorPosition);
      }
    }, 0);
  };

  const insertHeading = (level: number) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    pushHistory(content, textarea.selectionStart);

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentText = textarea.value;
    const hashes = '#'.repeat(level) + ' ';

    // Find the start of the current line
    const lineStart = currentText.lastIndexOf('\n', start - 1) + 1;
    const lineEnd = currentText.indexOf('\n', end);
    const actualLineEnd = lineEnd === -1 ? currentText.length : lineEnd;
    const currentLine = currentText.substring(lineStart, actualLineEnd);

    // If current line already has a heading prefix, replace it
    const cleanLine = currentLine.replace(/^#{1,6}\s*/, '');
    const newLine = `${hashes}${cleanLine}`;

    const newContent = currentText.substring(0, lineStart) + newLine + currentText.substring(actualLineEnd);
    setContent(newContent);
    const newCursorPos = lineStart + hashes.length + cleanLine.length;
    pushHistory(newContent, newCursorPos);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  const insertCodeBlock = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = textarea.value.substring(start, end);
    if (selected.includes('\n') || !selected) {
      insertFormatting('```javascript\n', '\n```\n', selected || '// 코드를 입력하세요');
    } else {
      insertFormatting('`', '`', selected);
    }
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
      // Auto-extract first 120 chars of clean plain text as summary
      const plain = stripMarkdown(content).slice(0, 120);
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
    } catch (err: unknown) {
      alert(getErrorMessage(err, '시리즈 생성에 실패했습니다.'));
    }
  };

  const handleSaveDraft = async () => {
    if (!title.trim() && !content.trim()) {
      alert('제목 또는 본문 내용을 입력해주세요.');
      return;
    }
    setSaving(true);
    // 자동 저장이 진행 중이면 끝나기를 기다려, 같은 글이 두 번 만들어지거나 서로 덮어쓰는 일을 막는다
    await autosave.suspend();
    try {
      const activeId = currentPostIdRef.current || id;
      const payload = buildDraftPayload(draftSnapshot);

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
      navigate(`/@${user?.username}/${finalSlug}`);
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

      {/* Draft Restore Notification Banner */}
      {hasDraftNotice && (
        <div className="bg-emerald-50 dark:bg-emerald-950/80 border-b border-emerald-200 dark:border-emerald-800 px-6 py-3 flex items-center justify-between text-xs animate-in slide-in-from-top-2">
          <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300">
            <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>이전에 작성 중이던 <strong>임시 저장본</strong>이 있습니다. 이어서 작성하시겠습니까?</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRestoreDraft}
              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-xs transition-colors"
            >
              불러오기
            </button>
            <button
              type="button"
              onClick={handleDiscardDraft}
              className="px-2.5 py-1 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            >
              삭제
            </button>
          </div>
        </div>
      )}

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

          {/* Markdown Formatting Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-y-2 py-2 px-1 mb-2 border-b border-slate-100 dark:border-slate-800/80 select-none">
            <div className="flex items-center flex-wrap gap-0.5 sm:gap-1 text-slate-600 dark:text-slate-300">
              {/* Headings H1 ~ H4 */}
              <button
                type="button"
                onClick={() => insertHeading(1)}
                className="px-2 py-1 rounded-md text-xs font-black hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                title="대제목 (H1)"
              >
                H1
              </button>
              <button
                type="button"
                onClick={() => insertHeading(2)}
                className="px-2 py-1 rounded-md text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                title="중제목 (H2)"
              >
                H2
              </button>
              <button
                type="button"
                onClick={() => insertHeading(3)}
                className="px-2 py-1 rounded-md text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                title="소제목 (H3)"
              >
                H3
              </button>
              <button
                type="button"
                onClick={() => insertHeading(4)}
                className="px-2 py-1 rounded-md text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                title="세부제목 (H4)"
              >
                H4
              </button>

              <div className="h-4 w-[1px] bg-slate-200 dark:bg-slate-800 mx-1" />

              {/* Text Styles: Bold, Italic, Strikethrough */}
              <button
                type="button"
                onClick={() => insertFormatting('**', '**', '굵은 텍스트')}
                className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                title="굵게 (Bold)"
              >
                <Bold className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => insertFormatting('*', '*', '기울임 텍스트')}
                className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                title="기울임 (Italic)"
              >
                <Italic className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => insertFormatting('~~', '~~', '취소선 텍스트')}
                className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                title="취소선 (Strikethrough)"
              >
                <Strikethrough className="w-3.5 h-3.5" />
              </button>

              <div className="h-4 w-[1px] bg-slate-200 dark:bg-slate-800 mx-1" />

              {/* Blocks & Extras: Quote, Link, Code, Divider */}
              <button
                type="button"
                onClick={() => insertFormatting('> ', '', '인용구를 입력하세요')}
                className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                title="인용구 (Quote)"
              >
                <Quote className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => insertFormatting('[', '](https://)', '링크 텍스트')}
                className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                title="링크 삽입"
              >
                <Link2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={insertCodeBlock}
                className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                title="코드 블록"
              >
                <Code className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => insertFormatting('\n\n---\n\n', '', '')}
                className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                title="구분선"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>

              <div className="h-4 w-[1px] bg-slate-200 dark:bg-slate-800 mx-1" />

              {/* Image Upload Button */}
              <button
                type="button"
                onClick={() => editorFileInputRef.current?.click()}
                disabled={uploadingEditorImage}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors text-xs font-medium"
                title="이미지 파일 첨부"
              >
                {uploadingEditorImage ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-500" />
                ) : (
                  <ImageIcon className="w-3.5 h-3.5 text-emerald-500" />
                )}
                <span>이미지</span>
              </button>

              <div className="h-4 w-[1px] bg-slate-200 dark:bg-slate-800 mx-1" />

              {/* Undo / Redo Buttons */}
              <button
                type="button"
                onClick={handleUndo}
                className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                title="실행 취소 (Cmd+Z / Ctrl+Z)"
              >
                <Undo2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleRedo}
                className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                title="다시 실행 (Cmd+Shift+Z / Ctrl+Y)"
              >
                <Redo2 className="w-3.5 h-3.5" />
              </button>
            </div>

            {uploadingEditorImage && (
              <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium animate-pulse">
                <Loader2 className="w-3 h-3 animate-spin" /> MinIO 업로드 중...
              </span>
            )}
          </div>

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
          {serverDrafts.length > 0 && (
            <button
              type="button"
              onClick={() => setShowDraftsModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 rounded-xl border border-emerald-200 dark:border-emerald-800 transition-colors mr-1 shadow-2xs"
            >
              <FileText className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>임시 글 목록</span>
              <span className="px-1.5 py-0.2 rounded-full bg-emerald-600 text-white text-[10px] font-bold">
                {serverDrafts.length}
              </span>
            </button>
          )}

          {autosave.saving && (
            <span className="hidden sm:inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 mr-2 animate-pulse">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>DB 동기화 중...</span>
            </span>
          )}

          {!autosave.saving && autoSavedLabel && (
            <span className="hidden sm:inline-flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500 mr-2">
              <Check className="w-3.5 h-3.5 text-emerald-500" />
              <span>{autoSavedLabel}</span>
            </span>
          )}

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

      {/* Server Drafts Selection Modal */}
      {showDraftsModal && (
        <div
          onClick={() => setShowDraftsModal(false)}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden text-slate-900 dark:text-slate-100 cursor-default p-6"
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4 mb-4">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-500" />
                <h3 className="text-lg font-bold">서버 DB 임시 글 목록 ({serverDrafts.length})</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowDraftsModal(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              클릭하면 해당 임시 글을 에디터로 불러옵니다. (현재 작성 중인 내용은 변경됩니다)
            </p>

            <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
              {serverDrafts.length === 0 ? (
                <div className="text-center py-8 text-sm text-slate-400 dark:text-slate-500">
                  저장된 임시 글이 없습니다.
                </div>
              ) : (
                serverDrafts.map((d) => (
                  <div
                    key={d.id}
                    onClick={() => handleSelectServerDraft(d)}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between gap-2 group ${
                      currentPostId === d.id
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500/50'
                        : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200/60 dark:border-slate-700/60 hover:border-emerald-400 dark:hover:border-emerald-600'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100 line-clamp-1 flex-1">
                        {d.title || '제목 없는 임시 글'}
                      </h4>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {currentPostId === d.id && (
                          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/60 px-2 py-0.5 rounded-full">
                            현재 작성 중
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={(e) => handleDeleteServerDraft(d.id, e)}
                          className="p-1 text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                          title="임시 글 삭제"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500">
                      <span>
                        {new Date(d.createdAt).toLocaleDateString('ko-KR', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      {d.tags && d.tags.length > 0 && (
                        <span className="text-emerald-600 dark:text-emerald-400 truncate max-w-[200px]">
                          {d.tags.map((t: string) => `#${t}`).join(' ')}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

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
