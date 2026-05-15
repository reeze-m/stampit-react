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
    // earnedAt이 YYYY-MM-DD 또는 ISO timestamp 형식 모두 slice(0,10)으로 날짜 비교
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
  /** 이전 판 설정 복사하여 즉시 새 판 생성 (혜택 달성 모달 원탭 시작) */
  createNextBoard: (params: { showId: string; name: string; capacity: number; sourceBenefits: Benefit[]; stampColor?: string }) => string;
  updateStampBoard: (showId: string, boardId: string, data: Partial<StampBoard>) => void;
  deleteStampBoard: (showId: string, boardId: string) => void;
  /** 확정 도장 있는 판 — 소프트 딜리트 (isHidden: true) */
  hideBoard: (showId: string, boardId: string) => void;
  /** 숨겨진 판 복구 */
  restoreBoard: (showId: string, boardId: string) => void;
  reorderBoards: (showId: string, orderedIds: string[]) => void;

  // 혜택 CRUD
  addBenefit: (showId: string, boardId: string, data: Omit<Benefit, 'id' | 'isAchieved' | 'isUsed'>) => void;
  updateBenefit: (showId: string, boardId: string, benefitId: string, data: Partial<Benefit>) => void;
  deleteBenefit: (showId: string, boardId: string, benefitId: string) => void;
  markBenefitAchieved: (showId: string, boardId: string, benefitId: string) => void;
  markBenefitUsed: (showId: string, boardId: string, benefitId: string, couponCode?: string, attachmentUrl?: string) => void;
  /** 혜택 사용 완료 — isUsed: true, usedAt: now */
  useBenefit: (showId: string, boardId: string, benefitId: string) => void;
  /** 혜택 사용 취소 — isUsed: false, usedAt: undefined */
  unuseBenefit: (showId: string, boardId: string, benefitId: string) => void;
  /** 혜택 사용 방법 메모 저장 */
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
  /** 취소된 일정 복구 → status: 'draft', 도장 재배분은 사용자가 직접 확정 시 처리 */
  restoreSchedule: (scheduleId: string) => void;
  /** 티켓 변경 — recalculate: 금액 재계산 / note-only: 기존 금액 유지 + 메모 */
  changeTicket: (
    scheduleId: string,
    newGradeId: string,
    newDiscountId: string,
    method: 'recalculate' | 'note-only'
  ) => void;
  softDeleteDiscountType: (showId: string, discountId: string) => void;
  updateScheduleCast: (scheduleId: string, cast: string) => void;

  // 스탬프 이벤트 CRUD
  addStampEvent: (showId: string, data: Omit<StampEvent, 'id'>) => void;
  updateStampEvent: (showId: string, eventId: string, data: Partial<StampEvent>) => void;
  deleteStampEvent: (showId: string, eventId: string) => void;

  // 특별 이벤트 CRUD
  addSpecialEvent: (showId: string, name: string) => void;
  updateSpecialEvent: (showId: string, eventId: string, name: string) => void;
  /** 사용 중이면 soft delete, 미사용이면 hard delete */
  deleteSpecialEvent: (showId: string, eventId: string) => void;

  // 데이터 관리
  exportData: () => string;
  importData: (json: string) => void;
  resetAllData: () => void;

  // 수동 도장 추가/삭제 (4.15)
  addManualStamp: (showId: string, boardId: string, data: { stampType: 'exchange' | 'share' | 'etc'; count: number; memo?: string; earnedAt: string }) => void;
  removeManualStamp: (showId: string, boardId: string, stampId: string) => void;

  // 중복 날짜 감지
  hasDuplicateDate: (showId: string, date: string, excludeScheduleId?: string) => boolean;

  // 공연 탭 순서 변경 (4.16)
  reorderShows: (orderedIds: string[]) => void;

  /**
   * 날짜 기반 혜택 달성 재계산 (앱 시작 시 호출)
   * 확정 도장의 earnedAt(YYYY-MM-DD)이 오늘 이전인 경우만 혜택 달성으로 인정
   */
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

  // 마이그레이션: tabOrder 없는 Show에 생성 순서 기준 부여 (4.16)
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

  // 마이그레이션 결과 저장 (다음 로드 시 재적용 방지)
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
        tabOrder: activeCount, // 새 공연은 가장 뒤
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

      // initialStamps 만큼의 도장 미리 생성
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
      // initialStamps 기준으로 이미 달성된 혜택을 isAchieved: true로 설정
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
        // 해당 보드의 미확정 스탬프 배분 제거
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
      const newBenefit: Benefit = {
        ...data,
        id: genId(),
        isAchieved: false,
        isUsed: false,
      };
      set(state => {
        const shows = state.shows.map(s => {
          if (s.id !== showId) return s;
          return {
            ...s,
            stampBoards: s.stampBoards.map(b =>
              b.id === boardId
                ? { ...b, benefits: [...b.benefits, newBenefit] }
                : b
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
              return {
                ...b,
                benefits: b.benefits.filter(ben => ben.id !== benefitId),
              };
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
                    ? {
                        ...ben,
                        isUsed: true,
                        usedAt: nowISO(),
                        couponCode,
                        attachmentUrl,
                      }
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
          s.id === showId
            ? { ...s, seatGrades: [...s.seatGrades, newGrade] }
            : s
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
            seatGrades: s.seatGrades.map(g =>
              g.id === gradeId ? { ...g, ...data } : g
            ),
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
      // 자동 배분 미리 계산 (미확정 상태, 나눔 관극 multiplier=0이면 배분 없음)
      const allocations: BoardAllocation[] = [];
      const totalStamps = data.multiplier != null ? data.multiplier : 1;
      if (show && totalStamps > 0) {
        const { allocations: auto } = allocateStamps(show.stampBoards, totalStamps);
        allocations.push(...auto);
      }
      const newSchedule: Schedule = {
        ...data,
        specialEventIds: data.specialEventIds ?? [],
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
        // 미확정 스케줄 삭제 시 도장 제거
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
        // 각 보드에 확정 도장 추가 및 혜택 달성 체크
        const today = todayKSTString();
        // 미래 일정이면 혜택 달성 불가 (날짜가 당도해야 혜택 발생)
        const dateHasPassed = schedule.date <= today;

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
                // 관람 날짜를 earnedAt으로 사용 (확정 시각이 아닌 실제 관람일)
                earnedAt: schedule.date,
                stampType: 'visit' as const,
              });
            }
            const updatedStamps = [...board.stamps, ...newStamps];
            // 혜택 달성은 날짜가 지난 도장 수 기준으로 체크
            const effectiveCount = effectiveStampCount(updatedStamps, today);
            const updatedBenefits = board.benefits.map(b => {
              if (!b.isAchieved && dateHasPassed && b.requiredStamps <= effectiveCount) {
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

    // ===== SC-29: 확정 취소 =====
    cancelConfirm: (scheduleId) => {
      const schedule = get().schedules.find(s => s.id === scheduleId);
      if (!schedule || !schedule.isConfirmed) return;

      set(state => {
        const schedules = state.schedules.map(s =>
          s.id === scheduleId
            ? { ...s, isConfirmed: false, status: 'draft' as const }
            : s
        );
        // 해당 scheduleId로 적립된 확정 도장 제거 + 혜택 재계산
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

    // ===== SC-30: 일정 취소 불참 =====
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
        // 확정 일정이었다면 도장 회수 + 혜택 재계산
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

    // ===== M-03: 취소 일정 복구 =====
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

    // ===== SC-30: 공연 전체 취소 =====
    cancelShow: (showId) => {
      set(state => {
        const now = nowISO();
        const shows = state.shows.map(s =>
          s.id === showId ? { ...s, isCancelled: true, cancelledAt: now } : s
        );
        // 미완성 판의 모든 일정 취소 + 도장 회수
        const show = state.shows.find(s => s.id === showId);
        if (!show) { saveData(shows, state.schedules); return { shows }; }

        const incompleteBoardIds = new Set(show.stampBoards.filter(b => !b.isCompleted).map(b => b.id));
        const schedules = state.schedules.map(s => {
          if (s.showId !== showId) return s;
          if (s.status === 'cancelled') return s;
          // 미완성 판에 배분된 일정만 취소
          const hasIncompleindigoloc = s.boardAllocations.some(a => incompleteBoardIds.has(a.boardId));
          if (hasIncompleindigoloc) {
            return { ...s, status: 'cancelled' as const, isConfirmed: false, cancelledAt: now };
          }
          return s;
        });

        // 취소된 일정에서 도장 회수 (미완성 판)
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

    // ===== SC-32: 소프트 삭제 권종 =====
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
        // 미확정 일정 중 해당 discountTypeId를 가진 것: discountTypeId = ''
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

    // ===== SC-31: 캐스트 업데이트 =====
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
          s.id === showId
            ? { ...s, events: [...s.events, newEvent] }
            : s
        );
        saveData(shows, state.schedules);
        return { shows };
      });
    },

    updateStampEvent: (showId, eventId, data) => {
      set(state => {
        const shows = state.shows.map(s => {
          if (s.id !== showId) return s;
          return {
            ...s,
            events: s.events.map(e =>
              e.id === eventId ? { ...e, ...data } : e
            ),
          };
        });
        saveData(shows, state.schedules);
        return { shows };
      });
    },

    deleteStampEvent: (showId, eventId) => {
      set(state => {
        const shows = state.shows.map(s =>
          s.id === showId
            ? { ...s, events: s.events.filter(e => e.id !== eventId) }
            : s
        );
        saveData(shows, state.schedules);
        return { shows };
      });
    },

    // ===== 특별 이벤트 CRUD =====
    addSpecialEvent: (showId, name) => {
      const newEvent: SpecialEvent = {
        id: genId(),
        name,
        isPreset: false,
        createdAt: nowISO(),
      };
      set(state => {
        const shows = state.shows.map(s =>
          s.id === showId
            ? { ...s, specialEvents: [...s.specialEvents, newEvent] }
            : s
        );
        saveData(shows, state.schedules);
        return { shows };
      });
    },

    updateSpecialEvent: (showId, eventId, name) => {
      set(state => {
        const shows = state.shows.map(s => {
          if (s.id !== showId) return s;
          return {
            ...s,
            specialEvents: s.specialEvents.map(e =>
              e.id === eventId ? { ...e, name } : e
            ),
          };
        });
        saveData(shows, state.schedules);
        return { shows };
      });
    },

    deleteSpecialEvent: (showId, eventId) => {
      const { schedules } = get();
      const isInUse = schedules.some(
        s => s.showId === showId && s.specialEventIds.includes(eventId)
      );
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

    importData: (json) => {
      try {
        const data = JSON.parse(json) as StorageData;
        const shows = data.shows || [];
        const schedules = data.schedules || [];
        saveData(shows, schedules);
        set({ shows, schedules });
      } catch {
        // 파싱 실패 시 무시
      }
    },

    resetAllData: () => {
      saveData([], []);
      set({ shows: [], schedules: [] });
    },

    // ===== 수동 도장 추가/삭제 (4.15) =====
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

    // ===== 중복 날짜 감지 =====
    hasDuplicateDate: (showId, date, excludeScheduleId) => {
      return get().schedules.some(
        s =>
          s.showId === showId &&
          s.date === date &&
          s.id !== excludeScheduleId
      );
    },

    // ===== 공연 탭 순서 변경 (4.16) =====
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
              // 이미 달성된 혜택은 유지, 미달성은 effective count 기준 재평가
              isAchieved: b.isAchieved
                ? b.requiredStamps <= effective   // 취소 등으로 도장이 줄었다면 해제 가능
                : b.requiredStamps <= effective,  // 날짜가 지나 새로 달성
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
