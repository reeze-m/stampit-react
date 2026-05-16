import { useState, useRef } from 'react';
import type { Show, Schedule, BoardAllocation, Benefit } from '../types';
import { useShowStore } from '../store/showStore';
import { useSettingsStore } from '../store/settingsStore';
import { useUndoStore } from '../store/undoStore';
import { saveToStorage, STORAGE_KEY } from '../store/storage';
import QuickCalculator from '../components/planner/QuickCalculator';
import QuickConfirmCard from '../components/planner/QuickConfirmCard';
import CalendarView from '../components/planner/CalendarView';
import SpecialEventFilter from '../components/planner/SpecialEventFilter';
import ScheduleCard from '../components/schedule/ScheduleCard';
import AddScheduleSheet from '../components/schedule/AddScheduleSheet';
import ConfirmScheduleSheet from '../components/schedule/ConfirmScheduleSheet';
import CancelScheduleSheet from '../components/schedule/CancelScheduleSheet';
import TicketChangeSheet from '../components/schedule/TicketChangeSheet';
import EditScheduleSheet from '../components/schedule/EditScheduleSheet';
import ManualAllocationModal from '../components/board/ManualAllocationModal';
import BenefitAchievedModal from '../components/board/BenefitAchievedModal';
import AddBoardSheet from '../components/board/AddBoardSheet';
import UndoToast from '../components/common/UndoToast';
import ConfirmSuccessToast from '../components/common/ConfirmSuccessToast';
import Toast from '../components/common/Toast';
import QuickStartBanner from '../components/show/QuickStartBanner';
import QuickAddSheet from '../components/planner/QuickAddSheet';
import PendingAlertBanner from '../components/planner/PendingAlertBanner';
import { todayKSTString } from '../utils/dateUtils';
import { colors } from '../constants/tokens';


interface PlannerTabProps {
  show: Show;
  onGoToSettings?: () => void;
  onGoToStatus?: (benefitId?: string) => void;
}

interface AchievedData {
  benefit: Benefit;
  boardId: string;
  boardName: string;
  stampCount: number;
  isLastBenefit: boolean;
}

/** 플래너 탭 */
export default function PlannerTab({ show, onGoToSettings, onGoToStatus }: PlannerTabProps) {
  const {
    schedules, addSchedule, addStampBoard, updateStampBoard, deleteSchedule, confirmSchedule,
    cancelConfirm, cancelSchedule, restoreSchedule, updateSchedule, changeTicket,
  } = useShowStore();
  const { settings, setLastUsed, setSeenConfirmTip } = useSettingsStore();
  const { setAction, clearAction } = useUndoStore();

  const [addOpen, setAddOpen] = useState(false);
  const [confirmTipVisible, setConfirmTipVisible] = useState(false);
  const [quickConfirmToast, setQuickConfirmToast] = useState<{ stampCount: number; boardName: string | null } | null>(null);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);
  const [changingTicketId, setChangingTicketId] = useState<string | null>(null);
  const [manualAllocId, setManualAllocId] = useState<string | null>(null);
  const [achievedData, setAchievedData] = useState<AchievedData | null>(null);
  const [addBoardOpen, setAddBoardOpen] = useState(false);
  const [addBoardForAchieved, setAddBoardForAchieved] = useState(false);
  // M-03: 일정 필터 탭
  type ScheduleFilter = 'all' | 'unconfirmed' | 'confirmed' | 'cancelled';
  const [scheduleFilter, setScheduleFilter] = useState<ScheduleFilter>('all');
  const [restoreToast, setRestoreToast] = useState<string | null>(null);
  const [calcOpen, setCalcOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [calendarAddDate, setCalendarAddDate] = useState<string | undefined>(undefined);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showSchedules = schedules.filter(s => s.showId === show.id);

  // 취소된 일정 분리
  const cancelledSchedules = showSchedules
    .filter(s => (s.status ?? (s.isConfirmed ? 'confirmed' : 'draft')) === 'cancelled')
    .sort((a, b) => b.date.localeCompare(a.date));

  const activeSchedules = showSchedules.filter(
    s => (s.status ?? (s.isConfirmed ? 'confirmed' : 'draft')) !== 'cancelled'
  );

  const filteredActive = activeSchedules;

  const today = todayKSTString();
  const todayUnconfirmed = showSchedules.filter(
    s => s.date === today && !s.isConfirmed && (s.status ?? 'draft') !== 'cancelled'
  );
  const unconfirmed = filteredActive.filter(s => !s.isConfirmed).sort((a, b) => a.date.localeCompare(b.date));
  const confirmed = filteredActive.filter(s => s.isConfirmed).sort((a, b) => b.date.localeCompare(a.date));
  const existingDates = showSchedules.map(s => s.date);
  const showConfirmHint = unconfirmed.length >= 3;

  const confirmingSchedule = confirmingId ? showSchedules.find(s => s.id === confirmingId) || null : null;

  const changingTicketSchedule = changingTicketId ? showSchedules.find(s => s.id === changingTicketId) || null : null;
  const changingGrade = changingTicketSchedule ? show.seatGrades.find(g => g.id === changingTicketSchedule.seatGradeId) || null : null;
  const changingDiscount = changingTicketSchedule ? show.discountTypes.find(d => d.id === changingTicketSchedule.discountTypeId) || null : null;

  const manualAllocSchedule = manualAllocId ? showSchedules.find(s => s.id === manualAllocId) || null : null;

  /** SC-09: 확정 직전 신규 달성 혜택 계산 */
  function computeAchieved(allocations: BoardAllocation[]): AchievedData | null {
    for (const alloc of allocations) {
      const board = show.stampBoards.find(b => b.id === alloc.boardId);
      if (!board) continue;
      const newCount = board.stamps.length + alloc.stamps;
      const newlyAchieved = board.benefits.find(b => !b.isAchieved && b.requiredStamps <= newCount);
      if (newlyAchieved) {
        const remainingUnachieved = board.benefits.filter(b => !b.isAchieved).length;
        return {
          benefit: newlyAchieved,
          boardId: board.id,
          boardName: board.name,
          stampCount: newCount,
          isLastBenefit: remainingUnachieved <= 1,
        };
      }
    }
    return null;
  }

  function handleConfirm(id: string, allocations: BoardAllocation[], multiplierOverride?: number, cast?: string) {
    if (multiplierOverride !== undefined) {
      updateSchedule(id, { multiplier: multiplierOverride });
    }
    if (cast !== undefined) {
      updateSchedule(id, { cast });
    }
    const achieved = computeAchieved(allocations);
    confirmSchedule(id, allocations);
    setConfirmingId(null);
    if (achieved) setAchievedData(achieved);

    // 첫 확정 툴팁 (한 번만 표시)
    if (!settings.hasSeenConfirmTip) {
      setSeenConfirmTip();
      setConfirmTipVisible(true);
      setTimeout(() => setConfirmTipVisible(false), 3000);
    }
  }

  /** 원탭 즉시 확정 (체크리스트 불필요 일정) */
  function handleQuickConfirm(scheduleId: string) {
    const multiplier = showSchedules.find(s => s.id === scheduleId)?.multiplier ?? 1;
    const activeBoards = [...show.stampBoards]
      .filter(b => b.isActive && !b.isCompleted)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    const recommendedBoard =
      activeBoards.find(b => b.capacity - b.stamps.length >= multiplier && b.benefits.some(ben => !ben.isAchieved))
      ?? activeBoards.find(b => b.capacity - b.stamps.length >= multiplier)
      ?? null;
    const allocations: BoardAllocation[] = recommendedBoard
      ? [{ boardId: recommendedBoard.id, stamps: multiplier }]
      : [];
    const achieved = computeAchieved(allocations);
    confirmSchedule(scheduleId, allocations);
    if (achieved) setAchievedData(achieved);
    setQuickConfirmToast({ stampCount: multiplier, boardName: recommendedBoard?.name ?? null });
  }

  // SC-33: 삭제 + Undo
  function handleDeleteWithUndo(scheduleId: string) {
    const schedule = showSchedules.find(s => s.id === scheduleId);
    if (!schedule) return;

    setAction({
      type: 'DELETE_SCHEDULE',
      payload: schedule,
      expiresAt: Date.now() + 3000,
      message: '일정이 삭제됐어요',
    });
    deleteSchedule(scheduleId);
  }

  // SC-33: Undo 실행 — 원본 일정 전체를 그대로 복원 (ID·배분 정보 유지)
  function handleUndo() {
    const { action } = useUndoStore.getState();
    if (!action || action.type !== 'DELETE_SCHEDULE') return;
    const schedule = action.payload as Schedule;
    // ✅ addSchedule 대신 updateSchedule+직접 삽입으로 원본 id·boardAllocations 유지
    useShowStore.setState(state => {
      const already = state.schedules.find(s => s.id === schedule.id);
      if (already) return {}; // 이미 복원됨 (중복 방지)
      const schedules = [...state.schedules, schedule];
      saveToStorage(STORAGE_KEY, { shows: state.shows, schedules });
      return { schedules };
    });
    clearAction();
  }

  // SC-29: 확정 취소
  function handleCancelConfirm(scheduleId: string) {
    cancelConfirm(scheduleId);
  }

  // SC-30: 일정 취소 (불참)
  function handleCancelSchedule(scheduleId: string, reason?: string, refundAmount?: number) {
    cancelSchedule(scheduleId, reason, refundAmount);
  }

  // M-03: 취소 일정 복구
  function handleRestoreSchedule(scheduleId: string) {
    restoreSchedule(scheduleId);
    setRestoreToast('일정이 복구됐어요. 확정하면 도장이 적립돼요.');
  }

  return (
    <div className="flex flex-col h-full">
      {/* 뷰 전환 버튼 (우측 상단 고정) */}
      <div className="flex justify-end px-4 py-2 shrink-0">
        <button
          onClick={() => setViewMode(v => v === 'list' ? 'calendar' : 'list')}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-100 active:bg-gray-200 transition-colors"
          aria-label={viewMode === 'list' ? '캘린더 뷰로 전환' : '리스트 뷰로 전환'}
        >
          {viewMode === 'list' ? (
            /* 캘린더 아이콘 */
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-gray-600">
              <rect x="3" y="4" width="18" height="18" rx="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
              <rect x="7" y="14" width="3" height="3" rx="0.5"/>
              <rect x="14" y="14" width="3" height="3" rx="0.5"/>
            </svg>
          ) : (
            /* 리스트 아이콘 */
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-gray-600">
              <line x1="8" y1="6" x2="21" y2="6"/>
              <line x1="8" y1="12" x2="21" y2="12"/>
              <line x1="8" y1="18" x2="21" y2="18"/>
              <circle cx="3" cy="6" r="1.2" fill="currentColor" stroke="none"/>
              <circle cx="3" cy="12" r="1.2" fill="currentColor" stroke="none"/>
              <circle cx="3" cy="18" r="1.2" fill="currentColor" stroke="none"/>
            </svg>
          )}
        </button>
      </div>

      {/* 캘린더 뷰 */}
      {viewMode === 'calendar' && (
        <div className="flex-1 overflow-hidden">
          <CalendarView
            show={show}
            schedules={showSchedules}
            onConfirmSchedule={id => setConfirmingId(id)}
            onAddSchedule={date => { setCalendarAddDate(date); setAddOpen(true); }}
          />
        </div>
      )}

      {/* 리스트 뷰 */}
      {viewMode === 'list' && (
      <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 160px)' }}>
        {/* SC-36 오늘의 일정 퀵카드 */}
        <QuickConfirmCard
          schedules={todayUnconfirmed}
          seatGrades={show.seatGrades}
          discountTypes={show.discountTypes}
          stampBoards={show.stampBoards}
          onConfirm={id => setConfirmingId(id)}
          onQuickConfirm={handleQuickConfirm}
          showName={show.name}
          specialEvents={show.specialEvents}
          nextUpcoming={(() => {
            const next = showSchedules
              .filter(s => s.date > today && (s.status ?? 'draft') !== 'cancelled')
              .sort((a, b) => a.date.localeCompare(b.date))[0];
            if (!next) return null;
            const diff = Math.round((new Date(next.date).getTime() - new Date(today).getTime()) / 86400000);
            return { date: next.date, dday: diff === 1 ? '내일' : `D-${diff}` };
          })()}
        />

        {/* U-11 미확정 복귀 안내 배너 */}
        <PendingAlertBanner
          schedules={showSchedules}
          today={today}
          onConfirm={() => {
            const oldest = showSchedules
              .filter(s => !s.isConfirmed && s.isShare !== true && (s.status ?? 'draft') !== 'cancelled' && s.date < today)
              .sort((a, b) => a.date.localeCompare(b.date))[0];
            if (oldest) {
              setTimeout(() => {
                const el = document.querySelector(`[data-schedule-id="${oldest.id}"]`);
                el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }, 100);
            }
          }}
        />

        {/* SC-28: 빠른 시작 배너 */}
        <QuickStartBanner
          hasNoSeatGrades={show.seatGrades.length === 0}
          onSetupNow={() => onGoToSettings?.()}
        />

        {/* 도장판 추가 버튼 */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-500">도장판</span>
          <button
            data-testid="btn-add-board"
            onClick={() => setAddBoardOpen(true)}
            className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-medium min-h-[36px]"
          >
            + 새 판
          </button>
        </div>

        {/* V-03: 빠른 계산기 */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <button
            data-testid="quick-calc-toggle"
            onClick={() => setCalcOpen(o => !o)}
            className="w-full h-[48px] flex items-center justify-between px-4 active:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-base leading-none">🧮</span>
              <span className="text-[14px] font-semibold text-gray-700">빠른 계산기</span>
            </div>
            {calcOpen ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={colors.primary[600]} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="18 15 12 9 6 15"/>
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={colors.gray[400]} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            )}
          </button>
          {calcOpen && (
            <div className="border-t border-gray-100 px-4 pt-[14px] pb-[14px]">
              <QuickCalculator
                seatGrades={show.seatGrades}
                discountTypes={show.discountTypes}
              />
            </div>
          )}
        </div>

        {/* V-04: 통합 필터 영역 */}
        {showSchedules.length > 0 && (
          <div className="space-y-2">
            {/* 이벤트 필터 */}
            <SpecialEventFilter
              showId={show.id}
              selectedEventId={selectedEventId}
              onChange={setSelectedEventId}
            />

            {/* 상태 필터 */}
            <div className="flex items-center gap-2">
              <span className="text-[12px] text-gray-400 flex-shrink-0 font-medium">상태</span>
              <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                {(
                  [
                    { key: 'all',         label: '전체',   count: 0 },
                    { key: 'unconfirmed', label: '미확정', count: unconfirmed.length },
                    { key: 'confirmed',   label: '확정',   count: confirmed.length },
                    ...(cancelledSchedules.length > 0
                      ? [{ key: 'cancelled', label: '취소', count: cancelledSchedules.length }]
                      : []),
                  ] as { key: ScheduleFilter; label: string; count: number }[]
                ).map(tab => {
                  const isActive = scheduleFilter === tab.key;
                  return (
                    <button
                      key={tab.key}
                      onClick={() => setScheduleFilter(tab.key)}
                      className={`flex items-center gap-1.5 flex-shrink-0 h-8 px-3 rounded-full text-xs font-medium transition-colors ${
                        isActive
                          ? 'bg-indigo-50 text-indigo-600'
                          : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {tab.label}
                      {tab.key !== 'all' && tab.count > 0 && (
                        <span className={`min-w-[16px] h-4 text-[10px] font-bold rounded-full flex items-center justify-center px-1 leading-none ${
                          isActive ? 'bg-indigo-600 text-white' : 'bg-gray-400 text-white'
                        }`}>
                          {tab.count > 9 ? '9+' : tab.count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* 미확정 일정 */}
        {(scheduleFilter === 'all' || scheduleFilter === 'unconfirmed') && unconfirmed.length > 0 && (
          <section>
            <div className="space-y-2">
              {unconfirmed.map(schedule => (
                <ScheduleCard
                  key={schedule.id}
                  schedule={schedule}
                  grade={show.seatGrades.find(g => g.id === schedule.seatGradeId) || null}
                  discount={show.discountTypes.find(d => d.id === schedule.discountTypeId) || null}
                  showRealCost={settings.showRealCost}
                  specialEvents={show.specialEvents}
                  onDelete={handleDeleteWithUndo}
                  onConfirm={id => setConfirmingId(id)}
                  onEdit={id => setEditingScheduleId(id)}
                  onCancelConfirm={handleCancelConfirm}
                  onCancelSchedule={id => setCancellingId(id)}
                  onManualAllocate={id => setManualAllocId(id)}
                  showConfirmHint={showConfirmHint}
                />
              ))}
            </div>
          </section>
        )}

        {/* 확정 일정 */}
        {(scheduleFilter === 'all' || scheduleFilter === 'confirmed') && confirmed.length > 0 && (
          <section>
            <div className="space-y-2">
              {confirmed.map(schedule => (
                <ScheduleCard
                  key={schedule.id}
                  schedule={schedule}
                  grade={show.seatGrades.find(g => g.id === schedule.seatGradeId) || null}
                  discount={show.discountTypes.find(d => d.id === schedule.discountTypeId) || null}
                  showRealCost={settings.showRealCost}
                  specialEvents={show.specialEvents}
                  onCancelConfirm={handleCancelConfirm}
                  onCancelSchedule={id => setCancellingId(id)}
                  onTicketChange={id => setChangingTicketId(id)}
                  onRate={(id, rating) => updateSchedule(id, { rating })}
                />
              ))}
            </div>
          </section>
        )}

        {/* 취소된 일정 */}
        {(scheduleFilter === 'all' || scheduleFilter === 'cancelled') && cancelledSchedules.length > 0 && (
          <section>
            <div className="space-y-2">
              {cancelledSchedules.map(schedule => (
                <ScheduleCard
                  key={schedule.id}
                  schedule={schedule}
                  grade={show.seatGrades.find(g => g.id === schedule.seatGradeId) || null}
                  discount={show.discountTypes.find(d => d.id === schedule.discountTypeId) || null}
                  showRealCost={settings.showRealCost}
                  specialEvents={show.specialEvents}
                  onRestore={handleRestoreSchedule}
                  onDelete={handleDeleteWithUndo}
                />
              ))}
            </div>
          </section>
        )}

        {showSchedules.length === 0 && (
          <div data-testid="empty-schedule-state" className="text-center py-12 text-gray-400">
            <p className="text-4xl mb-3">📅</p>
            <p className="text-sm">아직 관람 일정이 없어요</p>
            <p className="text-xs mt-1">+ 버튼으로 일정을 추가해보세요</p>
          </div>
        )}
      </div>
      )} {/* 리스트 뷰 끝 */}

      {/* 첫 확정 완료 툴팁 */}
      {confirmTipVisible && (
        <div className="fixed bottom-28 left-4 right-4 z-50 pointer-events-none">
          <div className="bg-gray-900 text-white rounded-2xl p-4 shadow-xl max-w-sm mx-auto">
            <p className="text-sm font-semibold mb-1">✅ 확정하면 도장이 찍혀요</p>
            <p className="text-xs text-gray-300">관람 후 확정하면 도장판에 자동으로 기록돼요</p>
          </div>
        </div>
      )}

      {/* FAB */}
      <button
        onClick={() => setAddOpen(true)}
        onTouchStart={() => {
          longPressTimer.current = setTimeout(() => {
            setQuickAddOpen(true);
          }, 500);
        }}
        onTouchEnd={() => {
          if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
          }
        }}
        onMouseDown={() => {
          longPressTimer.current = setTimeout(() => {
            setQuickAddOpen(true);
          }, 500);
        }}
        onMouseUp={() => {
          if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
          }
        }}
        onMouseLeave={() => {
          if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
          }
        }}
        data-testid="fab-add"
        style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 64px)' }}
        className="fixed right-4 w-14 h-14 bg-indigo-600 text-white rounded-full shadow-lg text-2xl flex items-center justify-center active:bg-indigo-800 transition-colors z-30 select-none"
        aria-label="일정 추가"
      >
        +
      </button>

      <AddScheduleSheet
        isOpen={addOpen}
        onClose={() => { setAddOpen(false); setCalendarAddDate(undefined); }}
        showId={show.id}
        seatGrades={show.seatGrades}
        discountTypes={show.discountTypes}
        stampBoards={show.stampBoards}
        stampEvents={show.events}
        existingScheduleDates={existingDates}
        initialDate={calendarAddDate}
        showStartDate={show.startDate}
        showEndDate={show.endDate}
        onGoToSettings={() => { setAddOpen(false); onGoToSettings?.(); }}
        onAdd={data => {
          addSchedule(data);
          if (data.seatGradeId && data.discountTypeId) {
            setLastUsed(show.id, data.seatGradeId, data.discountTypeId);
          }
          setCalendarAddDate(undefined);
        }}
        onAddAndConfirm={data => {
          const id = addSchedule(data);
          if (data.seatGradeId && data.discountTypeId) {
            setLastUsed(show.id, data.seatGradeId, data.discountTypeId);
          }
          setCalendarAddDate(undefined);
          setAddOpen(false);
          setConfirmingId(id);
        }}
      />

      <EditScheduleSheet
        isOpen={!!editingScheduleId}
        onClose={() => setEditingScheduleId(null)}
        schedule={editingScheduleId ? showSchedules.find(s => s.id === editingScheduleId) || null : null}
        showId={show.id}
        seatGrades={show.seatGrades}
        discountTypes={show.discountTypes}
        stampBoards={show.stampBoards}
        existingScheduleDates={existingDates}
        onSave={(scheduleId, data) => {
          updateSchedule(scheduleId, data);
          setEditingScheduleId(null);
        }}
      />

      <ConfirmScheduleSheet
        isOpen={!!confirmingId}
        onClose={() => setConfirmingId(null)}
        schedule={confirmingSchedule}
        schedules={showSchedules}
        show={show}
        onConfirm={(id, allocations, multiplierOverride, cast) => handleConfirm(id, allocations, multiplierOverride, cast)}
      />

      {/* SC-10: 티켓 변경 */}
      <TicketChangeSheet
        isOpen={!!changingTicketId}
        onClose={() => setChangingTicketId(null)}
        prevGrade={changingGrade}
        prevDiscount={changingDiscount}
        prevFinalPrice={changingTicketSchedule?.finalPrice ?? 0}
        seatGrades={show.seatGrades}
        discountTypes={show.discountTypes}
        onSave={(gradeId, discountId, method) => {
          if (changingTicketId) {
            changeTicket(changingTicketId, gradeId, discountId, method);
          }
          setChangingTicketId(null);
        }}
      />

      {/* SC-11: 수동 배분 조정 */}
      <ManualAllocationModal
        isOpen={!!manualAllocId}
        onClose={() => setManualAllocId(null)}
        boards={show.stampBoards}
        schedule={manualAllocSchedule}
        onApply={(allocations) => {
          if (manualAllocId) updateSchedule(manualAllocId, { boardAllocations: allocations });
          setManualAllocId(null);
        }}
      />

      <CancelScheduleSheet
        isOpen={!!cancellingId}
        onClose={() => setCancellingId(null)}
        onCancel={(reason, refundAmount) => {
          if (cancellingId) {
            handleCancelSchedule(cancellingId, reason, refundAmount);
          }
          setCancellingId(null);
        }}
      />

      {/* SC-09: 혜택 달성 모달 */}
      <BenefitAchievedModal
        isOpen={!!achievedData}
        showId={show.id}
        boardId={achievedData?.boardId ?? ''}
        boardName={achievedData?.boardName ?? ''}
        board={show.stampBoards.find(b => b.id === achievedData?.boardId) ?? null}
        totalBoardCount={show.stampBoards.length}
        benefit={achievedData?.benefit ?? null}
        stampCount={achievedData?.stampCount ?? 0}
        isLastBenefit={achievedData?.isLastBenefit ?? false}
        onContinue={() => setAchievedData(null)}
        onNewBoard={() => {
          // "직접 설정하기": 마지막 혜택이면 판 완성 처리 후 AddBoardSheet 오픈
          if (achievedData?.isLastBenefit && achievedData?.boardId) {
            updateStampBoard(show.id, achievedData.boardId, { isCompleted: true, isActive: false });
          }
          setAchievedData(null);
          setAddBoardForAchieved(true);
        }}
        onGoToStatus={benefitId => {
          setAchievedData(null);
          onGoToStatus?.(benefitId);
        }}
      />

      {/* btn-add-board 직접 추가 (full mode) */}
      <AddBoardSheet
        isOpen={addBoardOpen}
        onClose={() => setAddBoardOpen(false)}
        totalBoardCount={show.stampBoards.length}
        onSubmit={(data) => {
          addStampBoard(show.id, {
            ...data,
            benefits: data.benefits.map(b => ({
              ...b,
              id: Math.random().toString(36).slice(2) + Date.now().toString(36),
              isAchieved: false,
              isUsed: false,
            })),
          });
          setAddBoardOpen(false);
        }}
      />

      {/* 혜택 달성 후 새 판 추가 */}
      <AddBoardSheet
        isOpen={addBoardForAchieved}
        onClose={() => setAddBoardForAchieved(false)}
        totalBoardCount={show.stampBoards.length}
        onSubmit={(data) => {
          addStampBoard(show.id, {
            ...data,
            benefits: data.benefits.map(b => ({
              ...b,
              id: Math.random().toString(36).slice(2) + Date.now().toString(36),
              isAchieved: false,
              isUsed: false,
            })),
          });
          setAddBoardForAchieved(false);
        }}
      />

      {/* SC-36: FAB 롱프레스 빠른 추가 */}
      <QuickAddSheet
        isOpen={quickAddOpen}
        onClose={() => setQuickAddOpen(false)}
        show={show}
        lastUsedSeatGradeId={settings.lastUsedSeatGradeId}
        lastUsedDiscountTypeId={settings.lastUsedDiscountTypeId}
        onQuickAdd={(date, seatGradeId, discountTypeId, finalPrice, originalPrice) => {
          addSchedule({
            showId: show.id,
            date,
            seatGradeId,
            discountTypeId,
            finalPrice,
            originalPrice,
            multiplier: 1,
            status: 'draft',
            specialEventIds: [],
          });
          setLastUsed(show.id, seatGradeId, discountTypeId);
        }}
        onFullAdd={() => setAddOpen(true)}
      />

      {/* SC-33: Undo 토스트 */}
      <UndoToast onUndo={handleUndo} />

      {/* M-03: 일정 복구 토스트 */}
      {restoreToast && (
        <Toast
          message={restoreToast}
          type="success"
          onClose={() => setRestoreToast(null)}
        />
      )}

      {/* 원탭 확정 성공 토스트 */}
      {quickConfirmToast && (
        <ConfirmSuccessToast
          stampCount={quickConfirmToast.stampCount}
          boardName={quickConfirmToast.boardName}
          onClose={() => setQuickConfirmToast(null)}
        />
      )}
    </div>
  );
}
