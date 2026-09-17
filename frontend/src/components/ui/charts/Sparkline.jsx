// Decorative trend line for a stat tile: 2px line, ~10% area wash, and the
// current (last) point picked out as an accent dot. Bare stat-tile sparklines
// are exempt from hover/tooltip per dataviz interaction rules.
function Sparkline({ values, color = '#16a34a', height = 40 }) {
  const width = 120;
  const padding = 4;

  if (!values?.length) return null;

  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;

  const points = values.map((v, i) => {
    const x = padding + (i / (values.length - 1 || 1)) * (width - padding * 2);
    const y = height - padding - ((v - min) / range) * (height - padding * 2);
    return [x, y];
  });

  const linePath = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x} ${y}`).join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1][0]} ${height} L ${points[0][0]} ${height} Z`;
  const [lastX, lastY] = points[points.length - 1];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-10 w-full"
      preserveAspectRatio="none"
      role="presentation"
    >
      <path d={areaPath} fill={color} opacity="0.1" />
      <path d={linePath} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lastX} cy={lastY} r="4" fill={color} stroke="white" strokeWidth="2" />
    </svg>
  );
}

export default Sparkline;
