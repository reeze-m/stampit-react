import { create } from 'zustand';
import { loadFromStorage, saveToStorage } from './storage';
import type { AppSettings } from '../types';
import { useShowStore } from './showStore';
import { scheduleNotifications } from '../utils/notifications';

interface SettingsStore {
  settings: AppSettings;
  setShowRealCost: (v: boolean) => void;
  setOnboardingDone: () => void;
  setQuickStartDone: () => void;
  setSeenConfirmTip: () => void;
  setLastUsed: (showId: string, seatGradeId: string, discountTypeId: string) => void;
  updateNotification: (type: 'sameDay' | 'dayBefore', field: 'enabled' | 'hour', value: boolean | number) => void;
}

const SETTINGS_KEY = 'stampit_settings';

export const useSettingsStore = create<SettingsStore>((set) => ({
  settings: loadFromStorage<AppSettings>(SETTINGS_KEY, { showRealCost: true, onboardingDone: false }),
  setShowRealCost: (v) =>
    set(state => {
      const next = { ...state.settings, showRealCost: v };
      saveToStorage(SETTINGS_KEY, next);
      return { settings: next };
    }),
  setOnboardingDone: () =>
    set(state => {
      const next = { ...state.settings, onboardingDone: true };
      saveToStorage(SETTINGS_KEY, next);
      return { settings: next };
    }),
  setQuickStartDone: () =>
    set(state => {
      const next = { ...state.settings, hasCompletedQuickStart: true };
      saveToStorage(SETTINGS_KEY, next);
      return { settings: next };
    }),
  setSeenConfirmTip: () =>
    set(state => {
      const next = { ...state.settings, hasSeenConfirmTip: true };
      saveToStorage(SETTINGS_KEY, next);
      return { settings: next };
    }),
  setLastUsed: (showId, seatGradeId, discountTypeId) =>
    set(state => {
      const next = {
        ...state.settings,
        lastUsedShowId: showId,
        lastUsedSeatGradeId: seatGradeId,
        lastUsedDiscountTypeId: discountTypeId,
      };
      saveToStorage(SETTINGS_KEY, next);
      return { settings: next };
    }),
  updateNotification: (type, field, value) => {
    set(state => {
      const defaults = { sameDay: { enabled: false, hour: 9 }, dayBefore: { enabled: false, hour: 21 } };
      const current = state.settings.notification ?? defaults;
      const updated = {
        ...state.settings,
        notification: {
          ...current,
          [type]: { ...current[type], [field]: value },
        },
      };
      saveToStorage(SETTINGS_KEY, updated);
      return { settings: updated };
    });
    // 설정 변경 시 알림 스케줄 즉시 갱신
    const { shows, schedules } = useShowStore.getState();
    const { settings } = useSettingsStore.getState();
    if (settings.notification) {
      scheduleNotifications(schedules, shows, settings.notification);
    }
  },
}));
