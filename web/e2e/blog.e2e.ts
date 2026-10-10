import { expect, test, type Page } from '@playwright/test';
import { auditMobile, formatViolations, type AuditOptions } from './mobileAudit';
import { AUTHOR, mockApi } from './fixtures';

/** 화면이 자리 잡을 때까지 기다린 뒤 모바일 문제를 모두 모아 한 번에 보여 준다. */
async function expectMobileFriendly(page: Page, options: AuditOptions = {}) {
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.ready);
  const violations = await auditMobile(page, options);
  expect(violations, `모바일에서 깨지는 곳이 있습니다:\n${formatViolations(violations)}`).toEqual([]);
}

for (const loggedIn of [false, true]) {
  const who = loggedIn ? '로그인' : '비로그인';

  test.describe(`블로그: ${who}`, () => {
    test.beforeEach(async ({ page }) => mockApi(page, { loggedIn }));

    test('피드', async ({ page }) => {
      await page.goto('/');
      await expect(page.getByText('끊을 곳 없는 아주 긴 제목').first()).toBeVisible();
      await expectMobileFriendly(page);
    });

    test('글 상세(긴 제목·코드·표·댓글)', async ({ page }) => {
      await page.goto(`/@${AUTHOR.username}/post-1`);
      await expect(page.getByText('끊을 곳 없는 아주 긴 제목').first()).toBeVisible();
      await expect(page.getByText('답글입니다')).toBeVisible({ timeout: 10_000 });
      await expectMobileFriendly(page);
    });

    test('채널(프로필·글 목록)', async ({ page }) => {
      await page.goto(`/@${AUTHOR.username}`);
      await expect(page.getByText('끊을 곳 없는 아주 긴 제목').first()).toBeVisible();
      await expectMobileFriendly(page);
    });

    test('시리즈 상세', async ({ page }) => {
      await page.goto(`/@${AUTHOR.username}/series/series-1`);
      await expect(page.getByText(/시리즈의 2번째 글/).first()).toBeVisible();
      await expectMobileFriendly(page);
    });

    test('태그 검색', async ({ page }) => {
      await page.goto('/tags');
      await expect(page.getByText(/kotlin/).first()).toBeVisible();
      await expectMobileFriendly(page);
    });
  });
}

test.describe('블로그: 로그인 전용 화면', () => {
  test.beforeEach(async ({ page }) => mockApi(page, { loggedIn: true }));

  test('내 포스트 관리', async ({ page }) => {
    await page.goto('/me/posts?tab=draft');
    await expect(page.getByRole('heading', { name: '내 포스트 관리' })).toBeVisible();
    await expectMobileFriendly(page);
  });

  test('알림 드롭다운', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: '알림' }).click();
    await expect(page.getByText('모두 읽음')).toBeVisible();
    await expectMobileFriendly(page);
  });

  test('글쓰기', async ({ page }) => {
    await page.goto('/write');
    await expect(page.getByRole('button', { name: /발행|저장|출간/ }).first()).toBeVisible();
    await expectMobileFriendly(page);
  });

  test('개발자(API 키) 문서', async ({ page }) => {
    await page.goto('/developers');
    await expect(page.getByText('Headless API & Developer Platform')).toBeVisible();
    await expectMobileFriendly(page);
  });
});
