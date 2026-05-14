import type { Stamp, Benefit } from '../../types';

export const DEFAULT_STAMP_COLOR = '#0d9488';

interface StampGridProps {
  capacity: number;
  stamps: Stamp[];
  benefits: Benefit[];
  previewInitial?: number; // 미리보기용: 초기 도장 수
  stampColor?: string;     // 도장 색상 (hex)
}

/** 도장판 그리드 컴포넌트 */
export default function StampGrid({ capacity, stamps, benefits, previewInitial, stampColor = DEFAULT_STAMP_COLOR }: StampGridProps) {
  const cols = Math.min(7, capacity);
  const benefitPositions = new Set(benefits.map(b => b.requiredStamps));

  // 미리보기 모드: stamps 배열 대신 previewInitial 사용
  const filledCount = previewInitial !== undefined ? previewInitial : stamps.length;
  const initialCount = previewInitial !== undefined
    ? previewInitial
    : stamps.filter(s => s.isInitial).length;

  return (
    <div
      className="grid gap-1"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      data-testid="stamp-grid"
    >
      {Array.from({ length: capacity }).map((_, idx) => {
        const slotNum = idx + 1;
        const isFilled = slotNum <= filledCount;
        const isInitialSlot = slotNum <= initialCount;
        const hasBenefit = benefitPositions.has(slotNum);

        return (
          <div key={idx} className="relative aspect-square" data-testid={`stamp-slot-${idx}`}>
            {isFilled ? (
              /* 찍힌 도장: 원형 */
              <div
                className="w-full h-full rounded-full"
                style={{
                  backgroundColor: stampColor,
                  opacity: isInitialSlot ? 0.4 : 1,
                  boxShadow: isInitialSlot ? 'none' : '0 1px 4px rgba(0,0,0,0.18)',
                }}
              />
            ) : (
              /* 빈 슬롯: 점선 원형 */
              <div className="w-full h-full rounded-full border-2 border-dashed border-gray-200 bg-white/60" />
            )}

            {/* 혜택 위치 마커: 작은 금별 */}
            {hasBenefit && (
              <span
                className="absolute -top-1 -right-1 text-yellow-400 text-xs leading-none drop-shadow-sm"
                data-testid={`benefit-marker-${slotNum}`}
              >
                ★
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
