import { useState, useEffect } from 'react';
import BottomSheet from '../common/BottomSheet';
import Button from '../common/Button';
import Input from '../common/Input';
import StampGrid from '../common/StampGrid';
import type { Benefit, Stamp } from '../../types';
import { STAMP_COLOR_PRESETS, DEFAULT_STAMP_COLOR } from '../../constants/stampColors';

interface AddBoardSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    name: string;
    capacity: number;
    initialStamps: number;
    stampColor: string;
    benefits: Omit<Benefit, 'id' | 'isAchieved' | 'isUsed'>[];
  }) => void;
  /** 이전 판 설정을 기본값으로 채울 때 사용 */
  initialData?: {
    capacity?: number;
    stampColor?: string;
    benefits?: Omit<Benefit, 'id' | 'isAchieved' | 'isUsed'>[];
  };
  /** 전체 도장판 수 (완성된 판 포함) — 이름 자동 생성에 사용 */
  totalBoardCount?: number;
  /** 직전 판 이름 — 간소화 모드에서 자동 패턴 확인에 사용 */
  prevBoardName?: string;
}

type EditableBenefit = {
  requiredStamps: number;
  description: string;
  priority: number;
};

/** N판 형식의 자동 이름 생성 */
function getDefaultBoardName(totalCount: number): string {
  return `${totalCount + 1}판`;
}

/** 직전 판 이름이 자동 패턴인지 확인 후 기본 이름 반환 */
function getSimplifiedDefaultName(prevBoardName: string | undefined, totalCount: number): string {
  if (!prevBoardName) return getDefaultBoardName(totalCount);
  const isAutoPattern = /^\d+판$/.test(prevBoardName);
  return isAutoPattern ? getDefaultBoardName(totalCount) : '';
}

// ── BenefitEditor: 컴포넌트 외부에 정의해야 매 렌더마다 재생성되지 않음 ──
// 내부 정의 시 부모 리렌더 → 새 컴포넌트로 인식 → 언마운트/리마운트 → 포커스 소실
interface BenefitEditorProps {
  benefits: EditableBenefit[];
  hasBenefitOverflow: boolean;
  onUpdateStamps: (idx: number, value: number) => void;
  onUpdateDesc: (idx: number, value: string) => void;
  onRemove: (idx: number) => void;
  onMove: (idx: number, dir: 'up' | 'down') => void;
  onAdd: () => void;
}

function BenefitEditor({
  benefits,
  hasBenefitOverflow,
  onUpdateStamps,
  onUpdateDesc,
  onRemove,
  onMove,
  onAdd,
}: BenefitEditorProps) {
  return (
    <div className="space-y-2">
      {benefits.map((b, idx) => (
        <div key={idx} className="flex items-center gap-1.5 p-2.5 bg-gray-50 rounded-xl">
          <span className="w-5 h-5 bg-indigo-100 text-indigo-700 rounded-full text-xs font-bold flex items-center justify-center shrink-0">{idx + 1}</span>
          <input
            data-testid={`benefit-stamps-${idx}`}
            type="number"
            value={b.requiredStamps}
            onChange={e => onUpdateStamps(idx, Number(e.target.value))}
            className="w-12 px-1 py-1 rounded-lg border border-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-400 text-sm text-center"
            min={1}
          />
          <input
            type="text"
            value={b.description}
            onChange={e => onUpdateDesc(idx, e.target.value)}
            placeholder="혜택 내용"
            className="flex-1 px-2 py-1 rounded-lg border border-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-400 text-sm"
          />
          <div className="flex flex-col shrink-0">
            <button onClick={() => onMove(idx, 'up')} disabled={idx === 0} className="text-gray-400 hover:text-indigo-600 disabled:opacity-20 text-xs leading-none py-0.5">▲</button>
            <button onClick={() => onMove(idx, 'down')} disabled={idx === benefits.length - 1} className="text-gray-400 hover:text-indigo-600 disabled:opacity-20 text-xs leading-none py-0.5">▼</button>
          </div>
          <button onClick={() => onRemove(idx)} className="text-red-400 text-sm hover:text-red-600 shrink-0 px-1">✕</button>
        </div>
      ))}
      {hasBenefitOverflow && (
        <p data-testid="error-benefit-overflow" className="text-red-500 text-xs">혜택 도장 수가 칸 수를 초과합니다</p>
      )}
      <button
        data-testid="btn-add-benefit"
        onClick={onAdd}
        className="w-full py-2 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 text-sm hover:border-indigo-300 hover:text-indigo-400 transition-colors"
      >
        + 혜택 추가
      </button>
    </div>
  );
}

/** 도장판 추가 바텀 시트 (SC-06) */
export default function AddBoardSheet({
  isOpen, onClose, onSubmit, initialData, totalBoardCount = 0, prevBoardName,
}: AddBoardSheetProps) {
  const hasTemplate = !!(initialData?.capacity && initialData.benefits !== undefined);

  const computeDefaultName = () =>
    hasTemplate
      ? getSimplifiedDefaultName(prevBoardName, totalBoardCount)
      : getDefaultBoardName(totalBoardCount);

  const [name, setName] = useState(computeDefaultName);
  const [capacity, setCapacity] = useState(initialData?.capacity ?? 7);
  const [stampColor, setStampColor] = useState(initialData?.stampColor ?? DEFAULT_STAMP_COLOR);
  const [hasInitial, setHasInitial] = useState(false);
  const [initialStamps, setInitialStamps] = useState(0);
  const [benefits, setBenefits] = useState<EditableBenefit[]>(
    initialData?.benefits?.map((b, i) => ({ requiredStamps: b.requiredStamps, description: b.description, priority: i + 1 })) ?? []
  );
  const [errors, setErrors] = useState<{ name?: string; initial?: string }>({});
  // 간편 모드에서 "직접 설정" 펼치기 토글
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setName(computeDefaultName());
      setCapacity(initialData?.capacity ?? 7);
      setStampColor(initialData?.stampColor ?? DEFAULT_STAMP_COLOR);
      setHasInitial(false);
      setInitialStamps(0);
      setBenefits(
        initialData?.benefits
          ? initialData.benefits.map((b, i) => ({ requiredStamps: b.requiredStamps, description: b.description, priority: i + 1 }))
          : []
      );
      setErrors({});
      setShowAdvanced(false);
    }
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const effectiveInitial = hasInitial ? initialStamps : 0;

  function getInitialWarning(): string | null {
    if (!hasInitial) return null;
    if (initialStamps > capacity) return '초기 도장이 용량을 초과합니다';
    if (initialStamps === capacity) return '이미 완성된 판입니다';
    return null;
  }

  function addBenefit() {
    setBenefits(prev => [
      ...prev,
      { requiredStamps: 1, description: '', priority: prev.length + 1 },
    ]);
  }

  function updateBenefitStamps(idx: number, value: number) {
    setBenefits(prev => prev.map((b, i) => i === idx ? { ...b, requiredStamps: value } : b));
  }

  function updateBenefitDesc(idx: number, value: string) {
    setBenefits(prev => prev.map((b, i) => i === idx ? { ...b, description: value } : b));
  }

  function removeBenefit(idx: number) {
    setBenefits(prev => prev.filter((_, i) => i !== idx).map((b, i) => ({ ...b, priority: i + 1 })));
  }

  function moveBenefit(idx: number, dir: 'up' | 'down') {
    setBenefits(prev => {
      const next = [...prev];
      const target = dir === 'up' ? idx - 1 : idx + 1;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next.map((b, i) => ({ ...b, priority: i + 1 }));
    });
  }

  function validate(): boolean {
    const newErrors: { name?: string; initial?: string } = {};
    if (!name.trim()) newErrors.name = '판 이름을 입력해주세요';
    if (hasInitial && initialStamps > capacity) newErrors.initial = '초기 도장이 용량을 초과합니다';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleSubmit() {
    if (!validate()) return;
    onSubmit({
      name: name.trim(),
      capacity,
      initialStamps: effectiveInitial,
      stampColor,
      benefits: benefits.map((b, i) => ({ requiredStamps: b.requiredStamps, description: b.description, priority: i + 1 })),
    });
    onClose();
  }

  const _warning = getInitialWarning(); void _warning;
  const hasBenefitOverflow = benefits.some(b => b.requiredStamps > capacity);

  const previewStamps: Stamp[] = Array.from({ length: effectiveInitial }).map((_, i) => ({
    id: `preview-${i}`, scheduleId: null, isInitial: true, isConfirmed: true, earnedAt: '',
  }));

  const previewBenefits = benefits.map((b, i) => ({
    ...b, id: `preview-benefit-${i}`, isAchieved: false, isUsed: false,
  }));

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="새 도장판 추가"
      footer={
        <Button
          data-testid="btn-save-board"
          onClick={handleSubmit}
          disabled={hasInitial && initialStamps > capacity}
          fullWidth
        >
          도장판 생성
        </Button>
      }
    >
      <div className="space-y-4">

        {/* 판 이름 */}
        <Input
          data-testid="input-board-name"
          label="판 이름"
          value={name}
          onChange={e => setName(e.target.value)}
          onFocus={e => e.target.select()}
          placeholder="1판, A판 등"
          error={errors.name}
          autoFocus
        />

        {/* 도장 색상 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">도장 색상</label>
          <div className="grid grid-cols-6 gap-2">
            {STAMP_COLOR_PRESETS.map(preset => (
              <button
                key={preset.hex}
                data-testid="stamp-color-option"
                onClick={() => setStampColor(preset.hex)}
                className="relative aspect-square rounded-full transition-transform active:scale-90"
                style={{ backgroundColor: preset.hex }}
                aria-label={preset.label}
                title={preset.label}
              >
                {stampColor === preset.hex && (
                  <span className="absolute inset-0 flex items-center justify-center text-white text-sm font-bold drop-shadow">✓</span>
                )}
              </button>
            ))}
          </div>
          {/* 미리보기 */}
          <div className="mt-2 p-3 bg-gray-50 rounded-xl">
            <p className="text-xs text-gray-400 mb-2">도장 미리보기</p>
            <StampGrid
              capacity={Math.min(capacity, 5)}
              stamps={[]}
              benefits={[]}
              previewInitial={Math.min(3, capacity)}
              stampColor={stampColor}
            />
          </div>
        </div>

        {/* 도장 칸 수 — 항상 표시 (간편 모드 시 숨김) */}
        {(!hasTemplate || showAdvanced) && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">도장 칸 수</label>
            <div className="flex items-center gap-3">
              <button onClick={() => setCapacity(c => Math.max(1, c - 1))} className="w-10 h-10 rounded-full bg-gray-100 text-gray-700 font-bold text-lg hover:bg-gray-200 flex items-center justify-center">-</button>
              <input
                data-testid="input-capacity"
                type="number"
                value={capacity}
                onChange={e => setCapacity(Math.max(1, Math.min(50, Number(e.target.value))))}
                className="text-2xl font-bold text-indigo-600 w-14 text-center border-none outline-none bg-transparent"
              />
              <button onClick={() => setCapacity(c => Math.min(50, c + 1))} className="w-10 h-10 rounded-full bg-gray-100 text-gray-700 font-bold text-lg hover:bg-gray-200 flex items-center justify-center">+</button>
            </div>
          </div>
        )}

        {/* 초기 도장 토글 — 항상 표시 */}
        <div>
          <label className="flex items-center gap-3 cursor-pointer">
            <div
              data-testid="toggle-initial-stamps"
              className={`w-12 h-6 rounded-full transition-colors ${hasInitial ? 'bg-indigo-600' : 'bg-gray-200'}`}
              onClick={() => setHasInitial(v => !v)}
            >
              <div className={`w-5 h-5 bg-white rounded-full shadow m-0.5 transition-transform ${hasInitial ? 'translate-x-6' : 'translate-x-0'}`} />
            </div>
            <span className="text-sm text-gray-700">이미 찍혀있는 도장이 있나요?</span>
          </label>
          {hasInitial && (
            <div className="mt-3 space-y-3">
              <div className="flex items-center gap-3">
                <input data-testid="input-initial-stamps" type="number" min={0} max={capacity} value={initialStamps} onChange={e => setInitialStamps(Number(e.target.value))} className="w-20 px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-400 text-sm text-center" />
                <span className="text-sm text-gray-500">개</span>
              </div>
              <div className="p-3 bg-gray-50 rounded-xl">
                <p className="text-xs text-gray-500 mb-2">미리보기</p>
                <StampGrid capacity={capacity} stamps={previewStamps} benefits={previewBenefits} previewInitial={effectiveInitial} stampColor={stampColor} />
              </div>
              {initialStamps === capacity && (
                <p data-testid="notice-already-complete" className="text-amber-500 text-xs">이미 완성된 판입니다</p>
              )}
              {initialStamps > capacity && (
                <p className="text-red-500 text-xs">초기 도장이 용량을 초과합니다</p>
              )}
              {errors.initial && <p className="text-red-500 text-xs">{errors.initial}</p>}
            </div>
          )}
        </div>

        {/* ── 간편 모드: 이전 판 혜택 자동 적용 ── */}
        {hasTemplate ? (
          <div>
            <div data-testid="card-inherited-settings" className="p-3 bg-gray-50 border border-gray-200 rounded-xl">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-700">이전 판 혜택 자동 적용</p>
                <button
                  data-testid="btn-full-mode"
                  onClick={() => setShowAdvanced(v => !v)}
                  className="text-xs text-indigo-500 font-medium active:opacity-60"
                >
                  {showAdvanced ? '접기' : '변경하기'}
                </button>
              </div>
              {!showAdvanced && (
                <div className="flex flex-wrap gap-1.5">
                  {benefits.map((b, i) => (
                    <span key={i} className="text-xs bg-white border border-gray-200 text-gray-600 px-2 py-0.5 rounded-full">
                      {b.requiredStamps}개 · {b.description}
                    </span>
                  ))}
                  {benefits.length === 0 && (
                    <span className="text-xs text-gray-400">혜택 없음</span>
                  )}
                </div>
              )}
            </div>

            {showAdvanced && (
              <div className="mt-3">
                <label className="block text-sm font-medium text-gray-700 mb-2">혜택 설정</label>
                <BenefitEditor
                  benefits={benefits}
                  hasBenefitOverflow={hasBenefitOverflow}
                  onUpdateStamps={updateBenefitStamps}
                  onUpdateDesc={updateBenefitDesc}
                  onRemove={removeBenefit}
                  onMove={moveBenefit}
                  onAdd={addBenefit}
                />
              </div>
            )}
          </div>
        ) : (
          /* ── 풀 모드: 혜택 편집 ── */
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">혜택 설정</label>
            <BenefitEditor
              benefits={benefits}
              hasBenefitOverflow={hasBenefitOverflow}
              onUpdateStamps={updateBenefitStamps}
              onUpdateDesc={updateBenefitDesc}
              onRemove={removeBenefit}
              onMove={moveBenefit}
              onAdd={addBenefit}
            />
          </div>
        )}

      </div>
    </BottomSheet>
  );
}
