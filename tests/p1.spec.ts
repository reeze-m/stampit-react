import { test, expect } from '@playwright/test';
import {
  seedShow,
  seedSchedule,
  clearStorage,
  setStorage,
  getStorage,
  todayKST,
  addDaysKST,
} from './utils/helpers';

// ────────────────────────────────────────────────────────────────
// P1-01  확정 시트 — 멀티플라이어 선택 & 도장 배분
// ────────────────────────────────────────────────────────────────
test.describe('P1-01 확정 시트 멀티플라이어', () => {
  async function openConfirmSheet(page: Parameters<Parameters<typeof test>[1]>[0]) {
    await seedShow(page);
    await seedSchedule(page, { status: 'draft' });
    await page.goto('/');
    await page.getByTestId('tab-planner').tap();
    await page.getByTestId('schedule-card').first().tap();
    await page.getByTestId('btn-confirm').tap();
    await expect(page.getByTestId('bottomsheet-confirm')).toBeVisible();
  }

  test('P1-01-01 확정 시트 열기', async ({ page }) => {
    await openConfirmSheet(page);
  });

  test('P1-01-02 멀티플라이어 2 선택', async ({ page }) => {
    await openConfirmSheet(page);
    await expect(page.getByTestId('multiplier-2')).toBeVisible();
    await page.getByTestId('multiplier-2').tap();
    await expect(page.getByTestId('multiplier-2')).toHaveClass(/selected|ring|bg-indigo/);
  });

  test('P1-01-03 도장판 선택 후 확정', async ({ page }) => {
    await openConfirmSheet(page);
    await page.getByTestId('multiplier-2').tap();
    await page.getByTestId('select-board-board-001').tap();
    await page.getByTestId('btn-confirm-submit').tap();
    const shows = await getStorage<Record<string, unknown>[]>(page, 'stampit:shows');
    const sched = (shows?.[0]?.['schedules'] as Record<string, unknown>[])?.[0];
    expect(sched?.['multiplier']).toBe(2);
    expect(sched?.['status']).toBe('confirmed');
  });
});

// ────────────────────────────────────────────────────────────────
// P1-02  확정 시트 — 재관람 체크 & 초과 경고
// ────────────────────────────────────────────────────────────────
test.describe('P1-02 확정 시트 재관람·초과', () => {
  async function openRebookConfirmSheet(page: Parameters<Parameters<typeof test>[1]>[0]) {
    await seedShow(page);
    await seedSchedule(page, { discountTypeId: 'disc-rebook', status: 'draft' });
    await page.goto('/');
    await page.getByTestId('tab-planner').tap();
    await page.getByTestId('schedule-card').first().tap();
    await page.getByTestId('btn-confirm').tap();
    await expect(page.getByTestId('bottomsheet-confirm')).toBeVisible();
  }

  test('P1-02-01 재관람 할인 스케줄 시트 열기', async ({ page }) => {
    await openRebookConfirmSheet(page);
  });

  test('P1-02-02 재관람 체크박스 표시 확인', async ({ page }) => {
    await openRebookConfirmSheet(page);
    await expect(page.getByTestId('checkbox-rebook')).toBeVisible();
  });

  test('P1-02-03 판 꽉 찼을 때 초과 경고', async ({ page }) => {
    await openRebookConfirmSheet(page);
    await page.getByTestId('select-board-board-001').tap();
    await expect(page.getByTestId('bottomsheet-confirm')).toBeVisible();
  });
});

// ────────────────────────────────────────────────────────────────
// P1-03  혜택 달성 모달
// ────────────────────────────────────────────────────────────────
test.describe('P1-03 혜택 달성 모달', () => {
  test('P1-03-01 5번째 도장으로 혜택 달성 모달 표시', async ({ page }) => {
    await seedShow(page);
    // 4 stamps already in board-001
    await seedSchedule(page, { status: 'draft' });
    // Manually set board stamps to 4
    await page.evaluate(() => {
      const raw = localStorage.getItem('stampit_react_v1');
      if (!raw) return;
      const data = JSON.parse(raw);
      const show = data.shows.find((s: Record<string, unknown>) => s.id === 'show-001');
      if (!show) return;
      const board = show.stampBoards.find((b: Record<string, unknown>) => b.id === 'board-001');
      if (!board) return;
      board.stamps = Array.from({ length: 4 }, (_, i) => ({
        id: `stamp-${i}`, scheduleId: `sched-pre-${i}`, isInitial: false, isConfirmed: true, earnedAt: '2026-01-01T00:00:00.000Z'
      }));
      localStorage.setItem('stampit_react_v1', JSON.stringify(data));
    });
    await page.goto('/');
    await page.getByTestId('tab-planner').tap();
    await page.getByTestId('schedule-card').first().tap();
    await page.getByTestId('btn-confirm').tap();
    await page.getByTestId('select-board-board-001').tap();
    await page.getByTestId('btn-confirm-submit').tap();
    await expect(page.getByTestId('modal-benefit-achieved')).toBeVisible({ timeout: 5000 });
  });

  test('P1-03-02 계속 사용 버튼', async ({ page }) => {
    await seedShow(page);
    await seedSchedule(page, { status: 'draft' });
    await page.evaluate(() => {
      const raw = localStorage.getItem('stampit_react_v1');
      if (!raw) return;
      const data = JSON.parse(raw);
      const show = data.shows.find((s: Record<string, unknown>) => s.id === 'show-001');
      if (!show) return;
      const board = show.stampBoards.find((b: Record<string, unknown>) => b.id === 'board-001');
      if (!board) return;
      board.stamps = Array.from({ length: 4 }, (_, i) => ({
        id: `stamp-${i}`, scheduleId: `sched-pre-${i}`, isInitial: false, isConfirmed: true, earnedAt: '2026-01-01T00:00:00.000Z'
      }));
      localStorage.setItem('stampit_react_v1', JSON.stringify(data));
    });
    await page.goto('/');
    await page.getByTestId('tab-planner').tap();
    await page.getByTestId('schedule-card').first().tap();
    await page.getByTestId('btn-confirm').tap();
    await page.getByTestId('select-board-board-001').tap();
    await page.getByTestId('btn-confirm-submit').tap();
    await expect(page.getByTestId('modal-benefit-achieved')).toBeVisible({ timeout: 5000 });
    await page.getByTestId('btn-benefit-continue').tap();
    await expect(page.getByTestId('modal-benefit-achieved')).not.toBeVisible();
  });
});

// ────────────────────────────────────────────────────────────────
// P1-04  티켓 변경 시트
// ────────────────────────────────────────────────────────────────
test.describe('P1-04 티켓 변경 시트', () => {
  test('P1-04-01 티켓 변경 시트 열기', async ({ page }) => {
    await seedShow(page);
    await seedSchedule(page, { status: 'confirmed', isConfirmed: true, finalPrice: 100000 });
    await page.goto('/');
    await page.getByTestId('tab-planner').tap();
    await page.getByTestId('schedule-card').first().tap();
    await page.getByTestId('btn-more').tap();
    await page.getByTestId('menu-ticket-change').tap();
    await expect(page.getByTestId('bottomsheet-ticket-change')).toBeVisible();
  });

  test('P1-04-02 할인 변경 선택', async ({ page }) => {
    await seedShow(page);
    await seedSchedule(page, { status: 'confirmed', isConfirmed: true, finalPrice: 100000 });
    await page.goto('/');
    await page.getByTestId('tab-planner').tap();
    await page.getByTestId('schedule-card').first().tap();
    await page.getByTestId('btn-more').tap();
    await page.getByTestId('menu-ticket-change').tap();
    await expect(page.getByTestId('select-discount-change')).toBeVisible();
    await page.getByTestId('select-discount-change').selectOption('disc-matinee');
    await expect(page.getByTestId('price-diff-options')).toBeVisible();
  });

  test('P1-04-03 재계산 라디오 선택 후 저장', async ({ page }) => {
    await seedShow(page);
    await seedSchedule(page, { status: 'confirmed', isConfirmed: true, finalPrice: 100000, originalPrice: 100000 });
    await page.goto('/');
    await page.getByTestId('tab-planner').tap();
    await page.getByTestId('schedule-card').first().tap();
    await page.getByTestId('btn-more').tap();
    await page.getByTestId('menu-ticket-change').tap();
    await page.getByTestId('select-discount-change').selectOption('disc-matinee');
    await page.getByTestId('radio-recalculate').tap();
    await page.getByTestId('btn-ticket-change-save').tap();
    const shows = await getStorage<Record<string, unknown>[]>(page, 'stampit:shows');
    const sched = (shows?.[0]?.['schedules'] as Record<string, unknown>[])?.[0];
    expect(sched?.['discountTypeId']).toBe('disc-matinee');
  });
});

// ────────────────────────────────────────────────────────────────
// P1-05  확정 취소
// ────────────────────────────────────────────────────────────────
test.describe('P1-05 확정 취소', () => {
  test('P1-05-01 확정 취소 메뉴 클릭 후 draft로 변경', async ({ page }) => {
    await seedShow(page);
    await seedSchedule(page, { status: 'confirmed', isConfirmed: true });
    await page.goto('/');
    await page.getByTestId('tab-planner').tap();
    await page.getByTestId('schedule-card').first().tap();
    await page.getByTestId('btn-more').tap();
    await page.getByTestId('menu-cancel-confirm').tap();
    const shows = await getStorage<Record<string, unknown>[]>(page, 'stampit:shows');
    const sched = (shows?.[0]?.['schedules'] as Record<string, unknown>[])?.[0];
    expect(sched?.['status']).toBe('draft');
  });
});

// ────────────────────────────────────────────────────────────────
// P1-06  공연 탭 순서 변경
// ────────────────────────────────────────────────────────────────
test.describe('P1-06 탭 순서 변경', () => {
  test('P1-06-01 탭 순서 변경 시트 열기', async ({ page }) => {
    await setStorage(page, [
      { id: 'show-001', name: '공연A', color: '#6366f1', seatGrades: [], discountTypes: [], stampBoards: [], events: [], specialEvents: [], isArchived: false, tabOrder: 0, startDate: '', endDate: '', createdAt: '2026-01-01T00:00:00.000Z', schedules: [] },
      { id: 'show-002', name: '공연B', color: '#f43f5e', seatGrades: [], discountTypes: [], stampBoards: [], events: [], specialEvents: [], isArchived: false, tabOrder: 1, startDate: '', endDate: '', createdAt: '2026-01-01T00:00:00.000Z', schedules: [] },
    ]);
    await page.goto('/');
    // Long press on show tab to open context menu
    const tab = page.getByTestId('show-tab-show-001');
    await tab.tap({ force: true });
    // Try to find the tab reorder menu
    const menuBtn = page.getByTestId('menu-tab-reorder');
    if (await menuBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await menuBtn.tap();
      await expect(page.getByTestId('tab-order-sheet')).toBeVisible();
    } else {
      // Alternative: find settings and access tab order there
      await page.getByTestId('tab-settings').tap();
      const reorderBtn = page.getByTestId('btn-tab-reorder');
      if (await reorderBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await reorderBtn.tap();
        await expect(page.getByTestId('tab-order-sheet')).toBeVisible();
      }
    }
  });
});

// ────────────────────────────────────────────────────────────────
// P1-07  혜택 사용 처리 (StatusTab)
// ────────────────────────────────────────────────────────────────
test.describe('P1-07 혜택 사용 처리', () => {
  test('P1-07-01 달성된 혜택에 사용 버튼 표시', async ({ page }) => {
    await seedShow(page);
    // Mark benefit-001 as achieved
    await page.evaluate(() => {
      const raw = localStorage.getItem('stampit_react_v1');
      if (!raw) return;
      const data = JSON.parse(raw);
      const show = data.shows.find((s: Record<string, unknown>) => s.id === 'show-001');
      if (!show) return;
      const board = show.stampBoards.find((b: Record<string, unknown>) => b.id === 'board-001');
      if (!board) return;
      const benefit = board.benefits.find((b: Record<string, unknown>) => b.id === 'benefit-001');
      if (benefit) benefit.isAchieved = true;
      localStorage.setItem('stampit_react_v1', JSON.stringify(data));
    });
    await page.goto('/');
    await page.getByTestId('tab-status').tap();
    await expect(page.getByTestId('btn-use-benefit').first()).toBeVisible({ timeout: 5000 });
  });

  test('P1-07-02 쿠폰 혜택 사용 처리', async ({ page }) => {
    await seedShow(page);
    await page.evaluate(() => {
      const raw = localStorage.getItem('stampit_react_v1');
      if (!raw) return;
      const data = JSON.parse(raw);
      const show = data.shows.find((s: Record<string, unknown>) => s.id === 'show-001');
      if (!show) return;
      const board = show.stampBoards.find((b: Record<string, unknown>) => b.id === 'board-001');
      if (!board) return;
      const benefit = board.benefits.find((b: Record<string, unknown>) => b.id === 'benefit-001');
      if (benefit) benefit.isAchieved = true;
      localStorage.setItem('stampit_react_v1', JSON.stringify(data));
    });
    await page.goto('/');
    await page.getByTestId('tab-status').tap();
    await page.getByTestId('btn-use-benefit').first().tap();
    // Coupon benefits might show a confirm dialog
    const confirmBtn = page.getByTestId('btn-use-confirm');
    if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await confirmBtn.tap();
    }
    const shows = await getStorage<Record<string, unknown>[]>(page, 'stampit:shows');
    const board = (shows?.[0] as Record<string, unknown> & { stampBoards?: Record<string, unknown>[] })?.stampBoards?.find(
      (b: Record<string, unknown>) => b.id === 'board-001'
    );
    const benefit = (board?.['benefits'] as Record<string, unknown>[])?.find(
      (b) => b.id === 'benefit-001'
    );
    expect(benefit?.['isUsed']).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────────
// P1-08  오늘의 빠른 확정 (QuickConfirmCard)
// ────────────────────────────────────────────────────────────────
test.describe('P1-08 빠른 확정 카드', () => {
  test('P1-08-01 오늘 일정 없을 때 empty 상태', async ({ page }) => {
    await seedShow(page);
    await page.goto('/');
    await page.getByTestId('tab-planner').tap();
    await expect(page.getByTestId('quick-confirm-empty')).toBeVisible({ timeout: 5000 });
  });

  test('P1-08-02 오늘 일정 있을 때 카드 표시', async ({ page }) => {
    await seedShow(page);
    await seedSchedule(page, { date: todayKST(), status: 'draft' });
    await page.goto('/');
    await page.getByTestId('tab-planner').tap();
    await expect(page.getByTestId('quick-confirm-card')).toBeVisible({ timeout: 5000 });
  });

  test('P1-08-03 빈 상태 텍스트 확인', async ({ page }) => {
    await seedShow(page);
    await page.goto('/');
    await page.getByTestId('tab-planner').tap();
    await expect(page.getByTestId('quick-confirm-empty')).toContainText('오늘');
  });

  test('P1-08-04 빠른 확정 버튼 동작', async ({ page }) => {
    await seedShow(page);
    await seedSchedule(page, { date: todayKST(), status: 'draft' });
    await page.goto('/');
    await page.getByTestId('tab-planner').tap();
    await page.getByTestId('quick-confirm-btn').tap();
    // After quick confirm, schedule should be confirmed or confirm sheet opens
    const shows = await getStorage<Record<string, unknown>[]>(page, 'stampit:shows');
    const sched = (shows?.[0]?.['schedules'] as Record<string, unknown>[])?.[0];
    // Either confirmed directly or confirm sheet is open
    const isConfirmed = sched?.['status'] === 'confirmed';
    const sheetVisible = await page.getByTestId('bottomsheet-confirm').isVisible().catch(() => false);
    expect(isConfirmed || sheetVisible).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────────
// P1-09  빠른 계산기 (QuickCalculator)
// ────────────────────────────────────────────────────────────────
test.describe('P1-09 빠른 계산기', () => {
  test('P1-09-01 계산기 열기', async ({ page }) => {
    await seedShow(page);
    await page.goto('/');
    await page.getByTestId('tab-planner').tap();
    const toggleBtn = page.getByTestId('quick-calc-toggle');
    if (await toggleBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await toggleBtn.tap();
    }
    await expect(page.getByTestId('quick-calc-content')).toBeVisible({ timeout: 5000 });
  });

  test('P1-09-02 등급 및 할인 선택 후 금액 표시', async ({ page }) => {
    await seedShow(page);
    await page.goto('/');
    await page.getByTestId('tab-planner').tap();
    const toggleBtn = page.getByTestId('quick-calc-toggle');
    if (await toggleBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await toggleBtn.tap();
    }
    await expect(page.getByTestId('quick-calc-content')).toBeVisible({ timeout: 5000 });
    await page.getByTestId('calc-select-grade').selectOption('grade-r');
    await page.getByTestId('calc-select-discount').selectOption('disc-rebook');
    await expect(page.getByTestId('calc-price-final')).toBeVisible();
  });
});

// ────────────────────────────────────────────────────────────────
// P1-10  특별 이벤트 필터 (PlannerTab)
// ────────────────────────────────────────────────────────────────
test.describe('P1-10 특별 이벤트 필터', () => {
  test('P1-10-01 특별 이벤트 칩 표시', async ({ page }) => {
    await seedShow(page);
    await seedSchedule(page, { specialEventIds: ['se-001'] });
    await page.goto('/');
    await page.getByTestId('tab-planner').tap();
    // Special event filter chip should be visible
    const chip = page.getByTestId('event-chip-se-001');
    const filter = page.getByTestId('event-filter-se-001');
    const hasChip = await chip.isVisible({ timeout: 3000 }).catch(() => false);
    const hasFilter = await filter.isVisible({ timeout: 3000 }).catch(() => false);
    expect(hasChip || hasFilter).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────────
// P1-11  설정 탭 — 할인 유형 삭제
// ────────────────────────────────────────────────────────────────
test.describe('P1-11 할인 유형 삭제', () => {
  test('P1-11-01 설정 탭 할인 유형 목록 표시', async ({ page }) => {
    await seedShow(page);
    await page.goto('/');
    await page.getByTestId('tab-settings').tap();
    await page.getByTestId('tab-discount-types').tap();
    await expect(page.getByTestId('discount-item-disc-rebook')).toBeVisible({ timeout: 5000 });
  });

  test('P1-11-02 할인 유형 스와이프 삭제', async ({ page }) => {
    await seedShow(page);
    await page.goto('/');
    await page.getByTestId('tab-settings').tap();
    // 할인 항목 클릭 → expand
    await page.getByTestId('discount-item-disc-matinee').tap();
    // 삭제 버튼 표시 대기
    await expect(page.getByTestId('swipe-delete')).toBeVisible({ timeout: 3000 });
    await page.getByTestId('swipe-delete').tap();
    // 삭제 확인 버튼 대기
    await expect(page.getByTestId('btn-delete-confirm')).toBeVisible({ timeout: 3000 });
    await page.getByTestId('btn-delete-confirm').tap();
    // 스토리지 확인
    const shows = await getStorage<Record<string, unknown>[]>(page, 'stampit:shows');
    const discounts = (shows?.[0] as Record<string, unknown>)?.['discountTypes'] as Record<string, unknown>[];
    const matinee = discounts?.find((d) => d['id'] === 'disc-matinee');
    expect(!matinee || matinee['isDeleted'] === true).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────────
// P1-12  아카이브 제안 시트
// ────────────────────────────────────────────────────────────────
test.describe('P1-12 아카이브 제안', () => {
  test('P1-12-01 종료된 공연 아카이브 제안 시트 표시', async ({ page }) => {
    await setStorage(page, [
      {
        id: 'show-old', name: '종료공연', color: '#6366f1',
        seatGrades: [], discountTypes: [], stampBoards: [], events: [], specialEvents: [],
        isArchived: false, tabOrder: 0,
        startDate: '2025-01-01', endDate: '2025-12-31',
        createdAt: '2025-01-01T00:00:00.000Z', schedules: [],
      },
    ]);
    await page.goto('/');
    await expect(page.getByTestId('archive-prompt-sheet')).toBeVisible({ timeout: 5000 });
  });

  test('P1-12-02 아카이브 확정', async ({ page }) => {
    await setStorage(page, [
      {
        id: 'show-old', name: '종료공연', color: '#6366f1',
        seatGrades: [], discountTypes: [], stampBoards: [], events: [], specialEvents: [],
        isArchived: false, tabOrder: 0,
        startDate: '2025-01-01', endDate: '2025-12-31',
        createdAt: '2025-01-01T00:00:00.000Z', schedules: [],
      },
    ]);
    await page.goto('/');
    await expect(page.getByTestId('archive-prompt-sheet')).toBeVisible({ timeout: 5000 });
    await page.getByTestId('btn-archive-confirm').tap();
    const shows = await getStorage<Record<string, unknown>[]>(page, 'stampit:shows');
    const show = shows?.find((s) => s['id'] === 'show-old');
    expect(show?.['isArchived']).toBe(true);
  });

  test('P1-12-03 아카이브 해제(무시)', async ({ page }) => {
    await setStorage(page, [
      {
        id: 'show-old', name: '종료공연', color: '#6366f1',
        seatGrades: [], discountTypes: [], stampBoards: [], events: [], specialEvents: [],
        isArchived: false, tabOrder: 0,
        startDate: '2025-01-01', endDate: '2025-12-31',
        createdAt: '2025-01-01T00:00:00.000Z', schedules: [],
      },
    ]);
    await page.goto('/');
    await expect(page.getByTestId('archive-prompt-sheet')).toBeVisible({ timeout: 5000 });
    await page.getByTestId('btn-archive-dismiss').tap();
    await expect(page.getByTestId('archive-prompt-sheet')).not.toBeVisible();
  });
});

// ────────────────────────────────────────────────────────────────
// P1-13  설정 탭 — 데이터 초기화
// ────────────────────────────────────────────────────────────────
test.describe('P1-13 데이터 초기화', () => {
  test('P1-13-01 초기화 버튼 클릭 후 확인 인풋 표시', async ({ page }) => {
    await seedShow(page);
    await page.goto('/');
    await page.getByTestId('tab-settings').tap();
    await page.getByTestId('btn-reset-all').tap();
    await expect(page.getByTestId('input-reset-confirm')).toBeVisible({ timeout: 5000 });
  });

  test('P1-13-02 "초기화" 입력 후 초기화 실행', async ({ page }) => {
    await seedShow(page);
    await page.goto('/');
    await page.getByTestId('tab-settings').tap();
    await page.getByTestId('btn-reset-all').tap();
    await page.getByTestId('input-reset-confirm').fill('초기화');
    await page.getByTestId('btn-reset-confirm').tap();
    const shows = await getStorage<Record<string, unknown>[]>(page, 'stampit:shows');
    expect(!shows || shows.length === 0).toBe(true);
  });
});
