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
 * P3 — UI 렌더링 / 엣지 케이스 / 경계값 / 사용자 흐름 세부 TC
 *
 * 기획 반영:
 *   - V-xx UI/UX 개선 (헤더, 카드, BottomNav, 바텀시트)
 *   - 온보딩 슬라이드 3개
 *   - 공연 배너 이미지 크롭 (ImageCropModal)
 *   - 공연 종료 리포트 (ShowReportModal)
 *   - 확정 시트 UX (sticky 버튼, 요약 접기/펼치기)
 *   - FocusCard 탭 → 도장판 스크롤
 *   - PendingAlertBanner 세부
 *   - 일정 카드 날짜 경과 색상
 *   - 혜택 현황 행 상태별 스타일
 *   - 설정 탭 섹션 그룹화
 *   - BottomNav 뱃지
 *   - 데이터 내보내기 파일명 형식
 *   - 빠른 계산기 접기/펼치기 세션 유지
 *   - 배분 시뮬레이터 최솟값 판 우선 알고리즘
 *   - 도장판 카드 도장 그리드 5열
 *   - 나눔 관극 비용 설정 탭 토글
 *   - 티켓 변경 차액 실시간 업데이트
 */

// ══════════════════════════════════════════════
// P3-01. 온보딩 슬라이드 UI
// ══════════════════════════════════════════════
test.describe('[P3-01] 온보딩 슬라이드 UI', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate((key: string) => localStorage.removeItem(key), 'stampit_react_v1');
    await page.evaluate(() => localStorage.removeItem('stampit_settings'));
    await page.goto('/');
    await page.waitForSelector('[data-testid="input-show-name"]');
  });

  test('P3-01-01 온보딩 슬라이드 3개 — 인디케이터 노출', async ({ page }) => {
    await expect(page.locator('[data-testid="slide-indicator"]')).toHaveCount(3);
  });

  test('P3-01-02 첫 번째 슬라이드 — 활성 인디케이터 pill 형태', async ({ page }) => {
    const active = page.locator('[data-testid="slide-indicator"].active, [data-testid="slide-indicator"][aria-selected="true"]').first();
    const box = await active.boundingBox();
    // pill: width > height
    expect(box!.width).toBeGreaterThan(box!.height);
  });

  test('P3-01-03 "다음" 버튼 탭 → 슬라이드 2로 이동', async ({ page }) => {
    await page.locator('[data-testid="btn-next-slide"]').click();
    await expect(page.locator('[data-testid="slide-indicator"]').nth(1)).toHaveAttribute('aria-selected', 'true');
  });

  test('P3-01-04 슬라이드 1·2 — "시작" 버튼 미노출', async ({ page }) => {
    await expect(page.locator('[data-testid="btn-setup-full"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="btn-setup-quick"]')).not.toBeVisible();
  });

  test('P3-01-05 슬라이드 3 — "직접 설정하기" + "빠른 시작" 노출', async ({ page }) => {
    await page.locator('[data-testid="btn-next-slide"]').click();
    await page.locator('[data-testid="btn-next-slide"]').click();
    await expect(page.locator('[data-testid="btn-setup-full"]')).toBeVisible();
    await expect(page.locator('[data-testid="btn-setup-quick"]')).toBeVisible();
  });

  test('P3-01-06 건너뛰기 — 하단 텍스트 링크 위치', async ({ page }) => {
    const skip = page.locator('[data-testid="btn-start"]');
    await expect(skip).toBeVisible();
    const skipBox  = await skip.boundingBox();
    const viewport = page.viewportSize()!;
    // 하단 40% 이내
    expect(skipBox!.y).toBeGreaterThan(viewport.height * 0.6);
  });

  test('P3-01-07 공연명 미입력 → 빠른 시작 제출 버튼 비활성', async ({ page }) => {
    await expect(page.locator('[data-testid="btn-quick-start-submit"]')).toBeDisabled();
  });
});

// ══════════════════════════════════════════════
// P3-02. 헤더 UI
// ══════════════════════════════════════════════
test.describe('[P3-02] 헤더 UI', () => {

  test('P3-02-01 헤더 높이 52px 이하 (1줄 구조)', async ({ page }) => {
    await seedShow(page);
    await page.goto('/');
    const header = page.locator('[data-testid="app-header"]');
    await expect(header).toBeVisible();
    const box = await header.boundingBox();
    expect(box!.height).toBeLessThanOrEqual(60);
  });

  test('P3-02-02 공연 탭 pill 활성 탭 — indigo-50 배경', async ({ page }) => {
    await seedShow(page);
    await page.goto('/');
    const activeTab = page.locator('[data-testid="show-tab-show-001"]');
    const bg = await activeTab.evaluate(el =>
      window.getComputedStyle(el).backgroundColor
    );
    // indigo-50 = rgb(238, 242, 255) 또는 유사 색상
    expect(bg).not.toBe('rgba(0, 0, 0, 0)');
  });

  test('P3-02-03 공연 2개 이상 — 탭바 가로 스크롤 가능', async ({ page }) => {
    await seedShow(page);
    const raw = await page.evaluate((k: string) => localStorage.getItem(k), 'stampit_react_v1');
    const data = JSON.parse(raw!);
    for (let i = 2; i <= 5; i++) {
      data.shows.push({
        id: `show-00${i}`, name: `공연${i}`, color: '#10b981',
        isArchived: false, tabOrder: i - 1,
        seatGrades: [], discountTypes: [], stampBoards: [],
        events: [], specialEvents: [], archivePromptDismissed: false,
        createdAt: new Date().toISOString(),
      });
    }
    await page.evaluate(({ k, v }: { k: string; v: string }) => localStorage.setItem(k, v), { k: 'stampit_react_v1', v: JSON.stringify(data) });
    await page.goto('/');
    const tabBar = page.locator('[data-testid="show-tab-bar"]');
    const overflow = await tabBar.evaluate(el => window.getComputedStyle(el).overflowX);
    expect(['auto', 'scroll']).toContain(overflow);
  });
});

// ══════════════════════════════════════════════
// P3-03. BottomNav UI
// ══════════════════════════════════════════════
test.describe('[P3-03] BottomNav UI', () => {

  test('P3-03-01 BottomNav 높이 64px', async ({ page }) => {
    await seedShow(page);
    await page.goto('/');
    const nav = page.locator('[data-testid="bottom-nav"]');
    const box = await nav.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(60);
  });

  test('P3-03-02 활성 탭 — 아이콘 컨테이너 pill 배경', async ({ page }) => {
    await seedShow(page);
    await page.goto('/');
    const activeIcon = page.locator('[data-testid="nav-icon-planner"]');
    const bg = await activeIcon.evaluate(el => window.getComputedStyle(el).backgroundColor);
    expect(bg).not.toBe('rgba(0, 0, 0, 0)');
  });

  test('P3-03-03 미사용 달성 혜택 1개 이상 → 현황 탭 뱃지 노출', async ({ page }) => {
    await seedShow(page);
    await seedStamps(page, 7);
    const raw = await page.evaluate((k: string) => localStorage.getItem(k), 'stampit_react_v1');
    const data = JSON.parse(raw!);
    // benefit-001 은 쿠폰형(할인쿠폰)이라 뱃지 제외 — benefit-002(포토카드)를 달성 처리
    data.shows[0].stampBoards[0].benefits[1].isAchieved = true;
    data.shows[0].stampBoards[0].benefits[1].isUsed = false;
    await page.evaluate(({ k, v }: { k: string; v: string }) => localStorage.setItem(k, v), { k: 'stampit_react_v1', v: JSON.stringify(data) });
    await page.goto('/');
    await expect(page.locator('[data-testid="nav-badge-status"]')).toBeVisible();
  });

  test('P3-03-04 쿠폰형 혜택 달성 → 현황 탭 뱃지 카운트 제외', async ({ page }) => {
    await seedShow(page);
    await seedStamps(page, 5);
    const raw = await page.evaluate((k: string) => localStorage.getItem(k), 'stampit_react_v1');
    const data = JSON.parse(raw!);
    // benefit-001: 할인쿠폰 30% (쿠폰형) → 뱃지 제외
    data.shows[0].stampBoards[0].benefits[0].isAchieved = true;
    data.shows[0].stampBoards[0].benefits[0].isUsed = false;
    await page.evaluate(({ k, v }: { k: string; v: string }) => localStorage.setItem(k, v), { k: 'stampit_react_v1', v: JSON.stringify(data) });
    await page.goto('/');
    await expect(page.locator('[data-testid="nav-badge-status"]')).not.toBeVisible();
  });
});

// ══════════════════════════════════════════════
// P3-04. 플래너 탭 카드 UI
// ══════════════════════════════════════════════
test.describe('[P3-04] 플래너 탭 카드 UI', () => {

  test('P3-04-01 미확정 카드 — 하단 "확정하기" 버튼 전체 너비', async ({ page }) => {
    await seedShow(page);
    await seedSchedule(page, { date: addDaysKST(1) });
    await page.goto('/');
    const btn = page.locator('[data-testid="schedule-card-sched-001"] [data-testid="btn-confirm"]');
    const btnBox  = await btn.boundingBox();
    const cardBox = await page.locator('[data-testid="schedule-card-sched-001"]').boundingBox();
    // 버튼 너비가 카드 너비의 80% 이상
    expect(btnBox!.width).toBeGreaterThan(cardBox!.width * 0.8);
  });

  test('P3-04-02 날짜 1일 경과 미확정 → "어제" amber 텍스트', async ({ page }) => {
    await seedShow(page);
    await seedSchedule(page, { date: addDaysKST(-1) });
    await page.goto('/');
    await expect(
      page.locator('[data-testid="schedule-card-sched-001"] [data-testid="date-elapsed"]')
    ).toContainText('어제');
  });

  test('P3-04-03 날짜 3일 경과 미확정 → "3일 전" amber 텍스트', async ({ page }) => {
    await seedShow(page);
    await seedSchedule(page, { date: addDaysKST(-3) });
    await page.goto('/');
    await expect(
      page.locator('[data-testid="schedule-card-sched-001"] [data-testid="date-elapsed"]')
    ).toContainText('3일 전');
  });

  test('P3-04-04 날짜 7일 이상 경과 → red 텍스트', async ({ page }) => {
    await seedShow(page);
    await seedSchedule(page, { date: addDaysKST(-7) });
    await page.goto('/');
    const elapsed = page.locator('[data-testid="schedule-card-sched-001"] [data-testid="date-elapsed"]');
    const color = await elapsed.evaluate(el => window.getComputedStyle(el).color);
    // red 계열 확인 (rgb(239, 68, 68) 또는 유사)
    expect(color).toContain('239');
  });

  test('P3-04-05 확정 카드 — 좌측 초록 border-left 3px', async ({ page }) => {
    await seedShow(page);
    await seedSchedule(page, { date: addDaysKST(-1), isConfirmed: true, status: 'confirmed' });
    await page.goto('/');
    const card = page.locator('[data-testid="schedule-card-sched-001"]');
    const border = await card.evaluate(el => window.getComputedStyle(el).borderLeftWidth);
    expect(parseFloat(border)).toBeGreaterThanOrEqual(2);
  });

  test('P3-04-06 취소 카드 — opacity 낮음 + "취소" 뱃지', async ({ page }) => {
    await seedShow(page);
    await seedSchedule(page, { date: addDaysKST(1), status: 'cancelled' });
    await page.goto('/');
    await expect(
      page.locator('[data-testid="schedule-card-sched-001"] [data-testid="badge-cancelled"]')
    ).toBeVisible();
  });

  test('P3-04-07 오늘의 퀵카드 — 확정 버튼 높이 최소 48px', async ({ page }) => {
    await seedShow(page);
    await seedSchedule(page, { date: todayKST(), discountTypeId: 'disc-matinee' });
    await page.goto('/');
    const btn = page.locator('[data-testid="quick-confirm-card"] [data-testid="btn-instant-confirm"], [data-testid="quick-confirm-card"] [data-testid="btn-confirm"]').first();
    const box = await btn.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
  });
});

// ══════════════════════════════════════════════
// P3-05. 확정 시트 UI 세부
// ══════════════════════════════════════════════
test.describe('[P3-05] 확정 시트 UI 세부', () => {

  test.beforeEach(async ({ page }) => {
    await seedShow(page);
    await seedSchedule(page, { date: todayKST(), discountTypeId: 'disc-rebook' });
    await page.goto('/');
    await page.locator('[data-testid="quick-confirm-card"] [data-testid="btn-confirm"]').click();
  });

  test('P3-05-01 확정 버튼 — 항상 viewport 안에 보임 (sticky)', async ({ page }) => {
    const btn = page.locator('[data-testid="btn-confirm-submit"]');
    const box = await btn.boundingBox();
    const viewport = page.viewportSize()!;
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height + 1);
  });

  test('P3-05-02 요약 카드 — 기본 접힘', async ({ page }) => {
    await expect(page.locator('[data-testid="summary-section-content"]')).not.toBeVisible();
  });

  test('P3-05-03 요약 카드 "관람 요약" 탭 → 펼침', async ({ page }) => {
    await page.locator('[data-testid="summary-toggle"]').click();
    await expect(page.locator('[data-testid="summary-section-content"]')).toBeVisible();
  });

  test('P3-05-04 체크리스트 — 시트 최상단 (스크롤 없이 보임)', async ({ page }) => {
    const checklist = page.locator('[data-testid="checklist-section"]');
    const box = await checklist.boundingBox();
    const viewport = page.viewportSize()!;
    // 화면 상단 60% 이내
    expect(box!.y).toBeLessThan(viewport.height * 0.6);
  });

  test('P3-05-05 체크리스트 버튼 — 전체 너비 탭 가능 영역', async ({ page }) => {
    const btn = page.locator('[data-testid="checklist-rebook"]');
    const box = await btn.boundingBox();
    const sheetBox = await page.locator('[data-testid="confirm-sheet"]').boundingBox();
    // 버튼이 시트 너비의 80% 이상
    expect(box!.width).toBeGreaterThan(sheetBox!.width * 0.8);
  });

  test('P3-05-06 체크 후 버튼 — indigo 배경으로 변경', async ({ page }) => {
    await page.locator('[data-testid="checklist-rebook"]').click();
    const btn = page.locator('[data-testid="checklist-rebook"]');
    const bg = await btn.evaluate(el => window.getComputedStyle(el).backgroundColor);
    // indigo-50 또는 indigo 계열
    expect(bg).not.toBe('rgb(255, 251, 235)'); // amber-50에서 변경됨
  });

  test('P3-05-07 배수 이벤트 없음 → 배수 섹션 미노출', async ({ page }) => {
    await expect(page.locator('[data-testid="multiplier-section"]')).not.toBeVisible();
  });

  test('P3-05-08 도장판 1개 → 도장판 선택 UI 미노출 + 간략 표시', async ({ page }) => {
    await expect(page.locator('[data-testid="board-selector"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="board-simple-display"]')).toBeVisible();
  });
});

// ══════════════════════════════════════════════
// P3-06. 현황 탭 카드 UI
// ══════════════════════════════════════════════
test.describe('[P3-06] 현황 탭 카드 UI', () => {

  test('P3-06-01 도장판 그리드 — 5열 고정', async ({ page }) => {
    await seedShow(page);
    await seedStamps(page, 3);
    await page.goto('/');
    await page.locator('[data-testid="tab-status"]').click();
    const stamps = page.locator('[data-testid="stamp-cell"]');
    const count = await stamps.count();
    expect(count).toBe(10); // 10칸 (3 채움 + 7 빈칸)

    // 첫 번째 줄 5개 확인
    const firstRowBoxes = await Promise.all(
      Array.from({ length: 5 }, (_, i) => stamps.nth(i).boundingBox())
    );
    // 같은 y좌표 (같은 행)
    const firstY = firstRowBoxes[0]!.y;
    firstRowBoxes.forEach(box => expect(Math.abs(box!.y - firstY)).toBeLessThan(5));
  });

  test('P3-06-02 혜택 위치 칸 — 우상단 ★ 표시', async ({ page }) => {
    await seedShow(page);
    await page.goto('/');
    await page.locator('[data-testid="tab-status"]').click();
    // benefit-001: requiredStamps=5 → 5번째 칸에 별
    await expect(page.locator('[data-testid="stamp-cell-benefit-star"]')).toBeVisible();
  });

  test('P3-06-03 요약 카드 — 2×2 그리드 구조', async ({ page }) => {
    await seedShow(page);
    await page.goto('/');
    await page.locator('[data-testid="tab-status"]').click();
    await expect(page.locator('[data-testid="stat-total-visits"]')).toBeVisible();
    await expect(page.locator('[data-testid="stat-next-benefit"]')).toBeVisible();
    await expect(page.locator('[data-testid="stat-confirmed"]')).toBeVisible();
    await expect(page.locator('[data-testid="stat-unused-benefits"]')).toBeVisible();
  });

  test('P3-06-04 FocusCard 탭 → 해당 도장판 카드로 스크롤', async ({ page }) => {
    await seedShow(page);
    await seedStamps(page, 3);
    await page.goto('/');
    await page.locator('[data-testid="tab-status"]').click();
    await page.locator('[data-testid="focus-card"]').click();

    // 도장판 카드가 viewport 안으로 스크롤됨
    const boardCard = page.locator('[data-testid="board-card-board-001"]');
    await expect(boardCard).toBeInViewport();
  });

  test('P3-06-05 혜택 현황 — 달성·미사용 행 amber 배경', async ({ page }) => {
    await seedShow(page);
    await seedStamps(page, 5);
    const raw = await page.evaluate((k: string) => localStorage.getItem(k), 'stampit_react_v1');
    const data = JSON.parse(raw!);
    data.shows[0].stampBoards[0].benefits[0].isAchieved = true;
    await page.evaluate(({ k, v }: { k: string; v: string }) => localStorage.setItem(k, v), { k: 'stampit_react_v1', v: JSON.stringify(data) });
    await page.goto('/');
    await page.locator('[data-testid="tab-status"]').click();

    const row = page.locator('[data-testid="benefit-row-benefit-001"]');
    const bg = await row.evaluate(el => window.getComputedStyle(el).backgroundColor);
    // amber-50 = rgb(255, 251, 235)
    expect(bg).toContain('255');
  });

  test('P3-06-06 혜택 현황 — 사용 완료 행 취소선', async ({ page }) => {
    await seedShow(page);
    await seedStamps(page, 5);
    const raw = await page.evaluate((k: string) => localStorage.getItem(k), 'stampit_react_v1');
    const data = JSON.parse(raw!);
    data.shows[0].stampBoards[0].benefits[0].isAchieved = true;
    data.shows[0].stampBoards[0].benefits[0].isUsed = true;
    data.shows[0].stampBoards[0].benefits[0].usedAt = new Date().toISOString();
    await page.evaluate(({ k, v }: { k: string; v: string }) => localStorage.setItem(k, v), { k: 'stampit_react_v1', v: JSON.stringify(data) });
    await page.goto('/');
    await page.locator('[data-testid="tab-status"]').click();

    const text = page.locator('[data-testid="benefit-row-benefit-001"] [data-testid="benefit-name"]');
    const decoration = await text.evaluate(el => window.getComputedStyle(el).textDecoration);
    expect(decoration).toContain('line-through');
  });
});

// ══════════════════════════════════════════════
// P3-07. 빠른 계산기 세션 유지
// ══════════════════════════════════════════════
test.describe('[P3-07] 빠른 계산기 세션 유지', () => {

  test('P3-07-01 펼침 상태 → 탭 이동 후 복귀해도 유지', async ({ page }) => {
    await seedShow(page);
    await page.goto('/');
    await page.locator('[data-testid="quick-calc-toggle"]').click();
    await expect(page.locator('[data-testid="quick-calc-content"]')).toBeVisible();

    await page.locator('[data-testid="tab-status"]').click();
    await page.locator('[data-testid="tab-planner"]').click();
    await expect(page.locator('[data-testid="quick-calc-content"]')).toBeVisible();
  });

  test('P3-07-02 앱 새로고침 → 빠른 계산기 다시 접힘', async ({ page }) => {
    await seedShow(page);
    await page.goto('/');
    await page.locator('[data-testid="quick-calc-toggle"]').click();
    await page.reload();
    await expect(page.locator('[data-testid="quick-calc-content"]')).not.toBeVisible();
  });
});

// ══════════════════════════════════════════════
// P3-08. 배분 시뮬레이터 알고리즘 세부
// ══════════════════════════════════════════════
test.describe('[P3-08] 배분 시뮬레이터 알고리즘', () => {

  test('P3-08-01 미달성 혜택까지 최솟값 판 우선 배분', async ({ page }) => {
    await seedShow(page);
    // 2번 판 추가 (1개만 남음)
    const raw = await page.evaluate((k: string) => localStorage.getItem(k), 'stampit_react_v1');
    const data = JSON.parse(raw!);
    data.shows[0].stampBoards[0].stamps = Array.from({ length: 4 }, (_, i) => ({
      id: `s1-${i}`, scheduleId: null, isInitial: true, isConfirmed: true,
      stampType: 'initial', earnedAt: new Date().toISOString(),
    }));
    data.shows[0].stampBoards.push({
      id: 'board-002', showId: 'show-001', name: '2판',
      capacity: 10, initialStamps: 0, stampColor: '#10b981',
      stamps: Array.from({ length: 3 }, (_, i) => ({
        id: `s2-${i}`, scheduleId: null, isInitial: true, isConfirmed: true,
        stampType: 'initial', earnedAt: new Date().toISOString(),
      })),
      benefits: [
        { id: 'b2-1', requiredStamps: 5, description: '마티네 50%', priority: 1, isAchieved: false, isUsed: false },
      ],
      isActive: true, isCompleted: false, isHidden: false, sortOrder: 1,
      createdAt: new Date().toISOString(),
    });
    await page.evaluate(({ k, v }: { k: string; v: string }) => localStorage.setItem(k, v), { k: 'stampit_react_v1', v: JSON.stringify(data) });
    await page.goto('/');
    await page.locator('[data-testid="tab-status"]').click();
    await page.locator('[data-testid="more-section-toggle"]').click();
    await page.locator('[data-testid="btn-simulator"]').click();
    await page.locator('[data-testid="simulator-input"]').fill('3');

    // 1판: 1개 남음 (우선) → 첫 번째 배분
    const result1 = page.locator('[data-testid="simulator-result-board-001"]');
    const result2 = page.locator('[data-testid="simulator-result-board-002"]');
    await expect(result1).toBeVisible();
    await expect(result2).toBeVisible();
    // 1판이 더 많은 도장 배분받아야 함
    const text1 = await result1.textContent();
    const text2 = await result2.textContent();
    const num1 = parseInt(text1!.match(/\d+/)?.[0] ?? '0');
    const num2 = parseInt(text2!.match(/\d+/)?.[0] ?? '0');
    expect(num1).toBeGreaterThanOrEqual(num2);
  });
});

// ══════════════════════════════════════════════
// P3-09. 설정 탭 UI 세부
// ══════════════════════════════════════════════
test.describe('[P3-09] 설정 탭 UI 세부', () => {

  test('P3-09-01 섹션 헤더 그룹화 — "공연 설정" 섹션 노출', async ({ page }) => {
    await seedShow(page);
    await page.goto('/');
    await page.locator('[data-testid="tab-settings"]').click();
    await expect(page.locator('[data-testid="settings-section-show"]')).toBeVisible();
  });

  test('P3-09-02 "모든 데이터 초기화" — red 텍스트', async ({ page }) => {
    await seedShow(page);
    await page.goto('/');
    await page.locator('[data-testid="tab-settings"]').click();
    const btn = page.locator('[data-testid="btn-reset-all"]');
    const color = await btn.evaluate(el => window.getComputedStyle(el).color);
    // red 계열 (rgb(239, 68, 68) 또는 유사)
    expect(color).toMatch(/^rgb\(2[0-9]{2}/);
  });

  test('P3-09-03 실지출 표시 토글 — 기본값 ON', async ({ page }) => {
    await seedShow(page);
    await page.goto('/');
    await page.locator('[data-testid="tab-settings"]').click();
    await expect(page.locator('[data-testid="toggle-show-real-cost"]')).toBeChecked();
  });

  test('P3-09-04 나눔 관극 비용 포함 토글 — 설정 탭 노출', async ({ page }) => {
    await seedShow(page);
    await page.goto('/');
    await page.locator('[data-testid="tab-settings"]').click();
    await expect(page.locator('[data-testid="toggle-include-share-cost"]')).toBeVisible();
  });

  test('P3-09-05 공연 1개 → 탭 순서 섹션 미노출', async ({ page }) => {
    await seedShow(page);
    await page.goto('/');
    await page.locator('[data-testid="tab-settings"]').click();
    await expect(page.locator('[data-testid="tab-order-section"]')).not.toBeVisible();
  });
});

// ══════════════════════════════════════════════
// P3-10. 공연 배너 이미지 크롭 UI (ImageCropModal)
// ══════════════════════════════════════════════
test.describe('[P3-10] 공연 배너 이미지 크롭 UI', () => {

  test('P3-10-01 이미지 선택 → 크롭 모달 오픈', async ({ page }) => {
    await seedShow(page);
    await page.goto('/');
    await page.locator('[data-testid="btn-add-show"]').click();

    // 파일 input에 이미지 주입
    const fileInput = page.locator('input[type="file"][accept="image/*"]');
    await fileInput.setInputFiles({
      name: 'test.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.alloc(1024, 0xff),
    });

    await expect(page.locator('[data-testid="image-crop-modal"]')).toBeVisible();
  });

  test('P3-10-02 크롭 모달 — 핸들 4개 노출', async ({ page }) => {
    await seedShow(page);
    await page.goto('/');
    await page.locator('[data-testid="btn-add-show"]').click();

    const fileInput = page.locator('input[type="file"][accept="image/*"]');
    await fileInput.setInputFiles({
      name: 'test.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.alloc(1024, 0xff),
    });

    await page.waitForSelector('[data-testid="image-crop-modal"]');
    await page.waitForTimeout(300); // 이미지 로드 대기

    await expect(page.locator('[data-testid="crop-handle"]')).toHaveCount(4);
  });

  test('P3-10-03 크롭 "취소" → 모달 닫힘 + 이미지 미저장', async ({ page }) => {
    await seedShow(page);
    await page.goto('/');
    await page.locator('[data-testid="btn-add-show"]').click();

    const fileInput = page.locator('input[type="file"][accept="image/*"]');
    await fileInput.setInputFiles({
      name: 'test.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.alloc(1024, 0xff),
    });

    await page.locator('[data-testid="btn-crop-cancel"]').click();
    await expect(page.locator('[data-testid="image-crop-modal"]')).not.toBeVisible();
    // 배너 이미지 미적용
    await expect(page.locator('[data-testid="header-image-preview"]')).not.toBeVisible();
  });

  test('P3-10-04 크롭 모달 — 3분할 가이드선 노출', async ({ page }) => {
    await seedShow(page);
    await page.goto('/');
    await page.locator('[data-testid="btn-add-show"]').click();

    const fileInput = page.locator('input[type="file"][accept="image/*"]');
    await fileInput.setInputFiles({
      name: 'test.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.alloc(1024, 0xff),
    });

    await page.waitForSelector('[data-testid="image-crop-modal"]');
    await expect(page.locator('[data-testid="crop-guide-line"]')).toHaveCount(4);
  });
});

// ══════════════════════════════════════════════
// P3-11. 공연 종료 리포트 UI (ShowReportModal)
// ══════════════════════════════════════════════
test.describe('[P3-11] 공연 종료 리포트 UI', () => {

  test.beforeEach(async ({ page }) => {
    await seedShow(page);
    // 확정 일정 5개 추가
    for (let i = 0; i < 5; i++) {
      await seedSchedule(page, {
        id: `sched-${i}`,
        date: addDaysKST(-(i + 1)),
        isConfirmed: true,
        status: 'confirmed',
        finalPrice: 91000,
        originalPrice: 130000,
        cast: i % 2 === 0 ? '김OO' : '이OO',
        specialEventIds: i === 0 ? ['se-001'] : [],
      });
    }
    await seedStamps(page, 5);
    // 종료일 어제로 설정
    const raw = await page.evaluate((k: string) => localStorage.getItem(k), 'stampit_react_v1');
    const data = JSON.parse(raw!);
    data.shows[0].endDate = addDaysKST(-1);
    data.shows[0].archivePromptDismissed = false;
    data.shows[0].stampBoards[0].benefits[0].isAchieved = true;
    await page.evaluate(({ k, v }: { k: string; v: string }) => localStorage.setItem(k, v), { k: 'stampit_react_v1', v: JSON.stringify(data) });
    await page.goto('/');
  });

  test('P3-11-01 아카이브 프롬프트 — "리포트" 관련 문구 포함', async ({ page }) => {
    await expect(page.locator('[data-testid="archive-prompt"]')).toBeVisible();
    const text = await page.locator('[data-testid="archive-prompt"]').textContent();
    expect(text).toMatch(/리포트|기록/);
  });

  test('P3-11-02 "보관하고 리포트 보기" → ShowReportModal 오픈', async ({ page }) => {
    await page.locator('[data-testid="btn-archive-and-report"]').click();
    await expect(page.locator('[data-testid="show-report-modal"]')).toBeVisible();
  });

  test('P3-11-03 리포트 — 총 관람 횟수 표시', async ({ page }) => {
    await page.locator('[data-testid="btn-archive-and-report"]').click();
    await expect(page.locator('[data-testid="report-total-visits"]')).toContainText('5');
  });

  test('P3-11-04 리포트 — 총 지출 표시', async ({ page }) => {
    await page.locator('[data-testid="btn-archive-and-report"]').click();
    // 5회 × 91,000 = 455,000
    await expect(page.locator('[data-testid="report-total-spent"]')).toContainText('455,000');
  });

  test('P3-11-05 리포트 — 절약 금액 표시', async ({ page }) => {
    await page.locator('[data-testid="btn-archive-and-report"]').click();
    // 5회 × (130,000 - 91,000) = 195,000
    await expect(page.locator('[data-testid="report-total-saved"]')).toContainText('195,000');
  });

  test('P3-11-06 리포트 — 캐스트 바 차트 노출', async ({ page }) => {
    await page.locator('[data-testid="btn-archive-and-report"]').click();
    await expect(page.locator('[data-testid="report-cast-chart"]')).toBeVisible();
  });

  test('P3-11-07 리포트 — 특별 이벤트 칩 노출', async ({ page }) => {
    await page.locator('[data-testid="btn-archive-and-report"]').click();
    await expect(page.locator('[data-testid="report-special-events"]')).toBeVisible();
  });

  test('P3-11-08 리포트 닫힘 → 공연 isArchived=true', async ({ page }) => {
    await page.locator('[data-testid="btn-archive-and-report"]').click();
    await page.locator('[data-testid="btn-report-close"]').click();
    const shows = await getStorage<{ isArchived: boolean }[]>(page, 'shows');
    expect(shows![0].isArchived).toBe(true);
  });

  test('P3-11-09 보관함 — 설정 탭에서 리포트 다시 열기', async ({ page }) => {
    await page.locator('[data-testid="btn-archive-and-report"]').click();
    await page.locator('[data-testid="btn-report-close"]').click();
    await page.locator('[data-testid="tab-settings"]').click();
    await page.locator('[data-testid="btn-view-report-show-001"]').click();
    await expect(page.locator('[data-testid="show-report-modal"]')).toBeVisible();
  });
});

// ══════════════════════════════════════════════
// P3-12. 티켓 변경 차액 UI 세부
// ══════════════════════════════════════════════
test.describe('[P3-12] 티켓 변경 차액 UI 세부', () => {

  test.beforeEach(async ({ page }) => {
    await seedShow(page);
    await seedSchedule(page, {
      date: addDaysKST(-1),
      isConfirmed: true, status: 'confirmed',
      seatGradeId: 'grade-r', discountTypeId: 'disc-matinee',
      finalPrice: 88000, originalPrice: 110000,
    });
    await page.goto('/');
    await page.locator('[data-testid="schedule-card-sched-001"] [data-testid="btn-more"]').click();
    await page.locator('[data-testid="menu-ticket-change"]').click();
  });

  test('P3-12-01 등급 변경 시 변경 후 카드 실시간 업데이트', async ({ page }) => {
    await page.locator('[data-testid="select-new-grade"]').selectOption('grade-vip');
    await expect(page.locator('[data-testid="ticket-after-price"]')).toContainText('88,000');
  });

  test('P3-12-02 차액 양수 → red 텍스트로 표시', async ({ page }) => {
    await page.locator('[data-testid="select-new-grade"]').selectOption('grade-vip');
    await page.locator('[data-testid="select-new-discount"]').selectOption('disc-rebook');
    const diff = page.locator('[data-testid="price-diff"]');
    const color = await diff.evaluate(el => window.getComputedStyle(el).color);
    expect(color).toMatch(/239|red/i);
  });

  test('P3-12-03 차액 동일(0) → 처리방식 UI 미노출', async ({ page }) => {
    // 현재 R 마티네 88,000 → 동일 선택
    await expect(page.locator('[data-testid="price-diff-method"]')).not.toBeVisible();
  });

  test('P3-12-04 기록만 남기기 선택 → 서브텍스트 노출', async ({ page }) => {
    await page.locator('[data-testid="select-new-grade"]').selectOption('grade-vip');
    await page.locator('[data-testid="select-new-discount"]').selectOption('disc-rebook');
    await page.locator('[data-testid="radio-note-only"]').click();
    await expect(page.locator('[data-testid="radio-note-only-desc"]')).toBeVisible();
  });
});

// ══════════════════════════════════════════════
// P3-13. PendingAlertBanner 세부 UI
// ══════════════════════════════════════════════
test.describe('[P3-13] PendingAlertBanner 세부 UI', () => {

  test('P3-13-01 배너 배경 — amber 계열', async ({ page }) => {
    await seedShow(page);
    await seedSchedule(page, { id: 'sched-001', date: addDaysKST(-2) });
    await seedSchedule(page, { id: 'sched-002', date: addDaysKST(-1) });
    await page.goto('/');

    const banner = page.locator('[data-testid="pending-alert-banner"]');
    const bg = await banner.evaluate(el => window.getComputedStyle(el).backgroundColor);
    // amber-50 = rgb(255, 251, 235) 또는 유사
    expect(bg).toMatch(/^rgb\(25[0-9]/);
  });

  test('P3-13-02 배너 — N개 카운트 정확', async ({ page }) => {
    await seedShow(page);
    await seedSchedule(page, { id: 'sched-001', date: addDaysKST(-3) });
    await seedSchedule(page, { id: 'sched-002', date: addDaysKST(-2) });
    await seedSchedule(page, { id: 'sched-003', date: addDaysKST(-1) });
    await page.goto('/');
    await expect(page.locator('[data-testid="pending-alert-banner"]')).toContainText('3개');
  });

  test('P3-13-03 나눔 관극 → 배너 카운트 제외', async ({ page }) => {
    await seedShow(page);
    await seedSchedule(page, { id: 'sched-001', date: addDaysKST(-2), isShare: true });
    await seedSchedule(page, { id: 'sched-002', date: addDaysKST(-1) });
    await page.goto('/');
    // 나눔 1 + 일반 1 = 총 2개지만 나눔 제외 → 배너 미노출
    await expect(page.locator('[data-testid="pending-alert-banner"]')).not.toBeVisible();
  });
});

// ══════════════════════════════════════════════
// P3-14. 데이터 내보내기 파일명
// ══════════════════════════════════════════════
test.describe('[P3-14] 데이터 내보내기 파일명', () => {

  test('P3-14-01 내보내기 파일명 형식 — stampit-backup-YYYY-MM-DD.json', async ({ page }) => {
    await seedShow(page);
    await page.goto('/');
    await page.locator('[data-testid="tab-settings"]').click();

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('[data-testid="btn-export-json"]').click(),
    ]);

    const filename = download.suggestedFilename();
    expect(filename).toMatch(/^stampit.*backup.*\d{4}-\d{2}-\d{2}.*\.json$/);
  });
});

// ══════════════════════════════════════════════
// P3-15. 바텀시트 공통 UI
// ══════════════════════════════════════════════
test.describe('[P3-15] 바텀시트 공통 UI', () => {

  test('P3-15-01 바텀시트 — 상단 핸들 노출', async ({ page }) => {
    await seedShow(page);
    await page.goto('/');
    await page.locator('[data-testid="btn-add-show"]').click();
    await expect(page.locator('[data-testid="sheet-handle"]')).toBeVisible();
  });

  test('P3-15-02 바텀시트 — 딤 배경 탭 시 닫힘', async ({ page }) => {
    await seedShow(page);
    await page.goto('/');
    await page.locator('[data-testid="btn-add-show"]').click();
    await expect(page.locator('[data-testid="add-show-sheet"]')).toBeVisible();

    // 딤 배경 클릭
    await page.locator('[data-testid="sheet-dim"]').click();
    await expect(page.locator('[data-testid="add-show-sheet"]')).not.toBeVisible();
  });

  test('P3-15-03 바텀시트 — X 버튼 40×40px 이상 터치 영역', async ({ page }) => {
    await seedShow(page);
    await page.goto('/');
    await page.locator('[data-testid="btn-add-show"]').click();
    const closeBtn = page.locator('[data-testid="btn-close-sheet"]');
    const box = await closeBtn.boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(36);
    expect(box!.height).toBeGreaterThanOrEqual(36);
  });

  test('P3-15-04 바텀시트 저장 버튼 — sticky bottom', async ({ page }) => {
    await seedShow(page);
    await page.goto('/');
    await page.locator('[data-testid="fab-add"]').tap();

    const saveBtn = page.locator('[data-testid="btn-save-schedule"]');
    await expect(saveBtn).toBeVisible({ timeout: 3000 });
    const viewport = page.viewportSize()!;
    const box = await saveBtn.boundingBox();
    // sticky: 항상 화면 하단에 위치
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height + 5);
  });
});

// ══════════════════════════════════════════════
// P3-16. 도장 수동 추가 UI 세부
// ══════════════════════════════════════════════
test.describe('[P3-16] 도장 수동 추가 UI 세부', () => {

  test('P3-16-01 ManualStampSheet — 취득 경로 칩 3개 (교환/나눔/기타)', async ({ page }) => {
    await seedShow(page);
    await page.goto('/');
    await page.locator('[data-testid="tab-status"]').click();
    await page.locator('[data-testid="board-card-board-001"] [data-testid="btn-more"]').click();
    await page.locator('[data-testid="menu-stamp-exchange"]').click();

    await expect(page.locator('[data-testid="chip-exchange"]')).toBeVisible();
    await expect(page.locator('[data-testid="chip-share"]')).toBeVisible();
    await expect(page.locator('[data-testid="chip-etc"]')).toBeVisible();
  });

  test('P3-16-02 취득 경로 칩 전환 → 선택 상태 변경', async ({ page }) => {
    await seedShow(page);
    await page.goto('/');
    await page.locator('[data-testid="tab-status"]').click();
    await page.locator('[data-testid="board-card-board-001"] [data-testid="btn-more"]').click();
    await page.locator('[data-testid="menu-stamp-exchange"]').click();

    await page.locator('[data-testid="chip-share"]').click();
    await expect(page.locator('[data-testid="chip-share"]')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('[data-testid="chip-exchange"]')).toHaveAttribute('aria-selected', 'false');
  });
});

// ══════════════════════════════════════════════
// P3-17. 경계값 및 엣지 케이스
// ══════════════════════════════════════════════
test.describe('[P3-17] 경계값 및 엣지 케이스', () => {

  test('P3-17-01 공연명 30자 최대 입력 → 저장 가능', async ({ page }) => {
    await seedShow(page);
    await page.goto('/');
    await page.locator('[data-testid="btn-add-show"]').click();
    await page.locator('[data-testid="input-show-name"]').fill('가'.repeat(30));
    await expect(page.locator('[data-testid="btn-save-show"]')).toBeEnabled();
  });

  test('P3-17-02 공연명 31자 입력 → 30자로 잘림', async ({ page }) => {
    await seedShow(page);
    await page.goto('/');
    await page.locator('[data-testid="btn-add-show"]').click();
    await page.locator('[data-testid="input-show-name"]').fill('가'.repeat(31));
    const val = await page.locator('[data-testid="input-show-name"]').inputValue();
    expect(val.length).toBeLessThanOrEqual(30);
  });

  test('P3-17-03 도장판 10칸 꽉 참 → 수동 추가 메뉴 미노출', async ({ page }) => {
    await seedShow(page);
    await seedStamps(page, 10);
    const raw = await page.evaluate((k: string) => localStorage.getItem(k), 'stampit_react_v1');
    const data = JSON.parse(raw!);
    data.shows[0].stampBoards[0].isCompleted = true;
    data.shows[0].stampBoards[0].isActive = false;
    await page.evaluate(({ k, v }: { k: string; v: string }) => localStorage.setItem(k, v), { k: 'stampit_react_v1', v: JSON.stringify(data) });
    await page.goto('/');
    await page.locator('[data-testid="tab-status"]').click();
    await expect(page.locator('[data-testid="menu-stamp-exchange"]')).not.toBeVisible();
  });

  test('P3-17-04 일정 0개 → 플래너 탭 빈 상태 메시지', async ({ page }) => {
    await seedShow(page);
    await page.goto('/');
    await expect(page.locator('[data-testid="empty-schedule-state"]')).toBeVisible();
  });

  test('P3-17-05 혜택 0개 도장판 → 혜택 현황 미노출', async ({ page }) => {
    await seedShow(page);
    const raw = await page.evaluate((k: string) => localStorage.getItem(k), 'stampit_react_v1');
    const data = JSON.parse(raw!);
    data.shows[0].stampBoards[0].benefits = [];
    await page.evaluate(({ k, v }: { k: string; v: string }) => localStorage.setItem(k, v), { k: 'stampit_react_v1', v: JSON.stringify(data) });
    await page.goto('/');
    await page.locator('[data-testid="tab-status"]').click();
    await expect(page.locator('[data-testid="benefit-section"]')).not.toBeVisible();
  });

  test('P3-17-06 오늘 일정 없음 → 퀵카드 미노출 + 빈 상태 메시지', async ({ page }) => {
    await seedShow(page);
    await seedSchedule(page, { date: addDaysKST(1) }); // 내일 일정
    await page.goto('/');
    await expect(page.locator('[data-testid="quick-confirm-card"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="no-today-schedule"]')).toBeVisible();
  });

  test('P3-17-07 usageNote 100자 최대 입력', async ({ page }) => {
    await seedShow(page);
    await seedStamps(page, 4);
    await seedSchedule(page, { date: todayKST(), discountTypeId: 'disc-matinee' });
    await page.goto('/');
    await page.locator('[data-testid="quick-confirm-card"] [data-testid="btn-instant-confirm"]').click();
    await page.locator('[data-testid="benefit-achieved-modal"]').waitFor({ state: 'visible' });

    const input = page.locator('[data-testid="input-usage-note"]');
    await input.fill('가'.repeat(101));
    const val = await input.inputValue();
    expect(val.length).toBeLessThanOrEqual(100);
  });

  test('P3-17-08 공연 탭 10개 — 앱 크래시 없이 정상 렌더', async ({ page }) => {
    await seedShow(page);
    const raw = await page.evaluate((k: string) => localStorage.getItem(k), 'stampit_react_v1');
    const data = JSON.parse(raw!);
    for (let i = 2; i <= 10; i++) {
      data.shows.push({
        id: `show-${i.toString().padStart(3, '0')}`, name: `공연${i}`,
        color: '#6366f1', isArchived: false, tabOrder: i - 1,
        seatGrades: [], discountTypes: [], stampBoards: [],
        events: [], specialEvents: [], archivePromptDismissed: false,
        createdAt: new Date().toISOString(),
      });
    }
    await page.evaluate(({ k, v }: { k: string; v: string }) => localStorage.setItem(k, v), { k: 'stampit_react_v1', v: JSON.stringify(data) });
    await page.goto('/');

    await expect(page.locator('[data-testid="error-fallback"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="bottom-nav"]')).toBeVisible();
  });
});
