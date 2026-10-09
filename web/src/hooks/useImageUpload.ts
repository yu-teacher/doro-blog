import { useState } from 'react';
import type { ChangeEvent, ClipboardEvent, Dispatch, DragEvent, RefObject, SetStateAction } from 'react';
import { blogApi } from '../api/blogApi';
import { getErrorMessage } from '../utils/errors';
import { altText, replacePlaceholder, uploadPlaceholder } from '../utils/uploadPlaceholder';
import { notify } from '../utils/notify';

const IMAGE_ONLY_MESSAGE = '이미지 파일(PNG, JPG, GIF, WebP, SVG)만 업로드할 수 있습니다.';
const POST_IMAGE_FOLDER = 'posts';
const THUMBNAIL_FOLDER = 'thumbnails';

interface Options {
  content: string;
  setContent: Dispatch<SetStateAction<string>>;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  setThumbnailUrl: (url: string) => void;
  setThumbnailAutoDetected: (value: boolean) => void;
}

export interface ImageUpload {
  uploadingEditorImage: boolean;
  uploadingThumbnail: boolean;
  handleEditorPaste: (e: ClipboardEvent<HTMLTextAreaElement>) => void;
  handleEditorDrop: (e: DragEvent<HTMLTextAreaElement>) => void;
  handleEditorFileInputChange: (e: ChangeEvent<HTMLInputElement>) => void;
  handleThumbnailFileInputChange: (e: ChangeEvent<HTMLInputElement>) => void;
  handleThumbnailDrop: (e: DragEvent<HTMLDivElement>) => void;
}

/**
 * 에디터 본문 이미지(붙여넣기/드롭/버튼)와 출간 모달 썸네일 업로드.
 * 본문 이미지는 업로드하는 동안 로컬 미리보기(blob)를 먼저 끼워 넣고, 끝나면 영구 URL 로 바꾼다.
 */
export function useImageUpload({ content, setContent, textareaRef, setThumbnailUrl, setThumbnailAutoDetected }: Options): ImageUpload {
  const [uploadingEditorImage, setUploadingEditorImage] = useState(false);
  const [uploadingThumbnail, setUploadingThumbnail] = useState(false);

  const uploadAndInsertImage = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      notify.info(IMAGE_ONLY_MESSAGE);
      return;
    }

    const blobUrl = URL.createObjectURL(file);
    const placeholder = uploadPlaceholder(file.name, blobUrl);
    const insertPos = textareaRef.current?.selectionStart ?? content.length;

    setContent(content.slice(0, insertPos) + placeholder + content.slice(insertPos));
    setUploadingEditorImage(true);

    try {
      const res = await blogApi.uploadImage(file, POST_IMAGE_FOLDER);
      setContent((prev) => replacePlaceholder(prev, placeholder, `![${altText(res.originalFilename)}](${res.url})\n`));
    } catch (err: unknown) {
      console.error('Failed to upload image:', err);
      notify.error(getErrorMessage(err, '이미지 업로드에 실패했습니다.'));
      setContent((prev) => replacePlaceholder(prev, placeholder, ''));
    } finally {
      URL.revokeObjectURL(blobUrl);
      setUploadingEditorImage(false);
    }
  };

  const handleEditorPaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        e.preventDefault();
        const file = items[i].getAsFile();
        if (file) void uploadAndInsertImage(file);
        break;
      }
    }
  };

  const handleEditorDrop = (e: DragEvent<HTMLTextAreaElement>) => {
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      e.preventDefault();
      void uploadAndInsertImage(file);
    }
  };

  const handleEditorFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      void uploadAndInsertImage(file);
      e.target.value = '';
    }
  };

  const uploadThumbnail = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      notify.info(IMAGE_ONLY_MESSAGE);
      return;
    }
    try {
      setUploadingThumbnail(true);
      const res = await blogApi.uploadImage(file, THUMBNAIL_FOLDER);
      setThumbnailUrl(res.url);
      setThumbnailAutoDetected(false);
    } catch (err: unknown) {
      console.error('Failed to upload thumbnail:', err);
      notify.error(getErrorMessage(err, '썸네일 업로드에 실패했습니다.'));
    } finally {
      setUploadingThumbnail(false);
    }
  };

  const handleThumbnailFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      void uploadThumbnail(file);
      e.target.value = '';
    }
  };

  const handleThumbnailDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      void uploadThumbnail(file);
    }
  };

  return {
    uploadingEditorImage,
    uploadingThumbnail,
    handleEditorPaste,
    handleEditorDrop,
    handleEditorFileInputChange,
    handleThumbnailFileInputChange,
    handleThumbnailDrop,
  };
}
