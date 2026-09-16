import React, { useEffect, useRef } from 'react';

interface SpinnerProps {
  size?: number;
  strokeWidth?: number;
  cycleDurationMs?: number;
}

const KF_ID = 'sonotrade-spinner-kf';
const KF_CSS = `@keyframes sonotrade-spin{to{transform:rotate(360deg)}}`;

function ensureKeyframes() {
  if (typeof document === 'undefined' || document.getElementById(KF_ID)) return;
  const s = document.createElement('style');
  s.id = KF_ID;
  s.textContent = KF_CSS;
  document.head.appendChild(s);
}

export function Spinner({ size = 24, strokeWidth = 2, cycleDurationMs = 800 }: SpinnerProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    ensureKeyframes();
  }, []);

  const r = (size - strokeWidth * 2) / 2;
  const cx = size / 2;
  const circumference = 2 * Math.PI * r;
  const dashLen = circumference * 0.75;

  return (
    <svg
      ref={svgRef}
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{
        display: 'block',
        flexShrink: 0,
        animation: `sonotrade-spin ${cycleDurationMs}ms linear infinite`,
        willChange: 'transform',
      }}
    >
      <circle
        cx={cx}
        cy={cx}
        r={r}
        fill="none"
        stroke="#ffffff"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={`${dashLen} ${circumference - dashLen}`}
      />
    </svg>
  );
}
