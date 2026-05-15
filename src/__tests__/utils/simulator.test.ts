import { describe, test, expect } from 'vitest';
import { runSimulator } from '../../utils/simulator';
import type { StampBoard, Stamp, Benefit } from '../../types';

function makeStamp(overrides: Partial<Stamp> = {}): Stamp {
  return {
    id: Math.random().toString(36).slice(2),
    scheduleId: null,
    isInitial: false,
    isConfirmed: true,
    earnedAt: '',
    ...overrides,
  };
}

function makeBenefit(requiredStamps: number, isAchieved = false): Benefit {
  return {
    id: `b-${requiredStamps}`,
    requiredStamps,
    description: `${requiredStamps}개 혜택`,
    priority: 1,
    isAchieved,
    isUsed: false,
  };
}

function makeBoard(id: string, capacity: number, stampCount: number, benefits: Benefit[] = [], sortOrder = 1): StampBoard {
  const stamps: Stamp[] = Array(stampCount).fill(null).map(() => makeStamp());
  return {
    id,
    showId: 'show1',
    name: `${id}판`,
    capacity,
    initialStamps: 0,
    stamps,
    benefits,
    isActive: true,
    isCompleted: stampCount >= capacity,
    sortOrder,
    createdAt: '',
  };
}

describe('runSimulator', () => {
  test('원본 데이터 변경 없음', () => {
    const boards = [makeBoard('b1', 10, 0, [makeBenefit(5)])];
    runSimulator(boards, 10);
    expect(boards[0].stamps.length).toBe(0);
    expect(boards[0].benefits[0].isAchieved).toBe(false);
  });

  test('5회 관람 시 5개 도장 혜택 1개 달성', () => {
    const board = makeBoard('b1', 10, 0, [makeBenefit(5)]);
    const result = runSimulator([board], 5);
    expect(result.totalBenefits).toBe(1);
    expect(result.boardResults[0].achievedBenefits).toHaveLength(1);
    expect(result.boardResults[0].stampsAdded).toBe(5);
  });

  test('관람 횟수가 많을수록 달성 혜택 수 증가', () => {
    const boards = [makeBoard('b1', 20, 0, [makeBenefit(5), makeBenefit(10), makeBenefit(15)])];
    const r5 = runSimulator(boards, 5);
    const r15 = runSimulator(boards, 15);
    expect(r15.totalBenefits).toBeGreaterThanOrEqual(r5.totalBenefits);
  });

  test('완성된 판 건너뜀', () => {
    const board = makeBoard('b1', 5, 5);
    const result = runSimulator([board], 5);
    expect(result.totalBenefits).toBe(0);
    // 완성된 판은 boardResults에서 제외됨
    expect(result.boardResults).toHaveLength(0);
  });

  test('활성 판 없으면 혜택 0개', () => {
    const result = runSimulator([], 5);
    expect(result.totalBenefits).toBe(0);
    expect(result.boardResults).toHaveLength(0);
  });

  test('혜택까지 가장 가까운 판 우선 배분', () => {
    // b1: 4개 도장 있음 → 혜택까지 1개 남음
    // b2: 0개 도장 있음 → 혜택까지 5개 남음
    const b1 = makeBoard('b1', 10, 4, [makeBenefit(5)], 1);
    const b2 = makeBoard('b2', 10, 0, [makeBenefit(5)], 2);
    const result = runSimulator([b1, b2], 1);
    const r1 = result.boardResults.find(r => r.boardId === 'b1');
    const r2 = result.boardResults.find(r => r.boardId === 'b2');
    expect(r1?.stampsAdded).toBe(1);
    expect(r2?.stampsAdded).toBe(0);
  });

  test('동률 시 sortOrder 낮은 판 우선', () => {
    const b1 = makeBoard('b1', 10, 0, [makeBenefit(5)], 2);
    const b2 = makeBoard('b2', 10, 0, [makeBenefit(5)], 1);
    const result = runSimulator([b1, b2], 1);
    const r2 = result.boardResults.find(r => r.boardId === 'b2');
    expect(r2?.stampsAdded).toBe(1);
  });

  test('결과 boardResults는 sortOrder 기준 정렬', () => {
    const b1 = makeBoard('b1', 10, 0, [makeBenefit(5)], 2);
    const b2 = makeBoard('b2', 10, 0, [makeBenefit(5)], 1);
    const result = runSimulator([b1, b2], 2);
    expect(result.boardResults[0].boardId).toBe('b2');
    expect(result.boardResults[1].boardId).toBe('b1');
  });
});
