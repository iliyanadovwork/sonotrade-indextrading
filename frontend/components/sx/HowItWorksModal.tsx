"use client";

import { useEffect, useCallback, useState, useRef } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { CSXText } from "@/components/sx/core/CSXText";
import NumberFlow from '@number-flow/react';
import { supabaseImage } from '@/lib/supabaseImage'
import { AnimatedSparkline, levelToPrice, pushUniq } from '@/components/sx/AnimatedSparkline'

const START_LEVEL = 17; // matches last SEED point
// Entry levels for the 4 demo positions on slide 4
const ENTRIES = [
  { label: 'Up position',   level: 3 }, // $3.50
  { label: 'Up position',   level: 4 }, // $4.00
  { label: 'Down position', level: 9 }, // $6.50 — short, profitable when price < entry
  { label: 'Up position',   level: 5 }, // $4.50
];

// Pre-seeded initial history so the chart starts with a shape
const SEED: number[] = [8, 7, 6, 7, 8, 9, 10, 9, 10, 11, 12, 11, 10, 11, 12, 13, 14, 15, 14, 15, 16, 17];

const DRAKE_IMG = "https://iawngxubkakulvrqvxal.supabase.co/storage/v1/object/public/profile-photos/drake-b06467174add.webp";

const SLIDES = [
  "The cultural relevance of your favorite people, tracked real time.",
  "Trade up or down. Each trade moves the price a tiny bit.",
  "Enough traders, and the price reflects public opinion.",
  "Close your position anytime to cash out.",
];

export default function HowItWorksModal() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const open = searchParams.get("how") === "open";

  const [shouldRender, setShouldRender] = useState(open);
  const [visible, setVisible] = useState(false);
  const [slide, setSlide] = useState(1);

  const [history, setHistory] = useState<number[]>(SEED);
  const [currentLevel, setCurrentLevel] = useState(START_LEVEL);

  const [closed, setClosed] = useState([false, false, false, false]);
  const [profit, setProfit] = useState([false, false, false, false]);

  const [slideVisible, setSlideVisible] = useState(true);
  const [pressDirection, setPressDirection] = useState(true); // true = up/green, false = down/red
  const [traderCount, setTraderCount] = useState(1180);
  const [hoveredBtn, setHoveredBtn] = useState<'up' | 'down' | null>(null);
  const levelRef = useRef(START_LEVEL);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [particles, setParticles] = useState<{ id: number; x: number; y: number; dir: 'up' | 'down'; delay: number }[]>([]);
  const particleIdRef = useRef(0);

  function spawnParticles(dir: 'up' | 'down') {
    const N = 3;
    setParticles(prev => [
      ...prev.slice(-12),
      ...Array.from({ length: N }, (_, i) => ({
        id: particleIdRef.current++,
        x: 82 + Math.random() * 14,   // cluster near the right tip
        y: 15 + Math.random() * 45,
        dir,
        delay: i * 45,
      })),
    ]);
  }

  function removeParticle(id: number) {
    setParticles(prev => prev.filter(p => p.id !== id));
  }

  function applyTick(dir: 'up' | 'down') {
    const next = dir === 'up' ? levelRef.current + 1 : levelRef.current - 1;
    levelRef.current = next;
    setCurrentLevel(next);
    setHistory(h => pushUniq(h, next));
    setPressDirection(dir === 'up');
    spawnParticles(dir);
  }

  function resetChart() {
    levelRef.current = START_LEVEL;
    setHistory(SEED);
    setCurrentLevel(START_LEVEL);
    setClosed([false, false, false, false]);
    setProfit([false, false, false, false]);
    setPressDirection(true);
  }

  /* eslint-disable react-hooks/set-state-in-effect --
     Synchronises modal visibility with query-param. Same pattern as AuthModal. */
  useEffect(() => {
    if (open) {
      setShouldRender(true);
      setSlide(1);
      resetChart();
      setSlideVisible(true);
      requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
    } else {
      setVisible(false);
      const t = setTimeout(() => setShouldRender(false), 80);
      return () => clearTimeout(t);
    }
  }, [open]);
  /* eslint-enable react-hooks/set-state-in-effect */

  /* eslint-disable react-hooks/set-state-in-effect --
     Slide 3 continues from slide 2 — no reset, just starts auto-simulation + auto-advance. */
  useEffect(() => {
    if (slide !== 3) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    // Seed trader count fresh each time slide 3 mounts
    let count = 1180 + Math.floor(Math.random() * 60);
    setTraderCount(count);

    intervalRef.current = setInterval(() => {
      const atMin = levelRef.current <= 1;
      const goUp = atMin ? true : Math.random() > 0.5;
      applyTick(goUp ? 'up' : 'down');
      count += 2 + Math.floor(Math.random() * 5);
      setTraderCount(count);
    }, 700);

    const autoAdvance = setTimeout(() => {
      setSlideVisible(false);
      setTimeout(() => {
        setClosed([false, false, false, false]);
        setProfit([false, false, false, false]);
        setSlide(4);
        setSlideVisible(true);
      }, 160);
    }, 10000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      clearTimeout(autoAdvance);
    };
  }, [slide]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const close = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("how");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [router, pathname, searchParams]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, close]);

  function pressUp() { applyTick('up'); }
  function pressDown() { applyTick('down'); }

  function closePosition(i: number) {
    setClosed(prev => prev.map((v, j) => j === i ? true : v));
    setTimeout(() => setProfit(prev => prev.map((v, j) => j === i ? true : v)), 150);
  }

  function goNext() {
    if (slide === 4) { close(); return; }
    setSlideVisible(false);
    setTimeout(() => {
      if (slide !== 2) resetChart();
      setSlide(s => s + 1);
      setSlideVisible(true);
    }, 160);
  }


  if (!shouldRender) return null;

  const currentPrice = levelToPrice(currentLevel);
  const isPositive = pressDirection;
  const positions = ENTRIES.map(e => {
    const entryPrice = levelToPrice(e.level);
    const pnl = currentPrice - entryPrice;
    return { ...e, entryPrice, pnl };
  });

  return (
    <>
    <style>{`
      @keyframes sparkleUp {
        0%   { transform: translateY(0)     scale(1);   opacity: 0.55; }
        100% { transform: translateY(-16px) scale(0.4); opacity: 0; }
      }
      @keyframes sparkleDown {
        0%   { transform: translateY(0)    scale(1);   opacity: 0.55; }
        100% { transform: translateY(16px) scale(0.4); opacity: 0; }
      }
    `}</style>
    <div
      className="flex fixed inset-0 z-[1100] items-center justify-center px-4 py-8"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{
          backgroundColor: "rgba(0,0,0,0.90)",
          opacity: visible ? 1 : 0,
          transition: "opacity 200ms ease",
        }}
        onClick={close}
      />

      {/* Card */}
      <div
        className="w-full max-w-[26.25rem] relative"
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0)" : "translateY(6px)",
          transition: "opacity 80ms ease, transform 80ms ease",
        }}
      >
        <div className="relative w-full overflow-hidden rounded-xl border border-st-border bg-st-black px-6 pb-8 pt-10 shadow-xl flex flex-col gap-6">

          {/* Close button */}
          <button
            onClick={close}
            className="absolute right-4 top-4 z-20 leading-none text-st-secondary transition-colors hover:text-white"
            aria-label="Close"
            type="button"
          >
            <CSXText variant="title">×</CSXText>
          </button>

          {/* ── Everything above the Next button fades between slides ── */}
          <div style={{ opacity: slideVisible ? 1 : 0, transition: 'opacity 0.16s ease', display: 'flex', flexDirection: 'column', gap: '2rem' }}>

          {/* ── Indicator dots ── */}
          <div className="flex items-center gap-1.5 justify-center">
            {SLIDES.map((_, i) => (
              <div
                key={i}
                className="h-1 rounded-full transition-all duration-300"
                style={{
                  width: i + 1 === slide ? 20 : 6,
                  backgroundColor: i + 1 === slide ? 'white' : 'var(--st-border-strong)',
                }}
              />
            ))}
          </div>

          {/* ── Mini profile pill + chart (hidden on slide 4) ── */}
          {slide !== 4 && (
            <>
              <div className="flex items-center gap-3 mx-auto">
                <img src={supabaseImage(DRAKE_IMG, 96)} alt="Drake" className="h-9 w-9 flex-shrink-0 select-none rounded-full object-cover" style={{ minWidth: '2.25rem', minHeight: '2.25rem' }} draggable={false} loading="lazy" />
                <span className="text-white font-normal leading-normal tracking-[-0.025em]" style={{ fontSize: '1.25rem' }}>Drake&apos;s Sentiment</span>
              </div>
              <NumberFlow
                value={currentPrice}
                prefix="$"
                format={{ minimumFractionDigits: 2, maximumFractionDigits: 2 }}
                className="font-mono text-3xl font-bold tabular-nums text-center block"
                style={{ color: isPositive ? '#04df9d' : '#FF4B4B', transition: 'color 0.25s ease' }}
              />
              <div style={{ height: '8.75rem', position: 'relative' }} className="mx-6">
                <AnimatedSparkline history={history} positive={isPositive} />
                {particles.map(p => (
                  <div
                    key={p.id}
                    onAnimationEnd={() => removeParticle(p.id)}
                    style={{
                      position: 'absolute',
                      left: `${p.x}%`,
                      top: `${p.y}%`,
                      animationName: p.dir === 'up' ? 'sparkleUp' : 'sparkleDown',
                      animationDuration: '0.5s',
                      animationDelay: `${p.delay}ms`,
                      animationTimingFunction: 'ease-out',
                      animationFillMode: 'forwards',
                      pointerEvents: 'none',
                      color: p.dir === 'up' ? '#04df9d' : '#FF4B4B',
                      lineHeight: 1,
                      userSelect: 'none',
                    }}
                  >
                    {p.dir === 'up' ? (
                      <svg xmlns="http://www.w3.org/2000/svg" width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/>
                      </svg>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Slide 3: traders preview — same position as Up/Down buttons */}
          {slide === 3 && (
            <div className="flex items-center gap-1.5 mx-auto">
              <svg width="13" height="13" viewBox="0 0 22 26" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <circle cx="11" cy="7" r="5" fill="white"/>
                <path d="M1 24c0-5.5 4-9 10-9s10 3.5 10 9" fill="white"/>
              </svg>
              <NumberFlow
                value={traderCount}
                format={{ useGrouping: true }}
                className="text-white text-sm tabular-nums"
              />
              <span className="text-white text-sm"> traders</span>
            </div>
          )}

          {/* Slide 2: Up / Down buttons — compact pills, centered, no wider than the Drake pill */}
          {slide === 2 && (
            <div className="flex gap-2 mx-auto w-fit">
              <button
                onClick={pressUp}
                onMouseEnter={() => setHoveredBtn('up')}
                onMouseLeave={() => setHoveredBtn(null)}
                className="flex items-center justify-center gap-1.5 rounded-full border px-6 py-2.5 text-sm font-semibold tracking-[-0.015em] transition-all duration-150 active:scale-[0.97]"
                style={{
                  background: hoveredBtn === 'up' ? 'rgba(4,223,157,0.07)' : 'transparent',
                  borderColor: hoveredBtn === 'up' ? 'rgba(4,223,157,0.28)' : 'rgba(4,223,157,0.18)',
                  color: hoveredBtn === 'up' ? 'rgba(4,223,157,0.8)' : 'rgba(4,223,157,0.55)',
                  minWidth: '5.625rem',
                }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>
                </svg>
                Up
              </button>
              <button
                onClick={pressDown}
                onMouseEnter={() => setHoveredBtn('down')}
                onMouseLeave={() => setHoveredBtn(null)}
                className="flex items-center justify-center gap-1.5 rounded-full border px-6 py-2.5 text-sm font-semibold tracking-[-0.015em] transition-all duration-150 active:scale-[0.97]"
                style={{
                  background: hoveredBtn === 'down' ? 'rgba(239,68,68,0.07)' : 'transparent',
                  borderColor: hoveredBtn === 'down' ? 'rgba(239,68,68,0.28)' : 'rgba(239,68,68,0.18)',
                  color: hoveredBtn === 'down' ? 'rgba(239,68,68,0.8)' : 'rgba(239,68,68,0.55)',
                  minWidth: '5.625rem',
                }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/>
                </svg>
                Down
              </button>
            </div>
          )}

          {/* Slide 4: 4 position rows */}
          {slide === 4 && (
            <div className="flex flex-col gap-2">
              {positions.map((pos, i) => (
                !closed[i] ? (
                  <button
                    key={i}
                    onClick={() => closePosition(i)}
                    className="w-full flex items-center justify-between rounded-lg px-3 py-2.5 text-left transition-opacity active:opacity-70"
                    style={{ backgroundColor: 'transparent', border: '1px solid var(--st-border)' }}
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="text-white text-xs font-medium">{pos.label}</span>
                      <span className="text-st-secondary text-xs">Entry ${pos.entryPrice.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs font-bold tabular-nums" style={{ color: pos.pnl >= 0 ? '#04df9d' : '#FF4B4B' }}>
                        {pos.pnl >= 0 ? '+' : ''}${pos.pnl.toFixed(2)}
                      </span>
                      <span className="text-xs text-st-secondary border border-st-border rounded px-2 py-0.5">Close</span>
                    </div>
                  </button>
                ) : (
                  <div
                    key={i}
                    className="relative w-full flex items-center justify-between rounded-lg px-3 py-2.5"
                    style={{
                      opacity: profit[i] ? 1 : 0,
                      transform: profit[i] ? 'translateY(0)' : 'translateY(3px)',
                      transition: 'opacity 200ms ease, transform 200ms ease',
                      backgroundColor: 'rgba(4,223,157,0.08)',
                      border: '1px solid rgba(4,223,157,0.2)',
                    }}
                  >
                    {/* Invisible ghost — forces same height as the open position button */}
                    <div className="flex flex-col gap-0.5 invisible" aria-hidden="true">
                      <span className="text-xs font-medium">x</span>
                      <span className="text-xs">x</span>
                    </div>
                    <span className="absolute inset-0 flex items-center justify-center text-[#04df9d] text-sm font-mono font-bold tabular-nums">
                      {pos.pnl >= 0 ? '+' : ''}${pos.pnl.toFixed(2)} cashed out
                    </span>
                  </div>
                )
              ))}
            </div>
          )}

          <p className="font-sans text-sm font-medium leading-normal tracking-[-0.025em] text-white text-center px-2">
            {SLIDES[slide - 1]}
          </p>

          </div>{/* end fade wrapper */}

          <button
            onClick={goNext}
            className="w-full bg-white rounded-full text-black text-sm font-semibold py-3 hover:opacity-90 active:scale-[0.98] transition-all duration-75"
          >
            {slide === 4 ? 'Done' : 'Next'}
          </button>

        </div>
      </div>
    </div>
    </>
  );
}
