import { useState, useEffect, useRef } from 'react';
import BottomSheet from '../common/BottomSheet';
import Button from '../common/Button';
import Input from '../common/Input';
import ImageCropModal from '../common/ImageCropModal';

// 6가지 색상 프리셋
export const COLOR_PRESETS = [
  '#6366f1', // indigo
  '#10b981', // emerald
  '#f59e0b', // amber
  '#f43f5e', // rose
  '#8b5cf6', // purple
  '#06b6d4', // cyan
];

interface AddShowSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    name: string;
    venue: string;
    startDate: string;
    endDate: string;
    color: string;
    headerImageUrl?: string;
    seatGrades: never[];
    discountTypes: never[];
  }) => void;
  mode?: 'add' | 'edit';
  initialData?: {
    name?: string;
    venue?: string;
    startDate?: string;
    endDate?: string;
    color?: string;
    headerImageUrl?: string;
  };
}

/** 공연 추가/수정 바텀 시트 */
export default function AddShowSheet({ isOpen, onClose, onSubmit, mode = 'add', initialData }: AddShowSheetProps) {
  const [name, setName] = useState(initialData?.name || '');
  const [venue, setVenue] = useState(initialData?.venue || '');
  const [startDate, setStartDate] = useState(initialData?.startDate || '');
  const [endDate, setEndDate] = useState(initialData?.endDate || '');
  const [color, setColor] = useState(initialData?.color || COLOR_PRESETS[0]);
  const [headerImageUrl, setHeaderImageUrl] = useState<string | undefined>(initialData?.headerImageUrl);
  const [cropSrc, setCropSrc] = useState('');
  const [isCropOpen, setIsCropOpen] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; date?: string }>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 시트가 열릴 때마다 initialData로 상태 초기화
  useEffect(() => {
    if (isOpen) {
      setName(initialData?.name || '');
      setVenue(initialData?.venue || '');
      setStartDate(initialData?.startDate || '');
      setEndDate(initialData?.endDate || '');
      setColor(initialData?.color || COLOR_PRESETS[0]);
      setHeaderImageUrl(initialData?.headerImageUrl);
      setErrors({});
    }
  }, [isOpen]);

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const objectUrl = URL.createObjectURL(file);
    setCropSrc(objectUrl);
    setIsCropOpen(true);
    e.target.value = '';
  }

  function handleCropDone(base64: string) {
    setHeaderImageUrl(base64);
    setIsCropOpen(false);
    URL.revokeObjectURL(cropSrc);
  }

  function handleCropClose() {
    setIsCropOpen(false);
    URL.revokeObjectURL(cropSrc);
  }

  function validateDates(start: string, end: string): string | undefined {
    if (start && end && end < start) {
      return '종료일은 시작일 이후여야 합니다';
    }
    return undefined;
  }

  function validate(): boolean {
    const newErrors: { name?: string; date?: string } = {};
    if (!name.trim()) newErrors.name = '공연명을 입력해주세요';
    const dateErr = validateDates(startDate, endDate);
    if (dateErr) newErrors.date = dateErr;
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleSubmit() {
    if (!validate()) return;
    onSubmit({
      name: name.trim(),
      venue: venue.trim(),
      startDate,
      endDate,
      color,
      headerImageUrl,
      seatGrades: [],
      discountTypes: [],
    });
    onClose();
  }

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={mode === 'edit' ? '공연 수정' : '공연 추가'}
      footer={
        <Button
          data-testid="btn-save-show"
          onClick={handleSubmit}
          disabled={!name.trim() || !!errors.date}
          fullWidth
        >
          저장
        </Button>
      }
    >
      <div className="space-y-4">
        {/* 상단 이미지 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">상단 이미지</label>
          {headerImageUrl ? (
            <div className="relative rounded-xl overflow-hidden">
              <img
                src={headerImageUrl}
                alt="공연 상단 이미지"
                className="w-full h-32 object-cover"
              />
              <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/30 opacity-0 hover:opacity-100 transition-opacity">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1.5 bg-white text-gray-800 rounded-lg text-xs font-medium"
                >
                  변경
                </button>
                <button
                  type="button"
                  onClick={() => setHeaderImageUrl(undefined)}
                  className="px-3 py-1.5 bg-red-500 text-white rounded-lg text-xs font-medium"
                >
                  삭제
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-24 rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-1.5 text-gray-400 hover:bg-gray-50 transition-colors"
            >
              <span className="text-2xl">🖼️</span>
              <span className="text-xs">이미지 추가</span>
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageChange}
            className="hidden"
          />
        </div>

        {/* 공연명 */}
        <Input
          data-testid="input-show-name"
          label="공연명"
          required
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          maxLength={30}
          placeholder="뮤지컬 햄릿"
          error={errors.name}
        />

        {/* 공연장 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">공연장</label>
          <input
            type="text"
            value={venue}
            onChange={e => setVenue(e.target.value)}
            placeholder="블루스퀘어 신한카드홀"
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-400 text-sm"
          />
        </div>

        {/* 기간 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">공연 기간</label>
          <div className="flex gap-2 items-center">
            <input
              data-testid="input-start-date"
              type="date"
              value={startDate}
              onChange={e => {
                const newStart = e.target.value;
                setStartDate(newStart);
                setErrors(prev => ({ ...prev, date: validateDates(newStart, endDate) || undefined }));
              }}
              className="flex-1 px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-400 text-sm"
            />
            <span className="text-gray-400">~</span>
            <input
              data-testid="input-end-date"
              type="date"
              value={endDate}
              onChange={e => {
                const newEnd = e.target.value;
                setEndDate(newEnd);
                setErrors(prev => ({ ...prev, date: validateDates(startDate, newEnd) || undefined }));
              }}
              min={startDate}
              className="flex-1 px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-400 text-sm"
            />
          </div>
          {errors.date && <p data-testid="error-date" className="text-red-500 text-xs mt-1">{errors.date}</p>}
        </div>

        {/* 대표 색상 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">대표 색상</label>
          <div className="flex gap-3">
            {COLOR_PRESETS.map(preset => (
              <button
                key={preset}
                data-testid="color-option"
                aria-selected={color === preset ? 'true' : 'false'}
                onClick={() => setColor(preset)}
                className="w-9 h-9 rounded-full border-4 transition-all"
                style={{
                  backgroundColor: preset,
                  borderColor: color === preset ? preset : 'transparent',
                  outline: color === preset ? `2px solid ${preset}` : 'none',
                  outlineOffset: '2px',
                }}
                aria-label={`색상 ${preset}`}
              />
            ))}
          </div>
        </div>

      </div>
    </BottomSheet>

    {cropSrc && (
      <ImageCropModal
        imageSrc={cropSrc}
        isOpen={isCropOpen}
        onClose={handleCropClose}
        onCrop={handleCropDone}
      />
    )}
  );
}
