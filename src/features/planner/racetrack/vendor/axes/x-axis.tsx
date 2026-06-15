import { memo, useMemo } from 'react';
import { RaceTrackDimensions } from '../types';

const barHeight = RaceTrackDimensions.xAxisHeight;
const barWidth = RaceTrackDimensions.RenderWidth;
const sectionY = RaceTrackDimensions.xAxisY;
const sectionX = RaceTrackDimensions.xOffset;

/** d3.scaleLinear().ticks()-style "nice" round ticks, dependency-free. */
function niceTicks(max: number, count = 10): number[] {
  if (max <= 0) return [0];
  const raw = max / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm >= 5 ? 10 : norm >= 2 ? 5 : norm >= 1 ? 2 : 1) * mag;
  const ticks: number[] = [];
  for (let t = 0; t <= max + 1e-9; t += step) ticks.push(Math.round(t));
  return ticks;
}

type XAxisProps = { courseDistance: number };

export const XAxis = memo<XAxisProps>(function XAxis({ courseDistance }) {
  const ticks = useMemo(() => niceTicks(courseDistance), [courseDistance]);
  const scale = (v: number) => (v / courseDistance) * barWidth;
  return (
    <svg id="racetrack-x-axis" x={sectionX} y={sectionY} width={barWidth} height={barHeight} overflow="visible">
      <line x1={0} x2={barWidth} y1={0} y2={0} stroke="var(--color-foreground)" />
      {ticks.map((tick) => (
        <g key={tick} transform={`translate(${scale(tick)},0)`}>
          <line y2={6} stroke="var(--color-foreground)" />
          <text y={15} textAnchor="middle" fontSize={10} fill="var(--color-foreground)">
            {tick}
          </text>
        </g>
      ))}
    </svg>
  );
});
