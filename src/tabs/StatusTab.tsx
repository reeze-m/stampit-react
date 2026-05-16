import { useState, useRef } from 'react';
import type { Show } from '../types';
import { useShowStore } from '../store/showStore';
import ManualStampSheet from '../components/board/ManualStampSheet';
import { useSettingsStore } from '../store/settingsStore';
import StampBoardCard from '../components/board/StampBoardCard';
import AddBoardSheet from '../components/board/AddBoardSheet';
import EditBoardSheet from '../components/board/EditBoardSheet';
import FocusCard from '../components/status/FocusCard';
import RewardSummary from '../components/status/RewardSummary';
import CouponTrackerCard from '../components/status/CouponTrackerCard';
import CostSummary from '../components/status/CostSummary';
import CastStats from '../components/status/CastStats';
import BoardHistoryCard from '../components/status/BoardHistoryCard';
import SimulatorSheet from '../components/status/SimulatorSheet';
import CouponHistorySheet from '../components/status/CouponHistorySheet';
import StatusSummaryCard from '../components/status/StatusSummaryCard';
import DeleteBoardModal from '../components/board/DeleteBoardModal';
import ConfirmDialog from '../components/common/ConfirmDialog';
import SectionHeader from '../components/common/SectionHeader';
import { isCouponBenefit } from '../utils/benefitUtils';
import { todayKSTString } from '../utils/dateUtils';
import PendingAlertBanner from '../components/planner/PendingAlertBanner';

interface StatusTabProps {
  show: Show;
  onGoToPlanner?: () => void;
}

// 탭 전환 시에도 더보기 상태 유지 (페이지 새로고침 시 초기화)
let _moreExpandedCache = false;

/** 현황 탭 */
export default function StatusTab({ show, onGoToPlanner }: StatusTabProps) {
  const { schedules, addStampBoard, updateStampBoard, deleteStampBoard, hideBoard, reorderBoards, addManualStamp } = useShowStore();
  const { settings } = useSettingsStore();
  const [addBoardOpen, setAddBoardOpen] = useState(false);
  const [editingBoardId, setEditingBoardId] = useState<string | null>(null);
  const [simulatorOpen, setSimulatorOpen] = useState(false);
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [moreExpanded, _setMoreExpanded] = useState(_moreExpandedCache);
  function setMoreExpanded(v: boolean | ((prev: boolean) => boolean)) {
    const newVal = typeof v === 'function' ? v(_moreExpandedCache) : v;
    _moreExpandedCache = newVal;
    _setMoreExpanded(newVal);
  }
  const [addStampBoardId, setAddStampBoardId] = useState<string | null>(null);
  const [deletingBoardId, setDeletingBoardId] = useState<string | null>(null); // Case B confirm
  const [hidingBoardId, setHidingBoardId] = useState<string | null>(null);     // Case C modal
  const [addStampInitialType, setAddStampInitialType] = useState<'exchange' | 'share' | 'etc' | undefined>(undefined);
  const [couponHistoryOpen, setCouponHistoryOpen] = useState(false);
  const [showAmount, setShowAmount] = useState(false); // 기본: 블러(숨김)

  const boardSectionRef = useRef<HTMLElement>(null);
  const benefitSectionRef = useRef<HTMLElement>(null);

  const editingBoard = editingBoardId
    ? show.stampBoards.find(b => b.id === editingBoardId) ?? null
    : null;

  const showSchedules = schedules.filter(s => s.showId === show.id);
  const today = todayKSTString();

  // B-02 요약 카드 메트릭
  const totalConfirmed = showSchedules.filter(s => s.isConfirmed).length;
  const allConfirmed = schedules.filter(s => s.isConfirmed).length;

  const nextBenefitStamps = (() => {
    const vals = show.stampBoards
      .filter(b => b.isActive && !b.isCompleted)
      .flatMap(b => {
        const earned = b.stamps.length;
        return b.benefits
          .filter(bf => !bf.isAchieved && bf.requiredStamps > earned)
          .map(bf => bf.requiredStamps - earned);
      });
    return vals.length > 0 ? Math.min(...vals) : null;
  })();

  const unusedBenefits = show.stampBoards
    .flatMap(b => b.benefits)
    .filter(bf => bf.isAchieved && !bf.isUsed && !isCouponBenefit(bf.description))
    .length;

  // 다음 예정 일정 (오늘 이후 미확정 중 가장 빠른 것)
  const nextSchedule = showSchedules
    .filter(s => s.date > today && !s.isConfirmed && (s.status ?? 'draft') !== 'cancelled')
    .sort((a, b) => a.date.localeCompare(b.date))[0] ?? null;

  function calcDDay(dateStr: string): string {
    const todayMs = new Date(today).getTime();
    const targetMs = new Date(dateStr).getTime();
    const diff = Math.round((targetMs - todayMs) / (1000 * 60 * 60 * 24));
    return diff === 0 ? 'D-day' : `D-${diff}`;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 88px)' }}>
        {/* B-02 요약 카드 */}
        <StatusSummaryCard
          totalConfirmed={totalConfirmed}
          allConfirmed={allConfirmed}
          nextBenefitStamps={nextBenefitStamps}
          unusedBenefits={unusedBenefits}
          onTapBoards={() => boardSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          onTapBenefits={() => benefitSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
        />

        {/* 다음 예정 회차 카드 */}
        {nextSchedule && (() => {
          const grade = show.seatGrades.find(g => g.id === nextSchedule.seatGradeId);
          const discount = show.discountTypes.find(d => d.id === nextSchedule.discountTypeId);
          const dday = calcDDay(nextSchedule.date);
          const dateObj = new Date(nextSchedule.date);
          const dows = ['일', '월', '화', '수', '목', '금', '토'];
          const dateLabel = `${dateObj.getFullYear()}.${String(dateObj.getMonth()+1).padStart(2,'0')}.${String(dateObj.getDate()).padStart(2,'0')} (${dows[dateObj.getDay()]})`;
          const specialEvents = (nextSchedule.specialEventIds ?? [])
            .map(eid => show.specialEvents?.find(e => e.id === eid))
            .filter(Boolean);
          return (
            <div data-testid="next-schedule-card" className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-400">📅 다음 관람</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  dday === 'D-day' ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-600'
                }`}>{dday}</span>
              </div>
              <p className="text-sm font-bold text-gray-800">{dateLabel}</p>
              <p className="text-sm text-gray-500 mt-0.5">
                {grade?.name ?? '(등급 없음)'} · {discount?.name ?? '(할인 없음)'}
              </p>
              {specialEvents.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {specialEvents.map(ev => ev && (
                    <span key={ev.id} className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                      {ev.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })()}

        {/* U-11 미확정 복귀 안내 배너 */}
        <PendingAlertBanner
          schedules={showSchedules}
          today={today}
          onConfirm={() => onGoToPlanner?.()}
        />

        {/* U-03 FocusCard — 추천 배너 대체 */}
        <FocusCard
          boards={show.stampBoards}
          today={today}
          onScrollToBoard={boardId => {
            boardSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            // 약간 지연 후 해당 보드 강조 스크롤 (boardSectionRef 이후에 있음)
            setTimeout(() => {
              const el = document.querySelector(`[data-board-id="${boardId}"]`);
              el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 100);
          }}
          onAddBoard={() => setAddBoardOpen(true)}
        />

        {/* 도장판 */}
        {(() => {
          // 숨겨진 판은 현황 탭 목록에서 제외
          const sortedBoards = [...show.stampBoards].filter(b => !b.isHidden).sort((a, b) => a.sortOrder - b.sortOrder);
          const activeBoards = sortedBoards.filter(b => !b.isCompleted);

          /** M-02: 도장판 삭제 3-case 분기 */
          function handleDeleteBoard(boardId: string) {
            const board = show.stampBoards.find(b => b.id === boardId);
            if (!board) return;
            const hasConfirmed = board.stamps.some(s => s.isConfirmed);
            const hasAny = board.stamps.length > 0;
            if (!hasAny) {
              // Case A: 도장 없음 → 즉시 삭제
              deleteStampBoard(show.id, boardId);
            } else if (hasConfirmed) {
              // Case C: 확정 도장 있음 → 소프트 딜리트 경고
              setHidingBoardId(boardId);
            } else {
              // Case B: 미확정 도장만 있음 → 확인 다이얼로그
              setDeletingBoardId(boardId);
            }
          }
          const completedBoards = sortedBoards.filter(b => b.isCompleted).sort((a, b) => {
            const aAt = [...a.stamps].filter(s => s.isConfirmed).sort((x, y) => y.earnedAt.localeCompare(x.earnedAt))[0]?.earnedAt ?? '';
            const bAt = [...b.stamps].filter(s => s.isConfirmed).sort((x, y) => y.earnedAt.localeCompare(x.earnedAt))[0]?.earnedAt ?? '';
            return bAt.localeCompare(aAt);
          });
          const firstActiveId = activeBoards.find(b => b.isActive)?.id;

          function moveBoard(boardId: string, direction: 'up' | 'down') {
            const ids = sortedBoards.map(b => b.id);
            const idx = ids.indexOf(boardId);
            if (direction === 'up' && idx > 0) {
              [ids[idx - 1], ids[idx]] = [ids[idx], ids[idx - 1]];
            } else if (direction === 'down' && idx < ids.length - 1) {
              [ids[idx], ids[idx + 1]] = [ids[idx + 1], ids[idx]];
            }
            reorderBoards(show.id, ids);
          }

          return (
            <section ref={boardSectionRef} className="space-y-3">
              <SectionHeader
                title="도장판"
                className="-mx-4"
                action={
                  <div className="flex items-center gap-2">
                    <button
                      data-testid="btn-simulator"
                      onClick={() => setSimulatorOpen(true)}
                      className="flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-gray-500 rounded-lg text-xs font-medium active:bg-gray-200 min-h-[36px]"
                    >
                      🔮 <span>시뮬레이터</span>
                    </button>
                    <button
                      data-testid="btn-add-board"
                      onClick={() => setAddBoardOpen(true)}
                      className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-medium min-h-[36px]"
                    >
                      + 새 판
                    </button>
                  </div>
                }
              />

              {activeBoards.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <p className="text-3xl mb-2">🎫</p>
                  <p className="text-sm">도장판이 없어요</p>
                  <p className="text-xs mt-1">+ 새 판 버튼으로 추가해보세요</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {activeBoards.map((board, index) => (
                    <StampBoardCard
                      key={board.id}
                      board={board}
                      priority={index + 1}
                      isFirst={board.id === firstActiveId}
                      onEdit={(boardId) => setEditingBoardId(boardId)}
                      onDelete={handleDeleteBoard}
                      onMoveUp={index > 0 ? () => moveBoard(board.id, 'up') : undefined}
                      onMoveDown={index < activeBoards.length - 1 ? () => moveBoard(board.id, 'down') : undefined}
                      onAddStamp={(boardId, type) => { setAddStampBoardId(boardId); setAddStampInitialType(type); }}
                    />
                  ))}
                </div>
              )}

              {/* 완성된 판 */}
              {completedBoards.length > 0 && (
                <div data-testid="history-section">
                  <button
                    data-testid="history-section-toggle"
                    onClick={() => setHistoryExpanded(v => !v)}
                    className="flex items-center gap-1 text-xs font-medium text-gray-400 mb-2"
                  >
                    <span>{historyExpanded ? '▾' : '▸'}</span>
                    완성된 판 {completedBoards.length}개
                  </button>
                  {historyExpanded && (
                    <div className="space-y-2">
                      {completedBoards.map(board => (
                        <div key={board.id} data-testid={`history-card-${board.id}`}>
                          <BoardHistoryCard
                            board={board}
                            onRevive={(boardId) =>
                              updateStampBoard(show.id, boardId, { isCompleted: false, isActive: true })
                            }
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </section>
          );
        })()}

        {/* 혜택 현황 */}
        <section ref={benefitSectionRef} className="space-y-2">
          <SectionHeader title="혜택 현황" className="-mx-4" />
          <CouponTrackerCard boards={show.stampBoards} onTap={() => setCouponHistoryOpen(true)} showAmount={true} />
          <RewardSummary showId={show.id} boards={show.stampBoards} />
        </section>

        {/* 더보기 섹션 (기본 접힘) */}
        <section>
          <button
            data-testid="more-section-toggle"
            onClick={() => setMoreExpanded(v => !v)}
            className="flex items-center justify-between w-full py-2"
          >
            <h2 className="text-sm font-semibold text-gray-500">더보기</h2>
            <span className="text-gray-400 text-sm">{moreExpanded ? '▾' : '▸'}</span>
          </button>
          {moreExpanded && (
            <div data-testid="more-section-content" className="space-y-4 mt-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">지출 현황</span>
                <button
                  data-testid="btn-toggle-cost-blur"
                  onClick={() => setShowAmount(v => !v)}
                  className="text-xs text-gray-400 font-medium active:text-gray-600"
                >
                  {showAmount ? '금액 숨기기 👁' : '금액 보기 👁'}
                </button>
              </div>
              <CostSummary schedules={showSchedules} showRealCost={settings.showRealCost} showAmount={showAmount} />
              <CastStats showId={show.id} />
            </div>
          )}
        </section>
      </div>

      <EditBoardSheet
        isOpen={!!editingBoardId}
        onClose={() => setEditingBoardId(null)}
        board={editingBoard}
        onSave={(boardId, updates) => {
          updateStampBoard(show.id, boardId, updates);
          setEditingBoardId(null);
        }}
      />

      <AddBoardSheet
        isOpen={addBoardOpen}
        onClose={() => setAddBoardOpen(false)}
        totalBoardCount={show.stampBoards.length}
        prevBoardName={(() => {
          const sorted = [...show.stampBoards].sort((a, b) => a.sortOrder - b.sortOrder);
          return sorted[sorted.length - 1]?.name;
        })()}
        initialData={(() => {
          const sorted = [...show.stampBoards].sort((a, b) => a.sortOrder - b.sortOrder);
          const last = sorted[sorted.length - 1];
          if (!last) return undefined;
          return {
            capacity: last.capacity,
            stampColor: last.stampColor,
            benefits: last.benefits.map(b => ({
              requiredStamps: b.requiredStamps,
              description: b.description,
              priority: b.priority,
            })),
          };
        })()}
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

      <SimulatorSheet
        isOpen={simulatorOpen}
        onClose={() => setSimulatorOpen(false)}
        boards={show.stampBoards}
        schedules={showSchedules}
      />

      <CouponHistorySheet
        isOpen={couponHistoryOpen}
        onClose={() => setCouponHistoryOpen(false)}
        boards={show.stampBoards}
      />

      {/* M-02 Case B: 미확정 도장만 있는 판 삭제 확인 */}
      <ConfirmDialog
        isOpen={!!deletingBoardId}
        title="도장판 삭제"
        message={`"${show.stampBoards.find(b => b.id === deletingBoardId)?.name ?? ''}" 도장판을 삭제할까요?\n미확정 도장과 관련 데이터가 함께 삭제돼요.`}
        confirmLabel="삭제"
        cancelLabel="취소"
        confirmDestructive
        onCancel={() => setDeletingBoardId(null)}
        onConfirm={() => {
          if (deletingBoardId) deleteStampBoard(show.id, deletingBoardId);
          setDeletingBoardId(null);
        }}
      />

      {/* M-02 Case C: 확정 도장 있는 판 → 소프트 딜리트 */}
      {(() => {
        const board = show.stampBoards.find(b => b.id === hidingBoardId);
        const confirmedCount = board ? board.stamps.filter(s => s.isConfirmed).length : 0;
        return (
          <DeleteBoardModal
            isOpen={!!hidingBoardId}
            boardName={board?.name ?? ''}
            confirmedStampCount={confirmedCount}
            onCancel={() => setHidingBoardId(null)}
            onHide={() => {
              if (hidingBoardId) hideBoard(show.id, hidingBoardId);
              setHidingBoardId(null);
            }}
          />
        );
      })()}

      {/* 4.15 수동 도장 추가 시트 */}
      {addStampBoardId && (() => {
        const board = show.stampBoards.find(b => b.id === addStampBoardId);
        if (!board) return null;
        const maxAdd = board.capacity - board.stamps.length;
        return (
          <ManualStampSheet
            boardName={board.name}
            maxAdd={maxAdd}
            initialType={addStampInitialType}
            onSave={(data) => addManualStamp(show.id, addStampBoardId, data)}
            onClose={() => { setAddStampBoardId(null); setAddStampInitialType(undefined); }}
          />
        );
      })()}
    </div>
  );
}
