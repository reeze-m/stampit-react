import { useState } from 'react';
import type { StampBoard } from '../../types';
import StampGrid from '../common/StampGrid';
import Badge from '../common/Badge';

interface StampBoardCardProps {
  board: StampBoard;
  priority: number;
  isFirst: boolean;
  onEdit: (boardId: string) => void;
  onDelete: (boardId: string) => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onAddStamp?: (boardId: string, type?: 'exchange' | 'share' | 'etc') => void;
}

/** V-08: 도장판 카드 컴포넌트 */
export default function StampBoardCard({
  board,
  priority,
  isFirst,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
  onAddStamp,
}: StampBoardCardProps) {
  const [swiped, setSwiped] = useState(false);
  const stampCount = board.stamps.length;

  // 교환/나눔/기타 도장 수 집계
  const exchangeCount = board.stamps.filter(s => s.stampType === 'exchange').length;
  const shareCount = board.stamps.filter(s => s.stampType === 'share').length;
  const etcCount = board.stamps.filter(s => s.stampType === 'etc').length;
  const hasManualStamps = exchangeCount + shareCount + etcCount > 0;

  const nextBenefit = board.benefits
    .filter(b => !b.isAchieved && b.requiredStamps > stampCount)
    .sort((a, b) => a.requiredStamps - b.requiredStamps)[0];

  const hasStampButtons = !!(onAddStamp && board.isActive && !board.isCompleted);
  // swipe reveal width: stamp buttons (3×38px + 2×4px gap) + 수정/삭제 (2×50px + 1×4px gap) + pr-2
  const swipeTranslate = hasStampButtons ? '-translate-x-[248px]' : '-translate-x-[108px]';

  return (
    <div className="relative overflow-hidden rounded-2xl" data-testid={`board-card-${board.id}`} data-board-id={board.id}>
      {/* 스와이프 액션 */}
      {swiped && (
        <div className="absolute right-0 top-0 bottom-0 flex items-center gap-1 pr-2 z-10">
          {hasStampButtons && (
            <>
              <button
                data-testid="menu-stamp-exchange"
                onClick={() => { onAddStamp!(board.id, 'exchange'); setSwiped(false); }}
                className="px-2 py-2 bg-gray-500 text-white rounded-xl text-xs font-medium min-h-[44px] whitespace-nowrap"
              >
                +교환
              </button>
              <button
                onClick={() => { onAddStamp!(board.id, 'share'); setSwiped(false); }}
                className="px-2 py-2 bg-gray-500 text-white rounded-xl text-xs font-medium min-h-[44px] whitespace-nowrap"
              >
                +나눔
              </button>
              <button
                onClick={() => { onAddStamp!(board.id, 'etc'); setSwiped(false); }}
                className="px-2 py-2 bg-gray-500 text-white rounded-xl text-xs font-medium min-h-[44px] whitespace-nowrap"
              >
                +기타
              </button>
            </>
          )}
          <button
            onClick={() => { onEdit(board.id); setSwiped(false); }}
            className="px-3 py-2 bg-indigo-500 text-white rounded-xl text-sm font-medium min-h-[44px]"
          >
            수정
          </button>
          <button
            onClick={() => { onDelete(board.id); setSwiped(false); }}
            className="px-3 py-2 bg-red-500 text-white rounded-xl text-sm font-medium min-h-[44px]"
          >
            삭제
          </button>
        </div>
      )}

      <div
        className={`transition-transform select-none ${swiped ? swipeTranslate : 'translate-x-0'}`}
        onClick={() => setSwiped(false)}
      >
        {board.isCompleted ? (
          // 완성된 판
          <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 p-4 rounded-2xl text-white">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h3 className="font-bold">{board.name}</h3>
                <span className="text-xs bg-indigo-500/60 px-2 py-0.5 rounded-full font-semibold">
                  {priority}순위
                </span>
              </div>
              <span className="text-xs bg-white/20 px-2 py-1 rounded-full font-semibold">완성! 🎉</span>
            </div>
            <StampGrid capacity={board.capacity} stamps={board.stamps} benefits={board.benefits} stampColor={board.stampColor} />
          </div>
        ) : (
          // 진행 중인 판
          <div className="bg-white border border-gray-100 px-4 pt-2 pb-4 rounded-2xl shadow-sm">
            {/* 헤더 */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-gray-900">{board.name}</h3>
                <Badge color="primary">{priority}순위</Badge>
                {isFirst && (
                  <Badge color="amber">⭐ 추천</Badge>
                )}
              </div>
              <div className="flex items-center gap-1">
                {onMoveUp && (
                  <button
                    onClick={e => { e.stopPropagation(); onMoveUp(); }}
                    className="min-w-[36px] min-h-[36px] flex items-center justify-center text-gray-400 active:text-indigo-600 text-base leading-none"
                    aria-label="우선순위 올리기"
                  >
                    ↑
                  </button>
                )}
                {onMoveDown && (
                  <button
                    onClick={e => { e.stopPropagation(); onMoveDown(); }}
                    className="min-w-[36px] min-h-[36px] flex items-center justify-center text-gray-400 active:text-indigo-600 text-base leading-none"
                    aria-label="우선순위 내리기"
                  >
                    ↓
                  </button>
                )}
                <button
                  data-testid="btn-more"
                  onClick={e => { e.stopPropagation(); setSwiped(s => !s); }}
                  className="min-w-[32px] min-h-[32px] flex items-center justify-center text-gray-400 active:text-gray-600 text-sm"
                >
                  ···
                </button>
              </div>
            </div>

            {/* 도장 그리드 */}
            <StampGrid capacity={board.capacity} stamps={board.stamps} benefits={board.benefits} stampColor={board.stampColor} />

            <div className="mt-3 space-y-1.5">
              {/* 도장 수 + 다음 혜택 한 줄 */}
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>{stampCount} / {board.capacity}개</span>
                {nextBenefit && (
                  <span>
                    다음 혜택: {nextBenefit.requiredStamps}개 달성 시 {nextBenefit.description} ·{' '}
                    <span className="font-bold text-indigo-600">
                      {nextBenefit.requiredStamps - stampCount}개
                    </span>{' '}
                    남음
                  </span>
                )}
              </div>

              {/* 취득 경로 요약 칩 */}
              {hasManualStamps && (
                <div className="flex gap-1.5">
                  {exchangeCount > 0 && (
                    <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full font-medium">🔄 교환 {exchangeCount}</span>
                  )}
                  {shareCount > 0 && (
                    <span className="text-[10px] bg-green-50 text-green-600 px-1.5 py-0.5 rounded-full font-medium">🎁 나눔 {shareCount}</span>
                  )}
                  {etcCount > 0 && (
                    <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full font-medium">✏️ 기타 {etcCount}</span>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
