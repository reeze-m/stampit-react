import { useState, useEffect } from 'react';
import BottomSheet from '../common/BottomSheet';
import Button from '../common/Button';
import type { Schedule, SeatGrade, DiscountType, StampBoard, BoardAllocation } from '../../types';
import { calcFinalPrice } from '../../utils/priceCalc';
import { allocateStamps } from '../../utils/stampAllocator';
import CastAutocomplete from '../planner/CastAutocomplete';
import SpecialEventPicker from '../planner/SpecialEventPicker';
import SpecialEventSheet from '../settings/SpecialEventSheet';
import StampCountPicker from './StampCountPicker';

interface EditScheduleSheetProps {
  isOpen: boolean;
  onClose: () => void;
  schedule: Schedule | null;
  showId: string;
  seatGrades: SeatGrade[];
  discountTypes: DiscountType[];
  stampBoards: StampBoard[];
  existingScheduleDates: string[];
  onSave: (scheduleId: string, data: {
    date: string;
    time?: string;
    seatGradeId: string;
    discountTypeId: string;
    finalPrice: number;
    originalPrice: number;
    multiplier: number;
    memo?: string;
    cast?: string;
    specialEventIds: string[];
    isShare?: boolean; // ✅ 추가
  }) => void;
}

/** 미확정 일정 수정 바텀 시트 */
export default function EditScheduleSheet({
  isOpen,
  onClose,
  schedule,
  showId,
  seatGrades,
  discountTypes,
  stampBoards,
  existingScheduleDates,
  onSave,
}: EditScheduleSheetProps) {
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [gradeId, setGradeId] = useState('');
  const [discountId, setDiscountId] = useState('');
  const [multiplier, setMultiplier] = useState(1);
  const [memo, setMemo] = useState('');
  const [cast, setCast] = useState('');
  const [isShare, setIsShare] = useState(false); // ✅ 나눠 관극 토글
  const [specialEventIds, setSpecialEventIds] = useState<string[]>([]);
  const [specialEventSheetOpen, setSpecialEventSheetOpen] = useState(false);
  const [previewAllocations, setPreviewAllocations] = useState<BoardAllocation[]>([]);
  const [isDuplicate, setIsDuplicate] = useState(false);

  const activeDiscountTypes = discountTypes.filter(d => !d.isDeleted);
  const grade = seatGrades.find(g => g.id === gradeId) || null;
  const discount = activeDiscountTypes.find(d => d.id === discountId) || null;
  const finalPrice = grade && discount ? calcFinalPrice(grade, discount) : 0;

  // schedule이 바뀔 때 폼 초기화
  useEffect(() => {
    if (!schedule || !isOpen) return;
    setDate(schedule.date);
    setTime(schedule.time ?? '');
    setGradeId(schedule.seatGradeId ?? seatGrades[0]?.id ?? '');
    setDiscountId(schedule.discountTypeId ?? discountTypes.filter(d => !d.isDeleted)[0]?.id ?? '');
    setMultiplier(schedule.multiplier);
    setMemo(schedule.memo ?? '');
    setCast(schedule.cast ?? '');
    setIsShare(schedule.isShare ?? false); // ✅ 나눠 토글 초기화
    setSpecialEventIds(schedule.specialEventIds ?? []);
  }, [schedule, isOpen]);

  // 날짜 변경 시 중복 체크 (자기 자신 날짜 제외)
  useEffect(() => {
    if (!date || !schedule) { setIsDuplicate(false); return; }
    const otherDates = existingScheduleDates.filter(d => d !== schedule.date);
    setIsDuplicate(otherDates.includes(date));
  }, [date, existingScheduleDates, schedule]);

  // 배분 미리보기
  useEffect(() => {
    const { allocations } = allocateStamps(stampBoards, multiplier);
    setPreviewAllocations(allocations);
  }, [stampBoards, multiplier]);

  function handleSubmit() {
    if (!schedule || !date || !gradeId || !discountId) return;
    onSave(schedule.id, {
      date,
      time: time || undefined,
      seatGradeId: gradeId,
      discountTypeId: discountId,
      finalPrice,
      originalPrice: grade?.price || 0,
      multiplier,
      memo: memo || undefined,
      cast: cast || undefined,
      specialEventIds,
      isShare, // ✅ 나눠 저장
    });
    onClose();
  }

  return (
    <>
      <SpecialEventSheet
        isOpen={specialEventSheetOpen}
        onClose={() => setSpecialEventSheetOpen(false)}
        showId={showId}
      />
      <BottomSheet
        isOpen={isOpen}
        onClose={onClose}
        title="일정 수정"
        footer={
          <Button
            data-testid="btn-save-schedule"
            onClick={handleSubmit}
            disabled={!date || !gradeId || !discountId}
            fullWidth
          >
            수정 완료
          </Button>
        }
      >
        <div className="space-y-4">
          {/* 날짜 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              날짜 <span className="text-red-500">*</span>
            </label>
            <input
              data-testid="input-schedule-date"
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-400 text-sm"
            />
            {isDuplicate && (
              <div data-testid="warn-dup-date" className="mt-1 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-amber-700 text-xs">⚠️ 이미 같은 날짜의 일정이 있습니다.</p>
              </div>
            )}
          </div>

          {/* 회차 시간 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">회차 (선택)</label>
            <input
              type="time"
              value={time}
              onChange={e => setTime(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-400 text-sm"
            />
          </div>

          {/* 좌석 등급 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              좌석 등급 <span className="text-red-500">*</span>
            </label>
            <select
              value={gradeId}
              onChange={e => setGradeId(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-400 text-sm bg-white"
            >
              {seatGrades.map(g => (
                <option key={g.id} value={g.id}>{g.name} ({g.price.toLocaleString()}원)</option>
              ))}
            </select>
          </div>

          {/* 할인 종류 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              할인권종 <span className="text-red-500">*</span>
            </label>
            <select
              value={discountId}
              onChange={e => setDiscountId(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-400 text-sm bg-white"
            >
              {activeDiscountTypes.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
            {discount?.isRebook && (
              <div className="mt-1 p-2 bg-orange-50 border border-orange-200 rounded-lg">
                <p className="text-orange-700 text-xs">🎟️ 재관람표를 지참하세요!</p>
              </div>
            )}
            {discount?.isCoupon && (
              <div className="mt-1 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-blue-700 text-xs">🎫 쿠폰을 챙기세요!</p>
              </div>
            )}
          </div>

          {/* 도장 개수 선택 */}
          <StampCountPicker
            value={multiplier}
            onChange={setMultiplier}
            label="도장 적립"
          />

          {/* 자동 배분 미리보기 */}
          {previewAllocations.length > 0 && (
            <div className="p-3 bg-gray-50 rounded-xl space-y-2">
              <p className="text-xs text-gray-500">배분 미리보기</p>
              {previewAllocations.map(alloc => {
                const board = stampBoards.find(b => b.id === alloc.boardId);
                const current = board?.stamps.length ?? 0;
                const capacity = board?.capacity ?? 1;
                const after = Math.min(current + alloc.stamps, capacity);
                return (
                  <div key={alloc.boardId} className="flex items-center gap-2">
                    <span className="text-xs text-gray-600 w-16 truncate flex-shrink-0">{board?.name}</span>
                    <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-400 rounded-full"
                        style={{ width: `${(current / capacity) * 100}%` }}
                      />
                    </div>
                    <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden -ml-2 opacity-50">
                      <div
                        className="h-full bg-indigo-600 rounded-full"
                        style={{ width: `${(after / capacity) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs font-semibold text-indigo-600 flex-shrink-0">+{alloc.stamps}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* ✅ 나눠 관극 토글 */}
          <div className="flex items-center justify-between py-1">
            <div>
              <p className="text-sm font-medium text-gray-700">나눠 관극</p>
              <p className="text-xs text-gray-400 mt-0.5">나눠 관극은 도장이 적립되지 않아요</p>
            </div>
            <button
              data-testid="toggle-is-share"
              onClick={() => setIsShare(v => !v)}
              className={`w-12 h-6 rounded-full transition-colors ${isShare ? 'bg-indigo-600' : 'bg-gray-200'}`}
            >
              <div className={`w-5 h-5 bg-white rounded-full shadow m-0.5 transition-transform ${isShare ? 'translate-x-6' : 'translate-x-0'}`} />
            </button>
          </div>

          {/* 메모 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">메모 (선택)</label>
            <input
              value={memo}
              onChange={e => setMemo(e.target.value)}
              placeholder="자유롭게 메모하세요"
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-400 text-sm"
            />
          </div>

          {/* 캐스트 메모 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">캐스트 메모 (선택)</label>
            <CastAutocomplete showId={showId} value={cast} onChange={setCast} />
          </div>

          {/* 특별 이벤트 태그 */}
          <SpecialEventPicker
            showId={showId}
            selectedIds={specialEventIds}
            onChange={setSpecialEventIds}
            onOpenSheet={() => setSpecialEventSheetOpen(true)}
          />

        </div>
      </BottomSheet>
    </>
  );
}
