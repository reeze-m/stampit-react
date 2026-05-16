import type { StampBoard } from '../../types';
import { getNextBenefitInfo, areAllBenefitsAchieved } from '../../utils/boardUtils';

interface FocusCardProps {
  boards: StampBoard[];
  today: string; // ✅ 추가
  onScrollToBoard: (boardId: string) => void;
  onAddBoard: () => void;
}

/** 현황 탭 핵심 정보 강조 카드 (U-03) */
export default function FocusCard({ boards, today, onScrollToBoard, onAddBoard }: FocusCardProps) {
  const activeBoards = boards.filter(b => b.isActive && !b.isCompleted);

  // C. 활성 판 없음 → 미노출
  if (activeBoards.length === 0) return null;

  const allAchieved = areAllBenefitsAchieved(boards);

  // B. 모든 혜택 달성 완료
  if (allAchieved) {
    return (
      <div className="bg-green-500 rounded-2xl p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <p className="text-base font-bold text-white mb-1">
              🎉 모든 혜택을 달성했어요!
            </p>
            <p className="text-sm text-green-100">
              새 도장판을 시작해볼까요?
            </p>
          </div>
          <button
            type="button"
            onClick={onAddBoard}
            className="shrink-0 px-3 py-1.5 bg-white text-green-600 rounded-xl text-sm font-semibold min-h-[36px] active:bg-green-50"
          >
            새 판 추가
          </button>
        </div>
      </div>
    );
  }

  const info = getNextBenefitInfo(boards, today);

  // A. 진행 중인 혜택 있음
  if (info) {
    return (
      <button
        type="button"
        data-testid="focus-card"
        onClick={() => onScrollToBoard(info.boardId)}
        className="w-full bg-indigo-600 rounded-2xl p-4 shadow-sm text-left active:bg-indigo-700 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <p className="text-sm font-bold text-white leading-snug">
              💡{' '}
              <span className="font-semibold opacity-90">{info.boardName}</span>에{' '}
              <span className="text-white font-extrabold underline decoration-dotted underline-offset-2">{info.remainingStamps}개</span>만 더 찍으면
            </p>
            <p className="text-sm text-indigo-200 mt-0.5 font-medium">
              {info.benefitDescription}이에요
            </p>
          </div>
          <span className="text-white text-lg opacity-60">▶</span>
        </div>
      </button>
    );
  }

  // 혜택 없는 판만 있을 때는 미노출
  return null;
}
