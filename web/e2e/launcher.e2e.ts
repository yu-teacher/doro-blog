import { expect, test, type Page } from '@playwright/test';
import { auditMobile, formatViolations } from './mobileAudit';
import { mockApi } from './fixtures';

const button = (page: Page) => page.getByRole('button', { name: 'Doro Dev 바로가기 (앱 런처)' });

// 앱 런처는 모든 너비(폰 포함)에서 헤더에 하나 있다. 로그인·비로그인 둘 다 확인한다.
for (const loggedIn of [false, true]) {
const who = loggedIn ? '로그인' : '비로그인';
test.describe(`앱 런처: ${who}`, () => {
test.beforeEach(async ({ page }) => mockApi(page, { loggedIn }));

test('헤더에 그리드 버튼이 하나, 44px 이상이고 가로로 넘치지 않는다', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await expect(button(page)).toBeVisible();
  await expect(page.getByRole('button', { name: /Doro Dev 바로가기/ })).toHaveCount(1);
  const box = await button(page).boundingBox();
  // 44px 터치 영역은 폰 세로(<640px)에서만 요구한다. 넓은 화면은 기존 36px 아이콘 버튼이다.
  const min = (page.viewportSize()?.width ?? 0) < 640 ? 44 : 32;
  expect(box && box.width >= min && box.height >= min, `버튼이 ${min}px 미만이다: ${JSON.stringify(box)}`).toBe(true);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - (window.visualViewport?.width ?? window.innerWidth));
  expect(overflow, '헤더 때문에 가로 스크롤이 생겼다').toBeLessThanOrEqual(0);
  const violations = await auditMobile(page);
  expect(violations, `모바일에서 깨지는 곳이 있습니다:\n${formatViolations(violations)}`).toEqual([]);
});

for (const theme of ['dark', 'light'] as const) {
  test(`누르면 Doro Dev 링크가 뜨고 화면 안에 들어온다 (${theme})`, async ({ page }) => {
      await page.addInitScript((value) => localStorage.setItem('doro_blog_theme', value), theme);
    await page.goto('/');
    await expect(page.locator('html')).toHaveClass(theme === 'dark' ? /dark/ : /^(?!.*dark).*$/);
    await button(page).click();

    const popover = page.locator('header div.absolute.right-0').filter({ hasText: '개발자 서비스 한눈에' });
    await expect(popover.getByRole('link', { name: /Doro Dev 홈/ })).toHaveAttribute('href', '/dev/');
    await expect(popover.getByRole('link', { name: /Doro 계정/ })).toHaveAttribute('href', '/dev/account');
    await expect(popover.getByText(/파티|게임|통합|허브/)).toHaveCount(0);

    await page.waitForLoadState('networkidle');
    const box = await popover.boundingBox();
    const viewport = page.viewportSize();
    expect(box && viewport && box.x >= 0 && box.x + box.width <= viewport.width, '목록 창이 화면 밖으로 나갔다').toBe(true);
    // 창에 zoom-in 애니메이션(transform)이 걸려 boundingBox 가 줄어 보이므로 레이아웃 크기(offsetHeight)로 잰다.
    const tapHeight = await popover.getByRole('link', { name: /Doro Dev 홈/ }).evaluate((el) => (el as HTMLElement).offsetHeight);
    expect(tapHeight, '터치 영역이 44px 미만이다').toBeGreaterThanOrEqual(44);
    const violations = await auditMobile(page);
    expect(violations, `모바일에서 깨지는 곳이 있습니다:\n${formatViolations(violations)}`).toEqual([]);
  });
}

test('Esc 와 바깥 클릭으로 닫는다', async ({ page }) => {
  await page.goto('/');
  await button(page).click();
  await expect(page.getByRole('link', { name: /Doro Dev 홈/ })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('link', { name: /Doro Dev 홈/ })).toHaveCount(0);
  await button(page).click();
  await expect(page.getByRole('link', { name: /Doro Dev 홈/ })).toBeVisible();
  // 바깥 클릭 막(Header 의 fixed inset-0)은 backdrop-blur 헤더 안에 갇혀 헤더 영역만 덮는다(기존 동작). 헤더의 빈 곳을 누른다.
  await page.mouse.click(5, 30);
  await expect(page.getByRole('link', { name: /Doro Dev 홈/ })).toHaveCount(0);
});

});
}

// 관리자에게만 일반 서비스 허브(/)로 돌아가는 타일이 보인다.
test.describe('앱 런처: 관리자', () => {
  for (const role of ['ADMIN', 'SUPER_ADMIN']) {
    test(`${role} 에게는 Doro 허브 타일(href=/)이 보인다`, async ({ page }) => {
      await mockApi(page, { loggedIn: true, role });
      await page.goto('/');
      await button(page).click();
      const popover = page.locator('header div.absolute.right-0').filter({ hasText: '개발자 서비스 한눈에' });
      await expect(popover.getByRole('link', { name: /Doro 허브/ })).toHaveAttribute('href', '/');
      await expect(popover.getByRole('link', { name: /Doro Dev 홈/ })).toHaveAttribute('href', '/dev/');
    });
  }
});
