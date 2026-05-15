import { describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import QuickConfirmCard from '../../components/planner/QuickConfirmCard';
import type { Schedule, SeatGrade, DiscountType, StampBoard, Stamp } from '../../types';

// ── 헬퍼 ─────────────────────────────────────────────────────────────────────

function makeSchedule(overrides: Partial<Schedule> = {}): Schedule {
  return {
    id: 'sc1',
    showId: 'show1',
    date: '2026-04-19',
    seatGradeId: 'g1',
    discountTypeId: 'd1',
    finalPrice: 77000,
    originalPrice: 110000,
    multiplier: 1,
    boardAllocations: [],
    isConfirmed: false,
    createdAt: '',
    status: 'draft',
    specialEventIds: [],
    ...overrides,
  };
}

function makeGrade(overrides: Partial<SeatGrade> = {}): SeatGrade {
  return { id: 'g1', name: 'VIP', price: 110000, ...overrides };
}

function makeDiscount(overrides: Partial<DiscountType> = {}): DiscountType {
  return {
    id: 'd1', name: '학생할인', method: 'rate', value: 30,
    isRebook: false, isCoupon: false,
    ...overrides,
  };
}

function makeBoard(id: string, sortOrder: number, overrides: Partial<StampBoard> = {}): StampBoard {
  return {
    id,
    showId: 'show1',
    name: `${id}판`,
    capacity: 10,
    initialStamps: 0,
    stamps: [] as Stamp[],
    benefits: [],
    isActive: true,
    isCompleted: false,
    sortOrder,
    createdAt: '',
    ...overrides,
  };
}

// ── QuickConfirmCard 테스트 ───────────────────────────────────────────────────

describe('QuickConfirmCard', () => {
  const baseProps = {
    schedules: [makeSchedule()],
    seatGrades: [makeGrade()],
    discountTypes: [makeDiscount()],
    stampBoards: [makeBoard('b1', 1)],
    onConfirm: vi.fn(),
    onQuickConfirm: vi.fn(),
  };

  test('오늘 미확정 일정 있으면 카드 노출', () => {
    render(<QuickConfirmCard {...baseProps} />);
    expect(screen.getByTestId('quick-confirm-card')).toBeInTheDocument();
  });

  test('schedules가 비어있으면 렌더링 없음', () => {
    render(<QuickConfirmCard {...baseProps} schedules={[]} />);
    expect(screen.queryByTestId('quick-confirm-card')).not.toBeInTheDocument();
  });

  test('일정 등급·할인명·금액 표시', () => {
    render(<QuickConfirmCard {...baseProps} />);
    expect(screen.getByText(/VIP/)).toBeInTheDocument();
    expect(screen.getByText(/학생할인/)).toBeInTheDocument();
    expect(screen.getByText(/77,000/)).toBeInTheDocument();
  });

  test('확정하기 버튼 클릭 → onQuickConfirm(scheduleId) 호출 (체크리스트 없음)', () => {
    const onQuickConfirm = vi.fn();
    render(<QuickConfirmCard {...baseProps} onQuickConfirm={onQuickConfirm} />);
    fireEvent.click(screen.getByTestId('quick-confirm-btn'));
    expect(onQuickConfirm).toHaveBeenCalledWith('sc1');
  });

  test('재관람표 할인 → 버튼 클릭 시 onConfirm(scheduleId) 호출', () => {
    const onConfirm = vi.fn();
    const discount = makeDiscount({ isRebook: true });
    render(<QuickConfirmCard {...baseProps} discountTypes={[discount]} onConfirm={onConfirm} />);
    fireEvent.click(screen.getByTestId('quick-confirm-btn'));
    expect(onConfirm).toHaveBeenCalledWith('sc1');
  });

  test('1순위 활성 도장판 배분 예정 표시', () => {
    render(<QuickConfirmCard {...baseProps} />);
    expect(screen.getByText(/b1판/)).toBeInTheDocument();
    expect(screen.getByText(/배분 예정/)).toBeInTheDocument();
  });

  test('도장판 없으면 배분 예정 문구 없음', () => {
    render(<QuickConfirmCard {...baseProps} stampBoards={[]} />);
    expect(screen.queryByText(/배분 예정/)).not.toBeInTheDocument();
  });

  test('2개 이상 일정 → 도트 인디케이터 및 n/m 표시', () => {
    const schedules = [
      makeSchedule({ id: 'sc1' }),
      makeSchedule({ id: 'sc2', seatGradeId: 'g1', discountTypeId: 'd1' }),
    ];
    render(<QuickConfirmCard {...baseProps} schedules={schedules} />);
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
  });

  test('도트 클릭으로 다른 일정으로 전환', () => {
    const sc2 = makeSchedule({ id: 'sc2', finalPrice: 55000 });
    const schedules = [makeSchedule({ id: 'sc1' }), sc2];
    render(<QuickConfirmCard {...baseProps} schedules={schedules} />);

    fireEvent.click(screen.getByLabelText('2번 일정'));
    // 두번째 일정 가격 노출
    expect(screen.getByText(/55,000/)).toBeInTheDocument();
  });

  test('isRebook → 재관람표 챙기기 안내 노출', () => {
    const discount = makeDiscount({ isRebook: true });
    render(<QuickConfirmCard {...baseProps} discountTypes={[discount]} />);
    expect(screen.getByText(/재관람표를 챙기세요/)).toBeInTheDocument();
  });

  test('isCoupon → 쿠폰 챙기기 안내 노출', () => {
    const discount = makeDiscount({ isCoupon: true });
    render(<QuickConfirmCard {...baseProps} discountTypes={[discount]} />);
    expect(screen.getByText(/쿠폰을 챙기세요/)).toBeInTheDocument();
  });

  test('더블적립(multiplier>1) 표시', () => {
    const schedule = makeSchedule({ multiplier: 2 });
    render(<QuickConfirmCard {...baseProps} schedules={[schedule]} />);
    expect(screen.getByText(/더블적립/)).toBeInTheDocument();
  });

  test('완료된 도장판은 1순위 추천 제외', () => {
    const completedBoard = makeBoard('b_done', 1, { isCompleted: true });
    const activeBoard = makeBoard('b_active', 2, { isCompleted: false });
    render(
      <QuickConfirmCard
        {...baseProps}
        stampBoards={[completedBoard, activeBoard]}
      />
    );
    // b_active가 2순위지만 활성 중 1순위이므로 배분 대상
    expect(screen.getByText(/b_active판/)).toBeInTheDocument();
  });
});
