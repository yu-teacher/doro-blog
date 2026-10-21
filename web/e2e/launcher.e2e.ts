import { expect, test, type Page } from '@playwright/test';
import { auditMobile, formatViolations } from './mobileAudit';
import { mockApi } from './fixtures';

/** 허브가 제공하는 서비스 목록(/services.json)을 가짜로 대체한다. */
async function mockServices(page: Page, body: unknown, status = 200) {
  await page.route('**/services.json', (route) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) }),
  );
}

const manifest = {
  version: 1,
  services: [
    { id: 'blog', name: 'DORO.log', desc: '개발자 오픈 기술 블로그', href: '/blog/' },
    { id: 'party', name: '도로 파티', desc: '친구들과 지도에 핀 모으기', href: '/party/' },
    { id: 'games', name: '도로 게임 천국', desc: '웹 미니게임', href: '/games/' },
    { id: 'interview', name: '도로 면접', desc: '면접 질문 은행', href: '/interview/' },
  ],
};

const button = (page: Page) => page.getByRole('button', { name: 'DORO 서비스 바로가기 (앱 런처)' });

// 앱 런처는 모든 너비(폰 포함)에서 헤더에 하나 있다. 로그인·비로그인 둘 다 확인한다.
for (const loggedIn of [false, true]) {
const who = loggedIn ? '로그인' : '비로그인';
test.describe(`앱 런처: ${who}`, () => {
test.beforeEach(async ({ page }) => mockApi(page, { loggedIn }));

test('헤더에 그리드 버튼이 하나, 44px 이상이고 가로로 넘치지 않는다', async ({ page }) => {
  await mockServices(page, manifest);
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await expect(button(page)).toBeVisible();
  await expect(page.getByRole('button', { name: /DORO 서비스 바로가기/ })).toHaveCount(1);
  await expect(page.getByRole('link', { name: 'DORO 서비스 전체 보기' })).toHaveCount(0);
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
  test(`누르면 서비스 링크가 뜨고 현재 서비스가 표시되며 화면 안에 들어온다 (${theme})`, async ({ page }) => {
    await mockServices(page, manifest);
    await page.addInitScript((value) => localStorage.setItem('doro_blog_theme', value), theme);
    await page.goto('/');
    await expect(page.locator('html')).toHaveClass(theme === 'dark' ? /dark/ : /^(?!.*dark).*$/);
    await button(page).click();

    const popover = page.locator('header div.absolute.right-0').filter({ hasText: 'DORO 서비스' });
    await expect(popover.getByRole('link', { name: /Doro 홈/ })).toHaveAttribute('href', '/');
    await expect(popover.getByRole('link', { name: /도로 면접/ })).toHaveAttribute('href', '/interview/');
    await expect(popover.getByRole('link', { name: /통합 포털 홈/ })).toBeVisible();
    await expect(popover.locator('[aria-current="page"]')).toContainText('DORO.log');

    await page.waitForLoadState('networkidle');
    const box = await popover.boundingBox();
    const viewport = page.viewportSize();
    expect(box && viewport && box.x >= 0 && box.x + box.width <= viewport.width, '목록 창이 화면 밖으로 나갔다').toBe(true);
    // 창에 zoom-in 애니메이션(transform)이 걸려 boundingBox 가 줄어 보이므로 레이아웃 크기(offsetHeight)로 잰다.
    const tapHeight = await popover.getByRole('link', { name: /도로 면접/ }).evaluate((el) => (el as HTMLElement).offsetHeight);
    expect(tapHeight, '터치 영역이 44px 미만이다').toBeGreaterThanOrEqual(44);
    const violations = await auditMobile(page);
    expect(violations, `모바일에서 깨지는 곳이 있습니다:\n${formatViolations(violations)}`).toEqual([]);
  });
}

test('목록을 못 읽으면 기존 링크와 안내만 보인다', async ({ page }) => {
  await mockServices(page, { error: 'down' }, 500);
  await page.goto('/');
  await button(page).click();
  await expect(page.getByRole('link', { name: /Doro 홈/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /통합 포털 홈/ })).toBeVisible();
  await expect(page.getByText('불러오지 못했어요')).toBeVisible();
});

test('Esc 와 바깥 클릭으로 닫는다', async ({ page }) => {
  await mockServices(page, manifest);
  await page.goto('/');
  await button(page).click();
  await expect(page.getByRole('link', { name: /Doro 홈/ })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('link', { name: /Doro 홈/ })).toHaveCount(0);
  await button(page).click();
  await expect(page.getByRole('link', { name: /Doro 홈/ })).toBeVisible();
  // 바깥 클릭 막(Header 의 fixed inset-0)은 backdrop-blur 헤더 안에 갇혀 헤더 영역만 덮는다(기존 동작). 헤더의 빈 곳을 누른다.
  await page.mouse.click(5, 30);
  await expect(page.getByRole('link', { name: /Doro 홈/ })).toHaveCount(0);
});

});
}
