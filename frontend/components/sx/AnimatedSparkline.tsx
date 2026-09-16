"use client";

import { useId, useLayoutEffect, useRef } from "react";

// Price is computed from level index — no upper/lower bound
export function levelToPrice(level: number) { return 29.50 + level * 0.50; }

const W = 300;
const H = 80;
const PAD = 6;
// Initial Y window — tight enough that each level step is clearly diagonal.
// Expands at runtime when data goes out of range (see AnimatedSparkline).
const Y_INIT_MIN = 33.00;
const Y_INIT_MAX = 38.50;

function computeY(val: number, yMin: number, yMax: number) {
  return PAD + (1 - (val - yMin) / (yMax - yMin)) * (H - PAD * 2);
}

// Only push to history if the new level differs from the last — prevents horizontal segments
export function pushUniq(h: number[], next: number): number[] {
  if (h.length > 0 && h[h.length - 1] === next) return h;
  return [...h, next];
}

function buildPath(pts: { x: number; y: number }[]) {
  if (pts.length < 2) return '';
  let d = `M${pts[0]!.x.toFixed(1)},${pts[0]!.y.toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    d += ` L${pts[i]!.x.toFixed(1)},${pts[i]!.y.toFixed(1)}`;
  }
  return d;
}

// Line path closed down to the baseline — the fill under the sparkline.
function buildAreaPath(pts: { x: number; y: number }[]) {
  if (pts.length < 2) return '';
  return `${buildPath(pts)} L${pts[pts.length - 1]!.x.toFixed(1)},${H} L${pts[0]!.x.toFixed(1)},${H} Z`;
}

// Chart driven entirely via imperative setAttribute — React never touches `d`.
// useLayoutEffect runs before paint: sets the "from" state synchronously then
// animates X (compression) and Y (scale expansion) together via rAF.
// `areaFill` adds a gradient wash under the line and `glow` a soft halo on the
// stroke + head dot — both opt-in so existing consumers render unchanged.
export function AnimatedSparkline({ history, positive, areaFill = false, glow = false }: {
  history: number[];
  positive: boolean;
  areaFill?: boolean;
  glow?: boolean;
}) {
  const pathRef = useRef<SVGPathElement>(null);
  const areaRef = useRef<SVGPathElement>(null);
  const circleRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const ptsRef = useRef<{ x: number; y: number }[]>([]);
  const yBoundsRef = useRef({ min: Y_INIT_MIN, max: Y_INIT_MAX });
  const uid = useId().replace(/:/g, '');

  const color = positive ? '#04df9d' : '#FF4B4B';

  function setPaths(pts: { x: number; y: number }[]) {
    pathRef.current?.setAttribute('d', buildPath(pts));
    areaRef.current?.setAttribute('d', buildAreaPath(pts));
  }

  function setHead(pts: { x: number; y: number }[]) {
    const c = circleRef.current;
    if (!c || pts.length === 0) return;
    const last = pts[pts.length - 1]!;
    // Position as % of viewBox so the dot is immune to SVG non-uniform scaling
    c.style.left = `${(last.x / W) * 100}%`;
    c.style.top = `${(last.y / H) * 100}%`;
  }

  useLayoutEffect(() => {
    const path = pathRef.current;
    if (!path) return;

    const N = history.length;
    const vals = history.map(lvl => levelToPrice(lvl));

    const dataMin = Math.min(...vals);
    const dataMax = Math.max(...vals);
    const STEP = 0.5;
    const newMin = Math.min(yBoundsRef.current.min, dataMin - STEP);
    const newMax = Math.max(yBoundsRef.current.max, dataMax + STEP);

    const toPts = vals.map((v, i) => ({
      x: N < 2 ? W / 2 : (i / (N - 1)) * W,
      y: computeY(v, newMin, newMax),
    }));

    const prev = ptsRef.current;
    const adding = N > prev.length && prev.length > 0;
    const boundsChanged = newMin < yBoundsRef.current.min || newMax > yBoundsRef.current.max;

    if (prev.length === 0 || (!adding && !boundsChanged) || (!adding && prev.length !== N)) {
      yBoundsRef.current = { min: newMin, max: newMax };
      ptsRef.current = toPts;
      setPaths(toPts);
      setHead(toPts);
      return;
    }

    const fromPts: { x: number; y: number }[] = adding
      ? [...prev, { x: prev[prev.length - 1]!.x, y: toPts[N - 1]!.y }]
      : prev;

    yBoundsRef.current = { min: newMin, max: newMax };
    ptsRef.current = toPts;

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const start = performance.now();
    const duration = 260;

    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const e = 1 - Math.pow(1 - t, 3);
      const interp = fromPts.map((from, i) => ({
        x: from.x + (toPts[i]!.x - from.x) * e,
        y: from.y + (toPts[i]!.y - from.y) * e,
      }));
      setPaths(interp);
      setHead(interp);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };

    setPaths(fromPts);
    setHead(fromPts);
    rafRef.current = requestAnimationFrame(tick);

    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [history]);

  return (
    <>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        width="100%"
        height="100%"
        style={{ display: 'block', overflow: 'visible' }}
      >
        {areaFill && (
          <defs>
            <linearGradient id={`spark-${uid}-pos`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#04df9d" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#04df9d" stopOpacity="0" />
            </linearGradient>
            <linearGradient id={`spark-${uid}-neg`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FF4B4B" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#FF4B4B" stopOpacity="0" />
            </linearGradient>
          </defs>
        )}
        {areaFill && (
          <path
            ref={areaRef}
            stroke="none"
            fill={`url(#spark-${uid}-${positive ? 'pos' : 'neg'})`}
          />
        )}
        <path
          ref={pathRef}
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          style={{
            transition: 'stroke 0.25s ease',
            filter: glow ? `drop-shadow(0 0 5px ${color}66)` : undefined,
          }}
        />
      </svg>
      <div
        ref={circleRef}
        style={{
          position: 'absolute',
          width: '0.3125rem',
          height: '0.3125rem',
          borderRadius: '50%',
          transform: 'translate(-50%, -50%)',
          background: color,
          transition: 'background 0.25s ease, box-shadow 0.25s ease',
          boxShadow: glow ? `0 0 8px 2px ${color}55` : undefined,
          pointerEvents: 'none',
        }}
      />
    </>
  );
}
