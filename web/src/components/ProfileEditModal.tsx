import React, { useState, useEffect } from 'react';
import { ModalShell } from './ModalShell';
import { blogApi } from '../api/blogApi';
import type { UserProfile, UpdateProfilePayload } from '../api/types';
import { useAuthStore } from '../store/authStore';
import { X, User, Mail, Globe, Loader2, Save } from 'lucide-react';
import { TextField } from './profile/TextField';
import { PROFILE_LIMITS } from './profile/profileLimits';
import { getErrorMessage } from '../utils/errors';

interface ProfileEditModalProps {
  profile: UserProfile;
  isOpen: boolean;
  onClose: () => void;
  onUpdated: (updated: UserProfile) => void;
}

const TABS = [
  { id: 'basic', label: '기본 정보' },
  { id: 'social', label: '소셜 & 링크' },
  { id: 'about', label: '상세 소개 (About)' },
] as const;

type SubTab = (typeof TABS)[number]['id'];

const EMPTY_FORM: UpdateProfilePayload = {
  nickname: '',
  bio: '',
  profileImageUrl: '',
  blogTitle: '',
  publicEmail: '',
  githubUrl: '',
  twitterUrl: '',
  websiteUrl: '',
  linkedinUrl: '',
  aboutMarkdown: '',
};

/** 서버가 null 로 내려주는 선택 항목은 입력칸에서 빈 문자열로 다룬다. */
function formFromProfile(profile: UserProfile): UpdateProfilePayload {
  return {
    nickname: profile.nickname || '',
    bio: profile.bio || '',
    profileImageUrl: profile.profileImageUrl || '',
    blogTitle: profile.blogTitle || '',
    publicEmail: profile.publicEmail || '',
    githubUrl: profile.githubUrl || '',
    twitterUrl: profile.twitterUrl || '',
    websiteUrl: profile.websiteUrl || '',
    linkedinUrl: profile.linkedinUrl || '',
    aboutMarkdown: profile.aboutMarkdown || '',
  };
}

export const ProfileEditModal: React.FC<ProfileEditModalProps> = ({
  profile,
  isOpen,
  onClose,
  onUpdated,
}) => {
  const { setUser } = useAuthStore();
  const [formData, setFormData] = useState<UpdateProfilePayload>(EMPTY_FORM);
  const setField = (field: keyof UpdateProfilePayload) => (value: string) => setFormData((prev) => ({ ...prev, [field]: value }));

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('basic');

  useEffect(() => {
    if (profile && isOpen) {
      setFormData(formFromProfile(profile));
      setErrorMsg('');
    }
  }, [profile, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg('');

    try {
      const updated = await blogApi.updateMyProfile(formData);
      setUser(updated);
      onUpdated(updated);
      onClose();
    } catch (err: unknown) {
      console.error('Failed to update profile', err);
      setErrorMsg(getErrorMessage(err, '프로필 수정에 실패했습니다.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell onClose={onClose} labelledBy="profile-edit-title" overlayClassName="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 cursor-pointer" panelClassName="bg-white dark:bg-slate-900 rounded-2xl max-w-xl w-full shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 flex flex-col max-h-[90vh] cursor-default">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <h2 id="profile-edit-title" className="text-lg font-extrabold text-slate-900 dark:text-slate-100">
              프로필 설정 및 정보 고도화
            </h2>
          </div>
          <button
            type="button"
            aria-label="닫기"
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sub Navigation */}
        <div className="flex border-b border-slate-100 dark:border-slate-800 px-6 bg-slate-50/50 dark:bg-slate-950/40 text-xs font-bold">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveSubTab(tab.id)}
              className={`py-3 px-3 transition-colors border-b-2 ${
                activeSubTab === tab.id
                  ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-400 text-xs rounded-xl font-medium">
              {errorMsg}
            </div>
          )}

          {activeSubTab === 'basic' && (
            <div className="space-y-4">
              <TextField label="닉네임" value={formData.nickname ?? ''} onChange={setField('nickname')} required placeholder="예: 김개발" maxLength={PROFILE_LIMITS.nickname} />
              <TextField label="블로그 타이틀" value={formData.blogTitle ?? ''} onChange={setField('blogTitle')} required placeholder="예: 김개발.log" maxLength={PROFILE_LIMITS.blogTitle} />
              <TextField
                label="한 줄 소개 (Bio)"
                value={formData.bio ?? ''}
                onChange={setField('bio')}
                placeholder="예: 프론트엔드 최적화와 사용자 경험을 고민합니다."
                maxLength={PROFILE_LIMITS.bio}
                hint="채널 상단과 글 하단 작가 카드에 노출됩니다."
              />
              <TextField label="프로필 이미지 URL" type="url" value={formData.profileImageUrl ?? ''} onChange={setField('profileImageUrl')} placeholder="https://..." maxLength={PROFILE_LIMITS.profileImageUrl} />
            </div>
          )}

          {activeSubTab === 'social' && (
            <div className="space-y-4">
              <TextField label="공개 이메일 (방문자 연락용)" type="email" value={formData.publicEmail ?? ''} onChange={setField('publicEmail')} placeholder="contact@mycompany.com" maxLength={PROFILE_LIMITS.publicEmail} icon={<Mail className="w-4 h-4" />} />
              <TextField label="GitHub URL" type="url" value={formData.githubUrl ?? ''} onChange={setField('githubUrl')} placeholder="https://github.com/username" maxLength={PROFILE_LIMITS.githubUrl} />
              <TextField label="개인 홈페이지 / 포트폴리오" type="url" value={formData.websiteUrl ?? ''} onChange={setField('websiteUrl')} placeholder="https://portfolio.me" maxLength={PROFILE_LIMITS.websiteUrl} icon={<Globe className="w-4 h-4" />} />
              <TextField label="LinkedIn URL" type="url" value={formData.linkedinUrl ?? ''} onChange={setField('linkedinUrl')} placeholder="https://linkedin.com/in/username" maxLength={PROFILE_LIMITS.linkedinUrl} />
              <TextField label="Twitter / X URL" type="url" value={formData.twitterUrl ?? ''} onChange={setField('twitterUrl')} placeholder="https://x.com/username" maxLength={PROFILE_LIMITS.twitterUrl} />
            </div>
          )}

          {activeSubTab === 'about' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="profile-about" className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  상세 소개글 (Markdown 지원)
                </label>
                <span className="text-[11px] text-slate-400">
                  채널의 [소개] 탭에 멋지게 렌더링됩니다.
                </span>
              </div>
              <textarea
                id="profile-about"
                rows={10}
                value={formData.aboutMarkdown ?? ''}
                onChange={(e) => setField('aboutMarkdown')(e.target.value)}
                placeholder={`# 안녕하세요! 🚀\n\n저는 백엔드 시스템 설계와 분산 인가 아키텍처에 관심이 많은 엔지니어입니다.\n\n## 기술 스택\n- Java, Spring Boot, Zanzibar ReBAC\n- React, TypeScript, TailwindCSS\n- Docker, Kubernetes, PostgreSQL`}
                className="w-full p-3.5 text-sm font-mono bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-slate-100 resize-none leading-relaxed"
              />
            </div>
          )}

          {/* Footer Action */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-sm transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>{saving ? '저장 중...' : '프로필 저장'}</span>
            </button>
          </div>
        </form>
      </ModalShell>
  );
};
