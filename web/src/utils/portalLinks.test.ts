import { describe, expect, it } from 'vitest';
import { DEV_ACCOUNT_PATH, DEV_HOME_PATH, DEV_LOGS_PATH } from './portalLinks';

describe('portalLinks', () => {
  it('Doro Dev 포털 경로는 /dev/ 아래의 같은 오리진 경로다', () => {
    expect(DEV_HOME_PATH).toBe('/dev/');
    expect(DEV_ACCOUNT_PATH).toBe('/dev/account');
    expect(DEV_LOGS_PATH).toBe('/dev/logs');
    for (const path of [DEV_HOME_PATH, DEV_ACCOUNT_PATH, DEV_LOGS_PATH]) {
      expect(path).toMatch(/^\/dev\/(?!\/)/);
    }
  });
});
