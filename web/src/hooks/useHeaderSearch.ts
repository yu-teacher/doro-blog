import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { blogApi } from '../api/blogApi';
import type { TagItem } from '../api/types';
import { parseSearchInput, searchPath, suggestTags } from '../utils/search';
import { useAsyncResource } from './useAsyncResource';

export interface HeaderSearch {
  isOpen: boolean;
  toggle: () => void;
  query: string;
  setQuery: (value: string) => void;
  suggestions: TagItem[];
  submit: (e: FormEvent) => void;
  selectTag: (tagName: string) => void;
}

/** 헤더 검색창: 열고 닫기, 입력, "#태그"/본문 검색 이동, 인기 태그 기반 추천. 인기 태그는 처음 열 때 한 번만 불러온다. */
export function useHeaderSearch(): HeaderSearch {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [needTags, setNeedTags] = useState(false);

  const popularTags = useAsyncResource((signal) => blogApi.getPopularTags(signal), [], { enabled: needTags });
  const suggestions = suggestTags(popularTags.data ?? [], query);

  const close = () => {
    setIsOpen(false);
    setQuery('');
  };

  const toggle = () => {
    if (!isOpen) setNeedTags(true);
    setIsOpen(!isOpen);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const target = parseSearchInput(query);
    if (!target) return;
    navigate(searchPath(target));
    close();
  };

  const selectTag = (tagName: string) => {
    navigate(searchPath({ kind: 'tag', tag: tagName }));
    close();
  };

  return { isOpen, toggle, query, setQuery, suggestions, submit, selectTag };
}
