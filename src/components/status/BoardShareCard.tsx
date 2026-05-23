/**
 * BoardShareCard.tsx
 * 도장판 공유용 카드 컴포넌트
 * html2canvas로 캡처해서 이미지로 저장/공유
 *
 * 위치: src/components/status/BoardShareCard.tsx
 */

import { forwardRef } from 'react';
import type { StampBoard, Benefit } from '../../types';
import { DEFAULT_STAMP_COLOR } from '../common/StampGrid';

interface BoardShareCardProps {
  board: StampBoard;
  showName: string;
  showColor: string;
  today: string; // YYYY-MM-DD
  noTestIds?: boolean; // 오프스크린 캡처용 카드에서 data-testid 생략
}

/** 예비 도장 구분 */
function isPreviewStamp(earnedAt: string, today: string): boolean {
  return earnedAt.slice(0, 10) > today;
}

const BoardShareCard = forwardRef<HTMLDivElement, BoardShareCardProps>(
  ({ board, showName, showColor, today, noTestIds }, ref) => {
    const stampColor = board.stampColor ?? DEFAULT_STAMP_COLOR;
    const realCount  = board.stamps.filter(s => s.isConfirmed && !isPreviewStamp(s.earnedAt, today)).length;
    const prevCount  = board.stamps.filter(s => s.isConfirmed && isPreviewStamp(s.earnedAt, today)).length;
    const total      = board.capacity;
    const cols       = Math.min(7, total);

    // 다음 미달성 혜택
    const nextBenefit: Benefit | undefined = board.benefits
      .filter(b => !b.isAchieved)
      .sort((a, b) => a.requiredStamps - b.requiredStamps)[0];
    const remaining = nextBenefit ? nextBenefit.requiredStamps - realCount : null;

    // 달성된 혜택 목록
    const achieved = board.benefits.filter(b => b.isAchieved);

    return (
      <div
        ref={ref}
        style={{
          width: 320,
          background: '#ffffff',
          borderRadius: 20,
          overflow: 'hidden',
          fontFamily: "'Noto Sans KR', -apple-system, sans-serif",
          boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
        }}
      >
        {/* 상단 헤더 — 공연 색상 */}
        <div
          {...(!noTestIds && { 'data-testid': 'share-card-header' })}
          style={{
            background: showColor,
            padding: '16px 20px 14px',
          }}
        >
          <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: 500, marginBottom: 2 }}>
            {showName}
          </p>
          <p style={{ color: '#ffffff', fontSize: 18, fontWeight: 800, lineHeight: 1.2 }}>
            {board.name}
          </p>
          <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 4, fontWeight: 500 }}>
            {realCount} / {total}개
            {prevCount > 0 && (
              <span {...(!noTestIds && { 'data-testid': 'share-preview-count' })} style={{ opacity: 0.7 }}> · 예비 {prevCount}개</span>
            )}
          </p>
        </div>

        {/* 도장 그리드 */}
        <div style={{ padding: '16px 20px 12px', background: '#fafafa' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${cols}, 1fr)`,
              gap: 6,
            }}
          >
            {Array.from({ length: total }).map((_, idx) => {
              const slotNum   = idx + 1;
              const stamp     = board.stamps[idx];
              const isFilled  = slotNum <= board.stamps.length;
              const isPreview = stamp && isPreviewStamp(stamp.earnedAt, today);
              const isInitial = stamp?.isInitial;
              const hasBenefit = board.benefits.some(b => b.requiredStamps === slotNum);

              return (
                <div
                  key={idx}
                  style={{ position: 'relative', aspectRatio: '1', width: '100%' }}
                >
                  {isFilled ? (
                    <div
                      style={{
                        width: '100%',
                        height: '100%',
                        borderRadius: '50%',
                        backgroundColor: stampColor,
                        opacity: isInitial ? 0.4 : isPreview ? 0.3 : 1,
                        boxShadow: (!isInitial && !isPreview) ? '0 1px 3px rgba(0,0,0,0.2)' : 'none',
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: '100%',
                        height: '100%',
                        borderRadius: '50%',
                        border: '2px dashed #E5E7EB',
                        backgroundColor: '#ffffff',
                      }}
                    />
                  )}
                  {hasBenefit && (
                    <span
                      style={{
                        position: 'absolute',
                        top: -2,
                        right: -2,
                        fontSize: 9,
                        lineHeight: 1,
                        color: '#FBBF24',
                      }}
                    >
                      ★
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* 혜택 안내 */}
        <div style={{ padding: '0 20px 16px', background: '#fafafa' }}>
          {remaining !== null && remaining > 0 && nextBenefit && (
            <div
              {...(!noTestIds && { 'data-testid': 'share-next-benefit' })}
              style={{
                background: '#EEF2FF',
                borderRadius: 10,
                padding: '8px 12px',
                marginBottom: achieved.length > 0 ? 8 : 0,
              }}
            >
              <p style={{ fontSize: 12, color: '#4F46E5', fontWeight: 600 }}>
                ✨ {remaining}개 더 찍으면 {nextBenefit.description}
              </p>
            </div>
          )}

          {/* 달성된 혜택 */}
          {achieved.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {achieved.map(b => (
                <span
                  key={b.id}
                  style={{
                    fontSize: 11,
                    background: b.isUsed ? '#F3F4F6' : '#FFFBEB',
                    color:      b.isUsed ? '#9CA3AF' : '#92400E',
                    padding:    '3px 8px',
                    borderRadius: 99,
                    fontWeight: 500,
                    textDecoration: b.isUsed ? 'line-through' : 'none',
                  }}
                >
                  ★ {b.description}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* 워터마크 */}
        <div
          {...(!noTestIds && { 'data-testid': 'share-watermark' })}
          style={{
            borderTop: '1px solid #F3F4F6',
            padding: '8px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            background: '#ffffff',
          }}
        >
          <p style={{ fontSize: 11, color: '#D1D5DB', fontWeight: 600, letterSpacing: 0.5 }}>
            ✦ stampit
          </p>
        </div>
      </div>
    );
  }
);

BoardShareCard.displayName = 'BoardShareCard';
export default BoardShareCard;
