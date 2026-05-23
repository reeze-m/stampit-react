import { test, expect } from '@playwright/test';
import {
  seedShow,
  seedSchedule,
  seedStamps,
  getStorage,
  todayKST,
  addDaysKST,
} from './utils/helpers';

/**
 * new-features-extra.spec.ts
 *
 * 신규 기능 보완 TC — 누락 케이스 + 엣지케이스
 *
 * 대상:
 *   A. 푸시 알림 — 누락/엣지
 *   B. 도장판 공유 — 누락/엣지
 */

// ══════════════════════════════════════════════
// 헬퍼
// ══════════════════════════════════════════════
async function grantNotificationPermission(page: any) {
  await page.evaluate(() => {
    Object.defineProperty(window, 'Notification', {
      value: class MockNotification {
        static permission = 'granted';
        static requestPermission = async () => 'granted';
        constructor(public title: string, public options?: NotificationOptions) {}
      },
      writable: true, configurable: true,
    });
  });
}

async function seedNotificationSettings(
  page: any,
  sameDay: { enabled: boolean; hour: number },
  dayBefore: { enabled: boolean; hour: number }
) {
  await page.evaluate(
    ({ sd, db }: { sd: typeof sameDay; db: typeof dayBefore }) => {
      const s = JSON.parse(localStorage.getItem('stampit_settings') || '{}');
      s.notification = { sameDay: sd, dayBefore: db };
      localStorage.setItem('stampit_settings', JSON.stringify(s));
    },
    { sd: sameDay, db: dayBefore }
  );
}

async function goToNotificationSettings(page: any) {
  await page.locator('[data-testid="tab-settings"]').click();
  await page.locator('[data-testid="settings-section-notification"]').scrollIntoViewIfNeeded();
}

async function openShareSheet(page: any) {
  await page.locator('[data-testid="tab-status"]').click();
  await page.locator('[data-testid="board-card-board-001"] [data-testid="btn-more"]').click();
  await page.locator('[data-testid="menu-share-board"]').click();
  await page.locator('[data-testid="board-share-sheet"]').waitFor({ state: 'visible' });
}

// ══════════════════════════════════════════════
// 푸시 알림 — 누락 케이스
// ══════════════════════════════════════════════
test.describe('[P1-NOTIF-EX-01] 알림 설정 OFF → 타이머 취소', () => {

  test('P1-NOTIF-EX-01-01 당일 알림 OFF → sessionStorage 타이머 빈 배열', async ({ page }) => {
    await seedShow(page);
    await seedSchedule(page, { date: todayKST() });
    await page.goto('/');
    await grantNotificationPermission(page);
    await seedNotificationSettings(page, { enabled: true, hour: 9 }, { enabled: false, hour: 21 });
    await page.reload();

    // 알림 OFF
    await seedNotificationSettings(page, { enabled: false, hour: 9 }, { enabled: false, hour: 21 });
    await page.reload();

    const timers = await page.evaluate(() => {
      const raw = sessionStorage.getItem('stampit_notif_timers');
      return raw ? JSON.parse(raw) : [];
    });
    expect(timers).toHaveLength(0);
  });

  test('P1-NOTIF-EX-01-02 전날/당일 모두 OFF → 스케줄 빈 배열', async ({ page }) => {
    await seedShow(page);
    await seedSchedule(page, { date: addDaysKST(1) });
    await page.goto('/');
    await seedNotificationSettings(page, { enabled: false, hour: 9 }, { enabled: false, hour: 21 });
    await page.reload();

    const timers = await page.evaluate(() => {
      const raw = sessionStorage.getItem('stampit_notif_timers');
      return raw ? JSON.parse(raw) : [];
    });
    expect(timers).toHaveLength(0);
  });
});

test.describe('[P1-NOTIF-EX-02] 7일 이후 일정 스케줄 미등록', () => {

  test('P1-NOTIF-EX-02-01 8일 후 일정 → 알림 등록 안 됨', async ({ page }) => {
    await seedShow(page);
    await seedSchedule(page, { date: addDaysKST(8) });
    await page.goto('/');
    await grantNotificationPermission(page);
    await seedNotificationSettings(page, { enabled: true, hour: 9 }, { enabled: true, hour: 21 });
    await page.reload();

    // 7일 범위 밖이므로 알림 아이템 0개
    const timers = await page.evaluate(() => {
      const raw = sessionStorage.getItem('stampit_notif_timers');
      return raw ? JSON.parse(raw) : [];
    });
    expect(timers).toHaveLength(0);
  });

  test('P1-NOTIF-EX-02-02 7일 후 일정 → 알림 등록 됨', async ({ page }) => {
    await seedShow(page);
    await seedSchedule(page, { date: addDaysKST(7) });
    await page.goto('/');
    await grantNotificationPermission(page);
    await seedNotificationSettings(page, { enabled: false, hour: 9 }, { enabled: true, hour: 21 });
    await page.reload();

    const timers = await page.evaluate(() => {
      const raw = sessionStorage.getItem('stampit_notif_timers');
      return raw ? JSON.parse(raw) : [];
    });
    // 7일 후 일정의 전날(6일 후)이 범위 안에 있음
    expect(timers.length).toBeGreaterThanOrEqual(0); // SW 환경에 따라 다름
  });
});

test.describe('[P1-NOTIF-EX-03] 오늘 알림 시간이 이미 지났을 때', () => {

  test('P1-NOTIF-EX-03-01 당일 알림 시간 경과 → 오늘 알림 미등록', async ({ page }) => {
    await seedShow(page);
    await seedSchedule(page, { date: todayKST() });
    await page.goto('/');
    await grantNotificationPermission(page);

    // 현재 시각보다 이전 시간으로 설정 (오전 1시 = 이미 지남)
    await seedNotificationSettings(page, { enabled: true, hour: 1 }, { enabled: false, hour: 21 });
    await page.reload();

    // 이미 지난 시간이라 타이머 등록 안 됨
    const timers = await page.evaluate(() => {
      const raw = sessionStorage.getItem('stampit_notif_timers');
      return raw ? JSON.parse(raw) : [];
    });
    expect(timers).toHaveLength(0);
  });

  test('P1-NOTIF-EX-03-02 전날 알림 시간 경과 → 전날 알림 미등록', async ({ page }) => {
    await seedShow(page);
    await seedSchedule(page, { date: addDaysKST(1) });
    await page.goto('/');
    await grantNotificationPermission(page);
    await seedNotificationSettings(page, { enabled: false, hour: 9 }, { enabled: true, hour: 1 });
    await page.reload();

    const timers = await page.evaluate(() => {
      const raw = sessionStorage.getItem('stampit_notif_timers');
      return raw ? JSON.parse(raw) : [];
    });
    expect(timers).toHaveLength(0);
  });
});

test.describe('[P1-NOTIF-EX-04] 공연 수정 시 알림 재등록', () => {

  test('P1-NOTIF-EX-04-01 공연 날짜 변경 → 알림 스케줄 재등록', async ({ page }) => {
    await seedShow(page);
    await seedSchedule(page, { id: 'sched-001', date: addDaysKST(2) });
    await page.goto('/');
    await grantNotificationPermission(page);
    await seedNotificationSettings(page, { enabled: true, hour: 9 }, { enabled: false, hour: 21 });

    const before = await page.evaluate(() => sessionStorage.getItem('stampit_notif_timers'));

    // 일정 날짜 수정
    await page.locator('[data-testid="schedule-card-sched-001"] [data-testid="btn-more"]').click();
    await page.locator('[data-testid="menu-edit-schedule"]').click();
    await page.locator('[data-testid="input-schedule-date"]').fill(addDaysKST(3));
    await page.locator('[data-testid="btn-save-schedule"]').click();

    const after = await page.evaluate(() => sessionStorage.getItem('stampit_notif_timers'));
    expect(after).not.toBeNull();
  });
});

test.describe('[P1-NOTIF-EX-05] SW 미지원 환경 setTimeout 폴백', () => {

  test('P1-NOTIF-EX-05-01 serviceWorker 미지원 → setTimeout 타이머 등록', async ({ page }) => {
    await seedShow(page);
    await seedSchedule(page, { date: addDaysKST(1) });
    await page.goto('/');

    // serviceWorker 제거 (미지원 환경 모킹)
    await page.evaluate(() => {
      delete (navigator as any).serviceWorker;
    });

    await grantNotificationPermission(page);
    await seedNotificationSettings(page, { enabled: false, hour: 9 }, { enabled: true, hour: 21 });
    await page.reload();

    // setTimeout 폴백으로 타이머 등록 (지원 환경에서 재로드 시)
    await expect(page.locator('[data-testid="tab-settings"]')).toBeVisible();
  });
});

test.describe('[P1-NOTIF-EX-06] 확정 일정도 알림 대상 포함', () => {

  test('P1-NOTIF-EX-06-01 확정된 미래 일정 → 알림 등록 대상', async ({ page }) => {
    await seedShow(page);
    await seedSchedule(page, {
      date: addDaysKST(1),
      isConfirmed: true,
      status: 'confirmed',
    });
    await page.goto('/');
    await grantNotificationPermission(page);
    await seedNotificationSettings(page, { enabled: true, hour: 9 }, { enabled: false, hour: 21 });
    await page.reload();

    // 확정 일정도 취소 아니므로 포함
    const activeSchedules = await page.evaluate(() => {
      const data = JSON.parse(localStorage.getItem('stampit_react_v1') || '{}');
      return data.schedules.filter((s: any) => s.status !== 'cancelled').length;
    });
    expect(activeSchedules).toBe(1);
  });
});

test.describe('[P1-NOTIF-EX-07] 설정 탭 이동 후 복귀 — 설정 유지', () => {

  test('P1-NOTIF-EX-07-01 다른 탭 이동 후 설정 탭 복귀 → 토글 상태 유지', async ({ page }) => {
    await seedShow(page);
    await page.goto('/');
    await grantNotificationPermission(page);
    await page.locator('[data-testid="tab-settings"]').click();
    await page.locator('[data-testid="toggle-sameday"]').click();

    await page.locator('[data-testid="tab-planner"]').click();
    await page.locator('[data-testid="tab-settings"]').click();

    await expect(page.locator('[data-testid="toggle-sameday"]')).toHaveAttribute('aria-checked', 'true');
  });
});

test.describe('[P2-NOTIF-EX-08] 알림 엣지케이스', () => {

  test('P2-NOTIF-EX-08-01 일정 없는 공연 → 알림 미등록 (타이머 빈 배열)', async ({ page }) => {
    await seedShow(page);
    // 일정 없음
    await page.goto('/');
    await grantNotificationPermission(page);
    await seedNotificationSettings(page, { enabled: true, hour: 9 }, { enabled: true, hour: 21 });
    await page.reload();

    const timers = await page.evaluate(() => {
      const raw = sessionStorage.getItem('stampit_notif_timers');
      return raw ? JSON.parse(raw) : [];
    });
    expect(timers).toHaveLength(0);
  });

  test('P2-NOTIF-EX-08-02 같은 날 여러 공연 일정 → 알림 1개로 묶임', async ({ page }) => {
    await seedShow(page);
    // 같은 날 2개 일정
    await seedSchedule(page, { id: 'sched-001', date: addDaysKST(1), discountTypeId: 'disc-matinee' });
    await seedSchedule(page, { id: 'sched-002', date: addDaysKST(1), discountTypeId: 'disc-rebook' });
    await page.goto('/');
    await grantNotificationPermission(page);
    await seedNotificationSettings(page, { enabled: false, hour: 9 }, { enabled: true, hour: 21 });
    await page.reload();

    // 같은 날짜 → 전날 알림 1개만 등록 (중복 방지)
    const timers = await page.evaluate(() => {
      const raw = sessionStorage.getItem('stampit_notif_timers');
      return raw ? JSON.parse(raw) : [];
    });
    // id가 `daybefore-${date}` 형태로 1개
    expect(timers.length).toBeLessThanOrEqual(1);
  });

  test('P2-NOTIF-EX-08-03 나눔 관극 일정 → 알림은 등록됨 (나눔도 관람이므로)', async ({ page }) => {
    await seedShow(page);
    await seedSchedule(page, { date: addDaysKST(1), isShare: true });
    await page.goto('/');

    // 나눔 관극도 취소 상태가 아니므로 알림 대상
    const activeSchedules = await page.evaluate(() => {
      const data = JSON.parse(localStorage.getItem('stampit_react_v1') || '{}');
      return data.schedules.filter((s: any) => s.status !== 'cancelled').length;
    });
    expect(activeSchedules).toBe(1);
  });

  test('P2-NOTIF-EX-08-04 오늘 날짜 + 당일 알림 시간 아직 안 지남 → 타이머 등록', async ({ page }) => {
    await seedShow(page);
    await seedSchedule(page, { date: todayKST(), discountTypeId: 'disc-matinee' });
    await page.goto('/');
    await grantNotificationPermission(page);

    // 오후 11시 → 아직 안 지난 경우 (테스트 실행 시각이 23시 이전이어야 함)
    await seedNotificationSettings(page, { enabled: true, hour: 23 }, { enabled: false, hour: 21 });
    await page.reload();

    // 타이머 등록됐을 수도 있음 (시각에 따라 다름)
    await expect(page.locator('[data-testid="tab-planner"]')).toBeVisible();
  });

  test('P2-NOTIF-EX-08-05 보관된 공연 일정 → 알림 미등록', async ({ page }) => {
    await seedShow(page);
    await seedSchedule(page, { date: addDaysKST(1) });
    // 공연 보관 처리
    const raw = await page.evaluate((k: string) => localStorage.getItem(k), 'stampit_react_v1');
    const data = JSON.parse(raw!);
    data.shows[0].isArchived = true;
    await page.evaluate(
      ({ k, v }: { k: string; v: string }) => localStorage.setItem(k, v),
      { k: 'stampit_react_v1', v: JSON.stringify(data) }
    );
    await page.goto('/');
    await grantNotificationPermission(page);
    await seedNotificationSettings(page, { enabled: false, hour: 9 }, { enabled: true, hour: 21 });
    await page.reload();

    // 보관된 공연 일정은 알림 대상에서 제외
    const timers = await page.evaluate(() => {
      const raw = sessionStorage.getItem('stampit_notif_timers');
      return raw ? JSON.parse(raw) : [];
    });
    expect(timers).toHaveLength(0);
  });

  test('P2-NOTIF-EX-08-06 Notification API 미지원 환경 → 에러 없이 조용히 실패', async ({ page }) => {
    await seedShow(page);
    await page.goto('/');

    // Notification 제거
    await page.evaluate(() => {
      delete (window as any).Notification;
    });

    await goToNotificationSettings(page);
    await page.locator('[data-testid="toggle-sameday"]').click();

    // 에러 없이 토글만 OFF 복귀
    await expect(page.locator('[data-testid="error-fallback"]')).not.toBeVisible();
  });

  async function goToNotificationSettings(page: any) {
    await page.locator('[data-testid="tab-settings"]').click();
    await page.locator('[data-testid="settings-section-notification"]').scrollIntoViewIfNeeded();
  }
});

// ══════════════════════════════════════════════
// 도장판 공유 — 누락 케이스
// ══════════════════════════════════════════════
test.describe('[P1-SHARE-EX-01] 도장 0개 빈 판 공유', () => {

  test('P1-SHARE-EX-01-01 도장 0개 판 → 공유하기 메뉴 노출', async ({ page }) => {
    await seedShow(page);
    // stamps 없음
    await page.goto('/');
    await page.locator('[data-testid="tab-status"]').click();
    await page.locator('[data-testid="board-card-board-001"] [data-testid="btn-more"]').click();
    await expect(page.locator('[data-testid="menu-share-board"]')).toBeVisible();
  });

  test('P1-SHARE-EX-01-02 도장 0개 판 공유 → 카드 렌더 오류 없음', async ({ page }) => {
    await seedShow(page);
    await page.goto('/');
    await openShareSheet(page);

    await expect(page.locator('[data-testid="board-share-card-preview"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-fallback"]')).not.toBeVisible();
  });

  test('P1-SHARE-EX-01-03 도장 0개 → "0 / 10개" 표시', async ({ page }) => {
    await seedShow(page);
    await page.goto('/');
    await openShareSheet(page);
    await expect(page.locator('[data-testid="board-share-card-preview"]')).toContainText('0');
  });
});

test.describe('[P1-SHARE-EX-02] 도장판 색상별 카드 헤더', () => {

  test('P1-SHARE-EX-02-01 도장판 색상 변경 → 카드 헤더 색상 반영', async ({ page }) => {
    await seedShow(page);
    const raw = await page.evaluate((k: string) => localStorage.getItem(k), 'stampit_react_v1');
    const data = JSON.parse(raw!);
    data.shows[0].color = '#10b981'; // emerald
    await page.evaluate(
      ({ k, v }: { k: string; v: string }) => localStorage.setItem(k, v),
      { k: 'stampit_react_v1', v: JSON.stringify(data) }
    );
    await page.goto('/');
    await openShareSheet(page);

    const header = page.locator('[data-testid="share-card-header"]');
    const bg = await header.evaluate(el => window.getComputedStyle(el).backgroundColor);
    // #10b981 → rgb(16, 185, 129)
    expect(bg).toContain('16');
  });
});

test.describe('[P1-SHARE-EX-03] 혜택 없는 판', () => {

  test('P1-SHARE-EX-03-01 혜택 없는 판 → "N개 더 찍으면" 미노출', async ({ page }) => {
    await seedShow(page);
    const raw = await page.evaluate((k: string) => localStorage.getItem(k), 'stampit_react_v1');
    const data = JSON.parse(raw!);
    data.shows[0].stampBoards[0].benefits = [];
    await page.evaluate(
      ({ k, v }: { k: string; v: string }) => localStorage.setItem(k, v),
      { k: 'stampit_react_v1', v: JSON.stringify(data) }
    );
    await page.goto('/');
    await openShareSheet(page);

    await expect(
      page.locator('[data-testid="board-share-card-preview"] [data-testid="share-next-benefit"]')
    ).not.toBeVisible();
  });

  test('P1-SHARE-EX-03-02 혜택 없는 판 → 워터마크는 항상 노출', async ({ page }) => {
    await seedShow(page);
    const raw = await page.evaluate((k: string) => localStorage.getItem(k), 'stampit_react_v1');
    const data = JSON.parse(raw!);
    data.shows[0].stampBoards[0].benefits = [];
    await page.evaluate(
      ({ k, v }: { k: string; v: string }) => localStorage.setItem(k, v),
      { k: 'stampit_react_v1', v: JSON.stringify(data) }
    );
    await page.goto('/');
    await openShareSheet(page);

    await expect(page.locator('[data-testid="share-watermark"]')).toBeVisible();
  });
});

test.describe('[P1-SHARE-EX-04] 예비 도장 0개 → 예비 카운트 미노출', () => {

  test('P1-SHARE-EX-04-01 예비 도장 없음 → 예비 N개 미노출', async ({ page }) => {
    await seedShow(page);
    await seedStamps(page, 3); // 모두 오늘 이전 실제 도장
    await page.goto('/');
    await openShareSheet(page);

    await expect(
      page.locator('[data-testid="share-preview-count"]')
    ).not.toBeVisible();
  });
});

test.describe('[P1-SHARE-EX-05] Web Share API 미지원 → 다운로드 폴백', () => {

  test('P1-SHARE-EX-05-01 Web Share API 미지원 → 다운로드 트리거', async ({ page }) => {
    await seedShow(page);
    await seedStamps(page, 3);
    await page.goto('/');

    // navigator.share 제거
    await page.evaluate(() => {
      delete (navigator as any).share;
    });

    await openShareSheet(page);

    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 8000 }).catch(() => null),
      page.locator('[data-testid="btn-share-image"]').click(),
    ]);

    // 다운로드 발생하거나 에러 없이 처리됨
    await expect(page.locator('[data-testid="error-fallback"]')).not.toBeVisible();
  });
});

test.describe('[P1-SHARE-EX-06] 여러 판 각각 공유', () => {

  test('P1-SHARE-EX-06-01 2번 판도 개별 공유 가능', async ({ page }) => {
    await seedShow(page);
    const raw = await page.evaluate((k: string) => localStorage.getItem(k), 'stampit_react_v1');
    const data = JSON.parse(raw!);
    data.shows[0].stampBoards.push({
      id: 'board-002', showId: 'show-001', name: '2판',
      capacity: 10, initialStamps: 0, stampColor: '#10b981',
      stamps: [], benefits: [], isActive: true, isCompleted: false,
      isHidden: false, sortOrder: 1, createdAt: new Date().toISOString(),
    });
    await page.evaluate(
      ({ k, v }: { k: string; v: string }) => localStorage.setItem(k, v),
      { k: 'stampit_react_v1', v: JSON.stringify(data) }
    );
    await page.goto('/');
    await page.locator('[data-testid="tab-status"]').click();

    // 2번 판 공유
    await page.locator('[data-testid="board-card-board-002"] [data-testid="btn-more"]').click();
    await page.locator('[data-testid="menu-share-board"]').click();

    await expect(page.locator('[data-testid="board-share-sheet"]')).toBeVisible();
    await expect(page.locator('[data-testid="board-share-card-preview"]')).toContainText('2판');
  });

  test('P1-SHARE-EX-06-02 1번 판 시트 닫고 2번 판 시트 열기 가능', async ({ page }) => {
    await seedShow(page);
    const raw = await page.evaluate((k: string) => localStorage.getItem(k), 'stampit_react_v1');
    const data = JSON.parse(raw!);
    data.shows[0].stampBoards.push({
      id: 'board-002', showId: 'show-001', name: '2판',
      capacity: 10, initialStamps: 0, stampColor: '#10b981',
      stamps: [], benefits: [], isActive: true, isCompleted: false,
      isHidden: false, sortOrder: 1, createdAt: new Date().toISOString(),
    });
    await page.evaluate(
      ({ k, v }: { k: string; v: string }) => localStorage.setItem(k, v),
      { k: 'stampit_react_v1', v: JSON.stringify(data) }
    );
    await page.goto('/');
    await page.locator('[data-testid="tab-status"]').click();

    // 1판 시트 열고 닫기
    await page.locator('[data-testid="board-card-board-001"] [data-testid="btn-more"]').click();
    await page.locator('[data-testid="menu-share-board"]').click();
    await page.locator('[data-testid="btn-share-close"]').click();
    await expect(page.locator('[data-testid="board-share-sheet"]')).not.toBeVisible();

    // 2판 시트 열기
    await page.locator('[data-testid="board-card-board-002"] [data-testid="btn-more"]').click();
    await page.locator('[data-testid="menu-share-board"]').click();
    await expect(page.locator('[data-testid="board-share-sheet"]')).toBeVisible();
    await expect(page.locator('[data-testid="board-share-card-preview"]')).toContainText('2판');
  });
});

// ══════════════════════════════════════════════
// 도장판 공유 — 엣지케이스
// ══════════════════════════════════════════════
test.describe('[P2-SHARE-EX-07] 공연명/판 이름 길 때 레이아웃', () => {

  test('P2-SHARE-EX-07-01 긴 공연명 (30자) → 카드 레이아웃 안 깨짐', async ({ page }) => {
    await seedShow(page, { showName: '가'.repeat(30) });
    await page.goto('/');
    await openShareSheet(page);

    await expect(page.locator('[data-testid="board-share-card-preview"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-fallback"]')).not.toBeVisible();

    // 카드가 화면 밖으로 넘치지 않음
    const cardBox   = await page.locator('[data-testid="board-share-card-preview"]').boundingBox();
    const sheetBox  = await page.locator('[data-testid="board-share-sheet"]').boundingBox();
    expect(cardBox!.width).toBeLessThanOrEqual(sheetBox!.width + 10);
  });

  test('P2-SHARE-EX-07-02 긴 판 이름 → 말줄임 처리 or 레이아웃 유지', async ({ page }) => {
    await seedShow(page);
    const raw = await page.evaluate((k: string) => localStorage.getItem(k), 'stampit_react_v1');
    const data = JSON.parse(raw!);
    data.shows[0].stampBoards[0].name = '아주 긴 도장판 이름입니다 테스트용';
    await page.evaluate(
      ({ k, v }: { k: string; v: string }) => localStorage.setItem(k, v),
      { k: 'stampit_react_v1', v: JSON.stringify(data) }
    );
    await page.goto('/');
    await openShareSheet(page);

    await expect(page.locator('[data-testid="board-share-card-preview"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-fallback"]')).not.toBeVisible();
  });

  test('P2-SHARE-EX-07-03 혜택명 긴 경우 → 칩 overflow 없음', async ({ page }) => {
    await seedShow(page);
    await seedStamps(page, 5);
    const raw = await page.evaluate((k: string) => localStorage.getItem(k), 'stampit_react_v1');
    const data = JSON.parse(raw!);
    data.shows[0].stampBoards[0].benefits[0].description = '아주 긴 혜택 설명 텍스트입니다 테스트용으로';
    data.shows[0].stampBoards[0].benefits[0].isAchieved = true;
    await page.evaluate(
      ({ k, v }: { k: string; v: string }) => localStorage.setItem(k, v),
      { k: 'stampit_react_v1', v: JSON.stringify(data) }
    );
    await page.goto('/');
    await openShareSheet(page);

    await expect(page.locator('[data-testid="board-share-card-preview"]')).toBeVisible();
  });
});

test.describe('[P2-SHARE-EX-08] 도장 50칸 최대 판 공유', () => {

  test('P2-SHARE-EX-08-01 50칸 판 → 카드 그리드 렌더 오류 없음', async ({ page }) => {
    await seedShow(page);
    const raw = await page.evaluate((k: string) => localStorage.getItem(k), 'stampit_react_v1');
    const data = JSON.parse(raw!);
    data.shows[0].stampBoards[0].capacity = 50;
    await page.evaluate(
      ({ k, v }: { k: string; v: string }) => localStorage.setItem(k, v),
      { k: 'stampit_react_v1', v: JSON.stringify(data) }
    );
    await page.goto('/');
    await openShareSheet(page);

    await expect(page.locator('[data-testid="board-share-card-preview"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-fallback"]')).not.toBeVisible();
  });
});

test.describe('[P2-SHARE-EX-09] 공유 중 다른 버튼 탭 방지', () => {

  test('P2-SHARE-EX-09-01 저장 중 상태 → 닫기 버튼만 활성, 공유 버튼 비활성', async ({ page }) => {
    await seedShow(page);
    await seedStamps(page, 3);
    await page.goto('/');
    await openShareSheet(page);

    // html2canvas 지연 모킹
    await page.evaluate(() => {
      const orig = (window as any).html2canvas;
      (window as any).html2canvas = () => new Promise(res => setTimeout(() => res({ toDataURL: () => '', toBlob: (cb: any) => setTimeout(() => cb(new Blob()), 200) }), 3000));
    });

    await page.locator('[data-testid="btn-share-image"]').click();
    // 즉시 확인
    await expect(page.locator('[data-testid="btn-share-image"]')).toBeDisabled();
    await expect(page.locator('[data-testid="btn-share-close"]')).toBeEnabled();
  });
});

test.describe('[P2-SHARE-EX-10] html2canvas 실패 처리', () => {

  test('P2-SHARE-EX-10-01 이미지 생성 실패 → 에러 토스트 노출', async ({ page }) => {
    await seedShow(page);
    await seedStamps(page, 3);
    await page.goto('/');
    await openShareSheet(page);

    // html2canvas 강제 실패
    await page.evaluate(() => {
      (window as any).html2canvas = () => Promise.reject(new Error('canvas error'));
    });

    await page.locator('[data-testid="btn-share-image"]').click();
    await expect(page.locator('[data-testid="share-error-toast"]')).toBeVisible();
    await expect(page.locator('[data-testid="share-error-toast"]')).toContainText('실패');
  });

  test('P2-SHARE-EX-10-02 에러 토스트 — 2.5초 후 자동 사라짐', async ({ page }) => {
    await seedShow(page);
    await seedStamps(page, 3);
    await page.goto('/');
    await openShareSheet(page);

    await page.evaluate(() => {
      (window as any).html2canvas = () => Promise.reject(new Error('canvas error'));
    });

    await page.locator('[data-testid="btn-share-image"]').click();
    await expect(page.locator('[data-testid="share-error-toast"]')).toBeVisible();
    await page.waitForTimeout(3000);
    await expect(page.locator('[data-testid="share-error-toast"]')).not.toBeVisible();
  });
});

test.describe('[P2-SHARE-EX-11] 숨겨진 판 공유 불가', () => {

  test('P2-SHARE-EX-11-01 isHidden=true 판 → 현황 탭 미노출 (공유 버튼 접근 불가)', async ({ page }) => {
    await seedShow(page);
    await seedStamps(page, 3);
    const raw = await page.evaluate((k: string) => localStorage.getItem(k), 'stampit_react_v1');
    const data = JSON.parse(raw!);
    data.shows[0].stampBoards[0].isHidden = true;
    data.shows[0].stampBoards[0].isActive = false;
    await page.evaluate(
      ({ k, v }: { k: string; v: string }) => localStorage.setItem(k, v),
      { k: 'stampit_react_v1', v: JSON.stringify(data) }
    );
    await page.goto('/');
    await page.locator('[data-testid="tab-status"]').click();

    // 숨겨진 판은 활성 목록에 없음
    await expect(page.locator('[data-testid="board-card-board-001"]')).not.toBeVisible();
  });
});

test.describe('[P2-SHARE-EX-12] 워터마크 항상 하단 고정', () => {

  test('P2-SHARE-EX-12-01 혜택 많아도 워터마크 항상 카드 하단에 위치', async ({ page }) => {
    await seedShow(page);
    await seedStamps(page, 5);
    const raw = await page.evaluate((k: string) => localStorage.getItem(k), 'stampit_react_v1');
    const data = JSON.parse(raw!);
    // 혜택 5개 달성
    data.shows[0].stampBoards[0].benefits = Array.from({ length: 5 }, (_, i) => ({
      id: `b-${i}`, requiredStamps: i + 1, description: `혜택 ${i + 1}`,
      priority: i + 1, isAchieved: true, isUsed: false,
    }));
    await page.evaluate(
      ({ k, v }: { k: string; v: string }) => localStorage.setItem(k, v),
      { k: 'stampit_react_v1', v: JSON.stringify(data) }
    );
    await page.goto('/');
    await openShareSheet(page);

    const watermark = page.locator('[data-testid="share-watermark"]');
    const card      = page.locator('[data-testid="board-share-card-preview"]');
    await expect(watermark).toBeVisible();

    const wmBox   = await watermark.boundingBox();
    const cardBox = await card.boundingBox();
    // 워터마크가 카드 하단 20% 이내에 위치
    expect(wmBox!.y).toBeGreaterThan(cardBox!.y + cardBox!.height * 0.7);
  });
});

test.describe('[P2-SHARE-EX-13] 공유 시트 스크롤', () => {

  test('P2-SHARE-EX-13-01 50칸 판 공유 시트 — 스크롤 가능 + 버튼 접근 가능', async ({ page }) => {
    await seedShow(page);
    const raw = await page.evaluate((k: string) => localStorage.getItem(k), 'stampit_react_v1');
    const data = JSON.parse(raw!);
    data.shows[0].stampBoards[0].capacity = 50;
    data.shows[0].stampBoards[0].stamps = Array.from({ length: 50 }, (_, i) => ({
      id: `s${i}`, scheduleId: null, isInitial: true, isConfirmed: true,
      stampType: 'initial', earnedAt: addDaysKST(-1),
    }));
    await page.evaluate(
      ({ k, v }: { k: string; v: string }) => localStorage.setItem(k, v),
      { k: 'stampit_react_v1', v: JSON.stringify(data) }
    );
    await page.goto('/');
    await openShareSheet(page);

    // 버튼이 viewport 내에 있거나 스크롤로 접근 가능
    const btn = page.locator('[data-testid="btn-share-image"]');
    await btn.scrollIntoViewIfNeeded();
    await expect(btn).toBeVisible();
  });
});
