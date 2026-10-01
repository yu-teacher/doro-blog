import React from 'react';
import { avatarInitial } from './commentUtils';

interface CommentAvatarProps {
  nickname: string;
  profileImageUrl?: string | null;
  className: string;
}

/** 댓글 작성자 아바타: 프로필 이미지가 있으면 이미지, 없으면 닉네임 첫 글자. */
export const CommentAvatar: React.FC<CommentAvatarProps> = ({ nickname, profileImageUrl, className }) => (
  <div className={`${className} font-bold flex items-center justify-center overflow-hidden`}>
    {profileImageUrl ? <img src={profileImageUrl} alt={nickname} className="w-full h-full object-cover" /> : avatarInitial(nickname)}
  </div>
);
