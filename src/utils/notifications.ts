/**
 * src/utils/notifications.ts
 *
 * 알림 스케줄 등록 유틸
 *
 * 안드로이드: Service Worker + periodicsync (백그라운드 알림)
 * iOS / 미지원: setTimeout (앱 열려있을 때만)
 */

import type { Schedule, Show } from '../types';

const SYNC_TAG   = 'stampit-check-notifications';
const SESSION_KEY = 'stampit_notif_timers';

// ─── 권한 ──────────────────────────────────────────────────────────────────
export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied')  return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

// ─── 알림 문구 ────────────────────────────────────────────────────────────
function getBody(schedule: Schedule, show: Show, isToday: boolean): string {
  const discount  = show.discountTypes.find(d => d.id === schedule.discountTypeId);
  const isRebook  = discount?.isRebook ?? false;
  const isCoupon  = discount?.isCoupon ?? false;
  const suffix    = isToday ? '챙기셨나요?' : '미리 챙겨두세요';

  if (isRebook && isCoupon) return `재관람표와 쿠폰 ${suffix}`;
  if (isRebook)              return `재관람표 ${suffix}`;
  if (isCoupon)              return `쿠폰 ${suffix}`;
  return '즐거운 관람 되세요';
}

function buildTitle(showNames: string[], prefix: '오늘' | '내일'): string {
  if (showNames.length === 0) return '';
  if (showNames.length <= 3)  return `🎟️ ${prefix} ${showNames.join(', ')} 관람일이에요`;
  return `🎟️ ${prefix} ${showNames[0]} 외 ${showNames.length - 1}개 공연 관람일이에요`;
}

// ─── 스케줄 아이템 빌드 ───────────────────────────────────────────────────
interface NotifItem {
  id:     string;
  fireAt: number;   // ms timestamp
  title:  string;
  body:   string;
  fired:  boolean;
}

function buildItems(
  schedules: Schedule[],
  shows: Show[],
  settings: { sameDay: { enabled: boolean; hour: number }; dayBefore: { enabled: boolean; hour: number } }
): NotifItem[] {
  const items: NotifItem[] = [];
  const now = new Date();

  for (let d = 0; d <= 7; d++) {
    const target = new Date(now);
    target.setDate(target.getDate() + d);
    const dateStr = target.toISOString().slice(0, 10);

    const daySchedules = schedules.filter(
      s => s.date === dateStr && s.status !== 'cancelled'
    );
    if (daySchedules.length === 0) continue;

    const showNames = [
      ...new Set(
        daySchedules
          .map(s => shows.find(sh => sh.id === s.showId)?.name ?? '')
          .filter(Boolean)
      ),
    ];

    // 당일 알림
    if (settings.sameDay.enabled && d === 0) {
      const fire = new Date(now);
      fire.setHours(settings.sameDay.hour, 0, 0, 0);
      if (fire.getTime() > now.getTime()) {
        const show    = shows.find(s => s.id === daySchedules[0].showId)!;
        const body    = daySchedules.length === 1
          ? getBody(daySchedules[0], show, true)
          : '오늘 공연 잊지 마세요';
        items.push({
          id:     `sameday-${dateStr}`,
          fireAt: fire.getTime(),
          title:  buildTitle(showNames, '오늘'),
          body,
          fired:  false,
        });
      }
    }

    // 전날 알림
    if (settings.dayBefore.enabled && d === 1) {
      const fire = new Date(now);
      fire.setHours(settings.dayBefore.hour, 0, 0, 0);
      if (fire.getTime() > now.getTime()) {
        const show = shows.find(s => s.id === daySchedules[0].showId)!;
        const body = daySchedules.length === 1
          ? getBody(daySchedules[0], show, false)
          : '내일 공연 미리 준비해두세요';
        items.push({
          id:     `daybefore-${dateStr}`,
          fireAt: fire.getTime(),
          title:  buildTitle(showNames, '내일'),
          body,
          fired:  false,
        });
      }
    }
  }

  return items;
}

// ─── SW 지원 여부 ─────────────────────────────────────────────────────────
function isSWSupported(): boolean {
  return 'serviceWorker' in navigator && 'Notification' in window;
}

function isPeriodicSyncSupported(): boolean {
  return 'periodicSync' in ServiceWorkerRegistration.prototype;
}

// ─── iOS / 미지원 환경 — setTimeout 폴백 ─────────────────────────────────
function scheduleViaTimeout(items: NotifItem[]): void {
  // 이전 타이머 취소
  const stored = sessionStorage.getItem(SESSION_KEY);
  if (stored) {
    (JSON.parse(stored) as number[]).forEach(id => clearTimeout(id));
  }

  const timerIds: number[] = [];
  const now = Date.now();

  items.forEach(item => {
    const ms = item.fireAt - now;
    if (ms <= 0) return;
    const id = window.setTimeout(() => {
      if (Notification.permission === 'granted') {
        new Notification(item.title, {
          body: item.body,
          icon: '/icons/icon-192.png',
        });
      }
    }, ms) as unknown as number;
    timerIds.push(id);
  });

  sessionStorage.setItem(SESSION_KEY, JSON.stringify(timerIds));
}

// ─── 메인 진입점 ──────────────────────────────────────────────────────────
export async function scheduleNotifications(
  schedules: Schedule[],
  shows: Show[],
  settings: {
    sameDay:   { enabled: boolean; hour: number };
    dayBefore: { enabled: boolean; hour: number };
  }
): Promise<void> {
  if (Notification.permission !== 'granted') return;

  const items = buildItems(schedules, shows, settings);

  // 알림 설정이 모두 꺼져 있으면 타이머 전부 취소
  if (!settings.sameDay.enabled && !settings.dayBefore.enabled) {
    scheduleViaTimeout([]); // 빈 배열로 기존 타이머 정리
    return;
  }

  if (!isSWSupported()) {
    // SW 미지원 환경 → setTimeout만
    scheduleViaTimeout(items);
    return;
  }

  try {
    const reg = await navigator.serviceWorker.ready;

    // SW에 스케줄 전달 (IndexedDB 저장)
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type:  'SCHEDULE_NOTIFICATIONS',
        items,
      });
    }

    // 안드로이드 periodicsync 등록 (1시간마다 체크)
    if (isPeriodicSyncSupported()) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (reg as any).periodicSync.register('stampit-check-notifications', {
          minInterval: 60 * 60 * 1000, // 1시간
        });
      } catch {
        // periodicsync 권한 없음 → setTimeout 폴백
        scheduleViaTimeout(items);
      }
    } else {
      // iOS 등 periodicsync 미지원 → setTimeout 폴백
      scheduleViaTimeout(items);
    }
  } catch {
    scheduleViaTimeout(items);
  }
}

// ─── SW 등록 ──────────────────────────────────────────────────────────────
export async function registerServiceWorker(): Promise<void> {
  if (!isSWSupported()) return;
  try {
    await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  } catch (err) {
    console.error('[SW] 등록 실패', err);
  }
}
