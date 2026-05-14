# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: p1.spec.ts >> P1-02 확정 시트 재관람·초과 >> P1-02-03 판 꽉 찼을 때 초과 경고
- Location: tests\p1.spec.ts:72:3

# Error details

```
Test timeout of 15000ms exceeded.
```

```
Error: locator.tap: Test timeout of 15000ms exceeded.
Call log:
  - waiting for getByTestId('schedule-card').first()

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - generic [ref=e5]:
    - button "테스트 공연" [ref=e7]: 테스트 공연
    - button "공연 추가" [ref=e9]:
      - img [ref=e10]
  - generic [ref=e13]:
    - button "캘린더 뷰로 전환" [ref=e15]:
      - img [ref=e16]
    - generic [ref=e20]:
      - generic [ref=e22]:
        - generic [ref=e24]: 오늘 · 테스트 공연
        - generic [ref=e25]:
          - generic [ref=e26]:
            - paragraph [ref=e27]: R석 · 재관람
            - paragraph [ref=e28]: 1판 +1도장 배분 예정
          - paragraph [ref=e29]: 100,000원
        - paragraph [ref=e31]: 📋 재관람표를 챙기세요
        - button "확정하기" [ref=e32]
      - generic [ref=e33]:
        - generic [ref=e34]: 도장판
        - button "+ 새 판" [ref=e35]
      - button "🧮 빠른 계산기" [ref=e37]:
        - generic [ref=e38]:
          - generic [ref=e39]: 🧮
          - generic [ref=e40]: 빠른 계산기
        - img [ref=e41]
      - generic [ref=e44]:
        - generic [ref=e45]: 상태
        - generic [ref=e46]:
          - button "전체" [ref=e47]
          - button "미확정 1" [ref=e48]:
            - text: 미확정
            - generic [ref=e49]: "1"
          - button "확정" [ref=e50]
      - generic [ref=e53]:
        - generic [ref=e54]:
          - generic [ref=e56]: 5.14 (목)
          - generic [ref=e57]:
            - generic [ref=e58]: 재관람
            - button "더보기 메뉴" [ref=e59]:
              - img [ref=e60]
        - generic [ref=e65]:
          - paragraph [ref=e67]: R석 · 재관람
          - paragraph [ref=e69]: 100,000원
        - button "확정하기" [ref=e71]
    - button "일정 추가" [ref=e72]: +
  - navigation [ref=e73]:
    - generic [ref=e74]:
      - button "플래너" [active] [ref=e75]:
        - img [ref=e77]
        - generic [ref=e79]: 플래너
      - button "현황" [ref=e80]:
        - img [ref=e82]
        - generic [ref=e92]: 현황
      - button "설정" [ref=e93]:
        - img [ref=e95]
        - generic [ref=e99]: 설정
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | import {
  3   |   seedShow,
  4   |   seedSchedule,
  5   |   clearStorage,
  6   |   setStorage,
  7   |   getStorage,
  8   |   todayKST,
  9   |   addDaysKST,
  10  | } from './utils/helpers';
  11  | 
  12  | // ────────────────────────────────────────────────────────────────
  13  | // P1-01  확정 시트 — 멀티플라이어 선택 & 도장 배분
  14  | // ────────────────────────────────────────────────────────────────
  15  | test.describe('P1-01 확정 시트 멀티플라이어', () => {
  16  |   async function openConfirmSheet(page: Parameters<Parameters<typeof test>[1]>[0]) {
  17  |     await seedShow(page);
  18  |     await seedSchedule(page, { status: 'draft' });
  19  |     await page.goto('/');
  20  |     await page.getByTestId('tab-planner').tap();
  21  |     await page.getByTestId('schedule-card').first().tap();
  22  |     await page.getByTestId('btn-confirm').tap();
  23  |     await expect(page.getByTestId('bottomsheet-confirm')).toBeVisible();
  24  |   }
  25  | 
  26  |   test('P1-01-01 확정 시트 열기', async ({ page }) => {
  27  |     await openConfirmSheet(page);
  28  |   });
  29  | 
  30  |   test('P1-01-02 멀티플라이어 2 선택', async ({ page }) => {
  31  |     await openConfirmSheet(page);
  32  |     await expect(page.getByTestId('multiplier-2')).toBeVisible();
  33  |     await page.getByTestId('multiplier-2').tap();
  34  |     await expect(page.getByTestId('multiplier-2')).toHaveClass(/selected|ring|bg-indigo/);
  35  |   });
  36  | 
  37  |   test('P1-01-03 도장판 선택 후 확정', async ({ page }) => {
  38  |     await openConfirmSheet(page);
  39  |     await page.getByTestId('multiplier-2').tap();
  40  |     await page.getByTestId('select-board-board-001').tap();
  41  |     await page.getByTestId('btn-confirm-submit').tap();
  42  |     const shows = await getStorage<Record<string, unknown>[]>(page, 'stampit:shows');
  43  |     const sched = (shows?.[0]?.['schedules'] as Record<string, unknown>[])?.[0];
  44  |     expect(sched?.['multiplier']).toBe(2);
  45  |     expect(sched?.['status']).toBe('confirmed');
  46  |   });
  47  | });
  48  | 
  49  | // ────────────────────────────────────────────────────────────────
  50  | // P1-02  확정 시트 — 재관람 체크 & 초과 경고
  51  | // ────────────────────────────────────────────────────────────────
  52  | test.describe('P1-02 확정 시트 재관람·초과', () => {
  53  |   async function openRebookConfirmSheet(page: Parameters<Parameters<typeof test>[1]>[0]) {
  54  |     await seedShow(page);
  55  |     await seedSchedule(page, { discountTypeId: 'disc-rebook', status: 'draft' });
  56  |     await page.goto('/');
  57  |     await page.getByTestId('tab-planner').tap();
> 58  |     await page.getByTestId('schedule-card').first().tap();
      |                                                     ^ Error: locator.tap: Test timeout of 15000ms exceeded.
  59  |     await page.getByTestId('btn-confirm').tap();
  60  |     await expect(page.getByTestId('bottomsheet-confirm')).toBeVisible();
  61  |   }
  62  | 
  63  |   test('P1-02-01 재관람 할인 스케줄 시트 열기', async ({ page }) => {
  64  |     await openRebookConfirmSheet(page);
  65  |   });
  66  | 
  67  |   test('P1-02-02 재관람 체크박스 표시 확인', async ({ page }) => {
  68  |     await openRebookConfirmSheet(page);
  69  |     await expect(page.getByTestId('checkbox-rebook')).toBeVisible();
  70  |   });
  71  | 
  72  |   test('P1-02-03 판 꽉 찼을 때 초과 경고', async ({ page }) => {
  73  |     await openRebookConfirmSheet(page);
  74  |     await page.getByTestId('select-board-board-001').tap();
  75  |     await expect(page.getByTestId('bottomsheet-confirm')).toBeVisible();
  76  |   });
  77  | });
  78  | 
  79  | // ────────────────────────────────────────────────────────────────
  80  | // P1-03  혜택 달성 모달
  81  | // ────────────────────────────────────────────────────────────────
  82  | test.describe('P1-03 혜택 달성 모달', () => {
  83  |   test('P1-03-01 5번째 도장으로 혜택 달성 모달 표시', async ({ page }) => {
  84  |     await seedShow(page);
  85  |     // 4 stamps already in board-001
  86  |     await seedSchedule(page, { status: 'draft' });
  87  |     // Manually set board stamps to 4
  88  |     await page.evaluate(() => {
  89  |       const raw = localStorage.getItem('stampit_react_v1');
  90  |       if (!raw) return;
  91  |       const data = JSON.parse(raw);
  92  |       const show = data.shows.find((s: Record<string, unknown>) => s.id === 'show-001');
  93  |       if (!show) return;
  94  |       const board = show.stampBoards.find((b: Record<string, unknown>) => b.id === 'board-001');
  95  |       if (!board) return;
  96  |       board.stamps = Array.from({ length: 4 }, (_, i) => ({
  97  |         id: `stamp-${i}`, scheduleId: `sched-pre-${i}`, isInitial: false, isConfirmed: true, earnedAt: '2026-01-01T00:00:00.000Z'
  98  |       }));
  99  |       localStorage.setItem('stampit_react_v1', JSON.stringify(data));
  100 |     });
  101 |     await page.goto('/');
  102 |     await page.getByTestId('tab-planner').tap();
  103 |     await page.getByTestId('schedule-card').first().tap();
  104 |     await page.getByTestId('btn-confirm').tap();
  105 |     await page.getByTestId('select-board-board-001').tap();
  106 |     await page.getByTestId('btn-confirm-submit').tap();
  107 |     await expect(page.getByTestId('modal-benefit-achieved')).toBeVisible({ timeout: 5000 });
  108 |   });
  109 | 
  110 |   test('P1-03-02 계속 사용 버튼', async ({ page }) => {
  111 |     await seedShow(page);
  112 |     await seedSchedule(page, { status: 'draft' });
  113 |     await page.evaluate(() => {
  114 |       const raw = localStorage.getItem('stampit_react_v1');
  115 |       if (!raw) return;
  116 |       const data = JSON.parse(raw);
  117 |       const show = data.shows.find((s: Record<string, unknown>) => s.id === 'show-001');
  118 |       if (!show) return;
  119 |       const board = show.stampBoards.find((b: Record<string, unknown>) => b.id === 'board-001');
  120 |       if (!board) return;
  121 |       board.stamps = Array.from({ length: 4 }, (_, i) => ({
  122 |         id: `stamp-${i}`, scheduleId: `sched-pre-${i}`, isInitial: false, isConfirmed: true, earnedAt: '2026-01-01T00:00:00.000Z'
  123 |       }));
  124 |       localStorage.setItem('stampit_react_v1', JSON.stringify(data));
  125 |     });
  126 |     await page.goto('/');
  127 |     await page.getByTestId('tab-planner').tap();
  128 |     await page.getByTestId('schedule-card').first().tap();
  129 |     await page.getByTestId('btn-confirm').tap();
  130 |     await page.getByTestId('select-board-board-001').tap();
  131 |     await page.getByTestId('btn-confirm-submit').tap();
  132 |     await expect(page.getByTestId('modal-benefit-achieved')).toBeVisible({ timeout: 5000 });
  133 |     await page.getByTestId('btn-benefit-continue').tap();
  134 |     await expect(page.getByTestId('modal-benefit-achieved')).not.toBeVisible();
  135 |   });
  136 | });
  137 | 
  138 | // ────────────────────────────────────────────────────────────────
  139 | // P1-04  티켓 변경 시트
  140 | // ────────────────────────────────────────────────────────────────
  141 | test.describe('P1-04 티켓 변경 시트', () => {
  142 |   test('P1-04-01 티켓 변경 시트 열기', async ({ page }) => {
  143 |     await seedShow(page);
  144 |     await seedSchedule(page, { status: 'confirmed', isConfirmed: true, finalPrice: 100000 });
  145 |     await page.goto('/');
  146 |     await page.getByTestId('tab-planner').tap();
  147 |     await page.getByTestId('schedule-card').first().tap();
  148 |     await page.getByTestId('btn-more').tap();
  149 |     await page.getByTestId('menu-ticket-change').tap();
  150 |     await expect(page.getByTestId('bottomsheet-ticket-change')).toBeVisible();
  151 |   });
  152 | 
  153 |   test('P1-04-02 할인 변경 선택', async ({ page }) => {
  154 |     await seedShow(page);
  155 |     await seedSchedule(page, { status: 'confirmed', isConfirmed: true, finalPrice: 100000 });
  156 |     await page.goto('/');
  157 |     await page.getByTestId('tab-planner').tap();
  158 |     await page.getByTestId('schedule-card').first().tap();
```