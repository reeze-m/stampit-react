/**
 * BoardShareSheet.tsx
 * 도장판 공유 미리보기 바텀시트
 *
 * 위치: src/components/status/BoardShareSheet.tsx
 */

import { useRef, useState } from 'react';
import type { StampBoard } from '../../types';
import BoardShareCard from './BoardShareCard';
import { shareOrSaveBoardImage } from '../../utils/reportImageUtils';

interface BoardShareSheetProps {
  isOpen: boolean;
  onClose: () => void;
  board: StampBoard;
  showName: string;
  showColor: string;
  today: string;
}

export default function BoardShareSheet({
  isOpen,
  onClose,
  board,
  showName,
  showColor,
  today,
}: BoardShareSheetProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  async function handleShare() {
    if (!cardRef.current) return;
    setLoading(true);
    try {
      await shareOrSaveBoardImage(cardRef, `${showName}-${board.name}`);
    } catch {
      setToast('이미지 생성에 실패했어요');
      setTimeout(() => setToast(null), 2500);
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) return null;

  return (
    <>
      {/* 딤 */}
      <div className="fixed inset-0 bg-black/50 z-50" onClick={onClose} />

      {/* 시트 */}
      <div data-testid="board-share-sheet" className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-[24px] pb-safe">

        {/* 핸들 */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-9 h-1 rounded-full bg-gray-200" />
        </div>

        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <h2 className="text-[16px] font-semibold text-gray-900">도장판 공유</h2>
          <button
            data-testid="btn-share-close"
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* 카드 미리보기 */}
        <div className="flex justify-center py-6 px-5 overflow-x-auto">
          {/* 실제 캡처 대상 — 화면 밖에 렌더 (opacity 0) */}
          <div
            style={{
              position: 'fixed',
              left: -9999,
              top: 0,
              pointerEvents: 'none',
            }}
          >
            <BoardShareCard
              ref={cardRef}
              board={board}
              showName={showName}
              showColor={showColor}
              today={today}
              noTestIds
            />
          </div>

          {/* 화면용 미리보기 (동일 컴포넌트, 실제 캡처 안 됨) */}
          <div
            data-testid="board-share-card-preview"
            style={{
              transform: 'scale(0.9)',
              transformOrigin: 'top center',
              boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
              borderRadius: 20,
              overflow: 'hidden',
            }}
          >
            <BoardShareCard
              board={board}
              showName={showName}
              showColor={showColor}
              today={today}
            />
          </div>
        </div>

        {/* 버튼 */}
        <div className="px-5 pb-6 space-y-2">
          <button
            data-testid="btn-share-image"
            onClick={handleShare}
            disabled={loading}
            className="w-full h-[54px] rounded-2xl bg-indigo-600 text-white text-[16px] font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"/>
                  <path d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" fill="currentColor" className="opacity-75"/>
                </svg>
                저장 중...
              </>
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1M8 12l4 4 4-4M12 3v13"
                    stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                이미지로 저장 / 공유하기
              </>
            )}
          </button>
          <button
            onClick={onClose}
            className="w-full h-[48px] rounded-2xl bg-gray-100 text-gray-600 text-[15px] font-medium"
          >
            닫기
          </button>
        </div>
      </div>

      {/* 에러 토스트 */}
      {toast && (
        <div data-testid="share-error-toast" className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[60] bg-gray-900 text-white text-sm px-4 py-2.5 rounded-full shadow-lg">
          {toast}
        </div>
      )}
    </>
  );
}
