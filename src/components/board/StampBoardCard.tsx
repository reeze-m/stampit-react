import { useState } from 'react';
import type { StampBoard } from '../../types';
import StampGrid from '../common/StampGrid';
import Badge from '../common/Badge';
import { todayKSTString } from '../../utils/dateUtils';

interface StampBoardCardProps {
  board: StampBoard;
  priority: number;
  isFirst: boolean;
  onEdit: (boardId: string) => void;
  onDelete: (boardId: string) => void;
  onAddStamp?: (boardId: string, type?: 'exchange' | 'share' | 'etc') => void;
}

/** V-08: 도장판 카드 컴포넌트 */
export default function StampBoardCard({
  board,
  priority,
  isFirst,
  onEdit,
  onDelete,
  onAddStamp,
}: StampBoardCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
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

  return (
    <>
      <div className="rounded-2xl" data-testid={`board-card-${board.id}`} data-board-id={board.id}>
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
            <StampGrid capacity={board.capacity} stamps={board.stamps} benefits={board.benefits} stampColor={board.stampColor} today={todayKSTString()} />
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
              <button
                data-testid="btn-more"
                onClick={e => { e.stopPropagation(); setMenuOpen(true); }}
                className="min-w-[32px] min-h-[32px] flex items-center justify-center text-gray-400 active:text-gray-600 text-sm"
              >
                ···
              </button>
            </div>

            {/* 도장 그리드 */}
            <StampGrid capacity={board.capacity} stamps={board.stamps} benefits={board.benefits} stampColor={board.stampColor} today={todayKSTString()} />

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

      {/* 액션 시트 */}
      {menuOpen && (
        <>
          {/* 딤 */}
          <div
            className="fixed inset-0 z-40 bg-black/30"
            onClick={() => setMenuOpen(false)}
          />
          {/* 시트 */}
          <div className="fixed left-0 right-0 bottom-0 z-50 bg-white rounded-t-3xl pb-8 pt-2">
            {/* 핸들 */}
            <div className="flex justify-center py-3">
              <div className="w-9 h-1 rounded-full bg-gray-200" />
            </div>

            {/* 판 이름 */}
            <p className="text-center text-sm font-semibold text-gray-700 pb-3 border-b border-gray-100">
              {board.name}
            </p>

            <div className="px-4 pt-2 space-y-1">
              {/* 도장 추가 버튼 */}
              {hasStampButtons && (
                <>
                  <button
                    data-testid="menu-stamp-exchange"
                    onClick={() => { onAddStamp!(board.id, 'exchange'); setMenuOpen(false); }}
                    className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl active:bg-gray-50 text-left"
                  >
                    <span className="text-lg">🔄</span>
                    <span className="text-sm font-medium text-gray-700">교환 도장 추가</span>
                  </button>
                  <button
                    onClick={() => { onAddStamp!(board.id, 'share'); setMenuOpen(false); }}
                    className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl active:bg-gray-50 text-left"
                  >
                    <span className="text-lg">🎁</span>
                    <span className="text-sm font-medium text-gray-700">나눔 도장 추가</span>
                  </button>
                  <button
                    onClick={() => { onAddStamp!(board.id, 'etc'); setMenuOpen(false); }}
                    className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl active:bg-gray-50 text-left"
                  >
                    <span className="text-lg">✏️</span>
                    <span className="text-sm font-medium text-gray-700">기타 도장 추가</span>
                  </button>
                  <div className="h-px bg-gray-100 my-1" />
                </>
              )}

              {/* 수정 / 삭제 */}
              <button
                onClick={() => { onEdit(board.id); setMenuOpen(false); }}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl active:bg-gray-50 text-left"
              >
                <span className="text-lg">✏️</span>
                <span className="text-sm font-medium text-gray-700">도장판 수정</span>
              </button>
              <button
                onClick={() => { onDelete(board.id); setMenuOpen(false); }}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl active:bg-red-50 text-left"
              >
                <span className="text-lg">🗑️</span>
                <span className="text-sm font-medium text-red-500">도장판 삭제</span>
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
