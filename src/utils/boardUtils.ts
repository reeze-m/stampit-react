import type { StampBoard } from '../types';

export interface NextBenefitInfo {
  boardId: string;
  boardName: string;
  benefitDescription: string;
  remainingStamps: number;
}

/**
 * 활성 도장판 중 다음 미달성 혜택까지 남은 도장이 가장 적은 판 반환
 * 동률 시 sortOrder 낮은 순
 */
export function getNextBenefitInfo(boards: StampBoard[], today: string): NextBenefitInfo | null {
  const activeBoards = boards.filter(b => b.isActive && !b.isCompleted);
  if (activeBoards.length === 0) return null;

  const candidates = activeBoards
    .map(board => {
      // 오늘 이전 도장만 카운트 (예비 제외)
      const currentStamps = board.stamps.filter(s =>
        s.isConfirmed &&
        (!s.earnedAt || s.earnedAt.slice(0, 10) <= today)
      ).length;
      const nextBenefit = board.benefits
        .filter(b => !b.isAchieved)
        .sort((a, b) => a.requiredStamps - b.requiredStamps)[0];
      if (!nextBenefit) return null;
      return {
        boardId: board.id,
        boardName: board.name,
        benefitDescription: nextBenefit.description,
        remainingStamps: nextBenefit.requiredStamps - currentStamps,
        sortOrder: board.sortOrder,
      };
    })
    .filter((c): c is NonNullable<typeof c> => c !== null);

  if (candidates.length === 0) return null;

  candidates.sort((a, b) =>
    a.remainingStamps !== b.remainingStamps
      ? a.remainingStamps - b.remainingStamps
      : a.sortOrder - b.sortOrder
  );

  const { sortOrder: _s, ...result } = candidates[0];
  return result;
}

/**
 * 모든 활성 판의 혜택이 달성 완료됐는지 확인
 */
export function areAllBenefitsAchieved(boards: StampBoard[]): boolean {
  const activeBoards = boards.filter(b => b.isActive && !b.isCompleted);
  if (activeBoards.length === 0) return false;
  return activeBoards.every(
    board => board.benefits.length > 0 && board.benefits.every(b => b.isAchieved)
  );
}
