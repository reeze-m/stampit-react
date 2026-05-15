import html2canvas from 'html2canvas';

export async function saveReportAsImage(
  elementRef: React.RefObject<HTMLDivElement | null>,
  showName: string
): Promise<void> {
  if (!elementRef.current) return;

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
