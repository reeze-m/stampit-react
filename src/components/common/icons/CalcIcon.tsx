export default function CalcIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      {/* 본체 */}
      <rect x="3" y="2" width="14" height="16" rx="3" fill="#4F46E5" />
      {/* 화면 */}
      <rect x="5" y="4" width="10" height="4" rx="1.5" fill="#C7D2FE" />
      {/* 버튼 그리드 3×3 */}
      {[0, 1, 2].map(col =>
        [0, 1, 2].map(row => (
          <rect
            key={`${col}-${row}`}
            x={5 + col * 4}
            y={10 + row * 2.5}
            width="2.5"
            height="1.5"
            rx="0.5"
            fill="white"
            opacity={row === 2 && col === 2 ? 1 : 0.6}
          />
        ))
      )}
    </svg>
  );
}
