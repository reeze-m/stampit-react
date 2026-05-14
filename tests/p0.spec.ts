import { test, expect } from '@playwright/test';
import { clearStorage, seedShow, seedSchedule, getStorage, todayKST, addDaysKST } from './utils/helpers';

/**
 * P0 — 없으면 서비스가 동작하지 않는 핵심 TC
 * 전체 TC의 약 10%
 */

// ─────────────────────────────────────────────
// P0-01. 온보딩 진입
// ─────────────────────────────────────────────
test.describe('[P0-01] 온보딩', () => {
  test('P0-01-01 최초 진입 → 온보딩 노출', async ({ page }) => {
    await clearStorage(page);
    await page.goto('/');
    await expect(page.locator('[data-testid="onboarding"]')).toBeVisible();
  });

  test('P0-01-02 데이터 있음 → 온보딩 스킵 → 메인 진입', async ({ page }) => {
    await seedShow(page);
    await page.goto('/');
    await expect(page.locator('[data-testid="onboarding"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="main"]')).toBeVisible();
  });

  test('P0-01-03 빠른 시작 완료 → Show + StampBoard 생성', async ({ page }) => {
    await clearStorage(page);
    await page.goto('/');
    await page.locator('[data-testid="input-show-name"]').fill('테스트 공연');
    await page.locator('[data-testid="input-show-name"]').press('Enter');

    const shows = await getStorage<{ name: string }[]>(page, 'stampit:shows');
    expect(shows).not.toBeNull();
    expect(shows![0].name).toBe('테스트 공연');
  });
});

// ─────────────────────────────────────────────
// P0-02. 공연 생성
// ─────────────────────────────────────────────
test.describe('[P0-02] 공연 생성', () => {
  test('P0-02-01 공연명 미입력 → 저장 버튼 비활성화', async ({ page }) => {
    await clearStorage(page);
    await page.goto('/');
    await page.locator('[data-testid="btn-start"]').click();
    await page.locator('[data-testid="btn-add-show"]').click();
    await expect(page.locator('[data-testid="btn-save-show"]')).toBeDisabled();
  });

  test('P0-02-02 정상 입력 → Show LocalStorage 저장', async ({ page }) => {
    await clearStorage(page);
    await page.goto('/');
    await page.locator('[data-testid="btn-start"]').click();
    await page.locator('[data-testid="btn-add-show"]').click();
    await page.locator('[data-testid="input-show-name"]').fill('새 공연');
    await page.locator('[data-testid="btn-save-show"]').click();

    const shows = await getStorage<{ name: string }[]>(page, 'stampit:shows');
    expect(shows![0].name).toBe('새 공연');
  });

  test('P0-02-03 공연명 31자 입력 → 30자 초과 차단', async ({ page }) => {
    await seedShow(page);
    await page.goto('/');
    await page.locator('[data-testid="btn-add-show"]').click();
    const input = page.locator('[data-testid="input-show-name"]');
    await input.fill('가'.repeat(31));
    await expect(input).toHaveValue('가'.repeat(30));
  });
});

// ─────────────────────────────────────────────
// P0-03. 도장판 추가
// ─────────────────────────────────────────────
test.describe('[P0-03] 도장판 추가', () => {
  test('P0-03-01 기본 칸 수 7 확인', async ({ page }) => {
    await seedShow(page);
    await page.goto('/');
    await page.locator('[data-testid="btn-add-board"]').click();
    await expect(page.locator('[data-testid="input-capacity"]')).toHaveValue('7');
  });

  test('P0-03-02 기존 도장 수 > 칸 수 → 저장 차단', async ({ page }) => {
    await seedShow(page);
    await page.goto('/');
    await page.locator('[data-testid="btn-add-board"]').click();
    await page.locator('[data-testid="toggle-initial-stamps"]').click();
    await page.locator('[data-testid="input-initial-stamps"]').fill('11');
    await expect(page.locator('[data-testid="btn-save-board"]')).toBeDisabled();
  });

  test('P0-03-03 정상 생성 → StampBoard LocalStorage 저장', async ({ page }) => {
    await seedShow(page);
    await page.goto('/');
    await page.locator('[data-testid="btn-add-board"]').click();
    await page.locator('[data-testid="input-board-name"]').fill('2번 판');
    await page.locator('[data-testid="btn-save-board"]').click();

    const shows = await getStorage<{ stampBoards: { name: string }[] }[]>(page, 'stampit:shows');
    expect(shows![0].stampBoards.some((b) => b.name === '2번 판')).toBe(true);
  });
});

// ─────────────────────────────────────────────
// P0-04. 관람 일정 추가
// ─────────────────────────────────────────────
test.describe('[P0-04] 관람 일정 추가', () => {
  test('P0-04-01 일정 저장 → Schedule isConfirmed=false 생성', async ({ page }) => {
    await seedShow(page);
    await page.goto('/');
    await page.locator('[data-testid="tab-planner"]').click();
    await page.locator('[data-testid="fab-add"]').tap();
    await page.locator('[data-testid="when-future"]').click();
    await page.locator('[data-testid="input-schedule-date"]').fill(addDaysKST(1));
    await page.locator('[data-testid="select-grade"]').selectOption('grade-vip');
    await page.locator('[data-testid="select-discount"]').selectOption('disc-rebook');
    await page.locator('[data-testid="btn-save-schedule"]').click();

    const shows = await getStorage<{ schedules: { isConfirmed: boolean }[] }[]>(page, 'stampit:shows');
    expect(shows![0].schedules[0].isConfirmed).toBe(false);
  });

  test('P0-04-02 등급+권종 선택 → 정가/할인가/절약액 즉시 계산', async ({ page }) => {
    await seedShow(page);
    await page.goto('/');
    await page.locator('[data-testid="tab-planner"]').click();
    await page.locator('[data-testid="fab-add"]').tap();
    await page.locator('[data-testid="select-grade"]').selectOption('grade-vip');
    await page.locator('[data-testid="select-discount"]').selectOption('disc-rebook');
    // VIP 130,000 * 0.7 = 91,000
    await expect(page.locator('[data-testid="price-final"]')).toContainText('91,000');
    await expect(page.locator('[data-testid="price-saved"]')).toContainText('39,000');
  });

  test('P0-04-03 공연 기간 외 날짜 → 경고 노출', async ({ page }) => {
    await seedShow(page);
    await page.goto('/');
    await page.locator('[data-testid="tab-planner"]').click();
    await page.locator('[data-testid="fab-add"]').tap();
    await page.locator('[data-testid="input-schedule-date"]').fill('2040-01-01');
    await expect(page.locator('[data-testid="warn-out-of-period"]')).toBeVisible();
  });
});

// ─────────────────────────────────────────────
// P0-05. 일정 확정
// ─────────────────────────────────────────────
test.describe('[P0-05] 일정 확정', () => {
  test('P0-05-01 확정 → isConfirmed=true + 도장 배분 고정', async ({ page }) => {
    await seedShow(page);
    await seedSchedule(page, { date: todayKST() });
    await page.goto('/');
    await page.locator('[data-testid="tab-planner"]').click();
    await page.locator('[data-testid="schedule-card-sched-001"] [data-testid="btn-confirm"]').click();
    await page.locator('[data-testid="btn-confirm-submit"]').click();

    const shows = await getStorage<{ schedules: { isConfirmed: boolean }[] }[]>(page, 'stampit:shows');
    expect(shows![0].schedules[0].isConfirmed).toBe(true);
  });

  test('P0-05-02 isRebook 권종 → 체크리스트 재관람표 항목 노출', async ({ page }) => {
    await seedShow(page);
    await seedSchedule(page, { date: todayKST(), discountTypeId: 'disc-rebook' });
    await page.goto('/');
    await page.locator('[data-testid="tab-planner"]').click();
    await page.locator('[data-testid="schedule-card-sched-001"] [data-testid="btn-confirm"]').click();
    await expect(page.locator('[data-testid="checklist-rebook"]')).toBeVisible();
  });

  test('P0-05-03 체크리스트 미체크 → 확정 버튼 비활성화', async ({ page }) => {
    await seedShow(page);
    await seedSchedule(page, { date: todayKST(), discountTypeId: 'disc-rebook' });
    await page.goto('/');
    await page.locator('[data-testid="tab-planner"]').click();
    await page.locator('[data-testid="schedule-card-sched-001"] [data-testid="btn-confirm"]').click();
    await expect(page.locator('[data-testid="btn-confirm-submit"]')).toBeDisabled();
  });

  test('P0-05-04 확정 후 일정 카드 수정 불가', async ({ page }) => {
    await seedShow(page);
    await seedSchedule(page, { date: addDaysKST(-1), isConfirmed: true, status: 'confirmed' });
    await page.goto('/');
    await page.locator('[data-testid="tab-planner"]').click();
    await page.locator('[data-testid="schedule-card-sched-001"]').click();
    await expect(page.locator('[data-testid="menu-edit-schedule"]')).not.toBeVisible();
  });
});

// ─────────────────────────────────────────────
// P0-06. LocalStorage 즉시 저장 + 앱 재시작 복원
// ─────────────────────────────────────────────
test.describe('[P0-06] 데이터 영속성', () => {
  test('P0-06-01 공연 생성 → 앱 재시작 후 데이터 유지', async ({ page }) => {
    await seedShow(page);
    await page.goto('/');
    await page.reload();
    const shows = await getStorage<{ name: string }[]>(page, 'stampit:shows');
    expect(shows![0].name).toBe('테스트 공연');
  });

  test('P0-06-02 일정 추가 → 앱 재시작 후 일정 유지', async ({ page }) => {
    await seedShow(page);
    await seedSchedule(page);
    await page.goto('/');
    await page.reload();
    const shows = await getStorage<{ schedules: { id: string }[] }[]>(page, 'stampit:shows');
    expect(shows![0].schedules[0].id).toBe('sched-001');
  });
});

// ─────────────────────────────────────────────
// P0-07. 할인 금액 계산 정확성
// ─────────────────────────────────────────────
test.describe('[P0-07] 할인 계산', () => {
  test('P0-07-01 정률 할인 소수점 내림 (130,000 * 0.7 = 91,000)', async ({ page }) => {
    await seedShow(page);
    await page.goto('/');
    await page.locator('[data-testid="tab-planner"]').click();
    await page.locator('[data-testid="fab-add"]').tap();
    await page.locator('[data-testid="select-grade"]').selectOption('grade-vip');
    await page.locator('[data-testid="select-discount"]').selectOption('disc-rebook');
    await expect(page.locator('[data-testid="price-final"]')).toContainText('91,000');
  });

  test('P0-07-02 정률 할인 20% (130,000 * 0.8 = 104,000)', async ({ page }) => {
    await seedShow(page);
    await page.goto('/');
    await page.locator('[data-testid="tab-planner"]').click();
    await page.locator('[data-testid="fab-add"]').tap();
    await page.locator('[data-testid="select-grade"]').selectOption('grade-vip');
    await page.locator('[data-testid="select-discount"]').selectOption('disc-matinee');
    await expect(page.locator('[data-testid="price-final"]')).toContainText('104,000');
  });
});
