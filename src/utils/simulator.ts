import type { StampBoard, SimulatorResult, SimulatorBoardResult } from '../types';

/** 신규 도장판 추가 시 혜택 달성 플랜 */
export interface NewBoardPlan {
  targetThreshold: number;   // 판 목표 도장 수 (= 해당 혜택까지 채울 기준)
  newBoardsCount: number;    // floor(leftoverViews / targetThreshold)
  benefitsPerBoard: {
    description: string;
    requiredStamps: number;
    priority: number;
  }[];
  totalNewBenefits: number;  // newBoardsCount × benefitsPerBoard.length
  leftoverAfter: number;     // leftoverViews % targetThreshold
  isRecommended: boolean;    // 1순위 혜택을 가장 많이 달성하는 플랜
}

/** 깊은 복사 */
function cloneBoards(boards: StampBoard[]): StampBoard[] {
  return JSON.parse(JSON.stringify(boards));
}

/**
 * 최적 배분 시뮬레이터 (순수 함수 — 원본 데이터 변경 없음)
 *
 * 매 회차마다 "다음 미달성 혜택까지 남은 도장 수"가 가장 적은 판에 도장 1개 배분.
 * 동률 시 sortOrder 낮은 판 우선. 달성할 혜택이 없는 판은 후순위.
 *
 * @param allBenefits false(기본): 기존 판에서 다음 혜택 1개만 달성 후 신규 판으로 넘김
 *                   true: 기존 판의 모든 혜택을 달성할 때까지 배분
 */
export function runSimulator(
  boards: StampBoard[],
  remainingViews: number,
  allBenefits: boolean = false,
): SimulatorResult & { leftoverViews: number } {
  const sim = cloneBoards(boards).filter(b => b.isActive && !b.isCompleted && !b.isHidden);

  // ── 데이터 정합성 보정: 현재 도장 수가 혜택 기준을 넘었는데
  //    isAchieved=false 인 경우 distance가 음수가 되어 혜택이 잘못 표시됨
  for (const b of sim) {
    const count = b.stamps.length;
    for (const benefit of b.benefits) {
      if (!benefit.isAchieved && benefit.requiredStamps <= count) {
        benefit.isAchieved = true;
      }
    }
  }

  // 판별 추가 도장 수 집계
  const stampsAdded: Record<string, number> = {};
  const achievedMap: Record<string, { description: string; requiredStamps: number }[]> = {};
  for (const b of sim) {
    stampsAdded[b.id] = 0;
    achievedMap[b.id] = [];
  }

  // allBenefits=false 일 때 다음 혜택 달성 후 배분 중단된 판
  const saturated = new Set<string>();

  let usedViews = 0;
  for (let i = 0; i < remainingViews; i++) {
    const active = sim.filter(b => !b.isCompleted && !saturated.has(b.id));
    if (active.length === 0) break;
    usedViews++;

    // 각 판의 다음 미달성 혜택까지 거리 계산
    // Math.max(0, ...) 로 음수 방지
    const ranked = active
      .map(b => {
        const currentCount = b.stamps.length;
        const next = b.benefits
          .filter(ben => !ben.isAchieved)
          .sort((a, c) => a.requiredStamps - c.requiredStamps)[0];
        const distance = next
          ? Math.max(0, next.requiredStamps - currentCount)
          : Infinity;
        return { board: b, distance };
      })
      .sort((a, b) => {
        if (a.distance !== b.distance) return a.distance - b.distance;
        return a.board.sortOrder - b.board.sortOrder;
      });

    // 모든 활성 도장판의 혜택이 달성됐으면 나머지는 신규 도장판용 leftover로 남김
    if (ranked[0].distance === Infinity) break;

    const target = ranked[0].board;

    // 도장 1개 추가
    target.stamps.push({
      id: `sim-${target.stamps.length}`,
      scheduleId: null,
      isInitial: false,
      isConfirmed: false,
      earnedAt: '',
    });
    stampsAdded[target.id] = (stampsAdded[target.id] ?? 0) + 1;

    // 혜택 달성 체크
    const newCount = target.stamps.length;
    for (const benefit of target.benefits) {
      if (!benefit.isAchieved && benefit.requiredStamps <= newCount) {
        benefit.isAchieved = true;
        achievedMap[target.id].push({
          description: benefit.description,
          requiredStamps: benefit.requiredStamps,
        });
      }
    }

    // allBenefits=false: 이번 시뮬에서 첫 혜택 달성 후 해당 판 배분 종료 → 잔여는 신규 판으로
    if (!allBenefits && achievedMap[target.id].length > 0) {
      saturated.add(target.id);
    }

    // 완성 체크
    if (newCount >= target.capacity) target.isCompleted = true;
  }

  // 결과 집계 (원본 boards 기준으로 이름·sortOrder 참조)
  const boardResults: SimulatorBoardResult[] = boards
    .filter(b => b.isActive && !b.isCompleted && !b.isHidden)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(b => ({
      boardId: b.id,
      boardName: b.name,
      stampsAdded: stampsAdded[b.id] ?? 0,
      achievedBenefits: achievedMap[b.id] ?? [],
    }));

  const totalBenefits = boardResults.reduce(
    (sum, r) => sum + r.achievedBenefits.length,
    0
  );

  // 도장판이 꽉 차 할당되지 못한 잔여 관람 수
  const leftoverViews = remainingViews - usedViews;

  return { totalBenefits, boardResults, leftoverViews };
}

/**
 * 신규 도장판 추가 시 혜택 달성 플랜 목록 생성 (순수 함수)
 *
 * 템플릿 도장판의 각 혜택 기준점(requiredStamps)을 도장판 목표 용량으로 삼아,
 * leftoverViews 회수로 몇 개 판을 완성할 수 있는지 계산한다.
 * 1순위(최저 priority 값) 혜택을 가장 많이 달성하는 플랜을 isRecommended=true 로 표시.
 */
export function planNewBoards(
  templateBoard: StampBoard,
  leftoverViews: number,
): NewBoardPlan[] {
  if (leftoverViews <= 0 || templateBoard.benefits.length === 0) return [];

  // 혜택 기준점 목록 (중복 제거 → 오름차순)
  const thresholds = [
    ...new Set(templateBoard.benefits.map(b => b.requiredStamps)),
  ].sort((a, b) => a - b);

  const plans: NewBoardPlan[] = thresholds
    .map(threshold => {
      const newBoardsCount = Math.floor(leftoverViews / threshold);
      if (newBoardsCount === 0) return null;

      const leftoverAfter = leftoverViews % threshold;
      // 해당 threshold 이하의 모든 혜택 → 우선순위 → 필요 도장 수 순
      const benefitsPerBoard = templateBoard.benefits
        .filter(b => b.requiredStamps <= threshold)
        .sort((a, b) => a.priority - b.priority || a.requiredStamps - b.requiredStamps)
        .map(b => ({
          description: b.description,
          requiredStamps: b.requiredStamps,
          priority: b.priority,
        }));

      return {
        targetThreshold: threshold,
        newBoardsCount,
        benefitsPerBoard,
        totalNewBenefits: newBoardsCount * benefitsPerBoard.length,
        leftoverAfter,
        isRecommended: false,
      };
    })
    .filter((p): p is NewBoardPlan => p !== null);

  if (plans.length === 0) return [];

  // 추천 플랜: 최고 우선순위(가장 낮은 priority 값) 혜택 포함 → 그 중 newBoardsCount 최대
  const topPriority = Math.min(...templateBoard.benefits.map(b => b.priority));
  const plansWithTop = plans.filter(p =>
    p.benefitsPerBoard.some(b => b.priority === topPriority),
  );
  const recommended = (plansWithTop.length > 0 ? plansWithTop : plans).reduce(
    (best, cur) => (cur.newBoardsCount > best.newBoardsCount ? cur : best),
  );
  recommended.isRecommended = true;

  return plans;
}

/** 신규 도장판 보장 시나리오 — 특정 혜택 1개 보장 후 나머지 최적 배분 */
export interface GuaranteedPlanResult {
  guaranteeThreshold: number;
  guaranteeBenefitName: string;   // 보장하는 전용 혜택명
  segments: {
    threshold: number;
    count: number;
    benefitsPerBoard: { description: string; requiredStamps: number; priority: number }[];
  }[];
  benefitSummary: { description: string; total: number; priority: number }[];
  leftoverAfter: number;
}

/**
 * 특정 혜택(guaranteeThreshold)을 1개 보장하고 나머지 관람을 우선순위 greedy로 배분.
 *
 * 예) leftoverViews=21, guaranteeThreshold=7(대본집)
 *   → 7회 도장판 1개 확정 후 남은 14회를
 *     5회(OST,p=1) 2개 + 3회(쿠폰,p=2) 1개 + 잔여 1회 로 배분
 */
export function planWithGuarantee(
  templateBoard: StampBoard,
  leftoverViews: number,
  guaranteeThreshold: number,
): GuaranteedPlanResult | null {
  if (leftoverViews < guaranteeThreshold) return null;

  const exclusiveBenefit = templateBoard.benefits.find(
    b => b.requiredStamps === guaranteeThreshold,
  );
  if (!exclusiveBenefit) return null;

  // 보장 도장판 1개의 혜택 목록
  const guaranteeBenefitsPerBoard = templateBoard.benefits
    .filter(b => b.requiredStamps <= guaranteeThreshold)
    .sort((a, b) => a.priority - b.priority)
    .map(b => ({ description: b.description, requiredStamps: b.requiredStamps, priority: b.priority }));

  const segments: GuaranteedPlanResult['segments'] = [
    { threshold: guaranteeThreshold, count: 1, benefitsPerBoard: guaranteeBenefitsPerBoard },
  ];

  // 나머지 관람 수를 우선순위 오름차순(낮은 숫자 = 높은 우선) greedy 배분
  const sortedThresholds = [
    ...new Set(
      [...templateBoard.benefits]
        .sort((a, b) => a.priority - b.priority)
        .map(b => b.requiredStamps),
    ),
  ];

  let remaining = leftoverViews - guaranteeThreshold;
  for (const threshold of sortedThresholds) {
    if (remaining <= 0) break;
    const count = Math.floor(remaining / threshold);
    if (count === 0) continue;

    const bpb = templateBoard.benefits
      .filter(b => b.requiredStamps <= threshold)
      .sort((a, b) => a.priority - b.priority)
      .map(b => ({ description: b.description, requiredStamps: b.requiredStamps, priority: b.priority }));

    const existingIdx = segments.findIndex(s => s.threshold === threshold);
    if (existingIdx >= 0) {
      segments[existingIdx].count += count;
    } else {
      segments.push({ threshold, count, benefitsPerBoard: bpb });
    }
    remaining %= threshold;
  }

  // 혜택별 합산
  const benefitMap = new Map<string, { description: string; total: number; priority: number }>();
  for (const seg of segments) {
    for (const b of seg.benefitsPerBoard) {
      const existing = benefitMap.get(b.description);
      if (existing) {
        existing.total += seg.count;
      } else {
        benefitMap.set(b.description, {
          description: b.description,
          total: seg.count,
          priority: b.priority,
        });
      }
    }
  }

  return {
    guaranteeThreshold,
    guaranteeBenefitName: exclusiveBenefit.description,
    segments: segments.sort((segA, segB) => {
      const pa = templateBoard.benefits.find(ben => ben.requiredStamps === segA.threshold)?.priority ?? 99;
      const pb = templateBoard.benefits.find(ben => ben.requiredStamps === segB.threshold)?.priority ?? 99;
      return pa - pb || segB.threshold - segA.threshold;
    }),
    benefitSummary: [...benefitMap.values()].sort((a, b) => a.priority - b.priority),
    leftoverAfter: remaining,
  };
}

// ─── 신규 도장판 배분 시뮬레이터 ───────────────────────────────────────────────

export interface NewBoardItem {
  index: number;
  stamps: number;   // 이 도장판에 찍히는 도장 수
  benefits: { description: string; requiredStamps: number }[];
}

export interface NewBoardSimulation {
  boards: NewBoardItem[];
  benefitSummary: { description: string; total: number }[];
}

/**
 * 신규 도장판 배분 시뮬레이터 (순수 함수)
 *
 * @param allBenefits false(기본): 우선순위 높은 혜택을 최대 수량으로 greedy 배분
 *                   true: 모든 혜택을 최소 1개씩 확보 후 나머지를 greedy 배분
 *
 * 혜택은 누적형이므로 7회 도장판에는 3회·5회·7회 혜택이 모두 발생함.
 */
export function simulateNewBoards(
  templateBoard: StampBoard,
  views: number,
  allBenefits: boolean,
): NewBoardSimulation {
  if (views <= 0 || templateBoard.benefits.length === 0) {
    return { boards: [], benefitSummary: [] };
  }

  // 우선순위 오름차순(낮은 숫자 = 높은 우선순위)으로 혜택 정렬
  const sortedBenefits = [...templateBoard.benefits].sort(
    (a, b) => a.priority - b.priority || a.requiredStamps - b.requiredStamps,
  );

  // 우선순위 순서를 유지하면서 중복 없는 threshold 목록
  const thresholdsByPriority = [
    ...new Map(sortedBenefits.map(b => [b.requiredStamps, b])).values(),
  ].map(b => b.requiredStamps);

  const maxThreshold = Math.max(...templateBoard.benefits.map(b => b.requiredStamps));

  // threshold에서 발생하는 누적 혜택 (해당 threshold 이하 전체)
  function benefitsAt(threshold: number) {
    return sortedBenefits
      .filter(b => b.requiredStamps <= threshold)
      .map(b => ({ description: b.description, requiredStamps: b.requiredStamps }));
  }

  const items: NewBoardItem[] = [];
  let remaining = views;
  let idx = 1;

  // ── Toggle ON: 최대 threshold 1개 먼저 확보 (모든 혜택 최소 1개 보장) ──
  if (allBenefits && remaining >= maxThreshold) {
    items.push({ index: idx++, stamps: maxThreshold, benefits: benefitsAt(maxThreshold) });
    remaining -= maxThreshold;
  }

  // ── Greedy: 우선순위 순으로 남은 횟수 배분 ──
  for (const threshold of thresholdsByPriority) {
    if (remaining <= 0) break;
    const count = Math.floor(remaining / threshold);
    if (count > 0) {
      const benfits = benefitsAt(threshold);
      for (let i = 0; i < count; i++) {
        items.push({ index: idx++, stamps: threshold, benefits: benfits });
      }
      remaining %= threshold;
    }
  }

  // ── 잔여: 혜택 미달성 부분 도장판 ──
  if (remaining > 0) {
    items.push({ index: idx++, stamps: remaining, benefits: [] });
  }

  // 혜택별 합산 (우선순위 순)
  const countMap = new Map<string, number>();
  for (const item of items) {
    for (const b of item.benefits) {
      countMap.set(b.description, (countMap.get(b.description) ?? 0) + 1);
    }
  }
  const benefitSummary = sortedBenefits
    .filter((b, i, arr) => arr.findIndex(x => x.description === b.description) === i)
    .filter(b => countMap.has(b.description))
    .map(b => ({ description: b.description, total: countMap.get(b.description)! }));

  return { boards: items, benefitSummary };
}
