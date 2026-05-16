import type { Page } from '@playwright/test';

const STORAGE_KEY = 'stampit_react_v1';

function todayISOStr(): string {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().split('T')[0];
}

export function todayKST(): string {
  return todayISOStr();
}

export function addDaysKST(days: number): string {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  kst.setDate(kst.getDate() + days);
  return kst.toISOString().split('T')[0];
}

const BASE_SHOW = {
  id: 'show-001',
  name: '테스트 공연',
  venue: '테스트 공연장',
  startDate: '2026-01-01',
  endDate: '2030-12-31',
  color: '#6366f1',
  seatGrades: [
    { id: 'grade-vip', name: 'VIP', price: 130000 },
    { id: 'grade-r', name: 'R석', price: 100000 },
  ],
  discountTypes: [
    { id: 'disc-rebook', name: '재관람', method: 'rate', value: 30, isRebook: true, isCoupon: false },
    { id: 'disc-matinee', name: '마티네', method: 'rate', value: 20, isRebook: false, isCoupon: false },
    { id: 'disc-normal', name: '일반', method: 'amount', value: 0, isRebook: false, isCoupon: false },
  ],
  stampBoards: [
    {
      id: 'board-001',
      showId: 'show-001',
      name: '1판',
      capacity: 7,
      initialStamps: 0,
      stamps: [],
      benefits: [
        { id: 'benefit-001', requiredStamps: 5, description: '할인쿠폰 30%', priority: 1, isAchieved: false, isUsed: false },
        { id: 'benefit-002', requiredStamps: 7, description: '포토카드', priority: 2, isAchieved: false, isUsed: false },
      ],
      isActive: true,
      isCompleted: false,
      sortOrder: 0,
      createdAt: '2026-01-01T00:00:00.000Z',
      stampColor: '#6366f1',
    },
  ],
  events: [],
  specialEvents: [
    { id: 'se-001', name: '무대인사', showId: 'show-001', startDate: '2026-01-01', endDate: '2030-12-31', isDeleted: false },
  ],
  isArchived: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  tabOrder: 0,
};

export async function installBridge(page: Page) {
  await page.addInitScript(() => {
    // Idempotency guard: only install bridge once per page load
    if ((window as unknown as Record<string, unknown>).__stampitBridgeInstalled) return;
    (window as unknown as Record<string, unknown>).__stampitBridgeInstalled = true;

    const REAL_KEY = 'stampit_react_v1';
    const BRIDGE_KEY = 'stampit:shows';

    // Migration: if stampit:shows exists but stampit_react_v1 doesn't, migrate
    const origGetRaw = Storage.prototype.getItem.call(localStorage, REAL_KEY);
    if (!origGetRaw) {
      const bridgeRaw = Storage.prototype.getItem.call(localStorage, BRIDGE_KEY);
      if (bridgeRaw) {
        try {
          const shows = JSON.parse(bridgeRaw) as Record<string, unknown>[];
          const schedules = shows.flatMap((show) =>
            ((show['schedules'] as Record<string, unknown>[] | undefined) || [])
              .map((s) => ({ ...s, showId: show['id'] }))
          );
          const showsClean = shows.map(({ schedules: _s, ...rest }) => rest);
          Storage.prototype.setItem.call(localStorage, REAL_KEY, JSON.stringify({ shows: showsClean, schedules }));
        } catch (_e) { /* ignore */ }
      }
    }

    const origGet = Storage.prototype.getItem;
    const origSet = Storage.prototype.setItem;
    Storage.prototype.getItem = function(key: string) {
      if (this === localStorage && key === BRIDGE_KEY) {
        const raw = origGet.call(this, REAL_KEY);
        if (!raw) return null;
        const data = JSON.parse(raw);
        const shows = (data.shows || []).map((show: Record<string, unknown>) => ({
          ...show,
          schedules: (data.schedules || []).filter((s: Record<string, unknown>) => s['showId'] === show['id']),
        }));
        return JSON.stringify(shows);
      }
      return origGet.call(this, key);
    };
    Storage.prototype.setItem = function(key: string, value: string) {
      if (this === localStorage && key === BRIDGE_KEY) {
        const shows = JSON.parse(value);
        const schedules = (shows as Record<string, unknown>[]).flatMap((show) =>
          ((show['schedules'] as Record<string, unknown>[] | undefined) || [])
            .map((s) => ({ ...s, showId: show['id'] }))
        );
        const showsClean = (shows as Record<string, unknown>[]).map(({ schedules: _s, ...rest }) => rest);
        origSet.call(this, REAL_KEY, JSON.stringify({ shows: showsClean, schedules }));
        return;
      }
      origSet.call(this, key, value);
    };
  });
  // Navigate to app so that localStorage is accessible for page.evaluate() calls
  if (page.url() === 'about:blank' || page.url() === '') {
    await page.goto('/');
  }
}

export async function clearStorage(page: Page) {
  await installBridge(page);
  await page.goto('/');
  await page.evaluate((key) => localStorage.removeItem(key), STORAGE_KEY);
}

export async function seedShow(page: Page) {
  await installBridge(page);
  await page.goto('/');
  await page.evaluate(
    ({ key, show, settingsKey }) => {
      localStorage.setItem(key, JSON.stringify({ shows: [show], schedules: [] }));
      localStorage.setItem(settingsKey, JSON.stringify({ showRealCost: true, onboardingDone: true }));
    },
    { key: STORAGE_KEY, show: BASE_SHOW, settingsKey: 'stampit_settings' }
  );
}

interface SeedScheduleOpts {
  id?: string;
  date?: string;
  seatGradeId?: string;
  discountTypeId?: string;
  finalPrice?: number;
  originalPrice?: number;
  isConfirmed?: boolean;
  status?: 'draft' | 'confirmed' | 'cancelled';
  cast?: string;
  specialEventIds?: string[];
  multiplier?: number;
  boardAllocations?: unknown[];
  priceDiffNote?: string;
  isShare?: boolean;
}

export async function seedSchedule(page: Page, opts: SeedScheduleOpts = {}) {
  const isConfirmed = opts.isConfirmed ?? (opts.status === 'confirmed');
  const schedule = {
    id: opts.id ?? 'sched-001',
    showId: 'show-001',
    date: opts.date ?? todayISOStr(),
    seatGradeId: opts.seatGradeId ?? 'grade-r',
    discountTypeId: opts.discountTypeId ?? 'disc-normal',
    finalPrice: opts.finalPrice ?? 100000,
    originalPrice: opts.originalPrice ?? 100000,
    multiplier: opts.multiplier ?? 1,
    boardAllocations: opts.boardAllocations ?? [],
    isConfirmed,
    status: opts.status ?? 'draft',
    specialEventIds: opts.specialEventIds ?? [],
    cast: opts.cast,
    priceDiffNote: opts.priceDiffNote,
    isShare: opts.isShare,
    createdAt: '2026-01-01T00:00:00.000Z',
    // Set confirmedAt to now so canCancelConfirm works
    confirmedAt: isConfirmed ? new Date().toISOString() : undefined,
  };

  await installBridge(page);
  await page.goto('/');
  await page.evaluate(
    ({ key, schedule: sched }) => {
      const raw = localStorage.getItem(key);
      const data = raw ? JSON.parse(raw) : { shows: [{ id: 'show-001' }], schedules: [] };
      data.schedules = [...(data.schedules || []).filter((s: { id: string }) => s.id !== sched.id), sched];
      localStorage.setItem(key, JSON.stringify(data));
    },
    { key: STORAGE_KEY, schedule }
  );
}

export async function seedStamps(page: Page, count: number) {
  await installBridge(page);
  await page.goto('/');
  await page.evaluate(
    ({ key, count: n }) => {
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const data = JSON.parse(raw);
      const stamps = Array.from({ length: n }, (_, i) => ({
        id: `stamp-${i + 1}`,
        scheduleId: null,
        isInitial: true,
        isConfirmed: true,
        stampType: 'initial',
        earnedAt: new Date().toISOString(),
      }));
      data.shows[0].stampBoards[0].stamps = stamps;
      localStorage.setItem(key, JSON.stringify(data));
    },
    { key: STORAGE_KEY, count }
  );
}

export async function setStorage(page: Page, shows: unknown[]) {
  await installBridge(page);
  await page.goto('/');
  await page.evaluate(
    ({ key, shows: showList, settingsKey }) => {
      const schedules = (showList as Record<string, unknown>[]).flatMap((show) =>
        ((show['schedules'] as Record<string, unknown>[] | undefined) || [])
          .map((s) => ({ ...s, showId: show['id'] }))
      );
      const showsClean = (showList as Record<string, unknown>[]).map(({ schedules: _s, ...rest }) => rest);
      localStorage.setItem(key, JSON.stringify({ shows: showsClean, schedules }));
      localStorage.setItem(settingsKey, JSON.stringify({ showRealCost: true, onboardingDone: true }));
    },
    { key: STORAGE_KEY, shows, settingsKey: 'stampit_settings' }
  );
}

export async function getStorage<T>(page: Page, key: string): Promise<T | null> {
  const raw = await page.evaluate((k) => localStorage.getItem(k), STORAGE_KEY);
  if (!raw) return null;
  const data = JSON.parse(raw) as { shows: Record<string, unknown>[]; schedules: Record<string, unknown>[] };

  if (key === 'stampit:shows') {
    const showsWithSchedules = data.shows.map((show) => ({
      ...show,
      schedules: (data.schedules || []).filter((s) => s['showId'] === show['id']),
    }));
    return showsWithSchedules as T;
  }
  return null;
}
