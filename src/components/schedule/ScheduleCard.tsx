import { useState, useRef, useEffect } from 'react';
import type { Schedule, SeatGrade, DiscountType, SpecialEvent } from '../../types';
import { todayKSTString } from '../../utils/dateUtils';
import { formatMoney } from '../../utils/priceCalc';
import Badge from '../common/Badge';

interface ScheduleCardProps {
  schedule: Schedule;
  grade: SeatGrade | null;
  discount: DiscountType | null;
  showRealCost: boolean;
  specialEvents?: SpecialEvent[];
  onDelete?: (scheduleId: string) => void;
  onConfirm?: (scheduleId: string) => void;
  onCancelConfirm?: (scheduleId: string) => void;
  onCancelSchedule?: (scheduleId: string) => void;
  onRestore?: (scheduleId: string) => void;
  onEdit?: (scheduleId: string) => void;
  onTicketChange?: (scheduleId: string) => void;
  onManualAllocate?: (scheduleId: string) => void;
  onRate?: (scheduleId: string, rating: number) => void;
  onTap?: (scheduleId: string) => void;
  showConfirmHint?: boolean;
}

const DOWS = ['일', '월', '화', '수', '목', '금', '토'];

/** V-05/V-06: 일정 카드 */
export default function ScheduleCard({
  schedule,
  grade,
  discount,
  showRealCost,
  specialEvents = [],
  onDelete,
  onConfirm,
  onCancelConfirm,
  onCancelSchedule,
  onRestore,
  onEdit,
  onTicketChange,
  onManualAllocate,
  onRate,
  onTap,
}: ScheduleCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [ratingOpen, setRatingOpen] = useState(false);
  const [diffNoteOpen, setDiffNoteOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const status = schedule.status ?? (schedule.isConfirmed ? 'confirmed' : 'draft');
  const isCancelled = status === 'cancelled';

  // 경과일
  const daysAgo = (() => {
    if (schedule.isConfirmed || isCancelled) return 0;
    const today = todayKSTString();
    if (schedule.date >= today) return 0;
    return Math.floor((new Date(today).getTime() - new Date(schedule.date).getTime()) / 86_400_000);
  })();
  const daysAgoLabel = daysAgo === 0 ? null : daysAgo === 1 ? '어제' : `${daysAgo}일 전`;
  const daysAgoColor = daysAgo >= 3 ? 'text-red-500' : 'text-amber-500';

  // 날짜 포맷: "5.8 (금)"
  const dateObj = new Date(schedule.date);
  const dateLabel = `${dateObj.getMonth() + 1}.${dateObj.getDate()} (${DOWS[dateObj.getDay()]})`;

  // 확정 24h 이내
  const canCancelConfirm = schedule.isConfirmed && schedule.confirmedAt
    ? Date.now() - new Date(schedule.confirmedAt).getTime() < 24 * 60 * 60 * 1000
    : false;

  // 이 일정에 붙은 특별 이벤트 (최대 2개)
  const scheduleEvents = (schedule.specialEventIds ?? [])
    .map(eid => specialEvents.find(e => e.id === eid && !e.isDeleted))
    .filter(Boolean)
    .slice(0, 2) as SpecialEvent[];

  // 삭제된 권종
  const isDeletedDiscount = !discount && schedule.discountTypeId && schedule.discountTypeId !== '';

  // 메뉴 노출 여부
  const showMenu = isCancelled
    ? (!!onRestore || !!onDelete)
    : (schedule.isConfirmed
        ? (canCancelConfirm || !!onCancelSchedule || !!onTicketChange || !!onRate)
        : true);

  // 왼쪽 보더 색상
  const leftBorderColor = isCancelled
    ? 'border-l-gray-300'
    : schedule.isConfirmed
    ? 'border-l-emerald-500'
    : daysAgo > 0
    ? 'border-l-amber-500'
    : 'border-l-indigo-200';

  // 배경색
  const bgColor = isCancelled
    ? 'bg-gray-50'
    : schedule.isConfirmed
    ? 'bg-gray-50'
    : 'bg-white';

  // 외부 클릭 시 메뉴 닫기
  useEffect(() => {
    if (!menuOpen) return;
    function onOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [menuOpen]);

  return (
    <div
      className={`relative rounded-xl border border-gray-200 border-l-[3px] ${leftBorderColor} ${bgColor} overflow-hidden ${isCancelled ? 'opacity-50' : ''}`}
      data-testid={`schedule-card-${schedule.id}`}
      data-schedule-id={schedule.id}
    >
      {/* ── 상단 행: 날짜 + 뱃지 + 메뉴 ── */}
      <div className="flex items-center justify-between px-[14px] pt-3">
        {/* 날짜 + 경과일 */}
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[13px] font-medium text-gray-700">{dateLabel}</span>
          {schedule.time && (
            <span className="text-[12px] text-gray-400">{schedule.time}</span>
          )}
          {daysAgoLabel && (
            <span className={`text-[11px] font-semibold ${daysAgoColor}`}>{daysAgoLabel}</span>
          )}
          {/* 확정 뱃지 */}
          {schedule.isConfirmed && !isCancelled && (
            <Badge color="green">✓ 확정</Badge>
          )}
          {/* 취소됨 뱃지 */}
          {isCancelled && (
            <Badge color="gray">취소됨</Badge>
          )}
        </div>

        {/* 우측: 뱃지들 + 메뉴 */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {discount?.isRebook && (
            <Badge color="indigo">재관람</Badge>
          )}
          {discount?.isCoupon && (
            <Badge color="indigo">쿠폰</Badge>
          )}
          {schedule.isShare && (
            <span data-testid="badge-share">
              <Badge color="gray">나눔</Badge>
            </span>
          )}
          {scheduleEvents.map(ev => (
            <Badge key={ev.id} color="amber">{ev.name}</Badge>
          ))}
          {/* 기록 불일치 뱃지 — priceDiffNote 있을 때 상단 행 노출 */}
          {schedule.priceDiffNote && (
            <button
              onClick={e => { e.stopPropagation(); setDiffNoteOpen(v => !v); }}
              className="text-[11px] bg-gray-100 text-gray-500 px-2 py-[2px] rounded-[10px] leading-none"
              style={{ flexShrink: 0 }}
            >
              기록불일치
            </button>
          )}
          {showMenu && (
            <button
              data-testid="btn-more"
              onClick={e => { e.stopPropagation(); setMenuOpen(v => !v); }}
              className="w-7 h-7 flex items-center justify-center rounded-full active:bg-black/10 text-gray-400 ml-0.5"
              aria-label="더보기 메뉴"
            >
              <svg width="14" height="14" viewBox="0 0 18 18" fill="currentColor">
                <circle cx="3" cy="9" r="1.6"/>
                <circle cx="9" cy="9" r="1.6"/>
                <circle cx="15" cy="9" r="1.6"/>
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* ── 중단: 등급·할인 + 금액 + 캐스트 ── */}
      <div
        className="px-[14px] py-[6px]"
        onClick={() => schedule.isConfirmed && onTap?.(schedule.id)}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[15px] font-semibold text-gray-900 leading-snug">
              {isDeletedDiscount
                ? <span className="text-[14px] font-normal text-gray-400">(삭제된 권종)</span>
                : !schedule.isConfirmed && !schedule.discountTypeId
                ? <span className="text-[13px] text-amber-600">⚠️ 권종 미지정</span>
                : `${grade?.name ?? '(등급 없음)'} · ${discount?.name ?? '(할인 없음)'}`
              }
            </p>
            {schedule.multiplier > 1 && (
              <span className="text-[12px] text-indigo-500 font-medium">x{schedule.multiplier} 더블적립</span>
            )}
            {schedule.cast && (
              <p className="text-[12px] text-gray-400 mt-0.5">👤 {schedule.cast}</p>
            )}
            {schedule.memo && (
              <p className="text-[12px] text-gray-400 truncate mt-0.5">{schedule.memo}</p>
            )}
            {/* 별점 */}
            {schedule.rating && schedule.rating > 0 && (
              <p className="text-xs text-yellow-500 mt-0.5">
                {'★'.repeat(schedule.rating)}{'☆'.repeat(5 - schedule.rating)}
              </p>
            )}
          </div>
          {showRealCost && (
            <div className="flex-shrink-0 text-right">
              <p className="text-[14px] font-bold text-gray-500">{formatMoney(schedule.finalPrice)}</p>
            </div>
          )}
        </div>

        {/* 기록 불일치 툴팁 */}
        {diffNoteOpen && schedule.priceDiffNote && (
          <div className="mt-1.5 flex items-start gap-1.5 bg-gray-50 rounded-lg px-2.5 py-2">
            <span className="text-gray-400 text-xs mt-0.5">ℹ️</span>
            <p className="text-xs text-gray-500 leading-relaxed">{schedule.priceDiffNote}</p>
          </div>
        )}

        {/* 별점 인라인 입력 */}
        {ratingOpen && (
          <div className="mt-2 pt-2 border-t border-gray-100">
            <p className="text-xs text-gray-500 mb-1.5">별점을 선택하세요</p>
            <div className="flex gap-2 justify-center">
              {[1, 2, 3, 4, 5].map(star => (
                <button
                  key={star}
                  onClick={e => {
                    e.stopPropagation();
                    onRate?.(schedule.id, star);
                    setRatingOpen(false);
                  }}
                  className={`text-2xl transition-transform active:scale-125 ${
                    (schedule.rating ?? 0) >= star ? 'text-yellow-400' : 'text-gray-300'
                  }`}
                >
                  ★
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── 하단 액션 ── */}
      {/* 미확정: 확정하기 버튼 */}
      {!isCancelled && !schedule.isConfirmed && (
        <div className="border-t border-gray-100 px-[14px] py-[10px]">
          <button
            data-testid="btn-confirm"
            onClick={e => { e.stopPropagation(); onConfirm?.(schedule.id); }}
            className="w-full h-[40px] bg-indigo-600 text-white rounded-[10px] text-[14px] font-semibold active:bg-indigo-800 transition-colors"
          >
            확정하기
          </button>
        </div>
      )}

      {/* ── 드롭다운 메뉴 ── */}
      {showMenu && menuOpen && (
        <div className="absolute right-2 top-8 z-50" ref={menuRef}>
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 w-36 overflow-hidden">
            {/* 취소된 일정 */}
            {isCancelled && (
              <>
                {onRestore && (
                  <button
                    data-testid="menu-restore-schedule"
                    onClick={e => { e.stopPropagation(); setMenuOpen(false); onRestore(schedule.id); }}
                    className="w-full px-4 py-3 text-sm text-indigo-600 active:bg-indigo-50 text-left"
                  >
                    복구
                  </button>
                )}
                {onDelete && (
                  <button
                    onClick={e => { e.stopPropagation(); setMenuOpen(false); onDelete(schedule.id); }}
                    className="w-full px-4 py-3 text-sm text-red-600 active:bg-red-50 text-left border-t border-gray-50"
                  >
                    일정 삭제
                  </button>
                )}
              </>
            )}

            {/* 미확정 */}
            {!isCancelled && !schedule.isConfirmed && (
              <>
                {onEdit && (
                  <button
                    data-testid="menu-edit-schedule"
                    onClick={e => { e.stopPropagation(); setMenuOpen(false); onEdit(schedule.id); }}
                    className="w-full px-4 py-3 text-sm text-gray-700 active:bg-gray-100 text-left"
                  >
                    일정 수정
                  </button>
                )}
                {onManualAllocate && (
                  <button
                    onClick={e => { e.stopPropagation(); setMenuOpen(false); onManualAllocate(schedule.id); }}
                    className="w-full px-4 py-3 text-sm text-gray-700 active:bg-gray-100 text-left"
                  >
                    배분 조정
                  </button>
                )}
                {onDelete && (
                  <button
                    onClick={e => { e.stopPropagation(); setMenuOpen(false); onDelete(schedule.id); }}
                    className="w-full px-4 py-3 text-sm text-red-600 active:bg-red-50 text-left border-t border-gray-50"
                  >
                    일정 삭제
                  </button>
                )}
              </>
            )}

            {/* 확정 */}
            {!isCancelled && schedule.isConfirmed && (
              <>
                {onTicketChange && (
                  <button
                    data-testid="menu-ticket-change"
                    onClick={e => { e.stopPropagation(); setMenuOpen(false); onTicketChange(schedule.id); }}
                    className="w-full px-4 py-3 text-sm text-gray-700 active:bg-gray-100 text-left"
                  >
                    티켓 변경
                  </button>
                )}
                {onRate && (
                  <button
                    onClick={e => { e.stopPropagation(); setMenuOpen(false); setRatingOpen(v => !v); }}
                    className="w-full px-4 py-3 text-sm text-gray-700 active:bg-gray-100 text-left"
                  >
                    별점 남기기 {schedule.rating ? '★'.repeat(schedule.rating) : ''}
                  </button>
                )}
                {canCancelConfirm && onCancelConfirm && (
                  <button
                    data-testid="menu-cancel-confirm"
                    onClick={e => { e.stopPropagation(); setMenuOpen(false); onCancelConfirm(schedule.id); }}
                    className="w-full px-4 py-3 text-sm text-gray-700 active:bg-gray-100 text-left"
                  >
                    확정 취소
                  </button>
                )}
                {onCancelSchedule && (
                  <button
                    onClick={e => { e.stopPropagation(); setMenuOpen(false); onCancelSchedule(schedule.id); }}
                    className="w-full px-4 py-3 text-sm text-gray-700 active:bg-gray-50 text-left border-t border-gray-100"
                  >
                    일정 취소 (불참)
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
