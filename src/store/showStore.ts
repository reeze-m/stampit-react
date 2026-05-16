import { create } from 'zustand';
import { loadFromStorage, saveToStorage, STORAGE_KEY } from './storage';
import type {
  Show,
  StampBoard,
  Benefit,
  SeatGrade,
  DiscountType,
  Schedule,
  StampEvent,
  SpecialEvent,
  BoardAllocation,
  Stamp,
} from '../types';
import { nowKST, todayKSTString } from '../utils/dateUtils';
import { generateShowReport } from '../utils/reportUtils';
import { calcFinalPrice } from '../utils/priceCalc';
import { allocateStamps } from '../utils/stampAllocator';
import { SPECIAL_EVENT_PRESETS } from '../constants/specialEventPresets';

/** 고유 ID 생성 */
function genId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** KST 현재 시각을 ISO 문자열로 반환 */
function nowISO(): string {
  return nowKST().toISOString();
}

/**
 * 혜택 달성 계산용 유효 도장 수
 * - 초기 도장(isInitial)은 항상 카운트
 * - 확정 도장은 earnedAt(YYYY-MM-DD) 이 today 이하인 경우만 카운트
 * - earnedAt이 없거나 비어있으면 항상 카운트 (수동 도장 등)
 */
function effectiveStampCount(stamps: Stamp[], today: string): number {
  return stamps.filter(s => {
    if (s.isInitial) return true;
    if (!s.earnedAt) return true;
    return s.earnedAt.slice(0, 10) <= today;
  }).length;
}

interface ShowStore {
  shows: Show[];
  schedules: Schedule[];

  // 공연 CRUD
  addShow: (data: Omit<Show, 'id' | 'stampBoards' | 'events' | 'specialEvents' | 'isArchived' | 'createdAt'>) => string;
  updateShow: (id: string, data: Partial<Show>) => void;
  deleteShow: (id: string) => void;
  archiveShow: (id: string) => void;
  unarchiveShow: (id: string) => void;
  dismissArchivePrompt: (id: string) => void;

  // 도장판 CRUD
  addStampBoard: (showId: string, data: Omit<StampBoard, 'id' | 'showId' | 'stamps' | 'isActive' | 'isCompleted' | 'sortOrder' | 'createdAt'>) => string;
  createNextBoard: (params: { showId: string; name: string; capacity: number; sourceBenefits: Benefit[]; stampColor?: string }) => string;
  updateStampBoard: (showId: string, boardId: string, data: Partial<StampBoard>) => void;
  deleteStampBoard: (showId: string, boardId: string) => void;
  hideBoard: (showId: string, boardId: string) => void;
  restoreBoard: (showId: string, boardId: string) => void;
  reorderBoards: (showId: string, orderedIds: string[]) => void;

  // 혜택 CRUD
  addBenefit: (showId: string, boardId: string, data: Omit<Benefit, 'id' | 'isAchieved' | 'isUsed'>) => void;
  updateBenefit: (showId: string, boardId: string, benefitId: string, data: Partial<Benefit>) => void;
  deleteBenefit: (showId: string, boardId: string, benefitId: string) => void;
  markBenefitAchieved: (showId: string, boardId: string, benefitId: string) => void;
  markBenefitUsed: (showId: string, boardId: string, benefitId: string, couponCode?: string, attachmentUrl?: string) => void;
  useBenefit: (showId: string, boardId: string, benefitId: string) => void;
  unuseBenefit: (showId: string, boardId: string, benefitId: string) => void;
  updateBenefitNote: (showId: string, boardId: string, benefitId: string, note: string) => void;

  // 좌석 등급 CRUD
  addSeatGrade: (showId: string, data: Omit<SeatGrade, 'id'>) => void;
  updateSeatGrade: (showId: string, gradeId: string, data: Partial<SeatGrade>) => void;
  deleteSeatGrade: (showId: string, gradeId: string) => void;

  // 할인 종류 CRUD
  addDiscountType: (showId: string, data: Omit<DiscountType, 'id'>) => void;
  updateDiscountType: (showId: string, discountId: string, data: Partial<DiscountType>) => void;
  deleteDiscountType: (showId: string, discountId: string) => void;

  // 스케줄 CRUD
  addSchedule: (data: Omit<Schedule, 'id' | 'boardAllocations' | 'isConfirmed' | 'createdAt' | 'specialEventIds'> & { specialEventIds?: string[] }) => string;
  updateSchedule: (scheduleId: string, data: Partial<Schedule>) => void;
  deleteSchedule: (scheduleId: string) => void;
  confirmSchedule: (scheduleId: string, overrideAllocations?: BoardAllocation[]) => void;
  cancelConfirm: (scheduleId: string) => void;
  cancelSchedule: (scheduleId: string, reason?: string, refundAmount?: number) => void;
  cancelShow: (showId: string) => void;
  restoreSchedule: (scheduleId: string) => void;
  changeTicket: (scheduleId: string, newGradeId: string, newDiscountId: string, method: 'recalculate' | 'note-only') => void;
  softDeleteDiscountType: (showId: string, discountId: string) => void;
  updateScheduleCast: (scheduleId: string, cast: string) => void;

  // 스탬프 이벤트 CRUD
  addStampEvent: (showId: string, data: Omit<StampEvent, 'id'>) => void;
  updateStampEvent: (showId: string, eventId: string, data: Partial<StampEvent>) => void;
  deleteStampEvent: (showId: string, eventId: string) => void;

  // 특별 이벤트 CRUD
  addSpecialEvent: (showId: string, name: string) => void;
  updateSpecialEvent: (showId: string, eventId: string, name: string) => void;
  deleteSpecialEvent: (showId: string, eventId: string) => void;

  // 데이터 관리
  exportData: () => string;
  importData: (json: string) => boolean; // ✅ 수정: 성공/실패 boolean 반환
  resetAllData: () => void;

  // 수동 도장 추가/삭제
  addManualStamp: (showId: string, boardId: string, data: { stampType: 'exchange' | 'share' | 'etc'; count: number; memo?: string; earnedAt: string }) => void;
  removeManualStamp: (showId: string, boardId: string, stampId: string) => void;

  // 중복 날짜 감지
  hasDuplicateDate: (showId: string, date: string, excludeScheduleId?: string) => boolean;

  // 공연 탭 순서 변경
  reorderShows: (orderedIds: string[]) => void;

  refreshBenefits: () => void;

  // 리포트 모달 트리거
  pendingReportShowId: string | null;
  clearPendingReport: () => void;
}

interface StorageData {
  shows: Show[];
  schedules: Schedule[];
}

function makeDefaultSpecialEvents(): SpecialEvent[] {
  return SPECIAL_EVENT_PRESETS.map((name, i) => ({
    id: `preset-${i}`,
    name,
    isPreset: true,
    createdAt: new Date().toISOString(),
  }));
}

function loadData(): StorageData {
  const data = loadFromStorage<StorageData>(STORAGE_KEY, { shows: [], schedules: [] });

  // 마이그레이션: specialEvents 없는 Show에 프리셋 초기화
  data.shows = data.shows.map(show => {
    if (!show.specialEvents) {
      return { ...show, specialEvents: makeDefaultSpecialEvents() };
    }
    return show;
  });

  // 마이그레이션: tabOrder 없는 Show에 생성 순서 기준 부여
  data.shows = data.shows.map((show, idx) => ({
    ...show,
    tabOrder: show.tabOrder ?? idx,
  }));

  // 마이그레이션: specialEventIds 없는 Schedule에 빈 배열 초기화
  data.schedules = data.schedules.map(schedule => {
    if (!schedule.specialEventIds) {
      return { ...schedule, specialEventIds: [] };
    }
    return schedule;
  });

  // ✅ 마이그레이션: isShare 없는 Schedule에 false 기본값
  data.schedules = data.schedules.map(schedule => ({
    ...schedule,
    isShare: schedule.isShare ?? false,
  }));

  // 마이그레이션: stampType 없는 Stamp에 기본값 설정
  data.shows = data.shows.map(show => ({
    ...show,
    stampBoards: show.stampBoards.map(board => ({
      ...board,
      stamps: board.stamps.map(stamp => ({
        ...stamp,
        stampType: stamp.stampType ?? (stamp.isInitial ? 'initial' : 'visit'),
      })),
    })),
  }));

  // 마이그레이션: isHidden 없는 StampBoard에 기본값 설정
  data.shows = data.shows.map(show => ({
    ...show,
    stampBoards: show.stampBoards.map(board => ({
      ...board,
      isHidden: board.isHidden ?? false,
    })),
  }));

  saveToStorage(STORAGE_KEY, data);
  return data;
}

function saveData(shows: Show[], schedules: Schedule[]): void {
  saveToStorage(STORAGE_KEY, { shows, schedules });
}

export const useShowStore = create<ShowStore>((set, get) => {
  const initial = loadData();

  return {
    shows: initial.shows,
    schedules: initial.schedules,
    pendingReportShowId: null,

    // ===== 공연 CRUD =====
    addShow: (data) => {
      const id = genId();
      const activeCount = get().shows.filter(s => !s.isArchived && !s.isCancelled).length;
      const newShow: Show = {
        ...data,
        id,
        stampBoards: [],
        events: [],
        specialEvents: makeDefaultSpecialEvents(),
        isArchived: false,
        createdAt: nowISO(),
        tabOrder: activeCount,
      };
      set(state => {
        const shows = [...state.shows, newShow];
        saveData(shows, state.schedules);
        return { shows };
      });
      return id;
    },

    updateShow: (id, data) => {
      set(state => {
        const shows = state.shows.map(s => (s.id === id ? { ...s, ...data } : s));
        saveData(shows, state.schedules);
        return { shows };
      });
    },

    deleteShow: (id) => {
      set(state => {
        const shows = state.shows.filter(s => s.id !== id);
        const schedules = state.schedules.filter(s => s.showId !== id);
        saveData(shows, schedules);
        return { shows, schedules };
      });
    },

    archiveShow: (showId) => {
      set(state => {
        const show = state.shows.find(s => s.id === showId);
        if (!show) return {};
        const report = generateShowReport(show, state.schedules);
        const shows = state.shows.map(s =>
          s.id === showId ? { ...s, isArchived: true, report } : s
        );
        saveData(shows, state.schedules);
        return { shows, pendingReportShowId: showId };
      });
    },

    unarchiveShow: (id) => {
      set(state => {
        const shows = state.shows.map(s => (s.id === id ? { ...s, isArchived: false } : s));
        saveData(shows, state.schedules);
        return { shows };
      });
    },

    clearPendingReport: () => set({ pendingReportShowId: null }),

    dismissArchivePrompt: (id) => {
      set(state => {
        const shows = state.shows.map(s => (s.id === id ? { ...s, archivePromptDismissed: true } : s));
        saveData(shows, state.schedules);
        return { shows };
      });
    },

    // ===== 도장판 CRUD =====
    createNextBoard: ({ showId, name, capacity, sourceBenefits, stampColor }) => {
      return get().addStampBoard(showId, {
        name,
        capacity,
        initialStamps: 0,
        stampColor,
        benefits: sourceBenefits.map(b => ({
          id: genId(),
          requiredStamps: b.requiredStamps,
          description: b.description,
          priority: b.priority,
          isAchieved: false,
          isUsed: false,
        })),
      });
    },

    addStampBoard: (showId, data) => {
      const id = genId();
      const show = get().shows.find(s => s.id === showId);
      const maxSort = show ? Math.max(0, ...show.stampBoards.map(b => b.sortOrder)) : 0;

      const initialStampsList: Stamp[] = [];
      for (let i = 0; i < (data.initialStamps || 0); i++) {
        initialStampsList.push({
          id: genId(),
          scheduleId: null,
          isInitial: true,
          isConfirmed: true,
          earnedAt: nowISO(),
          stampType: 'initial' as const,
        });
      }

      const initialCount = data.initialStamps || 0;
      const benefitsWithInitial = (data.benefits || []).map(b => ({
        ...b,
        isAchieved: b.requiredStamps <= initialCount ? true : b.isAchieved,
      }));

      const newBoard: StampBoard = {
        ...data,
        id,
        showId,
        stamps: initialStampsList,
        benefits: benefitsWithInitial,
        isActive: true,
        isCompleted: initialCount >= data.capacity,
        sortOrder: maxSort + 1,
        createdAt: nowISO(),
      };

      set(state => {
        const shows = state.shows.map(s =>
          s.id === showId
            ? { ...s, stampBoards: [...s.stampBoards, newBoard] }
            : s
        );
        saveData(shows, state.schedules);
        return { shows };
      });
      return id;
    },

    updateStampBoard: (showId, boardId, data) => {
      set(state => {
        const shows = state.shows.map(s => {
          if (s.id !== showId) return s;
          return {
            ...s,
            stampBoards: s.stampBoards.map(b =>
              b.id === boardId ? { ...b, ...data } : b
            ),
          };
        });
        saveData(shows, state.schedules);
        return { shows };
      });
    },

    deleteStampBoard: (showId, boardId) => {
      set(state => {
        const shows = state.shows.map(s => {
          if (s.id !== showId) return s;
          return {
            ...s,
            stampBoards: s.stampBoards.filter(b => b.id !== boardId),
          };
        });
        const schedules = state.schedules.map(sc => {
          if (sc.showId !== showId) return sc;
          return {
            ...sc,
            boardAllocations: sc.boardAllocations.filter(a => a.boardId !== boardId),
          };
        });
        saveData(shows, schedules);
        return { shows, schedules };
      });
    },

    hideBoard: (showId, boardId) => {
      set(state => {
        const shows = state.shows.map(s => {
          if (s.id !== showId) return s;
          return {
            ...s,
            stampBoards: s.stampBoards.map(b =>
              b.id === boardId
                ? { ...b, isHidden: true, hiddenAt: nowISO(), isActive: false }
                : b
            ),
          };
        });
        saveData(shows, state.schedules);
        return { shows };
      });
    },

    restoreBoard: (showId, boardId) => {
      set(state => {
        const shows = state.shows.map(s => {
          if (s.id !== showId) return s;
          return {
            ...s,
            stampBoards: s.stampBoards.map(b => {
              if (b.id !== boardId) return b;
              const { hiddenAt: _removed, ...rest } = b;
              void _removed;
              return { ...rest, isHidden: false, isActive: true };
            }),
          };
        });
        saveData(shows, state.schedules);
        return { shows };
      });
    },

    reorderBoards: (showId, orderedIds) => {
      set(state => {
        const shows = state.shows.map(s => {
          if (s.id !== showId) return s;
          const boards = orderedIds
            .map((id, idx) => {
              const board = s.stampBoards.find(b => b.id === id);
              return board ? { ...board, sortOrder: idx + 1 } : null;
            })
            .filter(Boolean) as StampBoard[];
          return { ...s, stampBoards: boards };
        });
        saveData(shows, state.schedules);
        return { shows };
      });
    },

    // ===== 혜택 CRUD =====
    addBenefit: (showId, boardId, data) => {
      const newBenefit: Benefit = { ...data, id: genId(), isAchieved: false, isUsed: false };
      set(state => {
        const shows = state.shows.map(s => {
          if (s.id !== showId) return s;
          return {
            ...s,
            stampBoards: s.stampBoards.map(b =>
              b.id === boardId ? { ...b, benefits: [...b.benefits, newBenefit] } : b
            ),
          };
        });
        saveData(shows, state.schedules);
        return { shows };
      });
    },

    updateBenefit: (showId, boardId, benefitId, data) => {
      set(state => {
        const shows = state.shows.map(s => {
          if (s.id !== showId) return s;
          return {
            ...s,
            stampBoards: s.stampBoards.map(b => {
              if (b.id !== boardId) return b;
              return {
                ...b,
                benefits: b.benefits.map(ben =>
                  ben.id === benefitId ? { ...ben, ...data } : ben
                ),
              };
            }),
          };
        });
        saveData(shows, state.schedules);
        return { shows };
      });
    },

    deleteBenefit: (showId, boardId, benefitId) => {
      set(state => {
        const shows = state.shows.map(s => {
          if (s.id !== showId) return s;
          return {
            ...s,
            stampBoards: s.stampBoards.map(b => {
              if (b.id !== boardId) return b;
              return { ...b, benefits: b.benefits.filter(ben => ben.id !== benefitId) };
            }),
          };
        });
        saveData(shows, state.schedules);
        return { shows };
      });
    },

    markBenefitAchieved: (showId, boardId, benefitId) => {
      set(state => {
        const shows = state.shows.map(s => {
          if (s.id !== showId) return s;
          return {
            ...s,
            stampBoards: s.stampBoards.map(b => {
              if (b.id !== boardId) return b;
              return {
                ...b,
                benefits: b.benefits.map(ben =>
                  ben.id === benefitId ? { ...ben, isAchieved: true } : ben
                ),
              };
            }),
          };
        });
        saveData(shows, state.schedules);
        return { shows };
      });
    },

    markBenefitUsed: (showId, boardId, benefitId, couponCode, attachmentUrl) => {
      set(state => {
        const shows = state.shows.map(s => {
          if (s.id !== showId) return s;
          return {
            ...s,
            stampBoards: s.stampBoards.map(b => {
              if (b.id !== boardId) return b;
              return {
                ...b,
                benefits: b.benefits.map(ben =>
                  ben.id === benefitId
                    ? { ...ben, isUsed: true, usedAt: nowISO(), couponCode, attachmentUrl }
                    : ben
                ),
              };
            }),
          };
        });
        saveData(shows, state.schedules);
        return { shows };
      });
    },

    useBenefit: (showId, boardId, benefitId) => {
      set(state => {
        const shows = state.shows.map(s => {
          if (s.id !== showId) return s;
          return {
            ...s,
            stampBoards: s.stampBoards.map(b => {
              if (b.id !== boardId) return b;
              return {
                ...b,
                benefits: b.benefits.map(ben =>
                  ben.id === benefitId ? { ...ben, isUsed: true, usedAt: nowISO() } : ben
                ),
              };
            }),
          };
        });
        saveData(shows, state.schedules);
        return { shows };
      });
    },

    unuseBenefit: (showId, boardId, benefitId) => {
      set(state => {
        const shows = state.shows.map(s => {
          if (s.id !== showId) return s;
          return {
            ...s,
            stampBoards: s.stampBoards.map(b => {
              if (b.id !== boardId) return b;
              return {
                ...b,
                benefits: b.benefits.map(ben => {
                  if (ben.id !== benefitId) return ben;
                  const { usedAt: _removed, ...rest } = ben;
                  void _removed;
                  return { ...rest, isUsed: false };
                }),
              };
            }),
          };
        });
        saveData(shows, state.schedules);
        return { shows };
      });
    },

    updateBenefitNote: (showId, boardId, benefitId, note) => {
      get().updateBenefit(showId, boardId, benefitId, { usageNote: note });
    },

    // ===== 좌석 등급 CRUD =====
    addSeatGrade: (showId, data) => {
      const newGrade: SeatGrade = { ...data, id: genId() };
      set(state => {
        const shows = state.shows.map(s =>
          s.id === showId ? { ...s, seatGrades: [...s.seatGrades, newGrade] } : s
        );
        saveData(shows, state.schedules);
        return { shows };
      });
    },

    updateSeatGrade: (showId, gradeId, data) => {
      set(state => {
        const shows = state.shows.map(s => {
          if (s.id !== showId) return s;
          return {
            ...s,
            seatGrades: s.seatGrades.map(g => g.id === gradeId ? { ...g, ...data } : g),
          };
        });
        saveData(shows, state.schedules);
        return { shows };
      });
    },

    deleteSeatGrade: (showId, gradeId) => {
      set(state => {
        const shows = state.shows.map(s =>
          s.id === showId
            ? { ...s, seatGrades: s.seatGrades.filter(g => g.id !== gradeId) }
            : s
        );
        saveData(shows, state.schedules);
        return { shows };
      });
    },

    // ===== 할인 종류 CRUD =====
    addDiscountType: (showId, data) => {
      const newDiscount: DiscountType = { ...data, id: genId() };
      set(state => {
        const shows = state.shows.map(s =>
          s.id === showId
            ? { ...s, discountTypes: [...s.discountTypes, newDiscount] }
            : s
        );
        saveData(shows, state.schedules);
        return { shows };
      });
    },

    updateDiscountType: (showId, discountId, data) => {
      set(state => {
        const shows = state.shows.map(s => {
          if (s.id !== showId) return s;
          return {
            ...s,
            discountTypes: s.discountTypes.map(d =>
              d.id === discountId ? { ...d, ...data } : d
            ),
          };
        });
        saveData(shows, state.schedules);
        return { shows };
      });
    },

    deleteDiscountType: (showId, discountId) => {
      set(state => {
        const shows = state.shows.map(s =>
          s.id === showId
            ? { ...s, discountTypes: s.discountTypes.filter(d => d.id !== discountId) }
            : s
        );
        saveData(shows, state.schedules);
        return { shows };
      });
    },

    // ===== 스케줄 CRUD =====
    addSchedule: (data) => {
      const id = genId();
      const show = get().shows.find(s => s.id === data.showId);
      const allocations: BoardAllocation[] = [];
      const totalStamps = data.multiplier != null ? data.multiplier : 1;
      if (show && totalStamps > 0) {
        const { allocations: auto } = allocateStamps(show.stampBoards, totalStamps);
        allocations.push(...auto);
      }
      const newSchedule: Schedule = {
        ...data,
        specialEventIds: data.specialEventIds ?? [],
        isShare: data.isShare ?? false, // ✅ 기본값 보장
        id,
        boardAllocations: allocations,
        isConfirmed: false,
        status: 'draft',
        createdAt: nowISO(),
      };
      set(state => {
        const schedules = [...state.schedules, newSchedule];
        saveData(state.shows, schedules);
        return { schedules };
      });
      return id;
    },

    updateSchedule: (scheduleId, data) => {
      set(state => {
        const schedules = state.schedules.map(s =>
          s.id === scheduleId ? { ...s, ...data } : s
        );
        saveData(state.shows, schedules);
        return { schedules };
      });
    },

    changeTicket: (scheduleId, newGradeId, newDiscountId, method) => {
      set(state => {
        const schedule = state.schedules.find(s => s.id === scheduleId);
        if (!schedule) return state;
        const show = state.shows.find(s => s.id === schedule.showId);
        if (!show) return state;
        const newGrade = show.seatGrades.find(g => g.id === newGradeId);
        const newDiscount = show.discountTypes.find(d => d.id === newDiscountId);
        if (!newGrade || !newDiscount) return state;

        const newFinalPrice = calcFinalPrice(newGrade, newDiscount);
        const diff = newFinalPrice - schedule.finalPrice;

        let finalPrice: number;
        let priceDiffNote: string | undefined;

        if (method === 'recalculate') {
          finalPrice = newFinalPrice;
          priceDiffNote = undefined;
        } else {
          finalPrice = schedule.finalPrice;
          const diffLabel = diff > 0
            ? `+${diff.toLocaleString()}원`
            : `${diff.toLocaleString()}원`;
          priceDiffNote = `${newDiscount.name}으로 변경 (차액 ${diffLabel} 미반영)`;
        }

        const schedules = state.schedules.map(s =>
          s.id === scheduleId
            ? { ...s, seatGradeId: newGradeId, discountTypeId: newDiscountId, originalPrice: newGrade.price, finalPrice, priceDiffNote }
            : s
        );
        saveData(state.shows, schedules);
        return { schedules };
      });
    },

    deleteSchedule: (scheduleId) => {
      const schedule = get().schedules.find(s => s.id === scheduleId);
      set(state => {
        const schedules = state.schedules.filter(s => s.id !== scheduleId);
        let shows = state.shows;
        if (schedule && !schedule.isConfirmed) {
          shows = state.shows.map(show => {
            if (show.id !== schedule.showId) return show;
            return {
              ...show,
              stampBoards: show.stampBoards.map(board => {
                const alloc = schedule.boardAllocations.find(a => a.boardId === board.id);
                if (!alloc) return board;
                return {
                  ...board,
                  stamps: board.stamps.filter(s => s.scheduleId !== scheduleId),
                };
              }),
            };
          });
        }
        saveData(shows, schedules);
        return { shows, schedules };
      });
    },

    confirmSchedule: (scheduleId, overrideAllocations) => {
      const schedule = get().schedules.find(s => s.id === scheduleId);
      if (!schedule) return;
      const allocations = overrideAllocations || schedule.boardAllocations;

      set(state => {
        const schedules = state.schedules.map(s =>
          s.id === scheduleId
            ? { ...s, isConfirmed: true, status: 'confirmed' as const, confirmedAt: nowISO(), boardAllocations: allocations }
            : s
        );

        const today = todayKSTString();
        // ✅ 버그 수정: 미래 날짜라도 확정 시 혜택 달성 처리
        // 이전: dateHasPassed = schedule.date <= today (미래면 혜택 달성 안 됨)
        // 변경: 항상 혜택 달성 체크 (재관람 유저는 공연 전 수령 후 확정하는 경우가 많음)
        const shows = state.shows.map(show => {
          if (show.id !== schedule.showId) return show;
          const boards = show.stampBoards.map(board => {
            const alloc = allocations.find(a => a.boardId === board.id);
            if (!alloc || alloc.stamps <= 0) return board;
            const newStamps: Stamp[] = [];
            for (let i = 0; i < alloc.stamps; i++) {
              newStamps.push({
                id: genId(),
                scheduleId,
                isInitial: false,
                isConfirmed: true,
                earnedAt: schedule.date,
                stampType: 'visit' as const,
              });
            }
            const updatedStamps = [...board.stamps, ...newStamps];
            // 전체 도장 수 기준으로 혜택 달성 체크 (날짜 무관)
            const totalCount = updatedStamps.length;
            const updatedBenefits = board.benefits.map(b => {
              if (!b.isAchieved && b.requiredStamps <= totalCount) {
                return { ...b, isAchieved: true };
              }
              return b;
            });
            return {
              ...board,
              stamps: updatedStamps,
              benefits: updatedBenefits,
              isCompleted: updatedStamps.length >= board.capacity,
            };
          });
          return { ...show, stampBoards: boards };
        });
        saveData(shows, schedules);
        return { shows, schedules };
      });
    },

    cancelConfirm: (scheduleId) => {
      const schedule = get().schedules.find(s => s.id === scheduleId);
      if (!schedule || !schedule.isConfirmed) return;

      set(state => {
        const schedules = state.schedules.map(s =>
          s.id === scheduleId
            ? { ...s, isConfirmed: false, status: 'draft' as const }
            : s
        );
        const shows = state.shows.map(show => {
          if (show.id !== schedule.showId) return show;
          return {
            ...show,
            stampBoards: show.stampBoards.map(board => {
              const updatedStamps = board.stamps.filter(st => st.scheduleId !== scheduleId);
              const newCount = updatedStamps.length;
              const updatedBenefits = board.benefits.map(b => ({
                ...b,
                isAchieved: b.isAchieved ? b.requiredStamps <= newCount : false,
              }));
              return {
                ...board,
                stamps: updatedStamps,
                benefits: updatedBenefits,
                isCompleted: newCount >= board.capacity,
              };
            }),
          };
        });
        saveData(shows, schedules);
        return { shows, schedules };
      });
    },

    cancelSchedule: (scheduleId, reason, refundAmount) => {
      const schedule = get().schedules.find(s => s.id === scheduleId);
      if (!schedule) return;
      const wasConfirmed = schedule.isConfirmed;

      set(state => {
        const schedules = state.schedules.map(s =>
          s.id === scheduleId
            ? {
                ...s,
                status: 'cancelled' as const,
                isConfirmed: false,
                cancelledAt: nowISO(),
                cancelReason: reason,
                refundAmount,
              }
            : s
        );
        let shows = state.shows;
        if (wasConfirmed) {
          shows = state.shows.map(show => {
            if (show.id !== schedule.showId) return show;
            return {
              ...show,
              stampBoards: show.stampBoards.map(board => {
                const updatedStamps = board.stamps.filter(st => st.scheduleId !== scheduleId);
                const newCount = updatedStamps.length;
                const updatedBenefits = board.benefits.map(b => ({
                  ...b,
                  isAchieved: b.isAchieved ? b.requiredStamps <= newCount : false,
                }));
                return {
                  ...board,
                  stamps: updatedStamps,
                  benefits: updatedBenefits,
                  isCompleted: newCount >= board.capacity,
                };
              }),
            };
          });
        }
        saveData(shows, schedules);
        return { shows, schedules };
      });
    },

    restoreSchedule: (scheduleId) => {
      set(state => {
        const schedules = state.schedules.map(s => {
          if (s.id !== scheduleId) return s;
          const { cancelledAt: _ca, cancelReason: _cr, ...rest } = s;
          void _ca; void _cr;
          return { ...rest, status: 'draft' as const, isConfirmed: false };
        });
        saveData(state.shows, schedules);
        return { schedules };
      });
    },

    cancelShow: (showId) => {
      set(state => {
        const now = nowISO();
        const shows = state.shows.map(s =>
          s.id === showId ? { ...s, isCancelled: true, cancelledAt: now } : s
        );
        const show = state.shows.find(s => s.id === showId);
        if (!show) { saveData(shows, state.schedules); return { shows }; }

        const incompleteBoardIds = new Set(show.stampBoards.filter(b => !b.isCompleted).map(b => b.id));
        const schedules = state.schedules.map(s => {
          if (s.showId !== showId) return s;
          if (s.status === 'cancelled') return s;
          // ✅ 오타 수정: hasIncompleindigoloc → hasIncompleteAllocation
          const hasIncompleteAllocation = s.boardAllocations.some(a => incompleteBoardIds.has(a.boardId));
          if (hasIncompleteAllocation) {
            return { ...s, status: 'cancelled' as const, isConfirmed: false, cancelledAt: now };
          }
          return s;
        });

        const cancelledIds = new Set(
          schedules.filter((s, idx) => s.status === 'cancelled' && state.schedules[idx]?.status !== 'cancelled').map(s => s.id)
        );
        const updatedShows = shows.map(sh => {
          if (sh.id !== showId) return sh;
          return {
            ...sh,
            stampBoards: sh.stampBoards.map(board => {
              if (board.isCompleted) return board;
              const updatedStamps = board.stamps.filter(st => !st.scheduleId || !cancelledIds.has(st.scheduleId));
              const newCount = updatedStamps.length;
              const updatedBenefits = board.benefits.map(b => ({
                ...b,
                isAchieved: b.isAchieved ? b.requiredStamps <= newCount : false,
              }));
              return { ...board, stamps: updatedStamps, benefits: updatedBenefits, isCompleted: newCount >= board.capacity };
            }),
          };
        });
        saveData(updatedShows, schedules);
        return { shows: updatedShows, schedules };
      });
    },

    softDeleteDiscountType: (showId, discountId) => {
      set(state => {
        const shows = state.shows.map(s => {
          if (s.id !== showId) return s;
          return {
            ...s,
            discountTypes: s.discountTypes.map(d =>
              d.id === discountId ? { ...d, isDeleted: true, deletedAt: nowISO() } : d
            ),
          };
        });
        const schedules = state.schedules.map(s => {
          if (s.showId !== showId) return s;
          if (s.isConfirmed) return s;
          if (s.discountTypeId === discountId) return { ...s, discountTypeId: '' };
          return s;
        });
        saveData(shows, schedules);
        return { shows, schedules };
      });
    },

    updateScheduleCast: (scheduleId, cast) => {
      set(state => {
        const schedules = state.schedules.map(s =>
          s.id === scheduleId ? { ...s, cast: cast.slice(0, 100) } : s
        );
        saveData(state.shows, schedules);
        return { schedules };
      });
    },

    // ===== 스탬프 이벤트 CRUD =====
    addStampEvent: (showId, data) => {
      const newEvent: StampEvent = { ...data, id: genId() };
      set(state => {
        const shows = state.shows.map(s =>
          s.id === showId ? { ...s, events: [...s.events, newEvent] } : s
        );
        saveData(shows, state.schedules);
        return { shows };
      });
    },

    updateStampEvent: (showId, eventId, data) => {
      set(state => {
        const shows = state.shows.map(s => {
          if (s.id !== showId) return s;
          return { ...s, events: s.events.map(e => e.id === eventId ? { ...e, ...data } : e) };
        });
        saveData(shows, state.schedules);
        return { shows };
      });
    },

    deleteStampEvent: (showId, eventId) => {
      set(state => {
        const shows = state.shows.map(s =>
          s.id === showId ? { ...s, events: s.events.filter(e => e.id !== eventId) } : s
        );
        saveData(shows, state.schedules);
        return { shows };
      });
    },

    // ===== 특별 이벤트 CRUD =====
    addSpecialEvent: (showId, name) => {
      const newEvent: SpecialEvent = { id: genId(), name, isPreset: false, createdAt: nowISO() };
      set(state => {
        const shows = state.shows.map(s =>
          s.id === showId ? { ...s, specialEvents: [...s.specialEvents, newEvent] } : s
        );
        saveData(shows, state.schedules);
        return { shows };
      });
    },

    updateSpecialEvent: (showId, eventId, name) => {
      set(state => {
        const shows = state.shows.map(s => {
          if (s.id !== showId) return s;
          return { ...s, specialEvents: s.specialEvents.map(e => e.id === eventId ? { ...e, name } : e) };
        });
        saveData(shows, state.schedules);
        return { shows };
      });
    },

    deleteSpecialEvent: (showId, eventId) => {
      const { schedules } = get();
      const isInUse = schedules.some(s => s.showId === showId && s.specialEventIds.includes(eventId));
      set(state => {
        const shows = state.shows.map(s => {
          if (s.id !== showId) return s;
          const specialEvents = isInUse
            ? s.specialEvents.map(e => e.id === eventId ? { ...e, isDeleted: true } : e)
            : s.specialEvents.filter(e => e.id !== eventId);
          return { ...s, specialEvents };
        });
        saveData(shows, state.schedules);
        return { shows };
      });
    },

    // ===== 데이터 관리 =====
    exportData: () => {
      const { shows, schedules } = get();
      return JSON.stringify({ shows, schedules }, null, 2);
    },

    // ✅ 수정: 성공/실패 boolean 반환 (실패 시 기존 데이터 유지)
    importData: (json) => {
      try {
        const data = JSON.parse(json) as StorageData;
        // 최소한의 유효성 검사
        if (!Array.isArray(data.shows) || !Array.isArray(data.schedules)) {
          return false;
        }
        const shows = data.shows || [];
        const schedules = data.schedules || [];
        saveData(shows, schedules);
        set({ shows, schedules });
        return true;
      } catch {
        return false;
      }
    },

    resetAllData: () => {
      saveData([], []);
      set({ shows: [], schedules: [] });
    },

    // ===== 수동 도장 추가/삭제 =====
    addManualStamp: (showId, boardId, data) => {
      set(state => {
        const shows = state.shows.map(show => {
          if (show.id !== showId) return show;
          return {
            ...show,
            stampBoards: show.stampBoards.map(board => {
              if (board.id !== boardId) return board;
              const newStamps = [...board.stamps];
              for (let i = 0; i < data.count; i++) {
                newStamps.push({
                  id: genId(),
                  scheduleId: null,
                  isInitial: false,
                  isConfirmed: true,
                  earnedAt: data.earnedAt,
                  stampType: data.stampType,
                  memo: data.memo,
                });
              }
              const newCount = newStamps.length;
              const updatedBenefits = board.benefits.map(b => ({
                ...b,
                isAchieved: b.requiredStamps <= newCount,
              }));
              return {
                ...board,
                stamps: newStamps,
                benefits: updatedBenefits,
                isCompleted: newCount >= board.capacity,
              };
            }),
          };
        });
        saveData(shows, state.schedules);
        return { shows };
      });
    },

    removeManualStamp: (showId, boardId, stampId) => {
      set(state => {
        const shows = state.shows.map(show => {
          if (show.id !== showId) return show;
          return {
            ...show,
            stampBoards: show.stampBoards.map(board => {
              if (board.id !== boardId) return board;
              const updatedStamps = board.stamps.filter(s => s.id !== stampId);
              const newCount = updatedStamps.length;
              const updatedBenefits = board.benefits.map(b => ({
                ...b,
                isAchieved: b.requiredStamps <= newCount,
              }));
              return {
                ...board,
                stamps: updatedStamps,
                benefits: updatedBenefits,
                isCompleted: newCount >= board.capacity,
              };
            }),
          };
        });
        saveData(shows, state.schedules);
        return { shows };
      });
    },

    hasDuplicateDate: (showId, date, excludeScheduleId) => {
      return get().schedules.some(
        s => s.showId === showId && s.date === date && s.id !== excludeScheduleId
      );
    },

    reorderShows: (orderedIds) => {
      set(state => {
        const shows = state.shows.map(show => {
          const idx = orderedIds.indexOf(show.id);
          return idx !== -1 ? { ...show, tabOrder: idx } : show;
        });
        saveData(shows, state.schedules);
        return { shows };
      });
    },

    refreshBenefits: () => {
      set(state => {
        const today = todayKSTString();
        const shows = state.shows.map(show => ({
          ...show,
          stampBoards: show.stampBoards.map(board => {
            const effective = effectiveStampCount(board.stamps, today);
            const updatedBenefits = board.benefits.map(b => ({
              ...b,
              isAchieved: b.isAchieved
                ? b.requiredStamps <= effective
                : b.requiredStamps <= effective,
            }));
            return { ...board, benefits: updatedBenefits };
          }),
        }));
        saveData(shows, state.schedules);
        return { shows };
      });
    },
  };
});
