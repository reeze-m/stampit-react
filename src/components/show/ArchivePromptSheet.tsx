import type { Show } from '../../types';

interface ArchivePromptSheetProps {
  show: Show | null;
  current: number;   // 1-based
  total: number;
  onArchive: (showId: string) => void;
  onDismiss: (showId: string) => void;
}

/** 종료 공연 아카이브 제안 바텀시트 */
export default function ArchivePromptSheet({
  show,
  current,
  total,
  onArchive,
  onDismiss,
}: ArchivePromptSheetProps) {
  if (!show) return null;

  return (
    /* 오버레이 */
    <div data-testid="archive-prompt-sheet" className="fixed inset-0 z-50 flex items-end">
      <div className="absolute inset-0 bg-black/40" />

      {/* 시트 */}
      <div className="relative w-full bg-white rounded-t-3xl overflow-hidden" style={{ animation: 'slideUp 0.25s ease-out' }}>

        {/* 진행 표시 (2개 이상일 때) */}
        {total > 1 && (
          <div className="absolute top-4 right-4 px-2.5 py-1 bg-gray-100 rounded-full">
            <span className="text-xs font-semibold text-gray-500">{current} / {total}</span>
          </div>
        )}

        {/* 공연 대표색 헤더 */}
        <div
          className="h-28 flex items-center justify-center"
          style={{ backgroundColor: show.color + '33' }}
        >
          {show.headerImageUrl ? (
            <img
              src={show.headerImageUrl}
              alt={show.name}
              className="h-full w-full object-cover opacity-60"
            />
          ) : (
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl font-bold text-white"
              style={{ backgroundColor: show.color }}
            >
              {show.name.charAt(0)}
            </div>
          )}
        </div>

        {/* 내용 */}
        <div className="px-6 pt-5 pb-8">
          <p className="text-lg font-bold text-gray-900 mb-1">
            🎭 {show.name} 공연이 종료됐어요
          </p>
          <p className="text-sm text-gray-500 mb-6">
            보관하면 관람 리포트를 확인할 수 있어요 ✨
          </p>

          <div className="flex gap-3">
            <button
              data-testid="btn-archive-dismiss"
              onClick={() => onDismiss(show.id)}
              className="py-3 px-5 rounded-2xl bg-gray-100 text-gray-600 text-sm font-medium active:bg-gray-200 shrink-0"
            >
              나중에
            </button>
            <button
              data-testid="btn-archive-confirm"
              onClick={() => onArchive(show.id)}
              className="flex-1 py-3 rounded-2xl bg-indigo-600 text-white text-sm font-semibold active:bg-indigo-800"
            >
              보관하고 리포트 보기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
