import { test, expect } from '@playwright/test';
import {
  installBridge,
  clearStorage,
  seedShow,
  seedSchedule,
  getStorage,
  setStorage,
  todayKST,
  addDaysKST,
} from './utils/helpers';

/**
 * P2 — 세부 기능 및 예외 처리 TC
 * 전체 TC의 약 40~50%
 */

// ─────────────────────────────────────────────
// P2-01. 공연 생성 세부
// ─────────────────────────────────────────────
test.describe('[P2-01] 공연 생성 세부', () => {
  test('P2-01-01 종료일 < 시작일 → 인라인 에러 노출', async ({ page }) => {
    await seedShow(page);
    await page.goto('/');
    await page.locator('[data-testid="btn-add-show"]').click();
    await page.locator('[data-testid="input-show-name"]').fill('테스트');
    await page.locator('[data-testid="input-start-date"]').fill('2025-06-30');
    await page.locator('[data-testid="input-end-date"]').fill('2025-06-01');
    await expect(page.locator('[data-testid="error-date"]')).toBeVisible();
    await expect(page.locator('[data-testid="btn-save-show"]')).toBeDisabled();
  });

  test('P2-01-02 색상 6가지 선택 가능 + 기본값 존재', async ({ page }) => {
    await seedShow(page);
    await page.goto('/');
    await page.locator('[data-testid="btn-add-show"]').click();
    await expect(page.locator('[data-testid="color-option"]')).toHaveCount(6);
    await expect(page.locator('[data-testid="color-option"][aria-selected="true"]')).toHaveCount(1);
  });

  test('P2-01-03 공연 수정 → Show 필드 변경 + LocalStorage 갱신', async ({ page }) => {
    await seedShow(page);
    await page.goto('/');
    await page.locator('[data-testid="show-tab-show-001"]').dispatchEvent('longpress');
    await page.locator('[data-testid="menu-edit-show"]').click();
    await page.locator('[data-testid="input-show-name"]').fill('수정된 공연명');
    await page.locator('[data-testid="btn-save-show"]').click();
    const shows = await getStorage<{ name: string }[]>(page, 'stampit:shows');
    expect(shows![0].name).toBe('수정된 공연명');
  });

  test('P2-01-04 공연 삭제 → 관련 일정/도장판 전체 삭제', async ({ page }) => {
    await seedShow(page);
    await seedSchedule(page);
    await page.goto('/');
    await page.locator('[data-testid="show-tab-show-001"]').dispatchEvent('longpress');
    await page.locator('[data-testid="menu-delete-show"]').click();
    await page.locator('[data-testid="btn-delete-show-confirm"]').click();
    const shows = await getStorage<unknown[]>(page, 'stampit:shows');
    expect(shows).toHaveLength(0);
  });

  test('P2-01-05 공연 아카이브 → 탭바 숨김 + 데이터 보존', async ({ page }) => {
    await seedShow(page);
    await page.goto('/');
    await page.locator('[data-testid="show-tab-show-001"]').dispatchEvent('longpress');
    await page.locator('[data-testid="menu-archive-show"]').click();
    await expect(page.locator('[data-testid="show-tab-show-001"]')).not.toBeVisible();
    const shows = await getStorage<{ isArchived: boolean }[]>(page, 'stampit:shows');
    expect(shows![0].isArchived).toBe(true);
  });
});

// ─────────────────────────────────────────────
// P2-02. 도장판 세부
// ─────────────────────────────────────────────
test.describe('[P2-02] 도장판 세부', () => {
  test('P2-02-01 칸 수 1 미만 입력 → 최솟값 1 강제', async ({ page }) => {
    await seedShow(page);
    await page.goto('/');
    await page.locator('[data-testid="tab-status"]').click();
    await page.locator('[data-testid="btn-add-board"]').click();
    await page.locator('[data-testid="btn-full-mode"]').click();
    await page.locator('[data-testid="input-capacity"]').fill('0');
    await expect(page.locator('[data-testid="input-capacity"]')).toHaveValue('1');
  });

  test('P2-02-02 칸 수 50 초과 입력 → 최댓값 50 강제', async ({ page }) => {
    await seedShow(page);
    await page.goto('/');
    await page.locator('[data-testid="tab-status"]').click();
    await page.locator('[data-testid="btn-add-board"]').click();
    await page.locator('[data-testid="btn-full-mode"]').click();
    await page.locator('[data-testid="input-capacity"]').fill('51');
    await expect(page.locator('[data-testid="input-capacity"]')).toHaveValue('50');
  });

  test('P2-02-03 혜택 requiredStamps > 칸 수 → 인라인 에러', async ({ page }) => {
    await seedShow(page);
    await page.goto('/');
    await page.locator('[data-testid="tab-status"]').click();
    await page.locator('[data-testid="btn-add-board"]').click();
    await page.locator('[data-testid="btn-full-mode"]').click();
    await page.locator('[data-testid="input-capacity"]').fill('5');
    await page.locator('[data-testid="btn-add-benefit"]').click();
    await page.locator('[data-testid="benefit-stamps-0"]').fill('6');
    await expect(page.locator('[data-testid="error-benefit-overflow"]')).toBeVisible();
  });

  test('P2-02-04 기존 도장 수 = 칸 수 → "이미 완성된 판" 안내', async ({ page }) => {
    await seedShow(page);
    await page.goto('/');
    await page.locator('[data-testid="tab-status"]').click();
    await page.locator('[data-testid="btn-add-board"]').click();
    await page.locator('[data-testid="btn-full-mode"]').click();
    await page.locator('[data-testid="toggle-initial-stamps"]').click();
    await page.locator('[data-testid="input-capacity"]').fill('5');
    await page.locator('[data-testid="input-initial-stamps"]').fill('5');
    await expect(page.locator('[data-testid="notice-already-complete"]')).toBeVisible();
  });

  test('P2-02-05 도장판 2번째 추가 → 간소화 모드 (이전 판 설정 상속)', async ({ page }) => {
    await seedShow(page);
    await page.goto('/');
    await page.locator('[data-testid="tab-status"]').click();
    await page.locator('[data-testid="btn-add-board"]').click();
    // 간소화 모드: 판 이름 + 색상만 표시
    await expect(page.locator('[data-testid="input-board-name"]')).toBeVisible();
    await expect(page.locator('[data-testid="card-inherited-settings"]')).toBeVisible();
    await expect(page.locator('[data-testid="input-capacity"]')).not.toBeVisible();
  });

  test('P2-02-06 간소화 모드 "변경하기" → 전체 설정 모드 전환', async ({ page }) => {
    await seedShow(page);
    await page.goto('/');
    await page.locator('[data-testid="tab-status"]').click();
    await page.locator('[data-testid="btn-add-board"]').click();
    await page.locator('[data-testid="btn-full-mode"]').click();
    await expect(page.locator('[data-testid="input-capacity"]')).toBeVisible();
  });

  test('P2-02-07 도장판 색상 12가지 프리셋 선택 가능', async ({ page }) => {
    await seedShow(page);
    await page.goto('/');
    await page.locator('[data-testid="tab-status"]').click();
    await page.locator('[data-testid="btn-add-board"]').click();
    await expect(page.locator('[data-testid="stamp-color-option"]')).toHaveCount(12);
  });

  test('P2-02-08 초기 도장 isInitial=true, scheduleId=null 확인', async ({ page }) => {
    await seedShow(page);
    await page.goto('/');
    await page.locator('[data-testid="tab-status"]').click();
    await page.locator('[data-testid="btn-add-board"]').click();
    await page.locator('[data-testid="input-board-name"]').fill('테스트 판');
    await page.locator('[data-testid="toggle-initial-stamps"]').click();
    await page.locator('[data-testid="input-initial-stamps"]').fill('3');
    await page.locator('[data-testid="btn-save-board"]').click();
    const shows = await getStorage<{
      stampBoards: { name: string; stamps: { isInitial: boolean; scheduleId: null }[] }[];
    }[]>(page, 'stampit:shows');
    const board = shows![0].stampBoards.find((b) => b.name === '테스트 판');
    board!.stamps.forEach((s) => {
      expect(s.isInitial).toBe(true);
      expect(s.scheduleId).toBeNull();
    });
  });
});

// ─────────────────────────────────────────────
// P2-03. 좌석 등급 설정
// ─────────────────────────────────────────────
test.describe('[P2-03] 좌석 등급 설정', () => {
  test('P2-03-01 등급명 중복 입력 → 인라인 에러', async ({ page }) => {
    await seedShow(page);
    await page.goto('/');
    await page.locator('[data-testid="tab-settings"]').click();
    await page.locator('[data-testid="tab-seat-grades"]').click();
    await page.locator('[data-testid="btn-add-grade"]').click();
    await page.locator('[data-testid="input-grade-name"]').fill('VIP');
    await expect(page.locator('[data-testid="error-grade-dup"]')).toBeVisible();
  });

  test('P2-03-02 금액 0원 입력 → 경고 노출', async ({ page }) => {
    await seedShow(page);
    await page.goto('/');
    await page.locator('[data-testid="tab-settings"]').click();
    await page.locator('[data-testid="tab-seat-grades"]').click();
    await page.locator('[data-testid="btn-add-grade"]').click();
    await page.locator('[data-testid="input-grade-name"]').fill('S');
    await page.locator('[data-testid="input-grade-price"]').fill('0');
    await expect(page.locator('[data-testid="warn-zero-price"]')).toBeVisible();
  });

  test('P2-03-03 금액 천 단위 자동 포맷 (130000 → 130,000)', async ({ page }) => {
    await seedShow(page);
    await page.goto('/');
    await page.locator('[data-testid="tab-settings"]').click();
    await page.locator('[data-testid="tab-seat-grades"]').click();
    await page.locator('[data-testid="btn-add-grade"]').click();
    const input = page.locator('[data-testid="input-grade-price"]');
    await input.fill('130000');
    await input.blur();
    await expect(input).toHaveValue('130,000');
  });

  test('P2-03-04 등급 1개 남았을 때 삭제 시도 → 차단', async ({ page }) => {
    await seedShow(page);
    await page.evaluate(() => {
      const raw = localStorage.getItem('stampit:shows');
      const shows = JSON.parse(raw!);
      shows[0].seatGrades = [{ id: 'grade-vip', name: 'VIP', price: 130000 }];
      localStorage.setItem('stampit:shows', JSON.stringify(shows));
    });
    await page.goto('/');
    await page.locator('[data-testid="tab-settings"]').click();
    await page.locator('[data-testid="tab-seat-grades"]').click();
    await page.locator('[data-testid="grade-item-grade-vip"] [data-testid="swipe-delete"]').click();
    await expect(page.locator('[data-testid="error-min-grade"]')).toBeVisible();
  });
});

// ─────────────────────────────────────────────
// P2-04. 할인 권종 세부
// ─────────────────────────────────────────────
test.describe('[P2-04] 할인 권종 세부', () => {
  test('P2-04-01 정액 할인 선택 → 등급별 할인가 즉시 계산', async ({ page }) => {
    await seedShow(page);
    await page.goto('/');
    await page.locator('[data-testid="tab-settings"]').click();
    await page.locator('[data-testid="tab-discount-types"]').click();
    await page.locator('[data-testid="btn-add-discount"]').click();
    await page.locator('[data-testid="radio-method-amount"]').click();
    await page.locator('[data-testid="input-discount-value"]').fill('20000');
    // VIP 130,000 - 20,000 = 110,000
    await expect(page.locator('[data-testid="preview-grade-VIP"]')).toContainText('110,000');
  });

  test('P2-04-02 직접 입력 선택 → 모든 등급 동일 금액 표시', async ({ page }) => {
    await seedShow(page);
    await page.goto('/');
    await page.locator('[data-testid="tab-settings"]').click();
    await page.locator('[data-testid="tab-discount-types"]').click();
    await page.locator('[data-testid="btn-add-discount"]').click();
    await page.locator('[data-testid="radio-method-direct"]').click();
    await page.locator('[data-testid="input-discount-value"]').fill('77000');
    await expect(page.locator('[data-testid="preview-grade-VIP"]')).toContainText('77,000');
    await expect(page.locator('[data-testid="preview-grade-R"]')).toContainText('77,000');
  });

  test('P2-04-03 할인율 100% → 에러 노출', async ({ page }) => {
    await seedShow(page);
    await page.goto('/');
    await page.locator('[data-testid="tab-settings"]').click();
    await page.locator('[data-testid="tab-discount-types"]').click();
    await page.locator('[data-testid="btn-add-discount"]').click();
    await page.locator('[data-testid="radio-method-rate"]').click();
    await page.locator('[data-testid="input-discount-value"]').fill('100');
    await expect(page.locator('[data-testid="error-discount-rate"]')).toBeVisible();
  });

  test('P2-04-04 할인율 101% 입력 → 차단', async ({ page }) => {
    await seedShow(page);
    await page.goto('/');
    await page.locator('[data-testid="tab-settings"]').click();
    await page.locator('[data-testid="tab-discount-types"]').click();
    await page.locator('[data-testid="btn-add-discount"]').click();
    await page.locator('[data-testid="radio-method-rate"]').click();
    const input = page.locator('[data-testid="input-discount-value"]');
    await input.fill('101');
    expect(Number(await input.inputValue())).toBeLessThanOrEqual(100);
  });
});

// ─────────────────────────────────────────────
// P2-05. 배수 이벤트
// ─────────────────────────────────────────────
test.describe('[P2-05] 배수 이벤트', () => {
  test.beforeEach(async ({ page }) => {
    await seedShow(page);
    await page.evaluate(() => {
      const raw = localStorage.getItem('stampit:shows');
      const shows = JSON.parse(raw!);
      shows[0].events = [
        {
          id: 'event-001',
          name: '더블 이벤트',
          startDate: '2025-01-01',
          endDate: '2030-12-31',
          multiplier: 2,
        },
      ];
      localStorage.setItem('stampit:shows', JSON.stringify(shows));
    });
  });

  test('P2-05-01 배수 이벤트 기간 내 날짜 → 배수 자동 설정 + 배너 노출', async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-testid="tab-planner"]').click();
    await page.locator('[data-testid="fab-add"]').tap();
    await page.locator('[data-testid="input-schedule-date"]').fill(todayKST());
    await expect(page.locator('[data-testid="event-banner"]')).toBeVisible();
    await expect(page.locator('[data-testid="event-banner"]')).toContainText('더블 이벤트');
    await expect(page.locator('[data-testid="multiplier-2"]')).toHaveAttribute('aria-selected', 'true');
  });

  test('P2-05-02 배수 수동 변경 → 배너 "수동 설정됨" 표시', async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-testid="tab-planner"]').click();
    await page.locator('[data-testid="fab-add"]').tap();
    await page.locator('[data-testid="input-schedule-date"]').fill(todayKST());
    await page.locator('[data-testid="multiplier-3"]').click();
    await expect(page.locator('[data-testid="event-banner"]')).toContainText('수동 설정됨');
  });

  test('P2-05-03 이벤트 겹침 → 배수 높은 이벤트 우선 적용', async ({ page }) => {
    await page.evaluate(() => {
      const raw = localStorage.getItem('stampit:shows');
      const shows = JSON.parse(raw!);
      shows[0].events.push({
        id: 'event-002',
        name: '트리플 이벤트',
        startDate: '2025-01-01',
        endDate: '2030-12-31',
        multiplier: 3,
      });
      localStorage.setItem('stampit:shows', JSON.stringify(shows));
    });
    await page.goto('/');
    await page.locator('[data-testid="tab-planner"]').click();
    await page.locator('[data-testid="fab-add"]').tap();
    await page.locator('[data-testid="input-schedule-date"]').fill(todayKST());
    // x3이 우선 적용
    await expect(page.locator('[data-testid="multiplier-3"]')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('[data-testid="event-banner"]')).toContainText('외 1개');
  });

  test('P2-05-04 endDate 없는 이벤트 → "(무기한)" 뱃지 노출', async ({ page }) => {
    await page.evaluate(() => {
      const raw = localStorage.getItem('stampit:shows');
      const shows = JSON.parse(raw!);
      shows[0].events[0].endDate = undefined;
      localStorage.setItem('stampit:shows', JSON.stringify(shows));
    });
    await page.goto('/');
    await page.locator('[data-testid="tab-settings"]').click();
    await page.locator('[data-testid="tab-stamp-events"]').click();
    await expect(
      page.locator('[data-testid="event-item-event-001"] [data-testid="badge-unlimited"]'),
    ).toBeVisible();
  });

  test('P2-05-05 배수 이벤트 삭제 → 관련 일정 배수 영향 없음', async ({ page }) => {
    await seedSchedule(page, { date: todayKST() });
    await page.goto('/');
    await page.locator('[data-testid="tab-settings"]').click();
    await page.locator('[data-testid="tab-stamp-events"]').click();
    await page.locator('[data-testid="event-item-event-001"] [data-testid="btn-delete-event"]').click();
    const shows = await getStorage<{ schedules: { multiplier: number }[] }[]>(page, 'stampit:shows');
    expect(shows![0].schedules[0].multiplier).toBe(1);
  });
});

// ─────────────────────────────────────────────
// P2-06. 동일 날짜 중복 일정
// ─────────────────────────────────────────────
test.describe('[P2-06] 동일 날짜 중복 일정', () => {
  test('P2-06-01 동일 날짜 기존 일정 있음 → 중복 경고 노출', async ({ page }) => {
    await seedShow(page);
    await seedSchedule(page, { date: addDaysKST(1) });
    await page.goto('/');
    await page.locator('[data-testid="tab-planner"]').click();
    await page.locator('[data-testid="fab-add"]').tap();
    await page.locator('[data-testid="input-schedule-date"]').fill(addDaysKST(1));
    await expect(page.locator('[data-testid="warn-dup-date"]')).toBeVisible();
  });

  test('P2-06-02 동일 날짜 기존 일정 없음 → 경고 미노출', async ({ page }) => {
    await seedShow(page);
    await page.goto('/');
    await page.locator('[data-testid="tab-planner"]').click();
    await page.locator('[data-testid="fab-add"]').tap();
    await page.locator('[data-testid="input-schedule-date"]').fill(addDaysKST(1));
    await expect(page.locator('[data-testid="warn-dup-date"]')).not.toBeVisible();
  });

  test('P2-06-03 수정 시 자기 자신 날짜 → 중복 경고 미노출', async ({ page }) => {
    await seedShow(page);
    await seedSchedule(page, { date: addDaysKST(1) });
    await page.goto('/');
    await page.locator('[data-testid="tab-planner"]').click();
    await page.locator('[data-testid="schedule-card-sched-001"] [data-testid="btn-more"]').click();
    await page.locator('[data-testid="menu-edit-schedule"]').click();
    await page.locator('[data-testid="input-schedule-date"]').fill(addDaysKST(1));
    await expect(page.locator('[data-testid="warn-dup-date"]')).not.toBeVisible();
  });
});

// ─────────────────────────────────────────────
// P2-07. 캐스트 자동완성 + 통계
// ─────────────────────────────────────────────
test.describe('[P2-07] 캐스트 자동완성 + 통계', () => {
  test.beforeEach(async ({ page }) => {
    await seedShow(page);
    await seedSchedule(page, { date: addDaysKST(-3), isConfirmed: true, status: 'confirmed', cast: '김OO' });
    await seedSchedule(page, { id: 'sched-002', date: addDaysKST(-2), isConfirmed: true, status: 'confirmed', cast: '김OO' });
    await seedSchedule(page, { id: 'sched-003', date: addDaysKST(-1), isConfirmed: true, status: 'confirmed', cast: '이OO' });
  });

  test('P2-07-01 cast 입력 시 동일 공연 이전 값 자동완성 제안', async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-testid="tab-planner"]').click();
    await page.locator('[data-testid="fab-add"]').tap();
    await page.locator('[data-testid="input-cast"]').fill('김');
    await expect(page.locator('[data-testid="autocomplete-item"]')).toContainText('김OO');
  });

  test('P2-07-02 자동완성 최대 5개 제안', async ({ page }) => {
    await page.evaluate(() => {
      const raw = localStorage.getItem('stampit:shows');
      const shows = JSON.parse(raw!);
      const castList = ['가OO', '나OO', '다OO', '라OO', '마OO', '바OO'];
      castList.forEach((cast, i) => {
        shows[0].schedules.push({
          id: `sched-auto-${i}`, showId: 'show-001',
          date: new Date(Date.now() - (i + 4) * 86400000).toISOString().slice(0, 10),
          isConfirmed: true, status: 'confirmed', cast,
          seatGradeId: 'grade-vip', discountTypeId: 'disc-rebook',
          finalPrice: 91000, originalPrice: 130000, multiplier: 1,
          boardAllocations: [], specialEventIds: [],
          createdAt: new Date().toISOString(),
        });
      });
      localStorage.setItem('stampit:shows', JSON.stringify(shows));
    });
    await page.goto('/');
    await page.locator('[data-testid="tab-planner"]').click();
    await page.locator('[data-testid="fab-add"]').tap();
    await page.locator('[data-testid="input-cast"]').fill('O');
    const items = page.locator('[data-testid="autocomplete-item"]');
    expect(await items.count()).toBeLessThanOrEqual(5);
  });

  test('P2-07-03 캐스트 통계 최다 관람 배우 표시', async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-testid="tab-status"]').click();
    await page.locator('[data-testid="more-section-toggle"]').click();
    await expect(page.locator('[data-testid="cast-stats-header"]')).toContainText('김OO');
    await expect(page.locator('[data-testid="cast-stats-header"]')).toContainText('2회');
  });

  test('P2-07-04 cast 없는 일정 → 통계 집계 제외', async ({ page }) => {
    await seedSchedule(page, {
      id: 'sched-nocast', date: addDaysKST(-5),
      isConfirmed: true, status: 'confirmed', cast: '',
    });
    await page.goto('/');
    await page.locator('[data-testid="tab-status"]').click();
    await page.locator('[data-testid="more-section-toggle"]').click();
    await page.locator('[data-testid="cast-stats-card"]').click();
    // 빈 cast는 통계에서 제외
    await expect(page.locator('[data-testid="cast-bar-item"]').filter({ hasText: '' })).toHaveCount(0);
  });
});

// ─────────────────────────────────────────────
// P2-08. 특별 이벤트 CRUD
// ─────────────────────────────────────────────
test.describe('[P2-08] 특별 이벤트 CRUD', () => {
  test('P2-08-01 이벤트 추가 → 목록에 노출', async ({ page }) => {
    await seedShow(page);
    await page.goto('/');
    await page.locator('[data-testid="tab-settings"]').click();
    await page.locator('[data-testid="tab-special-events"]').click();
    await page.locator('[data-testid="btn-add-special-event"]').click();
    await page.locator('[data-testid="input-special-event-name"]').fill('팬미팅');
    await page.locator('[data-testid="btn-save-special-event"]').click();
    await expect(page.locator('[data-testid="special-event-item"]').filter({ hasText: '팬미팅' })).toBeVisible();
  });

  test('P2-08-02 이벤트명 20자 초과 → 차단', async ({ page }) => {
    await seedShow(page);
    await page.goto('/');
    await page.locator('[data-testid="tab-settings"]').click();
    await page.locator('[data-testid="tab-special-events"]').click();
    await page.locator('[data-testid="btn-add-special-event"]').click();
    const input = page.locator('[data-testid="input-special-event-name"]');
    await input.fill('가'.repeat(21));
    await expect(input).toHaveValue('가'.repeat(20));
  });

  test('P2-08-03 사용 중인 이벤트 삭제 → soft delete (isDeleted=true 저장)', async ({ page }) => {
    await seedShow(page);
    await seedSchedule(page, { specialEventIds: ['se-001'], date: addDaysKST(1) });
    await page.goto('/');
    await page.locator('[data-testid="tab-settings"]').click();
    await page.locator('[data-testid="tab-special-events"]').click();
    await page.locator('[data-testid="special-event-item-se-001"] [data-testid="btn-delete-event"]').click();
    await page.locator('[data-testid="btn-delete-confirm"]').click();
    const shows = await getStorage<{ specialEvents: { id: string; isDeleted?: boolean }[] }[]>(page, 'stampit:shows');
    const event = shows![0].specialEvents.find((e) => e.id === 'se-001');
    expect(event?.isDeleted).toBe(true);
  });

  test('P2-08-04 미사용 이벤트 삭제 → hard delete', async ({ page }) => {
    await seedShow(page);
    await page.goto('/');
    await page.locator('[data-testid="tab-settings"]').click();
    await page.locator('[data-testid="tab-special-events"]').click();
    await page.locator('[data-testid="special-event-item-se-001"] [data-testid="btn-delete-event"]').click();
    await page.locator('[data-testid="btn-delete-confirm"]').click();
    const shows = await getStorage<{ specialEvents: { id: string }[] }[]>(page, 'stampit:shows');
    expect(shows![0].specialEvents.find((e) => e.id === 'se-001')).toBeUndefined();
  });

  test('P2-08-05 soft delete 이벤트 → 일정 추가 칩에서 제외', async ({ page }) => {
    await seedShow(page);
    await page.evaluate(() => {
      const raw = localStorage.getItem('stampit:shows');
      const shows = JSON.parse(raw!);
      shows[0].specialEvents[0].isDeleted = true;
      localStorage.setItem('stampit:shows', JSON.stringify(shows));
    });
    await page.goto('/');
    await page.locator('[data-testid="tab-planner"]').click();
    await page.locator('[data-testid="fab-add"]').tap();
    await expect(page.locator('[data-testid="event-chip-se-001"]')).not.toBeVisible();
  });
});

// ─────────────────────────────────────────────
// P2-09. 나눔 관극
// ─────────────────────────────────────────────
test.describe('[P2-09] 나눔 관극', () => {
  test('P2-09-01 나눔 관극 토글 ON → 도장판 선택 영역 숨김', async ({ page }) => {
    await seedShow(page);
    await page.goto('/');
    await page.locator('[data-testid="tab-planner"]').click();
    await page.locator('[data-testid="fab-add"]').tap();
    await page.locator('[data-testid="toggle-is-share"]').click();
    await expect(page.locator('[data-testid="board-allocation-section"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="multiplier-section"]')).not.toBeVisible();
  });

  test('P2-09-02 나눔 관극 확정 → boardAllocations=[] + 도장 미적립', async ({ page }) => {
    await seedShow(page);
    await seedSchedule(page, { date: todayKST() });
    await page.evaluate(() => {
      const raw = localStorage.getItem('stampit:shows');
      const shows = JSON.parse(raw!);
      shows[0].schedules[0].isShare = true;
      shows[0].schedules[0].boardAllocations = [];
      localStorage.setItem('stampit:shows', JSON.stringify(shows));
    });
    await page.goto('/');
    await page.locator('[data-testid="tab-planner"]').click();
    await page.locator('[data-testid="schedule-card-sched-001"] [data-testid="btn-confirm"]').click();
    await page.locator('[data-testid="btn-confirm-submit"]').click();
    const shows = await getStorage<{
      schedules: { isConfirmed: boolean; boardAllocations: unknown[] }[];
    }[]>(page, 'stampit:shows');
    expect(shows![0].schedules[0].isConfirmed).toBe(true);
    expect(shows![0].schedules[0].boardAllocations).toHaveLength(0);
  });

  test('P2-09-03 나눔 관극 일정 카드 → "나눔" 회색 뱃지 노출', async ({ page }) => {
    await seedShow(page);
    await seedSchedule(page, { date: addDaysKST(1) });
    await page.evaluate(() => {
      const raw = localStorage.getItem('stampit:shows');
      const shows = JSON.parse(raw!);
      shows[0].schedules[0].isShare = true;
      localStorage.setItem('stampit:shows', JSON.stringify(shows));
    });
    await page.goto('/');
    await page.locator('[data-testid="tab-planner"]').click();
    await expect(
      page.locator('[data-testid="schedule-card-sched-001"] [data-testid="badge-share"]'),
    ).toBeVisible();
  });

  test('P2-09-04 나눔 관극 비용 제외 설정 OFF → 비용 요약에서 제외', async ({ page }) => {
    await seedShow(page);
    await seedSchedule(page, {
      date: addDaysKST(-1), isConfirmed: true, status: 'confirmed',
      finalPrice: 91000,
    });
    await page.evaluate(() => {
      const raw = localStorage.getItem('stampit:shows');
      const shows = JSON.parse(raw!);
      shows[0].schedules[0].isShare = true;
      localStorage.setItem('stampit:shows', JSON.stringify(shows));
    });
    await page.goto('/');
    await page.locator('[data-testid="tab-status"]').click();
    await page.locator('[data-testid="more-section-toggle"]').click();
    // 나눔 관극 제외 설정 OFF(기본값)이면 비용 0
    await expect(page.locator('[data-testid="cost-total"]')).toContainText('0');
  });

  test('P2-09-05 나눔 관극 → 총 관람 횟수에는 포함', async ({ page }) => {
    await seedShow(page);
    await seedSchedule(page, {
      date: addDaysKST(-1), isConfirmed: true, status: 'confirmed',
    });
    await page.evaluate(() => {
      const raw = localStorage.getItem('stampit:shows');
      const shows = JSON.parse(raw!);
      shows[0].schedules[0].isShare = true;
      localStorage.setItem('stampit:shows', JSON.stringify(shows));
    });
    await page.goto('/');
    await page.locator('[data-testid="tab-status"]').click();
    await expect(page.locator('[data-testid="stat-total-visits"]')).toContainText('1');
  });
});

// ─────────────────────────────────────────────
// P2-10. 도장 수동 추가
// ─────────────────────────────────────────────
test.describe('[P2-10] 도장 수동 추가', () => {
  test('P2-10-01 교환 메뉴 → ManualStampSheet 취득 경로 자동 선택', async ({ page }) => {
    await seedShow(page);
    await page.goto('/');
    await page.locator('[data-testid="tab-status"]').click();
    await page.locator('[data-testid="board-card-board-001"] [data-testid="btn-more"]').click();
    await page.locator('[data-testid="menu-stamp-exchange"]').click();
    await expect(page.locator('[data-testid="manual-stamp-sheet"]')).toBeVisible();
    await expect(page.locator('[data-testid="chip-exchange"]')).toHaveAttribute('aria-selected', 'true');
  });

  test('P2-10-02 수동 추가 도장 → scheduleId=null, isConfirmed=true', async ({ page }) => {
    await seedShow(page);
    await page.goto('/');
    await page.locator('[data-testid="tab-status"]').click();
    await page.locator('[data-testid="board-card-board-001"] [data-testid="btn-more"]').click();
    await page.locator('[data-testid="menu-stamp-exchange"]').click();
    await page.locator('[data-testid="btn-save-manual-stamp"]').click();
    const shows = await getStorage<{
      stampBoards: { stamps: { scheduleId: null; isConfirmed: boolean; stampType: string }[] }[];
    }[]>(page, 'stampit:shows');
    const stamp = shows![0].stampBoards[0].stamps.find((s) => s.stampType === 'exchange');
    expect(stamp?.scheduleId).toBeNull();
    expect(stamp?.isConfirmed).toBe(true);
  });

  test('P2-10-03 도장판 카드 스와이프 메뉴 — 교환/나눔/기타 버튼 노출', async ({ page }) => {
    await seedShow(page);
    await page.goto('/');
    await page.locator('[data-testid="tab-status"]').click();
    await page.locator('[data-testid="board-card-board-001"] [data-testid="btn-more"]').click();
    await expect(page.locator('[data-testid="menu-stamp-exchange"]')).toBeVisible();
  });

  test('P2-10-04 완성된 판 → 수동 추가 버튼 미노출', async ({ page }) => {
    await seedShow(page);
    await page.evaluate(() => {
      const raw = localStorage.getItem('stampit:shows');
      const shows = JSON.parse(raw!);
      shows[0].stampBoards[0].isCompleted = true;
      shows[0].stampBoards[0].isActive = false;
      localStorage.setItem('stampit:shows', JSON.stringify(shows));
    });
    await page.goto('/');
    await page.locator('[data-testid="tab-status"]').click();
    // 완성된 판 섹션에서는 수동 추가 버튼 없음
    await expect(page.locator('[data-testid="btn-stamp-exchange"]')).not.toBeVisible();
  });
});

// ─────────────────────────────────────────────
// P2-11. 현황 탭 구조
// ─────────────────────────────────────────────
test.describe('[P2-11] 현황 탭 구조', () => {
  test('P2-11-01 더보기 섹션 기본 상태 → 접힘', async ({ page }) => {
    await seedShow(page);
    await page.goto('/');
    await page.locator('[data-testid="tab-status"]').click();
    await expect(page.locator('[data-testid="more-section-content"]')).not.toBeVisible();
  });

  test('P2-11-02 더보기 탭 → 펼침 + 세션 유지', async ({ page }) => {
    await seedShow(page);
    await page.goto('/');
    await page.locator('[data-testid="tab-status"]').click();
    await page.locator('[data-testid="more-section-toggle"]').click();
    await expect(page.locator('[data-testid="more-section-content"]')).toBeVisible();
    // 다른 탭 이동 후 복귀
    await page.locator('[data-testid="tab-planner"]').click();
    await page.locator('[data-testid="tab-status"]').click();
    await expect(page.locator('[data-testid="more-section-content"]')).toBeVisible();
  });

  test('P2-11-03 앱 재실행 → 더보기 섹션 다시 접힘', async ({ page }) => {
    await seedShow(page);
    await page.goto('/');
    await page.locator('[data-testid="tab-status"]').click();
    await page.locator('[data-testid="more-section-toggle"]').click();
    await page.reload();
    await page.locator('[data-testid="tab-status"]').click();
    await expect(page.locator('[data-testid="more-section-content"]')).not.toBeVisible();
  });

  test('P2-11-04 다음 관람 카드 → D-N 정확성', async ({ page }) => {
    await seedShow(page);
    await seedSchedule(page, { date: addDaysKST(3) });
    await page.goto('/');
    await page.locator('[data-testid="tab-status"]').click();
    await expect(page.locator('[data-testid="next-schedule-card"]')).toContainText('D-3');
  });

  test('P2-11-05 완성된 판 히스토리 → 기본 접힘 + 판 이름 표시', async ({ page }) => {
    await seedShow(page);
    await page.evaluate(() => {
      const raw = localStorage.getItem('stampit:shows');
      const shows = JSON.parse(raw!);
      shows[0].stampBoards[0].isCompleted = true;
      shows[0].stampBoards[0].isActive = false;
      localStorage.setItem('stampit:shows', JSON.stringify(shows));
    });
    await page.goto('/');
    await page.locator('[data-testid="tab-status"]').click();
    await expect(page.locator('[data-testid="history-section"]')).toBeVisible();
    await expect(page.locator('[data-testid="history-section-toggle"]')).toContainText('완성된 판 1개');
    await expect(page.locator('[data-testid="history-card-board-001"]')).not.toBeVisible();
  });

  test('P2-11-06 지출 블러 기본 상태 → 금액 블러 처리', async ({ page }) => {
    await seedShow(page);
    await seedSchedule(page, { isConfirmed: true, status: 'confirmed', date: addDaysKST(-1) });
    await page.goto('/');
    await page.locator('[data-testid="tab-status"]').click();
    await page.locator('[data-testid="more-section-toggle"]').click();
    await expect(page.locator('[data-testid="cost-blur-mask"]')).toBeVisible();
  });

  test('P2-11-07 눈 아이콘 탭 → 블러 해제', async ({ page }) => {
    await seedShow(page);
    await seedSchedule(page, { isConfirmed: true, status: 'confirmed', date: addDaysKST(-1) });
    await page.goto('/');
    await page.locator('[data-testid="tab-status"]').click();
    await page.locator('[data-testid="more-section-toggle"]').click();
    await page.locator('[data-testid="btn-toggle-cost-blur"]').click();
    await expect(page.locator('[data-testid="cost-blur-mask"]')).not.toBeVisible();
  });
});

// ─────────────────────────────────────────────
// P2-12. 배분 시뮬레이터
// ─────────────────────────────────────────────
test.describe('[P2-12] 배분 시뮬레이터', () => {
  test('P2-12-01 시뮬레이터 오픈 → 입력 영역 노출', async ({ page }) => {
    await seedShow(page);
    await page.goto('/');
    await page.locator('[data-testid="tab-status"]').click();
    await page.locator('[data-testid="more-section-toggle"]').click();
    await page.locator('[data-testid="btn-simulator"]').click();
    await expect(page.locator('[data-testid="simulator-sheet"]')).toBeVisible();
    await expect(page.locator('[data-testid="simulator-input"]')).toBeVisible();
  });

  test('P2-12-02 횟수 입력 → 결과 도장판별 카드 노출', async ({ page }) => {
    await seedShow(page);
    await page.goto('/');
    await page.locator('[data-testid="tab-status"]').click();
    await page.locator('[data-testid="more-section-toggle"]').click();
    await page.locator('[data-testid="btn-simulator"]').click();
    await page.locator('[data-testid="simulator-input"]').fill('5');
    await expect(page.locator('[data-testid="simulator-result-board-001"]')).toBeVisible();
  });

  test('P2-12-03 시뮬레이터 실행 후 실제 도장 수 변경 없음', async ({ page }) => {
    await seedShow(page);
    const before = await getStorage<{ stampBoards: { stamps: unknown[] }[] }[]>(page, 'stampit:shows');
    const stampsBefore = before![0].stampBoards[0].stamps.length;
    await page.goto('/');
    await page.locator('[data-testid="tab-status"]').click();
    await page.locator('[data-testid="more-section-toggle"]').click();
    await page.locator('[data-testid="btn-simulator"]').click();
    await page.locator('[data-testid="simulator-input"]').fill('5');
    const after = await getStorage<{ stampBoards: { stamps: unknown[] }[] }[]>(page, 'stampit:shows');
    expect(after![0].stampBoards[0].stamps.length).toBe(stampsBefore);
  });

  test('P2-12-04 활성 판 없음 → 빈 상태 메시지', async ({ page }) => {
    await seedShow(page);
    await page.evaluate(() => {
      const raw = localStorage.getItem('stampit:shows');
      const shows = JSON.parse(raw!);
      shows[0].stampBoards[0].isCompleted = true;
      shows[0].stampBoards[0].isActive = false;
      localStorage.setItem('stampit:shows', JSON.stringify(shows));
    });
    await page.goto('/');
    await page.locator('[data-testid="tab-status"]').click();
    await page.locator('[data-testid="more-section-toggle"]').click();
    await page.locator('[data-testid="btn-simulator"]').click();
    await expect(page.locator('[data-testid="simulator-empty"]')).toBeVisible();
  });

  test('P2-12-05 하단 안내 문구 노출', async ({ page }) => {
    await seedShow(page);
    await page.goto('/');
    await page.locator('[data-testid="tab-status"]').click();
    await page.locator('[data-testid="more-section-toggle"]').click();
    await page.locator('[data-testid="btn-simulator"]').click();
    await expect(page.locator('[data-testid="simulator-notice"]')).toContainText('실제 데이터에 영향을 주지 않아요');
  });
});

// ─────────────────────────────────────────────
// P2-13. PWA 홈 화면 추가 안내
// ─────────────────────────────────────────────
test.describe('[P2-13] PWA 안내', () => {
  test('P2-13-01 설정 탭 하단 PWA 안내 섹션 노출', async ({ page }) => {
    await seedShow(page);
    await page.goto('/');
    await page.locator('[data-testid="tab-settings"]').click();
    await expect(page.locator('[data-testid="pwa-install-guide"]')).toBeVisible();
  });

  test('P2-13-02 iOS 환경 → iOS 안내만 표시', async ({ page, browserName }) => {
    test.skip(browserName !== 'webkit', 'iOS 에뮬레이션 필요');
    await seedShow(page);
    await page.goto('/');
    await page.locator('[data-testid="tab-settings"]').click();
    await expect(page.locator('[data-testid="pwa-guide-ios"]')).toBeVisible();
    await expect(page.locator('[data-testid="pwa-guide-android"]')).not.toBeVisible();
  });
});

// ─────────────────────────────────────────────
// P2-14. 실지출 설정
// ─────────────────────────────────────────────
test.describe('[P2-14] 실지출 설정', () => {
  test('P2-14-01 토글 OFF → CostSummary 금액 숨김', async ({ page }) => {
    await seedShow(page);
    await seedSchedule(page, { isConfirmed: true, status: 'confirmed', date: addDaysKST(-1) });
    await page.goto('/');
    await page.locator('[data-testid="tab-settings"]').click();
    await page.locator('[data-testid="toggle-show-real-cost"]').click();
    await page.locator('[data-testid="tab-status"]').click();
    await page.locator('[data-testid="more-section-toggle"]').click();
    await expect(page.locator('[data-testid="cost-summary-hidden"]')).toBeVisible();
  });

  test('P2-14-02 토글 OFF → 원본 finalPrice 데이터 변경 없음', async ({ page }) => {
    await seedShow(page);
    await seedSchedule(page, { isConfirmed: true, status: 'confirmed', date: addDaysKST(-1), finalPrice: 91000 });
    await page.goto('/');
    await page.locator('[data-testid="tab-settings"]').click();
    await page.locator('[data-testid="toggle-show-real-cost"]').click();
    const shows = await getStorage<{ schedules: { finalPrice: number }[] }[]>(page, 'stampit:shows');
    expect(shows![0].schedules[0].finalPrice).toBe(91000);
  });

  test('P2-14-03 설정값 앱 재시작 후 복원', async ({ page }) => {
    await seedShow(page);
    await page.goto('/');
    await page.locator('[data-testid="tab-settings"]').click();
    await page.locator('[data-testid="toggle-show-real-cost"]').click();
    await page.reload();
    await page.locator('[data-testid="tab-settings"]').click();
    await expect(page.locator('[data-testid="toggle-show-real-cost"]')).not.toBeChecked();
  });
});

// ─────────────────────────────────────────────
// P2-15. 마이그레이션
// ─────────────────────────────────────────────
test.describe('[P2-15] 마이그레이션', () => {
  test.beforeEach(async ({ page }) => {
    await installBridge(page);
  });


  test('P2-15-01 specialEvents 없는 기존 Show → 프리셋 자동 생성', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem('stampit:shows', JSON.stringify([{
        id: 'show-legacy', name: '레거시 공연',
        color: '#6366f1', isArchived: false, tabOrder: 0,
        seatGrades: [], discountTypes: [], stampBoards: [],
        events: [], schedules: [], createdAt: new Date().toISOString(),
        // specialEvents 필드 없음
      }]));
    });
    await page.goto('/');
    const shows = await getStorage<{ specialEvents: unknown[] }[]>(page, 'stampit:shows');
    expect(shows![0].specialEvents).toBeDefined();
    expect(shows![0].specialEvents.length).toBeGreaterThan(0);
  });

  test('P2-15-02 stampType 없는 기존 Stamp → isInitial 기준 자동 부여', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem('stampit:shows', JSON.stringify([{
        id: 'show-legacy', name: '레거시 공연',
        color: '#6366f1', isArchived: false, tabOrder: 0,
        seatGrades: [], discountTypes: [],
        stampBoards: [{
          id: 'board-legacy', showId: 'show-legacy', name: '레거시 판',
          capacity: 10, initialStamps: 0,
          stamps: [
            { id: 's1', scheduleId: 'sc1', isInitial: false, isConfirmed: true, earnedAt: new Date().toISOString() },
            { id: 's2', scheduleId: null, isInitial: true, isConfirmed: true, earnedAt: new Date().toISOString() },
          ],
          benefits: [], isActive: true, isCompleted: false, sortOrder: 0,
          createdAt: new Date().toISOString(),
        }],
        events: [], specialEvents: [], schedules: [],
        createdAt: new Date().toISOString(),
      }]));
    });
    await page.goto('/');
    const shows = await getStorage<{
      stampBoards: { stamps: { id: string; stampType: string }[] }[];
    }[]>(page, 'stampit:shows');
    const stamps = shows![0].stampBoards[0].stamps;
    expect(stamps.find((s) => s.id === 's1')?.stampType).toBe('visit');
    expect(stamps.find((s) => s.id === 's2')?.stampType).toBe('initial');
  });

  test('P2-15-03 tabOrder 없는 기존 Show → 배열 인덱스 기준 자동 부여', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem('stampit:shows', JSON.stringify([
        { id: 'show-a', name: '공연A', color: '#6366f1', isArchived: false, seatGrades: [], discountTypes: [], stampBoards: [], events: [], specialEvents: [], schedules: [], createdAt: new Date().toISOString() },
        { id: 'show-b', name: '공연B', color: '#6366f1', isArchived: false, seatGrades: [], discountTypes: [], stampBoards: [], events: [], specialEvents: [], schedules: [], createdAt: new Date().toISOString() },
      ]));
    });
    await page.goto('/');
    const shows = await getStorage<{ id: string; tabOrder: number }[]>(page, 'stampit:shows');
    expect(shows![0].tabOrder).toBe(0);
    expect(shows![1].tabOrder).toBe(1);
  });
});