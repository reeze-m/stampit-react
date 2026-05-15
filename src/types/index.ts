export interface SpecialEvent {
  id: string;
  name: string;
  isPreset: boolean;
  isDeleted?: boolean;
  createdAt: string;
}

export interface ShowReport {
  generatedAt: string;         // 리포트 생성 시각 (ISO)

  // 관람 통계
  totalVisits: number;         // 총 관람 횟수 (나눔 포함)
  confirmedVisits: number;     // 확정 관람 횟수
  firstVisitDate: string;      // 첫 관람일 (YYYY-MM-DD)
  lastVisitDate: string;       // 마지막 관람일 (YYYY-MM-DD)

  // 비용
  totalSpent: number;          // 총 지출 (취소·나눔 제외)
  totalSaved: number;          // 총 절약 금액 (originalPrice - finalPrice 합산)

  // 도장판
  completedBoards: number;     // 완성된 판 수
  totalStamps: number;         // 총 적립 도장 수

  // 혜택
  achievedBenefits: {
    description: string;       // 혜택명
    count: number;             // 달성 횟수 (도장판 여러 개 합산)
    usedCount: number;         // 사용 완료 횟수
  }[];

  // 캐스트 (관람 횟수 내림차순 상위 5)
  topCasts: {
    name: string;
    count: number;
  }[];

  // 특별 이벤트 (참여 횟수 내림차순)
  specialEventSummary: {
    name: string;
    count: number;
  }[];
}

export interface Show {
  id: string;
  name: string;
  venue?: string;
  startDate: string;
  endDate: string;
  color: string; // hex, one of 6 presets
  headerImageUrl?: string; // base64 data URL
  seatGrades: SeatGrade[];
  discountTypes: DiscountType[];
  stampBoards: StampBoard[];
  events: StampEvent[];
  specialEvents: SpecialEvent[];
  isArchived: boolean;
  createdAt: string;
  tabOrder?: number; // 낮을수록 탭바 앞에 표시 (기본값: 생성 순서)
  isCancelled?: boolean;
  cancelledAt?: string;
  archivePromptDismissed?: boolean;
  report?: ShowReport;         // 아카이브 시 자동 생성, 이후 수정 없음
}

export interface SeatGrade {
  id: string;
  name: string;
  price: number;
}

export interface DiscountType {
  id: string;
  name: string;
  method: 'rate' | 'amount' | 'direct';
  value: number;
  isRebook: boolean;
  isCoupon: boolean;
  isDeleted?: boolean;
  deletedAt?: string;
}

export interface StampBoard {
  id: string;
  showId: string;
  name: string;
  capacity: number;
  initialStamps: number;
  stamps: Stamp[];
  benefits: Benefit[];
  isActive: boolean;
  isCompleted: boolean;
  sortOrder: number;
  createdAt: string;
  stampColor?: string; // 도장 색상 (hex, 기본 #0d9488)
  isHidden?: boolean;  // 소프트 딜리트 플래그 (확정 도장 있는 판)
  hiddenAt?: string;
}

export type StampType = 'visit' | 'initial' | 'exchange' | 'share' | 'etc';

export interface Stamp {
  id: string;
  scheduleId: string | null;
  isInitial: boolean;
  isConfirmed: boolean;
  earnedAt: string;
  stampType?: StampType;  // 미설정 시 isInitial ? 'initial' : 'visit'
  memo?: string;
}

export interface Benefit {
  id: string;
  requiredStamps: number;
  description: string;
  priority: number;
  isAchieved: boolean;
  isUsed: boolean;
  usedAt?: string;
  attachmentUrl?: string;
  couponCode?: string;
  usageNote?: string;  // 혜택 사용 방법 메모
}

export interface Schedule {
  id: string;
  showId: string;
  date: string;
  time?: string;
  seatGradeId: string | null;
  discountTypeId: string | null;
  finalPrice: number;
  originalPrice: number;
  multiplier: number;
  boardAllocations: BoardAllocation[];
  isConfirmed: boolean;
  memo?: string;
  note?: string;
  rating?: number;
  createdAt: string;
  status?: 'draft' | 'confirmed' | 'cancelled';
  cancelledAt?: string;
  cancelReason?: string;
  confirmedAt?: string;
  cast?: string;
  specialEventIds: string[];  // 기본값 []
  refundAmount?: number;
  priceDiffNote?: string;  // 차액 미반영 시 자동 생성 메모
  isShare?: boolean;  // 나눔 관극 여부
}

export interface BoardAllocation {
  boardId: string;
  stamps: number;
}

export interface StampEvent {
  id: string;
  name: string;
  startDate: string;
  endDate?: string;
  multiplier: number;
  targetScheduleId?: string;
}

export interface AppSettings {
  showRealCost: boolean;
  onboardingDone: boolean;
  hasCompletedQuickStart?: boolean;
  hasSeenConfirmTip?: boolean;
  lastUsedShowId?: string;
  lastUsedSeatGradeId?: string;
  lastUsedDiscountTypeId?: string;
}

export interface UndoAction {
  type: 'DELETE_SCHEDULE' | 'CANCEL_SCHEDULE' | 'DELETE_BOARD' | 'CHANGE_TICKET';
  payload: unknown;
  expiresAt: number;
  message: string;
}

export interface SimulatorBoardResult {
  boardId: string;
  boardName: string;
  stampsAdded: number;
  achievedBenefits: {
    description: string;
    requiredStamps: number;
  }[];
}

export interface SimulatorResult {
  totalBenefits: number;
  boardResults: SimulatorBoardResult[];
}
