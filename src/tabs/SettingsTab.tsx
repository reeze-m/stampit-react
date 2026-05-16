import React, { useState, useRef } from 'react';
import { colors } from '../constants/tokens';
import type { Show } from '../types';
import { useShowStore } from '../store/showStore';
import { useSettingsStore } from '../store/settingsStore';

import SeatGradeSheet from '../components/show/SeatGradeSheet';
import DiscountTypeSheet from '../components/show/DiscountTypeSheet';
import StorageBanner from '../components/settings/StorageBanner';
import PwaInstallGuide from '../components/settings/PwaInstallGuide';
import SpecialEventSheet from '../components/settings/SpecialEventSheet';
import ConfirmDialog from '../components/common/ConfirmDialog';
import SectionHeader from '../components/common/SectionHeader';
import Toast from '../components/common/Toast';
import ShowReportSheet from '../components/archive/ShowReportSheet';

interface SettingsTabProps {
  show: Show;
  onOpenTabOrder?: () => void;
}

const DEFAULT_EVENT = { name: '', startDate: '', endDate: '', multiplier: 2 };

function ChevronRight() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={colors.gray[300]} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18l6-6-6-6"/>
    </svg>
  );
}


/** V-10: 설정 탭 */
export default function SettingsTab({ show, onOpenTabOrder }: SettingsTabProps) {
  const {
    shows,
    schedules,
    addSeatGrade, updateSeatGrade, deleteSeatGrade,
    addDiscountType, updateDiscountType, deleteDiscountType,
    softDeleteDiscountType,
    addStampEvent, updateStampEvent, deleteStampEvent,
    restoreBoard, deleteStampBoard,
    exportData, importData, resetAllData,
  } = useShowStore();

  const showSchedules = schedules.filter(s => s.showId === show.id);
  const { settings, setShowRealCost } = useSettingsStore();

  const [gradeSheetOpen, setGradeSheetOpen] = useState(false);
  const [deleteHiddenBoardId, setDeleteHiddenBoardId] = useState<string | null>(null);
  const [discountSheetOpen, setDiscountSheetOpen] = useState(false);
  const [expandedDiscountId, setExpandedDiscountId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [specialEventSheetOpen, setSpecialEventSheetOpen] = useState(false);
  const [reportShow, setReportShow] = useState<typeof shows[0] | null>(null);
  const archivedShows = shows.filter(s => s.isArchived && !s.isCancelled);
  const [resetStep, setResetStep] = useState(0);
  const [resetInput, setResetInput] = useState('');
  const [eventFormOpen, setEventFormOpen] = useState(false);
  const [eventForm, setEventForm] = useState(DEFAULT_EVENT);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [importToast, setImportToast] = useState<{ ok: boolean } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeDiscountTypes = show.discountTypes.filter(d => !d.isDeleted);
  const activeSpecialEvents = (show.specialEvents ?? []).filter(e => !e.isDeleted);

  function handleExport() {
    const data = exportData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stampit-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const text = ev.target?.result as string;
      const ok = importData(text);
      setImportToast({ ok });
      setTimeout(() => setImportToast(null), 3000);
    };
    reader.readAsText(file);
    e.target.value = ''; // 동일 파일 재선택 수 있도록
  }

  function handleReset() {
    if (resetInput === '초기화') {
      resetAllData();
      setResetStep(0);
      setResetInput('');
    }
  }

  function openAddEvent() {
    setEditingEventId(null);
    setEventForm({ ...DEFAULT_EVENT, startDate: new Date().toISOString().slice(0, 10) });
    setEventFormOpen(true);
  }

  function openEditEvent(eventId: string) {
    const event = show.events.find(e => e.id === eventId);
    if (!event) return;
    setEditingEventId(eventId);
    setEventForm({
      name: event.name,
      startDate: event.startDate,
      endDate: event.endDate ?? '',
      multiplier: event.multiplier,
    });
    setEventFormOpen(true);
  }

  function handleEventSave() {
    if (!eventForm.name.trim() || !eventForm.startDate) return;
    const data = {
      name: eventForm.name.trim(),
      startDate: eventForm.startDate,
      endDate: eventForm.endDate || undefined,
      multiplier: eventForm.multiplier,
    };
    if (editingEventId) {
      updateStampEvent(show.id, editingEventId, data);
    } else {
      addStampEvent(show.id, data);
    }
    setEventFormOpen(false);
    setEditingEventId(null);
    setEventForm(DEFAULT_EVENT);
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto pb-4" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 80px)' }}>
        <StorageBanner />

        {/* ── 공연 설정 ─────────────────────────────── */}
        <div data-testid="settings-section-show">
        <SectionHeader title="공연 설정" />
        <div className="bg-white rounded-2xl overflow-hidden mx-4 shadow-sm">

          {/* 좌석 등급 */}
          <button
            data-testid="tab-seat-grades"
            onClick={() => setGradeSheetOpen(true)}
            className="h-[52px] w-full px-4 flex items-center border-b border-gray-100 active:bg-gray-50"
          >
            <span className="text-[20px] leading-none">🎫</span>
            <span className="text-[15px] font-medium text-gray-900 ml-[10px] flex-1 text-left">좌석 등급</span>
            <span className="text-[14px] text-gray-400 mr-1">{show.seatGrades.length}개</span>
            <ChevronRight />
          </button>

          {/* 할인 종류 */}
          <div data-testid="tab-discount-types">
            <div className="min-h-[52px] px-4 flex items-center border-b border-gray-100">
              <span className="text-[20px] leading-none">🏷️</span>
              <span className="text-[15px] font-medium text-gray-900 ml-[10px] flex-1">할인 종류</span>
              <span className="text-[14px] text-gray-400 mr-2">{activeDiscountTypes.length}개</span>
              <button
                data-testid="btn-add-discount"
                onClick={() => setDiscountSheetOpen(true)}
                className="h-7 px-3 bg-indigo-50 text-indigo-600 rounded-full text-[12px] font-semibold active:bg-indigo-200"
              >
                관리
              </button>
            </div>
            {activeDiscountTypes.length > 0 && (
              <div className="px-3 py-2 border-b border-gray-100 space-y-1 bg-gray-50">
                {activeDiscountTypes.map(d => (
                  <div key={d.id}>
                    <button
                      data-testid={`discount-item-${d.id}`}
                      className="flex items-center justify-between w-full px-3 py-2 bg-white rounded-xl text-sm text-gray-700 active:bg-gray-50"
                      onClick={() => setExpandedDiscountId(expandedDiscountId === d.id ? null : d.id)}
                    >
                      <span>{d.name}</span>
                      <span className="text-gray-400 text-xs">{expandedDiscountId === d.id ? '▲' : '▼'}</span>
                    </button>
                    {expandedDiscountId === d.id && (
                      <div className="flex gap-2 mt-1 pl-2">
                        {deleteConfirmId === d.id ? (
                          <>
                            <button
                              data-testid="btn-delete-confirm"
                              onClick={() => { softDeleteDiscountType(show.id, d.id); setDeleteConfirmId(null); setExpandedDiscountId(null); }}
                              className="flex-1 py-1.5 bg-red-600 text-white rounded-lg text-xs font-semibold min-h-[36px]"
                            >
                              삭제 확인
                            </button>
                            <button
                              onClick={() => setDeleteConfirmId(null)}
                              className="flex-1 py-1.5 bg-gray-200 text-gray-700 rounded-lg text-xs min-h-[36px]"
                            >
                              취소
                            </button>
                          </>
                        ) : (
                          <button
                            data-testid="swipe-delete"
                            onClick={() => setDeleteConfirmId(d.id)}
                            className="flex-1 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-medium min-h-[36px]"
                          >
                            삭제
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 특별 이벤트 */}
          <button
            data-testid="tab-special-events"
            onClick={() => setSpecialEventSheetOpen(true)}
            className="h-[52px] w-full px-4 flex items-center border-b border-gray-100 active:bg-gray-50"
          >
            <span className="text-[20px] leading-none">✨</span>
            <span className="text-[15px] font-medium text-gray-900 ml-[10px] flex-1 text-left">특별 이벤트</span>
            <span className="text-[14px] text-gray-400 mr-1">{activeSpecialEvents.length}개</span>
            <ChevronRight />
          </button>

          {/* 배수 이벤트 */}
          <div data-testid="tab-stamp-events">
            <div className="min-h-[52px] px-4 flex items-center">
              <span className="text-[20px] leading-none">⚡</span>
              <span className="text-[15px] font-medium text-gray-900 ml-[10px] flex-1">배수 이벤트</span>
              <span className="text-[14px] text-gray-400">{show.events.length}개</span>
            </div>

            {show.events.length > 0 && (
              <div className="px-3 pb-2 bg-gray-50 border-t border-gray-100 pt-2 space-y-2">
                {show.events.map(event => (
                  <div
                    key={event.id}
                    data-testid={`event-item-${event.id}`}
                    className="flex items-center justify-between p-2.5 bg-white rounded-xl"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-700">{event.name}</p>
                        {!event.endDate && (
                          <span data-testid="badge-unlimited" className="text-xs bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full">무기한</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400">
                        {event.startDate}{event.endDate ? ` ~ ${event.endDate}` : ''} · x{event.multiplier}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => openEditEvent(event.id)}
                        className="p-2 text-indigo-400 active:text-indigo-600 text-sm"
                        aria-label="이벤트 수정"
                      >✏️</button>
                      <button
                        data-testid="btn-delete-event"
                        onClick={() => deleteStampEvent(show.id, event.id)}
                        className="p-2 text-red-400 active:text-red-600 text-sm"
                        aria-label="이벤트 삭제"
                      >✕</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {eventFormOpen ? (
              <div className="mx-3 mb-3 mt-1 p-3 bg-indigo-50 rounded-xl space-y-3">
                <p className="text-xs font-semibold text-indigo-700">{editingEventId ? '이벤트 수정' : '새 이벤트 추가'}</p>
                <input
                  value={eventForm.name}
                  onChange={e => setEventForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="예: 앙코르 공연 더블적립"
                  className="w-full px-3 py-2 text-sm border border-indigo-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                />
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">시작일 <span className="text-red-500">*</span></label>
                    <input type="date" value={eventForm.startDate} onChange={e => setEventForm(f => ({ ...f, startDate: e.target.value }))} className="w-full px-2 py-2 text-sm border border-indigo-200 rounded-lg focus:outline-none bg-white" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">종료일 (선택)</label>
                    <input type="date" value={eventForm.endDate} onChange={e => setEventForm(f => ({ ...f, endDate: e.target.value }))} className="w-full px-2 py-2 text-sm border border-indigo-200 rounded-lg focus:outline-none bg-white" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">배수</label>
                  <div className="flex gap-2">
                    {[2, 3, 4, 5].map(m => (
                      <button key={m} onClick={() => setEventForm(f => ({ ...f, multiplier: m }))} className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors ${eventForm.multiplier === m ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700 border border-indigo-200'}`}>
                        x{m}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={handleEventSave} disabled={!eventForm.name.trim() || !eventForm.startDate} className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50 min-h-[44px]">
                    {editingEventId ? '수정 완료' : '추가'}
                  </button>
                  <button onClick={() => { setEventFormOpen(false); setEditingEventId(null); }} className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm min-h-[44px]">
                    취소
                  </button>
                </div>
              </div>
            ) : (
              <div className="px-3 pb-3 pt-1">
                <button onClick={openAddEvent} className="w-full py-2 bg-gray-100 text-gray-500 rounded-xl text-sm font-medium min-h-[40px] active:bg-gray-200">
                  + 이벤트 추가
                </button>
              </div>
            )}
          </div>
        </div>

        </div>{/* /settings-section-show */}

        {/* ── 화면 ──────────────────────────────────── */}
        <SectionHeader title="화면" />
        <div className="bg-white rounded-2xl overflow-hidden mx-4 shadow-sm">
          <div className="h-[52px] px-4 flex items-center">
            <span className="text-[20px] leading-none">💰</span>
            <span className="text-[15px] font-medium text-gray-900 ml-[10px] flex-1">실제 비용 표시</span>
            <button
              data-testid="toggle-show-real-cost"
              role="switch"
              aria-checked={settings.showRealCost ? 'true' : 'false'}
              onClick={() => setShowRealCost(!settings.showRealCost)}
              className={`w-[44px] h-6 rounded-full transition-colors ${settings.showRealCost ? 'bg-indigo-600' : 'bg-gray-300'}`}
            >
              <div className={`w-5 h-5 bg-white rounded-full shadow m-0.5 transition-transform ${settings.showRealCost ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>
        </div>

        {/* ── 순서 ──────────────────────────────────── */}
        {onOpenTabOrder && (
          <div data-testid="tab-order-section">
            <SectionHeader title="순서" />
            <div className="bg-white rounded-2xl overflow-hidden mx-4 shadow-sm">
              <button
                data-testid="btn-tab-reorder"
                onClick={onOpenTabOrder}
                className="h-[52px] w-full px-4 flex items-center active:bg-gray-50"
              >
                <span className="text-[20px] leading-none">🔀</span>
                <span className="text-[15px] font-medium text-gray-900 ml-[10px] flex-1 text-left">공연 탭 순서</span>
                <ChevronRight />
              </button>
            </div>
          </div>
        )}

        {/* ── 데이터 ────────────────────────────────── */}
        <SectionHeader title="데이터" />
        <div className="bg-white rounded-2xl overflow-hidden mx-4 shadow-sm">
          <button
            data-testid="btn-export-json"
            onClick={handleExport}
            className="h-[52px] w-full px-4 flex items-center border-b border-gray-100 active:bg-gray-50"
          >
            <span className="text-[20px] leading-none">📤</span>
            <span className="text-[15px] font-medium text-gray-900 ml-[10px] flex-1 text-left">JSON으로 내보내기</span>
            <ChevronRight />
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="h-[52px] w-full px-4 flex items-center active:bg-gray-50"
          >
            <span className="text-[20px] leading-none">📥</span>
            <span className="text-[15px] font-medium text-gray-900 ml-[10px] flex-1 text-left">JSON에서 가져오기</span>
            <ChevronRight />
          </button>
          <input ref={fileInputRef} type="file" accept=".json" onChange={handleImport} className="hidden" />
        </div>

        {/* ── 보관된 공연 ──────────────────────────────── */}
        {archivedShows.length > 0 && (
          <>
            <SectionHeader title="보관된 공연" />
            <div className="bg-white rounded-2xl overflow-hidden mx-4 shadow-sm">
              {archivedShows.map((s, i) => {
                const archivedDateStr = s.report?.generatedAt
                  ? new Date(s.report.generatedAt).toLocaleDateString('ko-KR', {
                      year: 'numeric', month: '2-digit', day: '2-digit',
                    }).replace(/\. /g, '.').replace('.', '')
                  : null;

                return (
                  <button
                    key={s.id}
                    data-testid={`btn-view-report-${s.id}`}
                    onClick={() => setReportShow(s)}
                    className={`w-full flex items-center justify-between px-4 py-3.5 text-left active:bg-gray-50 ${
                      i < archivedShows.length - 1 ? 'border-b border-gray-100' : ''
                    }`}
                  >
                    {/* 왼쪽: 이모지 + 공연명 + 보관일 */}
                    <div className="flex items-center gap-2.5 flex-1 min-w-0">
                      <span className="text-[18px] leading-none shrink-0">🎭</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[15px] font-semibold text-gray-800 truncate">{s.name}</p>
                        {archivedDateStr && (
                          <p className="text-xs text-gray-400 mt-0.5">{archivedDateStr} 보관</p>
                        )}
                      </div>
                    </div>

                    {/* 오른쪽: 리포트 보기 버튼 */}
                    {s.report && (
                      <span className="shrink-0 ml-3 text-xs font-semibold text-indigo-600 flex items-center gap-0.5">
                        리포트 보기
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M9 18l6-6-6-6"/>
                        </svg>
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </>
        )}

        {/* ── 위험 ──────────────────────────────────── */}
        <SectionHeader title="위험" />
        <div className="bg-white rounded-2xl overflow-hidden mx-4 shadow-sm">
          {resetStep === 0 && (
            <button
              data-testid="btn-reset-all"
              onClick={() => setResetStep(1)}
              className="h-[52px] w-full px-4 flex items-center bg-red-50 active:bg-red-100"
            >
              <span className="text-[20px] leading-none">🗑️</span>
              <span className="text-[15px] font-medium text-red-500 ml-[10px] flex-1 text-left">모든 데이터 초기화</span>
            </button>
          )}
          {resetStep === 1 && (
            <div className="p-4 bg-red-50 space-y-2">
              <p className="text-xs text-red-700">정말 삭제하시겠습니까? <strong>"초기화"</strong>를 입력하세요</p>
              <input
                data-testid="input-reset-confirm"
                value={resetInput}
                onChange={e => setResetInput(e.target.value)}
                placeholder="초기화"
                className="w-full px-3 py-2 rounded-lg border border-red-200 text-sm bg-white"
              />
              <div className="flex gap-2">
                <button
                  data-testid="btn-reset-confirm"
                  onClick={handleReset}
                  disabled={resetInput !== '초기화'}
                  className="flex-1 py-2 bg-red-600 text-white rounded-lg text-sm disabled:opacity-50 min-h-[44px]"
                >
                  삭제
                </button>
                <button
                  onClick={() => { setResetStep(0); setResetInput(''); }}
                  className="flex-1 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm min-h-[44px]"
                >
                  취소
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── 숨겨진 도장판 복구 (M-02) ────────────── */}
        {(() => {
          const hiddenBoards = show.stampBoards.filter(b => b.isHidden);
          if (hiddenBoards.length === 0) return null;
          return (
            <>
              <SectionHeader title="숨겨진 도장판" />
              <div className="bg-white rounded-2xl overflow-hidden mx-4 shadow-sm border border-amber-100">
                <div className="space-y-0">
                  {hiddenBoards.map((board, i) => {
                    const hiddenDate = board.hiddenAt
                      ? new Date(board.hiddenAt).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })
                      : '';
                    return (
                      <div key={board.id} className={`flex items-center gap-2 px-4 py-3 ${i < hiddenBoards.length - 1 ? 'border-b border-gray-100' : ''}`}>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-700 truncate">{board.name}</p>
                          {hiddenDate && <p className="text-xs text-gray-400 mt-0.5">{hiddenDate} 숨김</p>}
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                          <button onClick={() => restoreBoard(show.id, board.id)} className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold min-h-[32px]">복구</button>
                          <button onClick={() => setDeleteHiddenBoardId(board.id)} className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-medium min-h-[32px]">완전 삭제</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          );
        })()}

        <div className="px-4 pt-6">
          <PwaInstallGuide />
        </div>

        <div className="text-center text-xs text-gray-400 py-5">
          <p>스탬핏 v1.0.0</p>
          <p className="mt-0.5">도장판 관리 앱</p>
        </div>
      </div>

      {/* 숨겨진 판 완전 삭제 확인 (M-02) */}
      <ConfirmDialog
        isOpen={!!deleteHiddenBoardId}
        title="도장판 완전 삭제"
        message={`"${show.stampBoards.find(b => b.id === deleteHiddenBoardId)?.name ?? ''}" 도장판을 완전히 삭제할까요?\n관련 도장 데이터가 함께 삭제되며 복구할 수 없어요.`}
        confirmLabel="삭제"
        cancelLabel="취소"
        confirmDestructive
        onCancel={() => setDeleteHiddenBoardId(null)}
        onConfirm={() => {
          if (deleteHiddenBoardId) deleteStampBoard(show.id, deleteHiddenBoardId);
          setDeleteHiddenBoardId(null);
        }}
      />

      <SpecialEventSheet
        isOpen={specialEventSheetOpen}
        onClose={() => setSpecialEventSheetOpen(false)}
        showId={show.id}
      />

      <SeatGradeSheet
        isOpen={gradeSheetOpen}
        onClose={() => setGradeSheetOpen(false)}
        grades={show.seatGrades}
        onAdd={(data) => addSeatGrade(show.id, data)}
        onUpdate={(id, data) => updateSeatGrade(show.id, id, data)}
        onDelete={(id) => deleteSeatGrade(show.id, id)}
      />

      <DiscountTypeSheet
        isOpen={discountSheetOpen}
        onClose={() => setDiscountSheetOpen(false)}
        discountTypes={show.discountTypes}
        seatGrades={show.seatGrades}
        schedules={showSchedules}
        onAdd={(data) => addDiscountType(show.id, data)}
        onUpdate={(id, data) => updateDiscountType(show.id, id, data)}
        onDelete={(id) => deleteDiscountType(show.id, id)}
        onSoftDelete={(id) => softDeleteDiscountType(show.id, id)}
      />

      {/* ✅ JSON 가져오기 성공/실패 토스트 */}
      {importToast && (
        <Toast
          message={
            importToast.ok
              ? '관람 기록을 성공적으로 불러왔어요.'
              : '파일 형식이 올바르지 않아요. 스탬핀 백업 파일(.json)을 선택해주세요.'
          }
          type={importToast.ok ? 'success' : 'error'}
          onClose={() => setImportToast(null)}
        />
      )}

      {/* 보관된 공연 리포트 시트 */}
      {reportShow && (
        <ShowReportSheet
          isOpen={!!reportShow}
          onClose={() => setReportShow(null)}
          show={reportShow}
        />
      )}
    </div>
  );
}
