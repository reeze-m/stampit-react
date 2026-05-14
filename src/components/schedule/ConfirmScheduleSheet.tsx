import React, { useState, useMemo, useEffect } from 'react';
import type { Schedule, Show, BoardAllocation } from '../../types';
import { formatKSTDate } from '../../utils/dateUtils';
import { formatMoney } from '../../utils/priceCalc';

interface ConfirmScheduleSheetProps {
  isOpen: boolean;
  onClose: () => void;
  schedule: Schedule | null;
  schedules?: Schedule[];
  show: Show;
  onConfirm: (scheduleId: string, allocations: BoardAllocation[], multiplierOverride?: number, cast?: string) => void;
}

/** 관람 확정 바텀 시트 */
export default function ConfirmScheduleSheet({
  isOpen,
  onClose,
  schedule,
  show,
  onConfirm,
}: ConfirmScheduleSheetProps) {

  // ── 파생 데이터 ────────────────────────────────────────────────────────
  const discount = schedule ? show.discountTypes.find(d => d.id === schedule.discountTypeId) : undefined;
  const grade    = schedule ? show.seatGrades.find(g => g.id === schedule.seatGradeId) : undefined;

  const activeBoards = useMemo(() =>
    show.stampBoards
      .filter(b => b.isActive && !b.isCompleted && !b.isHidden)
      .sort((a, b) => a.sortOrder - b.sortOrder),
    [show.stampBoards]
  );

  // 이 스케줄에 적용되는 배수 이벤트
  const activeEvent = useMemo(() =>
    schedule
      ? show.events.find(e =>
          e.startDate <= schedule.date &&
          (!e.endDate || e.endDate >= schedule.date)
        )
      : undefined,
    [show.events, schedule]
  );
  const hasEvent = !!activeEvent;

  // ── state ──────────────────────────────────────────────────────────────
  const [rebookChecked,   setRebookChecked]   = useState(false);
  const [couponChecked,   setCouponChecked]   = useState(false);
  const [selectedBoardId, setSelectedBoardId] = useState<string>(activeBoards[0]?.id ?? '');
  const [selectedCast,    setSelectedCast]    = useState<string>(schedule?.cast ?? '');
  const [multiplier,      setMultiplier]      = useState<number>(
    hasEvent ? (activeEvent?.multiplier ?? 1) : 1
  );
  const [showSummary,    setShowSummary]    = useState(false);
  const [showMultiplier, setShowMultiplier] = useState(false);
  const [keyboardOffset, setKeyboardOffset] = useState(0);

  // ── 시트 열릴 때마다 전체 상태 리셋 ──────────────────────────────────────
  // useState 초기값은 최초 마운트 시 1회만 실행됨.
  // isOpen/schedule 변경 시 리셋하지 않으면 이전 확정의 multiplier(=1)가
  // 이벤트 일정에도 그대로 적용되어 도장이 1개만 찍히는 버그 발생.
  useEffect(() => {
    if (!isOpen || !schedule) return;
    setRebookChecked(false);
    setCouponChecked(false);
    setSelectedBoardId(activeBoards[0]?.id ?? '');
    setSelectedCast(schedule.cast ?? '');
    const event = show.events.find(e =>
      e.startDate <= schedule.date &&
      (!e.endDate || e.endDate >= schedule.date)
    );
    // 이벤트가 없으면 일정에 저장된 multiplier 사용 (AddScheduleSheet에서 수동 설정한 배수 유지)
    setMultiplier(event ? (event.multiplier ?? 1) : (schedule.multiplier ?? 1));
    setShowSummary(false);
    setShowMultiplier(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, schedule?.id]);

  // ── visualViewport 키보드 감지 ─────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    const vv = window.visualViewport;
    if (!vv) return;
    function onResize() {
      const offset = Math.max(0, window.innerHeight - vv!.height - vv!.offsetTop);
      setKeyboardOffset(offset);
    }
    vv.addEventListener('resize', onResize);
    vv.addEventListener('scroll', onResize);
    return () => {
      vv.removeEventListener('resize', onResize);
      vv.removeEventListener('scroll', onResize);
      setKeyboardOffset(0);
    };
  }, [isOpen]);

  // ── 입력창 포커스 → 키보드 위로 스크롤 ───────────────────────────────────
  function handleScrollAreaFocus(e: React.FocusEvent<HTMLDivElement>) {
    const target = e.target;
    if (
      !(target instanceof HTMLInputElement) &&
      !(target instanceof HTMLTextAreaElement)
    ) return;
    setTimeout(() => {
      target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 300);
  }

  // ── 확정 가능 여부 ─────────────────────────────────────────────────────
  const checklistDone = useMemo(() => {
    if (discount?.isRebook && !rebookChecked) return false;
    if (discount?.isCoupon  && !couponChecked)  return false;
    return true;
  }, [discount, rebookChecked, couponChecked]);

  const canConfirm = checklistDone && (activeBoards.length === 0 || !!selectedBoardId);

  if (!schedule || !isOpen) return null;

  // ── 확정 처리 ──────────────────────────────────────────────────────────
  function handleConfirm() {
    if (!canConfirm || !schedule) return;
    const allocations: BoardAllocation[] = selectedBoardId
      ? [{ boardId: selectedBoardId, stamps: multiplier }]
      : [];
    onConfirm(schedule.id, allocations, multiplier !== 1 ? multiplier : undefined, selectedCast || undefined);
    onClose();
  }

  return (
    <>
      {/* 딤 */}
      <div
        className="fixed inset-0 bg-black/40 z-40"
        onClick={onClose}
      />

      {/* 시트 — keyboardOffset 만큼 bottom 을 올림 */}
      <div
        data-testid="bottomsheet-confirm"
        className="fixed left-0 right-0 z-50 bg-white rounded-t-[24px] flex flex-col max-h-[92vh]"
        style={{
          bottom: keyboardOffset,
          paddingBottom: keyboardOffset === 0 ? 'env(safe-area-inset-bottom, 0px)' : 0,
          transition: keyboardOffset > 0 ? 'bottom 0.15s ease-out' : 'none',
        }}
      >
        {/* 핸들 */}
        <div className="flex justify-center pt-3 flex-shrink-0">
          <div className="w-9 h-1 rounded-full bg-gray-200" />
        </div>

        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 flex-shrink-0">
          <h2 className="text-[17px] font-semibold text-gray-900">관람 확정</h2>
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100"
            aria-label="닫기"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M5 5l10 10M15 5L5 15"
                stroke="#6B7280" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* ── 스크롤 영역 ───────────────────────────────────────────────── */}
        <div
          className="flex-1 overflow-y-auto overscroll-contain px-5 pb-4 space-y-4"
          onFocus={handleScrollAreaFocus}
        >

          {/* ① 체크리스트 — 최상단 */}
          {(discount?.isRebook || discount?.isCoupon) && (
            <div className="space-y-2">
              <p className="text-[13px] font-semibold text-gray-400 tracking-[0.3px]">확인 사항</p>

              {discount.isRebook && (
                <button
                  data-testid="checklist-rebook"
                  onClick={() => setRebookChecked(v => !v)}
                  className={[
                    'w-full flex items-center gap-3 p-4 rounded-xl border-[1.5px] transition-all text-left',
                    rebookChecked
                      ? 'bg-indigo-50 border-indigo-400'
                      : 'bg-amber-50 border-amber-200',
                  ].join(' ')}
                >
                  <div className={[
                    'w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0',
                    rebookChecked ? 'bg-indigo-600' : 'border-2 border-amber-400',
                  ].join(' ')}>
                    {rebookChecked && (
                      <svg width="11" height="9" viewBox="0 0 11 9" fill="none">
                        <path d="M1 4.5l3 3 6-6"
                          stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                  <span className={[
                    'text-[14px] font-medium',
                    rebookChecked ? 'text-indigo-700' : 'text-amber-800',
                  ].join(' ')}>
                    🎟️ 재관람표를 제출했어요
                  </span>
                </button>
              )}

              {discount.isCoupon && (
                <button
                  onClick={() => setCouponChecked(v => !v)}
                  className={[
                    'w-full flex items-center gap-3 p-4 rounded-xl border-[1.5px] transition-all text-left',
                    couponChecked
                      ? 'bg-indigo-50 border-indigo-400'
                      : 'bg-amber-50 border-amber-200',
                  ].join(' ')}
                >
                  <div className={[
                    'w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0',
                    couponChecked ? 'bg-indigo-600' : 'border-2 border-amber-400',
                  ].join(' ')}>
                    {couponChecked && (
                      <svg width="11" height="9" viewBox="0 0 11 9" fill="none">
                        <path d="M1 4.5l3 3 6-6"
                          stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                  <span className={[
                    'text-[14px] font-medium',
                    couponChecked ? 'text-indigo-700' : 'text-amber-800',
                  ].join(' ')}>
                    🎫 쿠폰을 제출했어요
                  </span>
                </button>
              )}
            </div>
          )}

          {/* ② 도장판 — 2개 이상이면 선택 UI, 1개면 간략 표시 */}
          {activeBoards.length > 1 && (
            <div className="space-y-2">
              <p className="text-[13px] font-semibold text-gray-400 tracking-[0.3px]">도장판 선택</p>
              <div className="space-y-2">
                {activeBoards.map((board, idx) => {
                  const confirmedCount = board.stamps.filter(s => s.isConfirmed).length;
                  const remaining = board.capacity - confirmedCount;
                  const isSelected = selectedBoardId === board.id;
                  return (
                    <button
                      key={board.id}
                      data-testid={`select-board-${board.id}`}
                      onClick={() => setSelectedBoardId(board.id)}
                      className={[
                        'w-full flex items-center justify-between p-4 rounded-xl border-[1.5px] transition-all',
                        isSelected ? 'bg-indigo-50 border-indigo-500' : 'bg-white border-gray-200',
                      ].join(' ')}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: board.stampColor ?? '#6366F1' }}
                        />
                        <span className={[
                          'text-[14px] font-medium',
                          isSelected ? 'text-indigo-700' : 'text-gray-900',
                        ].join(' ')}>
                          {board.name}
                        </span>
                        {idx === 0 && (
                          <span className="text-[11px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">
                            ⭐ 추천
                          </span>
                        )}
                      </div>
                      <span className="text-[12px] text-gray-400">
                        {confirmedCount}/{board.capacity}개 · {remaining}칸
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {activeBoards.length === 1 && (
            <div className="flex items-center justify-between px-4 py-3 bg-gray-50 rounded-xl">
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: activeBoards[0].stampColor ?? '#6366F1' }}
                />
                <span className="text-[14px] font-medium text-gray-700">
                  {activeBoards[0].name}
                </span>
              </div>
              <span className="text-[12px] text-gray-400">
                {activeBoards[0].stamps.filter(s => s.isConfirmed).length}/{activeBoards[0].capacity}개
              </span>
            </div>
          )}

          {activeBoards.length === 0 && (
            <div className="px-4 py-3 bg-gray-50 rounded-xl">
              <span className="text-[14px] text-gray-400">활성화된 도장판이 없어요</span>
            </div>
          )}

          {/* ③ 캐스트 */}
          <div className="space-y-2">
            <p className="text-[13px] font-semibold text-gray-400 tracking-[0.3px]">
              캐스트 <span className="font-normal">(선택)</span>
            </p>
            <input
              value={selectedCast}
              onChange={e => setSelectedCast(e.target.value)}
              placeholder="예: 김OO (주역), 이OO (상대역)"
              className="w-full h-12 px-3.5 text-[15px] text-gray-900 placeholder:text-gray-300 border-[1.5px] border-gray-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-[3px] focus:ring-indigo-50"
            />
          </div>

          {/* ④ 도장 배수 — 이벤트 있을 때만, 기본 접힘 */}
          {hasEvent && (
            <div className="space-y-2">
              <button
                onClick={() => setShowMultiplier(v => !v)}
                className="flex items-center justify-between w-full"
              >
                <p className="text-[13px] font-semibold text-gray-400 tracking-[0.3px]">
                  도장 배수
                  {activeEvent && (
                    <span className="ml-2 text-[11px] text-amber-600 font-medium">
                      🎉 {activeEvent.name}
                    </span>
                  )}
                </p>
                <svg
                  width="16" height="16" viewBox="0 0 16 16" fill="none"
                  className={`transition-transform duration-200 ${showMultiplier ? 'rotate-180' : ''}`}
                >
                  <path d="M4 6l4 4 4-4"
                    stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              {showMultiplier && (
                <div className="grid grid-cols-3 gap-2">
                  {[1, 2, 3].map(x => (
                    <button
                      key={x}
                      data-testid={`multiplier-${x}`}
                      onClick={() => setMultiplier(x)}
                      className={[
                        'h-11 rounded-xl text-[14px] font-medium border-[1.5px] transition-all',
                        multiplier === x
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white text-gray-700 border-gray-200',
                      ].join(' ')}
                    >
                      {x === 1 ? 'x1' : x === 2 ? 'x2 더블' : 'x3 트리플'}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ⑤ 관람 요약 — 기본 접힘 */}
          <div className="space-y-2">
            <button
              onClick={() => setShowSummary(v => !v)}
              className="flex items-center justify-between w-full"
            >
              <p className="text-[13px] font-semibold text-gray-400 tracking-[0.3px]">관람 요약</p>
              <svg
                width="16" height="16" viewBox="0 0 16 16" fill="none"
                className={`transition-transform duration-200 ${showSummary ? 'rotate-180' : ''}`}
              >
                <path d="M4 6l4 4 4-4"
                  stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            {showSummary && (
              <div className="bg-gray-50 rounded-xl overflow-hidden">
                {[
                  { label: '날짜',    value: formatKSTDate(schedule.date) },
                  { label: '좌석',    value: grade?.name ?? '-' },
                  { label: '할인',    value: discount?.name ?? '-' },
                  { label: '결제금액', value: formatMoney(schedule.finalPrice), highlight: true },
                ].map(({ label, value, highlight }) => (
                  <div
                    key={label}
                    className="flex items-center justify-between px-4 py-3 border-b border-gray-100 last:border-0"
                  >
                    <span className="text-[13px] text-gray-500">{label}</span>
                    <span className={[
                      'text-[14px] font-medium',
                      highlight ? 'text-indigo-600' : 'text-gray-900',
                    ].join(' ')}>
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* ── 하단 고정 버튼 ────────────────────────────────────────────── */}
        <div className="flex-shrink-0 px-5 pt-3 pb-6 border-t border-gray-100 bg-white">
          {!checklistDone && (
            <p className="text-[12px] text-amber-600 text-center mb-2">
              위 확인 사항을 체크해야 확정할 수 있어요
            </p>
          )}
          <button
            data-testid="btn-confirm-submit"
            onClick={handleConfirm}
            disabled={!canConfirm}
            className={[
              'w-full h-[54px] rounded-2xl text-[17px] font-semibold transition-all',
              canConfirm
                ? 'bg-indigo-600 text-white shadow-[0_4px_12px_rgba(79,70,229,0.25)]'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed',
            ].join(' ')}
          >
            확정하기
          </button>
        </div>

      </div>
    </>
  );
}
