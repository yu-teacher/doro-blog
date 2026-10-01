import { postsApi } from './modules/posts';
import { commentsApi } from './modules/comments';
import { seriesApi } from './modules/series';
import { tagsApi } from './modules/tags';
import { usersApi } from './modules/users';
import { apiKeysApi } from './modules/apiKeys';
import { uploadsApi } from './modules/uploads';
import { notificationsApi } from './modules/notifications';

/**
 * 블로그 백엔드 API 전체. 도메인별 모듈(modules/)을 하나로 합친 것이며, 화면 코드는 blogApi.메서드() 로 호출한다.
 * 메서드 이름은 모듈 사이에서 겹치지 않아야 한다 (겹치면 아래 테스트가 실패한다).
 */
export const blogApi = {
  ...postsApi,
  ...commentsApi,
  ...seriesApi,
  ...tagsApi,
  ...usersApi,
  ...apiKeysApi,
  ...uploadsApi,
  ...notificationsApi,
};
