/**
 * reportImageUtils.ts
 * 이미지 저장/공유 유틸
 *
 * 위치: src/utils/reportImageUtils.ts
 */

import _html2canvas from 'html2canvas';
import type React from 'react';

// 테스트 환경에서 window.html2canvas 주입을 허용 (playwright mock)
function getHtml2canvas(): typeof _html2canvas {
  return (window as unknown as Record<string, unknown>)['html2canvas'] as typeof _html2canvas ?? _html2canvas;
}

// ─── 기존 함수 (유지) ──────────────────────────────────────────────────────
export async function saveReportAsImage(
  elementRef: React.RefObject<HTMLDivElement | null>,
  showName: string
): Promise<void> {
  if (!elementRef.current) return;

  const html2canvas = getHtml2canvas();
  const canvas = await html2canvas(elementRef.current, {
    backgroundColor: '#FFFFFF',
    scale: 2,
    useCORS: true,
    logging: false,
  });

  const link    = document.createElement('a');
  link.download = `stampit-${showName}-report.png`;
  link.href     = canvas.toDataURL('image/png');
  link.click();
}

// ─── 신규: 도장판 공유 카드 저장/공유 ────────────────────────────────────
/**
 * 도장판 공유 카드를 이미지로 변환 후:
 *   - Web Share API 지원 → 공유 시트 오픈 (인스타, 카카오 등)
 *   - 미지원 (데스크탑 등) → 갤러리 저장
 *
 * @param elementRef  캡처할 DOM 요소 ref (화면 밖 위치한 실제 캡처 대상)
 * @param filename    저장 파일명 (확장자 제외)
 */
export async function shareOrSaveBoardImage(
  elementRef: React.RefObject<HTMLDivElement | null>,
  filename: string
): Promise<void> {
  if (!elementRef.current) throw new Error('elementRef is null');

  const html2canvas = getHtml2canvas();
  const canvas = await html2canvas(elementRef.current, {
    backgroundColor: '#ffffff',
    scale: 3,          // 고해상도 (SNS 업로드 품질)
    useCORS: true,
    logging: false,
    // 폰트 렌더링 개선
    onclone: (doc) => {
      const el = doc.body.querySelector('[data-share-card]') as HTMLElement;
      if (el) el.style.display = 'block';
    },
  });

  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob(b => {
      if (b) resolve(b);
      else reject(new Error('toBlob failed'));
    }, 'image/png', 1.0);
  });

  const safeFilename = `stampit-${filename.replace(/[^a-zA-Z0-9가-힣\-_]/g, '-')}.png`;

  // Web Share API 지원 여부 확인 (파일 공유 가능한지)
  if (
    navigator.share &&
    navigator.canShare &&
    navigator.canShare({ files: [new File([blob], safeFilename, { type: 'image/png' })] })
  ) {
    const file = new File([blob], safeFilename, { type: 'image/png' });
    await navigator.share({
      files: [file],
      title: '스탬핏 도장판',
    });
  } else {
    // 폴백: 직접 다운로드
    const url  = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href     = url;
    link.download = safeFilename;
    link.click();
    URL.revokeObjectURL(url);
  }
}
