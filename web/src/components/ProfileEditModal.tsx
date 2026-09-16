import React, { useState, useEffect } from 'react';
import { blogApi } from '../api/blogApi';
import type { UserProfile, UpdateProfilePayload } from '../api/types';
import { useAuthStore } from '../store/authStore';
import {
  X,
  User,
  Mail,
  Globe,
  Loader2,
  Save,
  CheckCircle,
  FileText,
} from 'lucide-react';

interface ProfileEditModalProps {
  profile: UserProfile;
  isOpen: boolean;
  onClose: () => void;
  onUpdated: (updated: UserProfile) => void;
}

export const ProfileEditModal: React.FC<ProfileEditModalProps> = ({
  profile,
  isOpen,
  onClose,
  onUpdated,
}) => {
  const { setUser } = useAuthStore();
  const [formData, setFormData] = useState<UpdateProfilePayload>({
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
  });

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [activeSubTab, setActiveSubTab] = useState<'basic' | 'social' | 'about'>('basic');

  useEffect(() => {
    if (profile && isOpen) {
      setFormData({
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
      });
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
    } catch (err: any) {
      console.error('Failed to update profile', err);
      setErrorMsg(err.response?.data?.error?.message || '프로필 수정에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-xl w-full shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <h2 className="text-lg font-extrabold text-slate-900 dark:text-slate-100">
              프로필 설정 및 정보 고도화
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sub Navigation */}
        <div className="flex border-b border-slate-100 dark:border-slate-800 px-6 bg-slate-50/50 dark:bg-slate-950/40 text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveSubTab('basic')}
            className={`py-3 px-3 transition-colors border-b-2 ${
              activeSubTab === 'basic'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            기본 정보
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('social')}
            className={`py-3 px-3 transition-colors border-b-2 ${
              activeSubTab === 'social'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            소셜 & 링크
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('about')}
            className={`py-3 px-3 transition-colors border-b-2 ${
              activeSubTab === 'about'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            상세 소개 (About)
          </button>
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
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  닉네임
                </label>
                <input
                  type="text"
                  value={formData.nickname}
                  onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
                  required
                  placeholder="예: 김개발"
                  className="w-full px-3.5 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  블로그 타이틀
                </label>
                <input
                  type="text"
                  value={formData.blogTitle}
                  onChange={(e) => setFormData({ ...formData, blogTitle: e.target.value })}
                  required
                  placeholder="예: 김개발.log"
                  className="w-full px-3.5 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  한 줄 소개 (Bio)
                </label>
                <input
                  type="text"
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  placeholder="예: 프론트엔드 최적화와 사용자 경험을 고민합니다."
                  maxLength={255}
                  className="w-full px-3.5 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-slate-100"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  채널 상단과 글 하단 작가 카드에 노출됩니다.
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  프로필 이미지 URL
                </label>
                <input
                  type="url"
                  value={formData.profileImageUrl}
                  onChange={(e) => setFormData({ ...formData, profileImageUrl: e.target.value })}
                  placeholder="https://..."
                  className="w-full px-3.5 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-slate-100"
                />
              </div>
            </div>
          )}

          {activeSubTab === 'social' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  공개 이메일 (방문자 연락용)
                </label>
                <div className="relative">
                  <input
                    type="email"
                    value={formData.publicEmail}
                    onChange={(e) => setFormData({ ...formData, publicEmail: e.target.value })}
                    placeholder="contact@mycompany.com"
                    className="w-full pl-9 pr-3.5 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-slate-100"
                  />
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  GitHub URL
                </label>
                <input
                  type="url"
                  value={formData.githubUrl}
                  onChange={(e) => setFormData({ ...formData, githubUrl: e.target.value })}
                  placeholder="https://github.com/username"
                  className="w-full px-3.5 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  개인 홈페이지 / 포트폴리오
                </label>
                <div className="relative">
                  <input
                    type="url"
                    value={formData.websiteUrl}
                    onChange={(e) => setFormData({ ...formData, websiteUrl: e.target.value })}
                    placeholder="https://portfolio.me"
                    className="w-full pl-9 pr-3.5 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-slate-100"
                  />
                  <Globe className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  LinkedIn URL
                </label>
                <input
                  type="url"
                  value={formData.linkedinUrl}
                  onChange={(e) => setFormData({ ...formData, linkedinUrl: e.target.value })}
                  placeholder="https://linkedin.com/in/username"
                  className="w-full px-3.5 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Twitter / X URL
                </label>
                <input
                  type="url"
                  value={formData.twitterUrl}
                  onChange={(e) => setFormData({ ...formData, twitterUrl: e.target.value })}
                  placeholder="https://x.com/username"
                  className="w-full px-3.5 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-slate-100"
                />
              </div>
            </div>
          )}

          {activeSubTab === 'about' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  상세 소개글 (Markdown 지원)
                </label>
                <span className="text-[11px] text-slate-400">
                  채널의 [소개] 탭에 멋지게 렌더링됩니다.
                </span>
              </div>
              <textarea
                rows={10}
                value={formData.aboutMarkdown}
                onChange={(e) => setFormData({ ...formData, aboutMarkdown: e.target.value })}
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
      </div>
    </div>
  );
};
