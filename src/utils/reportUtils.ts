import type { Show, Schedule, ShowReport } from '../types';

export function generateShowReport(
  show: Show,
  schedules: Schedule[]
): ShowReport {
  const showSchedules = schedules.filter(
    s => s.showId === show.id && s.status !== 'cancelled'
  );
  const confirmedSchedules = showSchedules.filter(s => s.isConfirmed);

  // 관람 통계
  const totalVisits     = confirmedSchedules.length;
  const dates           = confirmedSchedules.map(s => s.date).sort();
  const firstVisitDate  = dates[0] ?? '';
  const lastVisitDate   = dates[dates.length - 1] ?? '';

  // 비용 (나눔 관극 제외)
  const paidSchedules   = confirmedSchedules.filter(s => !s.isShare);
  const totalSpent      = paidSchedules.reduce((sum, s) => sum + s.finalPrice, 0);
  const totalSaved      = paidSchedules.reduce(
    (sum, s) => sum + (s.originalPrice - s.finalPrice), 0
  );

  // 도장판
  const completedBoards = show.stampBoards.filter(b => b.isCompleted).length;
  const totalStamps     = show.stampBoards.reduce(
    (sum, b) => sum + b.stamps.filter(s => s.isConfirmed).length, 0
  );

  // 혜택 집계
  const benefitMap = new Map<string, { count: number; usedCount: number }>();
  show.stampBoards.forEach(board => {
    board.benefits.forEach(benefit => {
      if (!benefit.isAchieved) return;
      const key = benefit.description;
      const existing = benefitMap.get(key) ?? { count: 0, usedCount: 0 };
      benefitMap.set(key, {
        count:     existing.count + 1,
        usedCount: existing.usedCount + (benefit.isUsed ? 1 : 0),
      });
    });
  });
  const achievedBenefits = [...benefitMap.entries()]
    .map(([description, v]) => ({ description, ...v }))
    .sort((a, b) => b.count - a.count);

  // 캐스트 통계 (상위 5명)
  const castMap = new Map<string, number>();
  confirmedSchedules.forEach(s => {
    if (!s.cast) return;
    castMap.set(s.cast, (castMap.get(s.cast) ?? 0) + 1);
  });
  const topCasts = [...castMap.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // 특별 이벤트 집계
  const seMap = new Map<string, number>();
  confirmedSchedules.forEach(s => {
    s.specialEventIds.forEach(seId => {
      const se = show.specialEvents.find(e => e.id === seId);
      if (!se || se.isDeleted) return;
      seMap.set(se.name, (seMap.get(se.name) ?? 0) + 1);
    });
  });
  const specialEventSummary = [...seMap.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  return {
    generatedAt: new Date().toISOString(),
    totalVisits,
    confirmedVisits: totalVisits,
    firstVisitDate,
    lastVisitDate,
    totalSpent,
    totalSaved,
    completedBoards,
    totalStamps,
    achievedBenefits,
    topCasts,
    specialEventSummary,
  };
}

/** YYYY-MM-DD → M월 D일 (요일) */
export function formatReportDate(dateStr: string): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  const dows = ['일', '월', '화', '수', '목', '금', '토'];
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${dows[d.getDay()]})`;
}

/** 숫자 → 천단위 콤마 */
export function formatPrice(n: number): string {
  return n.toLocaleString('ko-KR');
}
