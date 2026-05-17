import { useState } from 'react';
import type { Schedule, SeatGrade, DiscountType, StampBoard, SpecialEvent } from '../../types';
import { formatMoney } from '../../utils/priceCalc';
import Badge from '../common/Badge';
import Slide1Tickets from '../onboarding/illustrations/Slide1Tickets';
import { sortBoardsByNextBenefit } from '../../utils/boardUtils';
import { todayKSTString } from '../../utils/dateUtils';

interface QuickConfirmCardProps {
  /** 오늘 미확정 일정 목록 */
  schedules: Schedule[];
  seatGrades: SeatGrade[];
  discountTypes: DiscountType[];
  stampBoards: StampBoard[];
  /** 체크리스트 필요 → ConfirmScheduleSheet 오픈 */
  onConfirm: (scheduleId: string) => void;
  /** 체크리스트 불필요 → 원탭 즉시 확정 */
  onQuickConfirm: (scheduleId: string) => void;
  /** 공연명 (빈 상태 + 카드 헤더용) */
  showName?: string;
  /** 특별 이벤트 목록 (칩 표시용) */
  specialEvents?: SpecialEvent[];
  /** 다음 예정 일정 정보 (빈 상태 힌트) */
  nextUpcoming?: { date: string; dday: string } | null;
}

/** V-02: 오늘의 일정 퀵카드 */
export default function QuickConfirmCard({
  schedules,
  seatGrades,
  discountTypes,
  stampBoards,
  onConfirm,
  onQuickConfirm,
  showName,
  specialEvents = [],
  nextUpcoming,
}: QuickConfirmCardProps) {
  const [idx, setIdx] = useState(0);

  /* ── 빈 상태 ──────────────────────────────────────────────── */
  if (schedules.length === 0) {
    const hintText = (() => {
      if (!nextUpcoming) return null;
      const { dday } = nextUpcoming;
      const prefix = dday === '내일' ? '내일' : dday;
      return `${prefix}${showName ? ` ${showName}` : ''} 공연이 있어요`;
    })();

    return (
      <div
        className="bg-gray-50 border border-dashed border-gray-200 rounded-xl px-4 py-4 text-center"
        data-testid="no-today-schedule"
      >
        <div className="flex justify-center mb-2">
          <Slide1Tickets />
        </div>
        <p className="text-sm text-gray-400 font-medium">오늘 예정된 관람이 없어요</p>
        {hintText && (
          <p className="text-xs text-gray-400 mt-1">{hintText}</p>
        )}
      </div>
    );
  }

  /* ── 일정 있음 ─────────────────────────────────────────────── */
  const clampedIdx = Math.min(idx, schedules.length - 1);
  const schedule = schedules[clampedIdx];
  const grade = seatGrades.find(g => g.id === schedule.seatGradeId) ?? null;
  const discount = discountTypes.find(d => d.id === schedule.discountTypeId) ?? null;
  const needsChecklist = !!(discount?.isRebook || discount?.isCoupon);

  // 1순위 활성 도장판 (다음 혜택까지 가장 가까운 판)
  const targetBoard = sortBoardsByNextBenefit(
    stampBoards.filter(b => b.isActive && !b.isCompleted),
    todayKSTString()
  )[0] ?? null;

  // 이 일정에 붙은 특별 이벤트 칩
  const scheduleEvents = (schedule.specialEventIds ?? [])
    .map(eid => specialEvents.find(e => e.id === eid && !e.isDeleted))
    .filter(Boolean) as SpecialEvent[];

  return (
    <div
      className="bg-white rounded-xl shadow-sm border-l-4 border-l-indigo-600 overflow-hidden"
      data-testid="quick-confirm-card"
    >
      <div className="px-4 pt-3.5 pb-4">
        {/* 상단: 오늘 · showName + 이벤트 칩 + 다건 카운터 */}
        <div className="flex items-center gap-1.5 flex-wrap mb-2">
          <span className="text-xs font-semibold text-indigo-600">
            오늘{showName ? ` · ${showName}` : ''}
          </span>
          {scheduleEvents.slice(0, 2).map(ev => (
            <Badge key={ev.id} color="amber">{ev.name}</Badge>
          ))}
          {schedules.length > 1 && (
            <span className="ml-auto text-xs text-gray-400 font-medium">
              {clampedIdx + 1} / {schedules.length}
            </span>
          )}
        </div>

        {/* 중단: 등급 · 할인 + 금액 */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="min-w-0">
            <p className="text-sm font-bold text-gray-800 leading-snug">
              {grade?.name ?? '(등급 없음)'} · {discount?.name ?? '(할인 없음)'}
            </p>
            {schedule.time && (
              <p className="text-xs text-gray-400 mt-0.5">{schedule.time}</p>
            )}
            {targetBoard && (
              <p className="text-xs text-gray-400 mt-0.5">
                {targetBoard.name} +{schedule.multiplier || 1}도장 배분 예정
              </p>
            )}
            {schedule.multiplier > 1 && (
              <span className="inline-block text-xs text-indigo-500 font-medium mt-0.5">
                x{schedule.multiplier} 더블적립
              </span>
            )}
          </div>
          <p className="text-base font-bold text-gray-900 flex-shrink-0">
            {formatMoney(schedule.finalPrice)}
          </p>
        </div>

        {/* 체크리스트 안내 (amber) */}
        {needsChecklist && (
          <div className="bg-amber-50 rounded-lg px-3 py-2 mb-3 space-y-0.5">
            {discount?.isRebook && (
              <p className="text-xs text-amber-700">📋 재관람표를 챙기세요</p>
            )}
            {discount?.isCoupon && (
              <p className="text-xs text-amber-700">🎫 쿠폰을 챙기세요</p>
            )}
          </div>
        )}

        {/* 다건 도트 인디케이터 */}
        {schedules.length > 1 && (
          <div className="flex justify-center gap-1.5 mb-3">
            {schedules.map((_, i) => (
              <button
                key={i}
                onClick={() => setIdx(i)}
                className={`rounded-full transition-all ${
                  i === clampedIdx
                    ? 'w-3 h-2 bg-indigo-600'
                    : 'w-2 h-2 bg-gray-200'
                }`}
                aria-label={`${i + 1}번 일정`}
              />
            ))}
          </div>
        )}

        {/* 하단: 확정하기 버튼 (전체 너비, 48px) */}
        <button
          data-testid={needsChecklist ? 'btn-confirm' : 'btn-instant-confirm'}
          onClick={() => needsChecklist ? onConfirm(schedule.id) : onQuickConfirm(schedule.id)}
          className="w-full py-3 bg-indigo-600 text-white rounded-xl text-sm font-bold min-h-[48px] active:bg-indigo-800 transition-colors"
        >
          확정하기
        </button>
      </div>
    </div>
  );
}
