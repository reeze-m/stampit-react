# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: p1.spec.ts >> P1-04 티켓 변경 시트 >> P1-04-02 할인 변경 선택
- Location: tests\p1.spec.ts:153:3

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
      - generic [ref=e21]:
        - paragraph [ref=e22]: 🎭
        - paragraph [ref=e23]: 오늘 예정된 관람이 없어요
      - generic [ref=e24]:
        - generic [ref=e25]: 도장판
        - button "+ 새 판" [ref=e26]
      - button "🧮 빠른 계산기" [ref=e28]:
        - generic [ref=e29]:
          - generic [ref=e30]: 🧮
          - generic [ref=e31]: 빠른 계산기
        - img [ref=e32]
      - generic [ref=e35]:
        - generic [ref=e36]: 상태
        - generic [ref=e37]:
          - button "전체" [ref=e38]
          - button "미확정" [ref=e39]
          - button "확정 1" [ref=e40]:
            - text: 확정
            - generic [ref=e41]: "1"
      - generic [ref=e44]:
        - generic [ref=e45]:
          - generic [ref=e46]:
            - generic [ref=e47]: 5.14 (목)
            - generic [ref=e48]: ✓ 확정
          - button "더보기 메뉴" [ref=e50]:
            - img [ref=e51]
        - generic [ref=e56]:
          - paragraph [ref=e58]: R석 · 일반
          - paragraph [ref=e60]: 100,000원
    - button "일정 추가" [ref=e61]: +
  - navigation [ref=e62]:
    - generic [ref=e63]:
      - button "플래너" [active] [ref=e64]:
        - img [ref=e66]
        - generic [ref=e68]: 플래너
      - button "현황" [ref=e69]:
        - img [ref=e71]
        - generic [ref=e81]: 현황
      - button "설정" [ref=e82]:
        - img [ref=e84]
        - generic [ref=e88]: 설정
```

# Test source

```ts
  58  |     await page.getByTestId('schedule-card').first().tap();
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
> 158 |     await page.getByTestId('schedule-card').first().tap();
      |                                                     ^ Error: locator.tap: Test timeout of 15000ms exceeded.
  159 |     await page.getByTestId('btn-more').tap();
  160 |     await page.getByTestId('menu-ticket-change').tap();
  161 |     await expect(page.getByTestId('select-discount-change')).toBeVisible();
  162 |     await page.getByTestId('select-discount-change').selectOption('disc-matinee');
  163 |     await expect(page.getByTestId('price-diff-options')).toBeVisible();
  164 |   });
  165 | 
  166 |   test('P1-04-03 재계산 라디오 선택 후 저장', async ({ page }) => {
  167 |     await seedShow(page);
  168 |     await seedSchedule(page, { status: 'confirmed', isConfirmed: true, finalPrice: 100000, originalPrice: 100000 });
  169 |     await page.goto('/');
  170 |     await page.getByTestId('tab-planner').tap();
  171 |     await page.getByTestId('schedule-card').first().tap();
  172 |     await page.getByTestId('btn-more').tap();
  173 |     await page.getByTestId('menu-ticket-change').tap();
  174 |     await page.getByTestId('select-discount-change').selectOption('disc-matinee');
  175 |     await page.getByTestId('radio-recalculate').tap();
  176 |     await page.getByTestId('btn-ticket-change-save').tap();
  177 |     const shows = await getStorage<Record<string, unknown>[]>(page, 'stampit:shows');
  178 |     const sched = (shows?.[0]?.['schedules'] as Record<string, unknown>[])?.[0];
  179 |     expect(sched?.['discountTypeId']).toBe('disc-matinee');
  180 |   });
  181 | });
  182 | 
  183 | // ────────────────────────────────────────────────────────────────
  184 | // P1-05  확정 취소
  185 | // ────────────────────────────────────────────────────────────────
  186 | test.describe('P1-05 확정 취소', () => {
  187 |   test('P1-05-01 확정 취소 메뉴 클릭 후 draft로 변경', async ({ page }) => {
  188 |     await seedShow(page);
  189 |     await seedSchedule(page, { status: 'confirmed', isConfirmed: true });
  190 |     await page.goto('/');
  191 |     await page.getByTestId('tab-planner').tap();
  192 |     await page.getByTestId('schedule-card').first().tap();
  193 |     await page.getByTestId('btn-more').tap();
  194 |     await page.getByTestId('menu-cancel-confirm').tap();
  195 |     const shows = await getStorage<Record<string, unknown>[]>(page, 'stampit:shows');
  196 |     const sched = (shows?.[0]?.['schedules'] as Record<string, unknown>[])?.[0];
  197 |     expect(sched?.['status']).toBe('draft');
  198 |   });
  199 | });
  200 | 
  201 | // ────────────────────────────────────────────────────────────────
  202 | // P1-06  공연 탭 순서 변경
  203 | // ────────────────────────────────────────────────────────────────
  204 | test.describe('P1-06 탭 순서 변경', () => {
  205 |   test('P1-06-01 탭 순서 변경 시트 열기', async ({ page }) => {
  206 |     await setStorage(page, [
  207 |       { id: 'show-001', name: '공연A', color: '#6366f1', seatGrades: [], discountTypes: [], stampBoards: [], events: [], specialEvents: [], isArchived: false, tabOrder: 0, startDate: '', endDate: '', createdAt: '2026-01-01T00:00:00.000Z', schedules: [] },
  208 |       { id: 'show-002', name: '공연B', color: '#f43f5e', seatGrades: [], discountTypes: [], stampBoards: [], events: [], specialEvents: [], isArchived: false, tabOrder: 1, startDate: '', endDate: '', createdAt: '2026-01-01T00:00:00.000Z', schedules: [] },
  209 |     ]);
  210 |     await page.goto('/');
  211 |     // Long press on show tab to open context menu
  212 |     const tab = page.getByTestId('show-tab-show-001');
  213 |     await tab.tap({ force: true });
  214 |     // Try to find the tab reorder menu
  215 |     const menuBtn = page.getByTestId('menu-tab-reorder');
  216 |     if (await menuBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
  217 |       await menuBtn.tap();
  218 |       await expect(page.getByTestId('tab-order-sheet')).toBeVisible();
  219 |     } else {
  220 |       // Alternative: find settings and access tab order there
  221 |       await page.getByTestId('tab-settings').tap();
  222 |       const reorderBtn = page.getByTestId('btn-tab-reorder');
  223 |       if (await reorderBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
  224 |         await reorderBtn.tap();
  225 |         await expect(page.getByTestId('tab-order-sheet')).toBeVisible();
  226 |       }
  227 |     }
  228 |   });
  229 | });
  230 | 
  231 | // ────────────────────────────────────────────────────────────────
  232 | // P1-07  혜택 사용 처리 (StatusTab)
  233 | // ────────────────────────────────────────────────────────────────
  234 | test.describe('P1-07 혜택 사용 처리', () => {
  235 |   test('P1-07-01 달성된 혜택에 사용 버튼 표시', async ({ page }) => {
  236 |     await seedShow(page);
  237 |     // Mark benefit-001 as achieved
  238 |     await page.evaluate(() => {
  239 |       const raw = localStorage.getItem('stampit_react_v1');
  240 |       if (!raw) return;
  241 |       const data = JSON.parse(raw);
  242 |       const show = data.shows.find((s: Record<string, unknown>) => s.id === 'show-001');
  243 |       if (!show) return;
  244 |       const board = show.stampBoards.find((b: Record<string, unknown>) => b.id === 'board-001');
  245 |       if (!board) return;
  246 |       const benefit = board.benefits.find((b: Record<string, unknown>) => b.id === 'benefit-001');
  247 |       if (benefit) benefit.isAchieved = true;
  248 |       localStorage.setItem('stampit_react_v1', JSON.stringify(data));
  249 |     });
  250 |     await page.goto('/');
  251 |     await page.getByTestId('tab-status').tap();
  252 |     await expect(page.getByTestId('btn-use-benefit').first()).toBeVisible({ timeout: 5000 });
  253 |   });
  254 | 
  255 |   test('P1-07-02 쿠폰 혜택 사용 처리', async ({ page }) => {
  256 |     await seedShow(page);
  257 |     await page.evaluate(() => {
  258 |       const raw = localStorage.getItem('stampit_react_v1');
```