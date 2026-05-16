import { useState, useEffect } from 'react';
import BottomSheet from '../common/BottomSheet';
import type { StampBoard, Schedule } from '../../types';
import { simulateNewBoards, runSimulator } from '../../utils/simulator';
import { todayKSTString } from '../../utils/dateUtils';

interface SimulatorSheetProps {
  isOpen: boolean;
  onClose: () => void;
  boards: StampBoard[];
  schedules?: Schedule[];
}

/** 기존 + 신규 도장판 혜택 통합 집계 */
function buildCombinedSummary(
  existingBoardResults: ReturnType<typeof runSimulator>['boardResults'] | null,
  newBenefitSummary: { description: string; total: number }[] | null,
  allBoards: StampBoard[],
): { description: string; total: number; priority: number }[] {
  const map = new Map<string, { total: number; priority: number }>();

  // 혜택 이름 → 우선순위 룩업 (모든 도장판 통합)
  const priorityMap = new Map<string, number>();
  for (const board of allBoards) {
    for (const b of board.benefits) {
      const cur = priorityMap.get(b.description);
      if (cur === undefined || b.priority < cur) {
        priorityMap.set(b.description, b.priority);
      }
    }
  }

  // 기존 도장판 달성 혜택 집계 (achievedBenefits 각 항목 = 1회 달성)
  if (existingBoardResults) {
    for (const r of existingBoardResults) {
      for (const b of r.achievedBenefits) {
        const priority = priorityMap.get(b.description) ?? 99;
        const entry = map.get(b.description);
        if (entry) entry.total += 1;
        else map.set(b.description, { total: 1, priority });
      }
    }
  }

  // 신규 도장판 혜택 집계
  if (newBenefitSummary) {
    for (const b of newBenefitSummary) {
      const priority = priorityMap.get(b.description) ?? 99;
      const entry = map.get(b.description);
      if (entry) entry.total += b.total;
      else map.set(b.description, { total: b.total, priority });
    }
  }

  return [...map.entries()]
    .map(([description, { total, priority }]) => ({ description, total, priority }))
    .sort((a, b) => a.priority - b.priority);
}

export default function SimulatorSheet({ isOpen, onClose, boards, schedules = [] }: SimulatorSheetProps) {
  const [views, setViews] = useState(10);
  const [allBenefits, setAllBenefits] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // 시트를 열 때마다 상태 초기화: 미래 일정이 있으면 그 수로, 없으면 10회
      setViews(futureCount > 0 ? Math.min(99, futureCount) : 10);
      setAllBenefits(false);
    }
  // futureCount는 열릴 때 한 번만 읽으면 되므로 isOpen만 의존
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // 미래 미확정 일정 수 (오늘 포함)
  const today = todayKSTString();
  const futureCount = schedules.filter(
    s => s.date >= today && !s.isConfirmed && (s.status ?? 'draft') !== 'cancelled',
  ).length;

  // 기준 도장판: 활성·미완성·미숨김 중 sortOrder 가장 낮은 것 (신규 도장판 템플릿용)
  const templateBoard = [...boards]
    .filter(b => b.isActive && !b.isCompleted && !b.isHidden)
    .sort((a, b) => a.sortOrder - b.sortOrder)[0] ?? null;

  const hasBenefits = (templateBoard?.benefits.length ?? 0) > 0;

  const maxThreshold = templateBoard
    ? Math.max(...templateBoard.benefits.map(b => b.requiredStamps))
    : 0;

  // ── Step 1: 기존 도장판에 먼저 배분 ──
  const existingResult = views > 0 ? runSimulator(boards, views) : null;
  const leftoverViews = existingResult?.leftoverViews ?? views;

  // 모든 혜택 보장 가능 여부는 신규 도장판에 실제로 사용되는 leftoverViews 기준
  const canGuaranteeAll = !allBenefits || leftoverViews >= maxThreshold;
  const hasExistingAllocation =
    existingResult?.boardResults.some(r => r.stampsAdded > 0) ?? false;
  const viewsUsedOnExisting = views - leftoverViews;

  // ── Step 2: 남은 관람으로 신규 도장판 배분 ──
  const newBoardResult =
    templateBoard && hasBenefits && leftoverViews > 0
      ? simulateNewBoards(templateBoard, leftoverViews, allBenefits && canGuaranteeAll)
      : null;

  // ── 통합 혜택 요약 ──
  const combinedSummary = buildCombinedSummary(
    hasExistingAllocation ? existingResult!.boardResults : null,
    newBoardResult?.benefitSummary ?? null,
    boards,
  );

  const hasAnyResult = hasExistingAllocation || (newBoardResult?.boards.length ?? 0) > 0;

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="배분 시뮬레이터" testId="simulator-sheet">
      <div className="space-y-5">

        {/* ── 빈 상태 ── */}
        {!templateBoard && (
          <p data-testid="simulator-empty" className="text-sm text-gray-400 text-center py-6">
            활성화된 도장판이 없어요.<br />새 판을 추가해 보세요.
          </p>
        )}
        {templateBoard && !hasBenefits && (
          <p data-testid="simulator-empty" className="text-sm text-gray-400 text-center py-6">
            도장판에 설정된 혜택이 없어요.
          </p>
        )}

        {templateBoard && hasBenefits && (
          <>
            {/* ── 기준 도장판 안내 ── */}
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-xl">
              <span className="text-xs text-gray-400">기준 도장판</span>
              <span className="text-xs font-semibold text-gray-700 flex-1 truncate">
                {templateBoard.name}
              </span>
              <div className="flex items-center gap-1 shrink-0">
                {[...new Map(
                  [...templateBoard.benefits]
                    .sort((a, b) => a.priority - b.priority)
                    .map(b => [b.description, b])
                ).values()].map((b, i) => (
                  <span key={i} className="text-[10px] text-gray-400 bg-white border border-gray-200 rounded-full px-1.5 py-0.5">
                    {b.requiredStamps}회
                  </span>
                ))}
              </div>
            </div>

            {/* ── 남은 관람 횟수 ── */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">남은 관람 횟수</span>
                {futureCount > 0 && (
                  <button
                    onClick={() => setViews(Math.min(99, futureCount))}
                    className="flex items-center gap-1 text-xs text-indigo-600 font-medium bg-indigo-50 rounded-lg px-2.5 py-1 active:bg-indigo-100"
                  >
                    📅 예정 일정 {futureCount}회 적용
                  </button>
                )}
              </div>
            <div className="flex items-center gap-3 justify-end">
                <button
                  onClick={() => setViews(v => Math.max(1, v - 1))}
                  disabled={views <= 1}
                  className="w-9 h-9 rounded-xl bg-gray-100 text-gray-700 font-bold text-lg flex items-center justify-center active:bg-gray-200 disabled:opacity-30"
                >
                  −
                </button>
                <input
                  data-testid="simulator-input"
                  type="number"
                  value={views}
                  onChange={e => setViews(Math.min(99, Math.max(1, Number(e.target.value) || 1)))}
                  className="w-14 text-center text-lg font-bold text-gray-900 border border-gray-200 rounded-xl px-1 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  min={1}
                  max={99}
                />
                <button
                  onClick={() => setViews(v => Math.min(99, v + 1))}
                  disabled={views >= 99}
                  className="w-9 h-9 rounded-xl bg-gray-100 text-gray-700 font-bold text-lg flex items-center justify-center active:bg-gray-200 disabled:opacity-30"
                >
                  +
                </button>
              </div>
            </div>

            {/* ── 모든 혜택 받기 토글 ── */}
            {/* leftoverViews=0이면 신규 판 없음 → 토글 비활성 */}
            <div className={`flex items-center justify-between gap-3 ${leftoverViews === 0 ? 'opacity-40 pointer-events-none' : ''}`}>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-700">모든 혜택 받기</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {leftoverViews === 0
                    ? '기존 판이 모든 관람을 소화해요'
                    : allBenefits
                      ? '모든 혜택을 1개씩 받은 뒤 나머지를 우선순위대로 배분해요'
                      : '1순위 혜택을 최대한 많이 받도록 배분해요'}
                </p>
              </div>
              <button
                data-testid="simulator-toggle"
                onClick={() => setAllBenefits(v => !v)}
                className={`relative w-12 h-6 rounded-full transition-colors shrink-0 overflow-hidden ${
                  allBenefits && leftoverViews > 0 ? 'bg-indigo-500' : 'bg-gray-200'
                }`}
              >
                <span
                  className="absolute top-[2px] left-[2px] w-5 h-5 bg-white rounded-full shadow transition-transform"
                  style={{ transform: allBenefits ? 'translateX(24px)' : 'translateX(0)' }}
                />
              </button>
            </div>

            {/* allBenefits ON + 잔여 있지만 최소 횟수 부족 */}
            {allBenefits && leftoverViews > 0 && !canGuaranteeAll && (
              <div className="px-4 py-3 bg-amber-50 border border-amber-200 rounded-2xl">
                <p className="text-xs text-amber-700">
                  잔여 <span className="font-bold">{leftoverViews}회</span>로는 모든 혜택을 보장하기 어려워요.{' '}
                  최소 <span className="font-bold">{maxThreshold}회</span>가 필요해서
                  우선순위 기준으로 배분해드릴게요.
                </p>
              </div>
            )}

            {/* ── 결과 ── */}
            {hasAnyResult && (
              <div className="space-y-4">

                {/* ── 기존 도장판 배분 ── */}
                {hasExistingAllocation && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 px-0.5">
                      <span className="text-sm font-semibold text-gray-800">기존 도장판</span>
                      <span className="text-xs text-gray-400">
                        {viewsUsedOnExisting}회 배분
                      </span>
                    </div>
                    <div className="space-y-2">
                      {existingResult!.boardResults
                        .filter(r => r.stampsAdded > 0)
                        .map(r => (
                          <div
                            key={r.boardId}
                            data-testid={`simulator-result-${r.boardId}`}
                            className="bg-white border border-gray-100 rounded-2xl px-4 py-2.5 shadow-sm"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-gray-700 flex-1 truncate">
                                {r.boardName}
                              </span>
                              <span className="text-xs font-semibold text-indigo-600 shrink-0">
                                +{r.stampsAdded}개
                              </span>
                            </div>
                            {r.achievedBenefits.length > 0 && (
                              <div className="mt-1.5 flex flex-wrap gap-1">
                                {r.achievedBenefits.map((b, i) => (
                                  <span
                                    key={i}
                                    className="text-[10px] text-amber-700 bg-amber-50 border border-amber-100 rounded-full px-1.5 py-0.5"
                                  >
                                    ★ {b.requiredStamps}회 {b.description}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* ── 신규 도장판 ── */}
                {newBoardResult && newBoardResult.boards.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 px-0.5">
                      <span className="text-sm font-semibold text-gray-800">
                        신규 도장판{' '}
                        <span className="text-indigo-600">{newBoardResult.boards.length}개</span>{' '}
                        필요
                      </span>
                      {allBenefits && canGuaranteeAll && (
                        <span className="text-[10px] font-bold bg-indigo-100 text-indigo-600 rounded-full px-2 py-0.5">
                          모든 혜택 포함
                        </span>
                      )}
                      {hasExistingAllocation && (
                        <span className="text-xs text-gray-400">
                          잔여 {leftoverViews}회
                        </span>
                      )}
                    </div>
                    <div className="space-y-2">
                      {newBoardResult.boards.map(item => (
                        <div
                          key={item.index}
                          data-testid={`simulator-result-${item.index}`}
                          className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm"
                        >
                          <div className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-50">
                            <span className="text-xs text-gray-400 shrink-0">
                              {item.index}번
                            </span>
                            <span className="text-sm font-semibold text-gray-800 flex-1">
                              {item.stamps}회 도장판
                            </span>
                          </div>
                          <div className="px-4 py-2.5">
                            {item.benefits.length === 0 ? (
                              <p className="text-xs text-gray-300">혜택 없음</p>
                            ) : (
                              <div className="space-y-1">
                                {item.benefits.map((b, i) => (
                                  <div key={i} className="flex items-center gap-1.5">
                                    <span className="text-amber-400 text-xs shrink-0">★</span>
                                    <span className="text-xs text-gray-600">
                                      {b.requiredStamps}회 {b.description}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── 최종 혜택 요약 ── */}
                {combinedSummary.length > 0 && (
                  <div className="px-4 py-3 bg-indigo-50 rounded-2xl space-y-2">
                    <p className="text-xs font-semibold text-indigo-700">최종 달성 혜택</p>
                    <div className="flex flex-wrap gap-2">
                      {combinedSummary.map((b, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-1.5 bg-white rounded-xl px-3 py-1.5 shadow-sm"
                        >
                          <span className="text-amber-400 text-xs">★</span>
                          <span className="text-sm font-semibold text-gray-800">{b.description}</span>
                          <span className="text-sm font-bold text-indigo-600">×{b.total}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            )}
          </>
        )}

        {/* 안내 */}
        <p data-testid="simulator-notice" className="text-xs text-gray-400 text-center pt-1">
          시뮬레이션 결과는 실제 데이터에 영향을 주지 않아요.
        </p>
      </div>
    </BottomSheet>
  );
}
