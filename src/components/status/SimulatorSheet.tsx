import { useState } from 'react';
import BottomSheet from '../common/BottomSheet';
import type { StampBoard } from '../../types';
import { runSimulator } from '../../utils/simulator';

interface SimulatorSheetProps {
  isOpen: boolean;
  onClose: () => void;
  boards: StampBoard[];
}

export default function SimulatorSheet({ isOpen, onClose, boards }: SimulatorSheetProps) {
  const [views, setViews] = useState(5);

  const targetBoards = boards.filter(b => b.isActive && !b.isCompleted);
  const result = views > 0 && targetBoards.length > 0
    ? runSimulator(boards, views)
    : null;

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="배분 시뮬레이터" testId="simulator-sheet">
      <div className="space-y-5">
        {/* 입력 */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">남은 관람 횟수</span>
          <div className="flex items-center gap-3">
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

        {/* 빈 상태: 활성 판 없음 또는 결과 없음 */}
        {targetBoards.length === 0 && (
          <p data-testid="simulator-empty" className="text-sm text-gray-400 text-center py-6">
            활성화된 도장판이 없어요.<br />새 판을 추가해 보세요.
          </p>
        )}
        {targetBoards.length > 0 && result && result.boardResults.length === 0 && (
          <p data-testid="simulator-empty" className="text-sm text-gray-400 text-center py-6">
            시뮬레이션 결과가 없어요.
          </p>
        )}

        {/* 결과 */}
        {result && result.boardResults.length > 0 && (
          <div className="space-y-3">
            {/* 결과 헤더 */}
            <div className="px-4 py-3 bg-indigo-50 rounded-2xl text-center">
              <p className="text-sm text-indigo-700">
                <span className="font-bold text-indigo-900">{views}회</span> 관람 시{' '}
                혜택 총{' '}
                <span className="font-bold text-indigo-600 text-base">{result.totalBenefits}개</span>{' '}
                달성 가능
              </p>
            </div>

            {/* 신규 도장판 추천 — 도장판이 꽉 차 잔여 관람이 남은 경우 */}
            {result.leftoverViews > 0 && (
              <div className="flex items-start gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-2xl">
                <span className="text-lg shrink-0">🆕</span>
                <div>
                  <p className="text-sm font-semibold text-amber-800">새 도장판이 필요해요</p>
                  <p className="text-xs text-amber-700 mt-0.5">
                    현재 도장판이 꽉 차서{' '}
                    <span className="font-bold">{result.leftoverViews}회</span>{' '}
                    관람분을 적립할 곳이 없어요.
                    새 도장판을 추가하면 더 많은 혜택을 달성할 수 있어요.
                  </p>
                </div>
              </div>
            )}

            {/* 도장판별 결과 카드 */}
            {result.boardResults.map(r => {
              const board = boards.find(b => b.id === r.boardId);
              const currentStamps = board?.stamps.length ?? 0;
              const capacity = board?.capacity ?? 0;

              return (
                <div
                  key={r.boardId}
                  data-testid={`simulator-result-${r.boardId}`}
                  className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden"
                >
                  {/* 헤더 */}
                  <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-800">{r.boardName}</span>
                    <span className="text-xs text-gray-400">
                      +{r.stampsAdded}개 → 총 {currentStamps + r.stampsAdded} / {capacity}
                    </span>
                  </div>

                  {/* 달성 혜택 */}
                  <div className="px-4 py-3">
                    {r.achievedBenefits.length === 0 ? (
                      <p className="text-xs text-gray-400">이번 관람으로 달성되는 혜택이 없어요</p>
                    ) : (
                      <div className="space-y-1.5">
                        {r.achievedBenefits.map((b, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <span className="text-amber-400 text-xs shrink-0">★</span>
                            <span className="text-sm text-amber-700 font-medium">{b.description}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 안내 문구 */}
        <p data-testid="simulator-notice" className="text-xs text-gray-400 text-center pt-1">
          시뮬레이션 결과는 실제 데이터에 영향을 주지 않아요.
        </p>
      </div>
    </BottomSheet>
  );
}
