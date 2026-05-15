import { useRef, useState } from 'react';
import type { Show } from '../../types';
import { formatPrice } from '../../utils/reportUtils';
import { saveReportAsImage } from '../../utils/reportImageUtils';

interface ShowReportSheetProps {
  isOpen: boolean;
  onClose: () => void;
  show: Show;
}

export default function ShowReportSheet({ isOpen, onClose, show }: ShowReportSheetProps) {
  const report = show.report;
  const captureRef = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);

  if (!isOpen || !report) return null;

  const period =
    report.firstVisitDate && report.lastVisitDate
      ? `${report.firstVisitDate.replaceAll('-', '.')} — ${report.lastVisitDate.replaceAll('-', '.')}`
      : null;

  const maxCastCount = report.topCasts[0]?.count ?? 1;

  async function handleSaveImage() {
    if (!captureRef.current || saving) return;
    setSaving(true);
    try {
      await saveReportAsImage(captureRef, show.name);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      {/* 딤 */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* 시트 */}
      <div
        className="relative w-full flex flex-col"
        style={{
          background: '#FFFFFF',
          borderRadius: '24px 24px 0 0',
          maxHeight: '92vh',
        }}
      >
        {/* 핸들 */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-9 h-1 rounded-full" style={{ background: '#E5E7EB' }} />
        </div>

        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-3 shrink-0">
          <h2
            className="font-semibold truncate"
            style={{ fontSize: '17px', color: '#111827' }}
          >
            {show.name}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center shrink-0"
            style={{ color: '#9CA3AF' }}
          >
            ✕
          </button>
        </div>

        {/* 스크롤 영역 */}
        <div className="flex-1 overflow-y-auto">

          {/* 캡처 대상 영역 */}
          <div ref={captureRef} style={{ background: '#FFFFFF' }}>

            {/* ── 공연 타이틀 ── */}
            <div
              className="px-5 py-5"
              style={{ background: `linear-gradient(160deg, ${show.color}22, ${show.color}08)` }}
            >
              <div className="flex items-start gap-3">
                <div
                  className="self-stretch shrink-0"
                  style={{
                    width: '4px',
                    borderRadius: '4px',
                    backgroundColor: show.color,
                  }}
                />
                <div>
                  <p
                    className="leading-tight"
                    style={{ fontSize: '22px', fontWeight: 800, color: '#111827' }}
                  >
                    {show.name}
                  </p>
                  {period && (
                    <p className="mt-1" style={{ fontSize: '14px', color: '#6B7280' }}>
                      {period}
                    </p>
                  )}
                  {show.venue && (
                    <p className="mt-0.5" style={{ fontSize: '14px', color: '#9CA3AF' }}>
                      {show.venue}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="px-5 space-y-0">

              {/* ── 핵심 수치 2×2 ── */}
              <div className="py-5 border-b" style={{ borderColor: '#F3F4F6' }}>
                {/* gap:1px 구현 — 바깥 배경을 #F3F4F6으로, 셀은 #FFF */}
                <div
                  className="grid grid-cols-2 overflow-hidden"
                  style={{ gap: '1px', background: '#F3F4F6', borderRadius: '16px' }}
                >
                  {[
                    {
                      label: '총 관람',
                      value: `${report.totalVisits}회`,
                      color: '#111827',
                    },
                    {
                      label: '총 지출',
                      value: report.totalSpent > 0 ? `${formatPrice(report.totalSpent)}원` : '-',
                      color: '#111827',
                    },
                    {
                      label: '절약 금액',
                      value: report.totalSaved > 0 ? `${formatPrice(report.totalSaved)}원` : '-',
                      color: '#10B981',
                    },
                    {
                      label: '도장판',
                      value: `${report.completedBoards}판 완성`,
                      color: '#4F46E5',
                    },
                  ].map((cell, idx) => (
                    <div
                      key={cell.label}
                      style={{
                        background: '#FFFFFF',
                        padding: '16px',
                        borderRadius:
                          idx === 0 ? '15px 0 0 0'
                          : idx === 1 ? '0 15px 0 0'
                          : idx === 2 ? '0 0 0 15px'
                          : '0 0 15px 0',
                      }}
                    >
                      <p style={{ fontSize: '12px', color: '#9CA3AF', marginBottom: '6px' }}>
                        {cell.label}
                      </p>
                      <p
                        className="leading-tight"
                        style={{ fontSize: '26px', fontWeight: 700, color: cell.color }}
                      >
                        {cell.value}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── 혜택 달성 ── */}
              {report.achievedBenefits.length > 0 && (
                <div className="py-5 border-b" style={{ borderColor: '#F3F4F6' }}>
                  <p
                    className="mb-3"
                    style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}
                  >
                    혜택 달성
                  </p>
                  <div className="space-y-2.5">
                    {report.achievedBenefits.map((b, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span style={{ color: '#F59E0B', fontSize: '14px' }}>★</span>
                          <span style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>
                            {b.description}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span style={{ fontSize: '14px', fontWeight: 700, color: '#4F46E5' }}>
                            ×{b.count}
                          </span>
                          {b.usedCount > 0 && (
                            <span style={{ fontSize: '12px', color: '#9CA3AF' }}>
                              ({b.usedCount}개 사용)
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── 함께한 캐스트 ── */}
              {report.topCasts.length > 0 && (
                <div className="py-5 border-b" style={{ borderColor: '#F3F4F6' }}>
                  <p
                    className="mb-3"
                    style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}
                  >
                    함께한 캐스트
                  </p>
                  <div className="space-y-2.5">
                    {report.topCasts.map((c, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <span
                          className="shrink-0 truncate"
                          style={{ fontSize: '13px', color: '#374151', width: '56px' }}
                        >
                          {c.name}
                        </span>
                        <div
                          className="flex-1 overflow-hidden"
                          style={{ background: '#EEF2FF', borderRadius: '4px', height: '8px' }}
                        >
                          <div
                            style={{
                              width: `${Math.round((c.count / maxCastCount) * 100)}%`,
                              height: '100%',
                              background: '#4F46E5',
                              borderRadius: '4px',
                              transition: 'width 0.3s',
                            }}
                          />
                        </div>
                        <span
                          className="shrink-0 text-right"
                          style={{ fontSize: '12px', fontWeight: 600, color: '#9CA3AF', width: '28px' }}
                        >
                          {c.count}회
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── 특별한 순간 ── */}
              {report.specialEventSummary.length > 0 && (
                <div className="py-5">
                  <p
                    className="mb-3"
                    style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}
                  >
                    특별한 순간
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {report.specialEventSummary.map((ev, i) => (
                      <span
                        key={i}
                        style={{
                          background: '#FFFBEB',
                          color: '#92400E',
                          borderRadius: '9999px',
                          fontSize: '11px',
                          fontWeight: 500,
                          padding: '5px 12px',
                        }}
                      >
                        {ev.name} {ev.count}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* 워터마크 */}
              <p
                className="text-center pb-4"
                style={{ fontSize: '10px', color: '#D1D5DB' }}
              >
                stampit
              </p>
            </div>
          </div>
        </div>

        {/* ── 하단 버튼 ── */}
        <div
          className="flex gap-3 px-5 shrink-0"
          style={{
            paddingTop: '12px',
            paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)',
            borderTop: '1px solid #F3F4F6',
          }}
        >
          <button
            onClick={handleSaveImage}
            disabled={saving}
            className="flex-1 flex items-center justify-center font-semibold disabled:opacity-50"
            style={{
              background: '#4F46E5',
              color: '#FFFFFF',
              height: '52px',
              borderRadius: '14px',
              fontSize: '15px',
            }}
          >
            {saving ? '저장 중…' : '📷 이미지로 저장'}
          </button>
          <button
            onClick={onClose}
            className="flex items-center justify-center font-semibold"
            style={{
              background: '#F3F4F6',
              color: '#374151',
              height: '52px',
              borderRadius: '14px',
              fontSize: '15px',
              padding: '0 24px',
            }}
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
