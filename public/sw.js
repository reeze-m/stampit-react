/**
 * stampit Service Worker
 * 역할:
 *   1. 안드로이드: periodicsync로 백그라운드 알림 발송
 *   2. iOS / 미지원 환경: 앱 실행 시 등록된 알림만 처리
 */

const DB_NAME    = 'stampit-notif-db';
const DB_VERSION = 1;
const STORE_NAME = 'scheduled';
const SYNC_TAG   = 'stampit-check-notifications';

// ─── IndexedDB 헬퍼 ────────────────────────────────────────────────────────
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = e => {
      e.target.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
    };
    req.onsuccess = e => resolve(e.target.result);
    req.onerror   = e => reject(e.target.error);
  });
}

async function saveSchedules(items) {
  const db    = await openDB();
  const tx    = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  // 기존 전부 지우고 새로 저장
  await new Promise((res, rej) => {
    const r = store.clear();
    r.onsuccess = res;
    r.onerror   = rej;
  });
  items.forEach(item => store.put(item));
  return new Promise((res, rej) => {
    tx.oncomplete = res;
    tx.onerror    = rej;
  });
}

async function loadSchedules() {
  const db    = await openDB();
  const tx    = db.transaction(STORE_NAME, 'readonly');
  const store = tx.objectStore(STORE_NAME);
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = e => resolve(e.target.result);
    req.onerror   = e => reject(e.target.error);
  });
}

async function deleteSchedule(id) {
  const db    = await openDB();
  const tx    = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  store.delete(id);
  return new Promise((res, rej) => {
    tx.oncomplete = res;
    tx.onerror    = rej;
  });
}

// ─── 알림 발송 체크 ────────────────────────────────────────────────────────
async function checkAndFire() {
  const items = await loadSchedules();
  const now   = Date.now();

  for (const item of items) {
    // 발송 시각이 됐고 아직 안 보낸 것
    if (item.fireAt <= now && !item.fired) {
      await self.registration.showNotification(item.title, {
        body:    item.body,
        icon:    '/icons/icon-192.png',
        badge:   '/icons/icon-72.png',
        tag:     item.id,           // 동일 tag면 중복 방지
        data:    { url: '/' },
      });
      await deleteSchedule(item.id);
    }
  }
}

// ─── 이벤트 ────────────────────────────────────────────────────────────────
self.addEventListener('install',  () => self.skipWaiting());
self.addEventListener('activate', e  => e.waitUntil(self.clients.claim()));

/** 앱에서 스케줄 데이터 수신 */
self.addEventListener('message', async event => {
  if (event.data?.type !== 'SCHEDULE_NOTIFICATIONS') return;
  try {
    await saveSchedules(event.data.items);
    // 저장 직후 한 번 체크 (앱 열린 상태)
    await checkAndFire();
  } catch (err) {
    console.error('[SW] saveSchedules error', err);
  }
});

/** 안드로이드 백그라운드 주기 실행 */
self.addEventListener('periodicsync', event => {
  if (event.tag === SYNC_TAG) {
    event.waitUntil(checkAndFire());
  }
});

/** 알림 탭 시 앱 오픈 */
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then(clientList => {
      if (clientList.length > 0) {
        return clientList[0].focus();
      }
      return self.clients.openWindow('/');
    })
  );
});
