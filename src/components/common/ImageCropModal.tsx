import { useRef, useState, useEffect, useCallback } from 'react';

interface ImageCropModalProps {
  imageSrc: string;
  aspectRatio?: number;
  outputWidth?: number;
  quality?: number;
  isOpen: boolean;
  onClose: () => void;
  onCrop: (base64: string) => void;
}

type DragType = 'move' | 'nw' | 'ne' | 'sw' | 'se';
interface CropBox { x: number; y: number; w: number; h: number; }
interface ImgRect { x: number; y: number; w: number; h: number; }

const HANDLE = 10;
const MIN_W = 40;

export default function ImageCropModal({
  imageSrc,
  aspectRatio = 16 / 9,
  outputWidth = 800,
  quality = 0.85,
  isOpen,
  onClose,
  onCrop,
}: ImageCropModalProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [crop, setCrop] = useState<CropBox>({ x: 0, y: 0, w: 0, h: 0 });
  const [imgRectState, setImgRectState] = useState<ImgRect>({ x: 0, y: 0, w: 0, h: 0 });
  const imgRectRef = useRef<ImgRect>({ x: 0, y: 0, w: 0, h: 0 });
  const naturalRef = useRef({ w: 1, h: 1 });
  const dragRef = useRef<{ type: DragType; sx: number; sy: number; sc: CropBox } | null>(null);

  function measureImg(): ImgRect | null {
    const img = imgRef.current;
    const container = containerRef.current;
    if (!img || !container) return null;
    const ir = img.getBoundingClientRect();
    const cr = container.getBoundingClientRect();
    return { x: ir.left - cr.left, y: ir.top - cr.top, w: ir.width, h: ir.height };
  }

  function handleImgLoad() {
    const img = imgRef.current;
    if (!img) return;
    naturalRef.current = { w: img.naturalWidth, h: img.naturalHeight };
    const rect = measureImg();
    if (!rect) return;
    imgRectRef.current = rect;
    setImgRectState(rect);
    const boxH = Math.min(rect.h, rect.w / aspectRatio);
    const boxW = boxH * aspectRatio;
    setCrop({ x: (rect.w - boxW) / 2, y: (rect.h - boxH) / 2, w: boxW, h: boxH });
  }

  const onPointerMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!dragRef.current) return;
    if (e.cancelable) e.preventDefault();
    const clientX = 'touches' in e ? (e as TouchEvent).touches[0].clientX : (e as MouseEvent).clientX;
    const clientY = 'touches' in e ? (e as TouchEvent).touches[0].clientY : (e as MouseEvent).clientY;
    const dx = clientX - dragRef.current.sx;
    const dy = clientY - dragRef.current.sy;
    const sc = dragRef.current.sc;
    const type = dragRef.current.type;
    const ir = imgRectRef.current;

    const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

    setCrop(() => {
      if (type === 'move') {
        return {
          x: clamp(sc.x + dx, 0, ir.w - sc.w),
          y: clamp(sc.y + dy, 0, ir.h - sc.h),
          w: sc.w,
          h: sc.h,
        };
      }

      let x = sc.x, y = sc.y, w = sc.w, h = sc.h;

      if (type === 'se') {
        w = clamp(sc.w + dx, MIN_W, ir.w - sc.x);
        h = w / aspectRatio;
        if (sc.y + h > ir.h) { h = ir.h - sc.y; w = h * aspectRatio; }
        return { x: sc.x, y: sc.y, w, h };
      }
      if (type === 'sw') {
        w = clamp(sc.w - dx, MIN_W, sc.x + sc.w);
        h = w / aspectRatio;
        if (sc.y + h > ir.h) { h = ir.h - sc.y; w = h * aspectRatio; }
        x = sc.x + sc.w - w;
        return { x, y: sc.y, w, h };
      }
      if (type === 'ne') {
        w = clamp(sc.w + dx, MIN_W, ir.w - sc.x);
        h = w / aspectRatio;
        const maxH = sc.y + sc.h;
        if (h > maxH) { h = maxH; w = h * aspectRatio; }
        y = sc.y + sc.h - h;
        return { x: sc.x, y, w, h };
      }
      if (type === 'nw') {
        w = clamp(sc.w - dx, MIN_W, sc.x + sc.w);
        h = w / aspectRatio;
        const maxH = sc.y + sc.h;
        if (h > maxH) { h = maxH; w = h * aspectRatio; }
        x = sc.x + sc.w - w;
        y = sc.y + sc.h - h;
        return { x, y, w, h };
      }

      return { x, y, w, h };
    });
  }, [aspectRatio]);

  const onPointerUp = useCallback(() => { dragRef.current = null; }, []);

  useEffect(() => {
    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);
    window.addEventListener('touchmove', onPointerMove, { passive: false });
    window.addEventListener('touchend', onPointerUp);
    return () => {
      window.removeEventListener('mousemove', onPointerMove);
      window.removeEventListener('mouseup', onPointerUp);
      window.removeEventListener('touchmove', onPointerMove);
      window.removeEventListener('touchend', onPointerUp);
    };
  }, [onPointerMove, onPointerUp]);

  function startDrag(type: DragType, e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault();
    e.stopPropagation();
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    dragRef.current = { type, sx: clientX, sy: clientY, sc: { ...crop } };
  }

  function handleApply() {
    const img = imgRef.current;
    if (!img || crop.w === 0) return;
    const { w: natW, h: natH } = naturalRef.current;
    const ir = imgRectRef.current;
    const scaleX = natW / ir.w;
    const scaleY = natH / ir.h;
    const outputHeight = Math.round(outputWidth / aspectRatio);
    const canvas = document.createElement('canvas');
    canvas.width = outputWidth;
    canvas.height = outputHeight;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, crop.x * scaleX, crop.y * scaleY, crop.w * scaleX, crop.h * scaleY, 0, 0, outputWidth, outputHeight);
    onCrop(canvas.toDataURL('image/jpeg', quality));
  }

  if (!isOpen) return null;

  const { x: ix, y: iy, w: iw, h: ih } = imgRectState;
  const { x: cx, y: cy, w: cw, h: ch } = crop;
  const hasCrop = cw > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <div className="bg-white rounded-2xl overflow-hidden w-full max-w-lg mx-4">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-800">이미지 크롭</h2>
          <span className="text-xs text-gray-400">비율 고정 크롭</span>
        </div>

        <div ref={containerRef} className="relative bg-black" style={{ userSelect: 'none' }}>
          <img
            ref={imgRef}
            src={imageSrc}
            alt="crop target"
            onLoad={handleImgLoad}
            draggable={false}
            className="block mx-auto"
            style={{ maxHeight: '20rem', maxWidth: '100%', objectFit: 'contain' }}
          />

          {hasCrop && (
            <>
              {/* Dark overlay: top / bottom / left / right of crop box */}
              <div className="absolute pointer-events-none bg-black/55" style={{ left: ix, top: iy, width: iw, height: cy }} />
              <div className="absolute pointer-events-none bg-black/55" style={{ left: ix, top: iy + cy + ch, width: iw, height: ih - cy - ch }} />
              <div className="absolute pointer-events-none bg-black/55" style={{ left: ix, top: iy + cy, width: cx, height: ch }} />
              <div className="absolute pointer-events-none bg-black/55" style={{ left: ix + cx + cw, top: iy + cy, width: iw - cx - cw, height: ch }} />

              {/* Crop box */}
              <div
                className="absolute border border-white cursor-move"
                style={{ left: ix + cx, top: iy + cy, width: cw, height: ch }}
                onMouseDown={e => startDrag('move', e)}
                onTouchStart={e => startDrag('move', e)}
              >
                {/* Rule-of-thirds guide lines */}
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute inset-y-0 border-l border-white/35" style={{ left: '33.33%' }} />
                  <div className="absolute inset-y-0 border-l border-white/35" style={{ left: '66.67%' }} />
                  <div className="absolute inset-x-0 border-t border-white/35" style={{ top: '33.33%' }} />
                  <div className="absolute inset-x-0 border-t border-white/35" style={{ top: '66.67%' }} />
                </div>

                {/* Corner handles */}
                {(['nw', 'ne', 'sw', 'se'] as const).map(handle => (
                  <div
                    key={handle}
                    className="absolute bg-white z-10"
                    style={{
                      width: HANDLE * 2,
                      height: HANDLE * 2,
                      borderRadius: 2,
                      ...(handle[0] === 'n' ? { top: -HANDLE } : { bottom: -HANDLE }),
                      ...(handle[1] === 'w' ? { left: -HANDLE } : { right: -HANDLE }),
                      cursor: handle === 'nw' || handle === 'se' ? 'nwse-resize' : 'nesw-resize',
                    }}
                    onMouseDown={e => startDrag(handle, e)}
                    onTouchStart={e => startDrag(handle, e)}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        <div className="px-4 py-3 flex gap-3 justify-end border-t border-gray-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="px-4 py-2 rounded-xl text-sm font-medium text-white bg-indigo-500 hover:bg-indigo-600 transition-colors"
          >
            적용
          </button>
        </div>
      </div>
    </div>
  );
}
