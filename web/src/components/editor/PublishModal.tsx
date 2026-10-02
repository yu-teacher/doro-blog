import React from 'react';
import { ModalShell } from '../ModalShell';
import type { Series, PostStatus } from '../../api/types';
import { BookOpen, Check, Globe, Link2, Loader2, Lock, RefreshCw, Sparkles, Trash2, Upload } from 'lucide-react';

interface PublishModalProps {
  /** 슬러그 미리보기(/@username/...)에 쓰는 작성자 이름. */
  username: string | undefined;
  summary: string;
  setSummary: (value: string) => void;
  thumbnailUrl: string;
  setThumbnailUrl: (value: string) => void;
  slug: string;
  setSlug: (value: string) => void;
  status: PostStatus;
  setStatus: (value: PostStatus) => void;
  selectedSeriesId: string;
  setSelectedSeriesId: (value: string) => void;
  seriesList: Series[];
  newSeriesTitle: string;
  setNewSeriesTitle: (value: string) => void;
  showNewSeriesInput: boolean;
  setShowNewSeriesInput: (value: boolean) => void;
  showManualUrlInput: boolean;
  setShowManualUrlInput: (value: boolean) => void;
  thumbnailAutoDetected: boolean;
  setThumbnailAutoDetected: (value: boolean) => void;
  uploadingThumbnail: boolean;
  thumbnailFileInputRef: React.RefObject<HTMLInputElement | null>;
  handleThumbnailDrop: (e: React.DragEvent<HTMLDivElement>) => void;
  saving: boolean;
  onCreateSeries: () => void;
  onPublish: () => void;
  onClose: () => void;
}

/** 출간 설정(요약, 썸네일, 시리즈, 공개 범위, 슬러그) 모달. */
export const PublishModal: React.FC<PublishModalProps> = ({
  username,
  summary, setSummary, thumbnailUrl, setThumbnailUrl, slug, setSlug, status, setStatus, selectedSeriesId, setSelectedSeriesId, seriesList, newSeriesTitle, setNewSeriesTitle, showNewSeriesInput, setShowNewSeriesInput, showManualUrlInput, setShowManualUrlInput, thumbnailAutoDetected, setThumbnailAutoDetected, uploadingThumbnail, thumbnailFileInputRef, handleThumbnailDrop, saving, onCreateSeries, onPublish, onClose,
}) => (
    <ModalShell onClose={onClose} labelledBy="publish-modal-title" overlayClassName="fixed inset-0 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 cursor-pointer" panelClassName="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden flex flex-col md:flex-row max-h-[90vh] text-slate-900 dark:text-slate-100 cursor-default">
        {/* Modal Left: Post Thumbnail & Summary Preview */}
        <div className="w-full md:w-1/2 p-8 bg-slate-50 dark:bg-slate-950/50 border-r border-slate-100 dark:border-slate-800 flex flex-col justify-between overflow-y-auto">
          <div>
            <h3 id="publish-modal-title" className="text-lg font-bold text-slate-900 dark:text-white mb-4">포스트 미리보기</h3>

            {/* Velog-style 1.91:1 (~16:9) Thumbnail Upload Box */}
            <div className="mb-5">
              <span className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                대표 썸네일
              </span>

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
                  <div className="absolute inset-0 bg-black/50 backdrop-blur-xs opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity flex items-center justify-center gap-3">
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
                  role="button"
                  tabIndex={0}
                  aria-label="썸네일 이미지 업로드"
                  onClick={() => thumbnailFileInputRef.current?.click()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      thumbnailFileInputRef.current?.click();
                    }
                  }}
                  onDrop={handleThumbnailDrop}
                  onDragOver={(e) => e.preventDefault()}
                  className="aspect-video bg-white dark:bg-slate-800/80 hover:bg-emerald-50/50 dark:hover:bg-slate-800 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-emerald-500 transition-all flex flex-col items-center justify-center cursor-pointer p-6 text-center group focus-visible:outline-2 focus-visible:outline-emerald-500"
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
                  aria-label="썸네일 이미지 URL"
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
                <label htmlFor="publish-summary">포스트 한 줄 소개</label>
                <span>{summary.length}/150</span>
              </div>
              <textarea
                id="publish-summary"
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
              <span id="publish-visibility-label" className="block text-sm font-bold text-slate-900 dark:text-white mb-2">공개 설정</span>
              <div role="group" aria-labelledby="publish-visibility-label" className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  aria-pressed={status === 'PUBLISHED'}
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
                  aria-pressed={status === 'PRIVATE'}
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
              <label htmlFor="publish-slug" className="block text-sm font-bold text-slate-900 dark:text-white mb-1">URL 슬러그</label>
              <div className="flex items-center text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700">
                <span className="font-mono">/@{username}/</span>
                <input
                  id="publish-slug"
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
                <label htmlFor="publish-series" className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
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
                    aria-label="새 시리즈 이름"
                    placeholder="새 시리즈 이름"
                    value={newSeriesTitle}
                    onChange={(e) => setNewSeriesTitle(e.target.value)}
                    className="flex-1 text-xs p-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={onCreateSeries}
                    className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-colors"
                  >
                    추가
                  </button>
                </div>
              )}

              <select
                id="publish-series"
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
              onClick={() => onClose()}
              className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
            >
              취소
            </button>
            <button
              type="button"
              onClick={onPublish}
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
      </ModalShell>
  
);
