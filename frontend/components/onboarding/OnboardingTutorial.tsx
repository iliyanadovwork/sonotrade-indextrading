"use client";

import { useEffect, useCallback, useState, useRef } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { CSXText } from "@/components/sx/core/CSXText";
import NumberFlow from '@number-flow/react';
import { supabaseImage } from '@/lib/supabaseImage';
import { AnimatedSparkline, levelToPrice, pushUniq } from '@/components/sx/AnimatedSparkline';
import { useAuth } from '@/components/auth/AuthProvider';

// Shown once per browser, on the first page view after auth settles.
// localStorage gate follows the existing convention (`pauv:savedMarkets`);
// there is no per-user flag column, so a new device shows it again — by design.
// `?onboarding=open` force-opens it regardless of auth or the seen flag
// (preview/QA — same convention as HowItWorksModal's `?how=open`); closing
// that mode only removes the param and never marks the tutorial as seen.
const SEEN_KEY = 'sonotrade:onboarding-seen';

const START_LEVEL = 17; // matches last SEED point
// Pre-seeded initial history so the chart starts with a shape
const SEED: number[] = [8, 7, 6, 7, 8, 9, 10, 9, 10, 11, 12, 11, 10, 11, 12, 13, 14, 15, 14, 15, 16, 17];

const DEMO_CONTRACTS = 10;
// Once a demo position is open, the index trends in the story's direction and
// stops this many levels past entry so the chart stays on scale.
const AUTO_DRIFT_LEVELS = 6;
// If the user hasn't opened the demo position themselves, open it for them so
// the slide still animates hands-free.
const AUTO_OPEN_MS = 1600;

const DRAKE_IMG = "https://iawngxubkakulvrqvxal.supabase.co/storage/v1/object/public/profile-photos/drake-b06467174add.webp";

const HEADLINES = [
  "Artists, priced live.",
  "Think they're blowing up?",
  "Overhyped?",
  "Cash out anytime.",
];
const SUBS = [
  "Every artist has a live index driven by their real streaming numbers. Streams climb, the index climbs.",
  "Go long. As their streams rise, your P&L rises with them.",
  "Go short. The index falls — your P&L still grows.",
  "Close a position and the P&L lands in your balance. You start with $1,000.",
];

type DemoRow = { side: 'long' | 'short'; entryLevel: number };

export default function OnboardingTutorial() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, loading } = useAuth();
  const previewOpen = searchParams.get('onboarding') === 'open';

  const [shouldRender, setShouldRender] = useState(false);
  const [visible, setVisible] = useState(false);
  const [slide, setSlide] = useState(1);
  const [slideVisible, setSlideVisible] = useState(true);

  const [history, setHistory] = useState<number[]>(SEED);
  const [currentLevel, setCurrentLevel] = useState(START_LEVEL);
  const [entryLevel, setEntryLevel] = useState(START_LEVEL);
  const [positionOpen, setPositionOpen] = useState(false);
  const [pressDirection, setPressDirection] = useState(true); // true = up/green, false = down/red

  const [rows, setRows] = useState<DemoRow[]>([]);
  const [closedRows, setClosedRows] = useState<boolean[]>([]);
  const [cashedRows, setCashedRows] = useState<boolean[]>([]);

  const levelRef = useRef(START_LEVEL);
  const entryRef = useRef(START_LEVEL);
  const positionOpenRef = useRef(false);
  const dismissedRef = useRef(false);
  const [particles, setParticles] = useState<{ id: number; x: number; y: number; dir: 'up' | 'down'; delay: number }[]>([]);
  const particleIdRef = useRef(0);

  const spawnParticles = useCallback((dir: 'up' | 'down') => {
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
  }, []);

  function removeParticle(id: number) {
    setParticles(prev => prev.filter(p => p.id !== id));
  }

  const applyTick = useCallback((dir: 'up' | 'down') => {
    const next = dir === 'up' ? levelRef.current + 1 : levelRef.current - 1;
    levelRef.current = next;
    setCurrentLevel(next);
    setHistory(h => pushUniq(h, next));
    setPressDirection(dir === 'up');
    spawnParticles(dir);
  }, [spawnParticles]);

  // Opening the demo position marks the entry — it does NOT move the index;
  // the index only follows the (simulated) streaming data.
  const openDemoPosition = useCallback(() => {
    if (positionOpenRef.current) return;
    positionOpenRef.current = true;
    entryRef.current = levelRef.current;
    setEntryLevel(levelRef.current);
    setPositionOpen(true);
  }, []);

  const openedViaParamRef = useRef(false);

  /* eslint-disable react-hooks/set-state-in-effect --
     Synchronises modal visibility with the `?onboarding=open` preview param.
     Same pattern as HowItWorksModal's `?how=open`. */
  useEffect(() => {
    if (previewOpen) {
      openedViaParamRef.current = true;
      levelRef.current = START_LEVEL;
      entryRef.current = START_LEVEL;
      positionOpenRef.current = false;
      setHistory(SEED);
      setCurrentLevel(START_LEVEL);
      setEntryLevel(START_LEVEL);
      setPositionOpen(false);
      setSlide(1);
      setSlideVisible(true);
      setShouldRender(true);
      requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
    } else if (openedViaParamRef.current) {
      openedViaParamRef.current = false;
      setVisible(false);
      const t = setTimeout(() => setShouldRender(false), 80);
      return () => clearTimeout(t);
    }
  }, [previewOpen]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // First-login gate: opens the tutorial once per browser after auth settles.
  // Waits out the sign-up page and the mobile auth modal (`?auth=`) so it
  // appears where the user lands, not over the login flow.
  useEffect(() => {
    if (loading || !user || dismissedRef.current) return;
    if (pathname === '/sign-up' || pathname === '/sign-in') return;
    if (searchParams.get('auth') || searchParams.get('how') === 'open') return;
    if (searchParams.get('onboarding') === 'open') return; // preview effect owns it
    try {
      if (localStorage.getItem(SEEN_KEY)) return;
    } catch {
      return; // storage unavailable — never show rather than show forever
    }
    const t = setTimeout(() => {
      setShouldRender(true);
      requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
    }, 600);
    return () => clearTimeout(t);
  }, [user, loading, pathname, searchParams]);

  // The index drifts on its own — it tracks streaming data, so it moves with
  // or without the user. Slide 1 wanders; on slides 2/3, once the demo
  // position is open the streams trend the story's way (up for the long,
  // down for the short) so the P&L visibly grows.
  useEffect(() => {
    if (!shouldRender || slide === 4) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const iv = setInterval(() => {
      if (slide === 1) {
        // Strong up-bias: the welcome slide should read green almost always
        const goUp = levelRef.current <= 2 ? true : Math.random() > 0.25;
        applyTick(goUp ? 'up' : 'down');
      } else if (!positionOpenRef.current) {
        // No position yet — idle wiggle, streams neither hot nor cold.
        const goUp = levelRef.current <= 2 ? true : Math.random() > 0.5;
        applyTick(goUp ? 'up' : 'down');
      } else if (slide === 2) {
        if (levelRef.current - entryRef.current < AUTO_DRIFT_LEVELS) applyTick('up');
      } else if (slide === 3) {
        if (entryRef.current - levelRef.current < AUTO_DRIFT_LEVELS && levelRef.current > 1) applyTick('down');
      }
    }, slide === 1 ? 1100 : 900);
    return () => clearInterval(iv);
  }, [slide, shouldRender, applyTick]);

  // Hands-free fallback: open the demo position if the user just watches.
  useEffect(() => {
    if (!shouldRender || (slide !== 2 && slide !== 3)) return;
    const t = setTimeout(openDemoPosition, AUTO_OPEN_MS);
    return () => clearTimeout(t);
  }, [slide, shouldRender, openDemoPosition]);

  const close = useCallback(() => {
    if (openedViaParamRef.current) {
      // Preview mode — drop the param (the sync effect unmounts) and leave
      // the first-login seen flag untouched.
      const params = new URLSearchParams(searchParams.toString());
      params.delete('onboarding');
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      return;
    }
    dismissedRef.current = true;
    try { localStorage.setItem(SEEN_KEY, '1'); } catch { /* private mode — dismissedRef still gates this session */ }
    setVisible(false);
    setTimeout(() => setShouldRender(false), 80);
  }, [router, pathname, searchParams]);

  useEffect(() => {
    if (!shouldRender) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [shouldRender, close]);

  function goToSlide(next: number) {
    setSlideVisible(false);
    setTimeout(() => {
      if (next === 2 || next === 3) {
        // Each demo starts flat — the position opens on the button press
        // (or hands-free after AUTO_OPEN_MS).
        positionOpenRef.current = false;
        setPositionOpen(false);
      }
      if (next === 4) {
        // Fresh demo positions relative to wherever the chart ended up —
        // both in profit so "cash out" lands the point.
        const cur = levelRef.current;
        setRows([
          { side: 'long', entryLevel: cur - 5 },
          { side: 'short', entryLevel: cur + 4 },
          { side: 'long', entryLevel: cur - 2 },
        ]);
        setClosedRows([false, false, false]);
        setCashedRows([false, false, false]);
      }
      setSlide(next);
      setSlideVisible(true);
    }, 160);
  }

  function goNext() {
    if (slide === 4) { close(); return; }
    goToSlide(slide + 1);
  }

  function closeRow(i: number) {
    setClosedRows(prev => prev.map((v, j) => j === i ? true : v));
    setTimeout(() => setCashedRows(prev => prev.map((v, j) => j === i ? true : v)), 150);
  }

  if (!shouldRender) return null;

  const currentPrice = levelToPrice(currentLevel);
  const entryPrice = levelToPrice(entryLevel);
  const isPositive = pressDirection;
  const demoSide: 'long' | 'short' = slide === 3 ? 'short' : 'long';
  const demoPnl = (demoSide === 'long' ? currentPrice - entryPrice : entryPrice - currentPrice) * DEMO_CONTRACTS;

  const rowPnl = (row: DemoRow) => {
    const entry = levelToPrice(row.entryLevel);
    return (row.side === 'long' ? currentPrice - entry : entry - currentPrice) * DEMO_CONTRACTS;
  };

  return (
    <>
    <style>{`
      @keyframes onboardingSparkleUp {
        0%   { transform: translateY(0)     scale(1);   opacity: 0.55; }
        100% { transform: translateY(-16px) scale(0.4); opacity: 0; }
      }
      @keyframes onboardingSparkleDown {
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
          backgroundColor: "rgba(0,0,0,0.85)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          opacity: visible ? 1 : 0,
          transition: "opacity 200ms ease",
        }}
        onClick={close}
      />

      {/* Card */}
      <div
        className="w-full max-w-[420px] relative"
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0)" : "translateY(6px)",
          transition: "opacity 80ms ease, transform 80ms ease",
        }}
      >
        <div className="relative w-full overflow-hidden rounded-2xl border border-st-border bg-st-black px-6 pb-8 pt-10 shadow-2xl flex flex-col gap-6">

          {/* Close button */}
          <button
            onClick={close}
            className="absolute right-4 top-4 z-20 leading-none text-st-secondary transition-colors hover:text-white"
            aria-label="Close"
            type="button"
          >
            <CSXText variant="title">×</CSXText>
          </button>

          {/* ── Everything above the Next button slides + fades between steps ── */}
          <div style={{
            opacity: slideVisible ? 1 : 0,
            transform: slideVisible ? 'translateX(0)' : 'translateX(14px)',
            transition: 'opacity 0.22s ease, transform 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
            display: 'flex', flexDirection: 'column', gap: 26,
          }}>

          {/* ── Indicator dots ── */}
          <div className="flex items-center gap-1.5 justify-center">
            {HEADLINES.map((_, i) => (
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

          {/* ── Mini profile pill + chart (hidden on the cash-out slide) ── */}
          {slide !== 4 && (
            <>
              <div className="flex items-center gap-3 mx-auto">
                <img src={supabaseImage(DRAKE_IMG, 96)} alt="Drake" className="h-9 w-9 flex-shrink-0 select-none rounded-full object-cover" style={{ minWidth: 36, minHeight: 36 }} draggable={false} loading="lazy" />
                <span className="text-white font-normal leading-normal tracking-[-0.025em]" style={{ fontSize: '1.25rem' }}>Drake</span>
                <span className="flex items-center gap-1.5 rounded-full border border-st-border px-2.5 py-1">
                  <span
                    className="h-1.5 w-1.5 rounded-full animate-pulse"
                    style={{ backgroundColor: isPositive ? '#04df9d' : '#FF4B4B', transition: 'background-color 0.25s ease' }}
                  />
                  <span className="text-[10px] font-semibold tracking-[0.08em] text-st-secondary select-none">LIVE</span>
                </span>
              </div>
              <NumberFlow
                value={currentPrice}
                prefix="$"
                format={{ minimumFractionDigits: 2, maximumFractionDigits: 2 }}
                className="font-sans text-[28px] font-semibold tracking-[-0.02em] tabular-nums text-center block leading-none"
                style={{ color: isPositive ? '#04df9d' : '#FF4B4B', transition: 'color 0.25s ease' }}
              />
              <div style={{ height: 120, position: 'relative' }} className="mx-6">
                {/* Ambient glow behind the chart, tinted by direction */}
                <div
                  aria-hidden
                  style={{
                    position: 'absolute',
                    inset: '-30% -10%',
                    background: `radial-gradient(ellipse at center, ${isPositive ? 'rgba(4,223,157,0.14)' : 'rgba(255,75,75,0.12)'} 0%, transparent 70%)`,
                    filter: 'blur(20px)',
                    transition: 'background 0.4s ease',
                    pointerEvents: 'none',
                  }}
                />
                <AnimatedSparkline history={history} positive={isPositive} areaFill glow />
                {particles.map(p => (
                  <div
                    key={p.id}
                    onAnimationEnd={() => removeParticle(p.id)}
                    style={{
                      position: 'absolute',
                      left: `${p.x}%`,
                      top: `${p.y}%`,
                      animationName: p.dir === 'up' ? 'onboardingSparkleUp' : 'onboardingSparkleDown',
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

          {/* ── Slides 2 + 3: mini trading panel mirroring SXTradingPanel ── */}
          {(slide === 2 || slide === 3) && (
            <div className="bg-[#131313] rounded-2xl p-5 flex flex-col gap-4">
              {/* Long/Short toggle — same treatment as the real panel; tapping
                  the inactive side hops to that side's slide */}
              <div className="flex gap-4">
                <button
                  onClick={() => { if (slide !== 2) goToSlide(2); }}
                  className="px-0 rounded-full text-[1.25rem] leading-none transition-colors"
                  style={{ fontFamily: 'var(--font-geist-sans)', color: demoSide === 'long' ? 'var(--st-chart-positive)' : '#5c5c5c' }}
                >
                  Long
                </button>
                <button
                  onClick={() => { if (slide !== 3) goToSlide(3); }}
                  className="px-0 rounded-full text-[1.25rem] leading-none transition-colors"
                  style={{ fontFamily: 'var(--font-geist-sans)', color: demoSide === 'short' ? 'var(--st-chart-negative)' : '#5c5c5c' }}
                >
                  Short
                </button>
              </div>

              <div className="flex items-center justify-between" style={{ minHeight: 26 }}>
                <p className="text-xs" style={{ fontFamily: 'var(--font-geist-sans)', color: 'var(--st-secondary)' }}>
                  {positionOpen
                    ? `${DEMO_CONTRACTS} contracts · entry $${entryPrice.toFixed(2)}`
                    : `1 contract ≈ $${currentPrice.toFixed(2)}`}
                </p>
                {positionOpen && (
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-3 py-1 text-xs ${demoSide === 'long'
                      ? 'bg-st-chart-positive/10 text-st-chart-positive'
                      : 'bg-st-chart-negative/10 text-st-chart-negative'}`}>
                      {demoSide.toUpperCase()}
                    </span>
                    <NumberFlow
                      value={demoPnl}
                      format={{ style: 'currency', currency: 'USD', signDisplay: 'always' }}
                      className="font-mono text-sm font-bold tabular-nums"
                      style={{ color: demoPnl >= 0 ? '#04df9d' : '#FF4B4B', transition: 'color 0.25s ease' }}
                    />
                  </div>
                )}
              </div>

              <button
                onClick={openDemoPosition}
                disabled={positionOpen}
                className="w-full bg-[#FFFFFF] rounded-full text-black text-[16px] py-3 hover:opacity-90 active:scale-95 transition-all duration-75 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ fontFamily: 'var(--font-geist-sans)' }}
              >
                {positionOpen ? 'Position open' : `Place ${demoSide} order`}
              </button>
            </div>
          )}

          {/* ── Slide 4: position rows → cash out ── */}
          {slide === 4 && (
            <div className="flex flex-col gap-2">
              {rows.map((row, i) => {
                const pnl = rowPnl(row);
                return !closedRows[i] ? (
                  <button
                    key={i}
                    onClick={() => closeRow(i)}
                    className="w-full flex items-center justify-between rounded-lg px-3 py-2.5 text-left transition-opacity active:opacity-70"
                    style={{ backgroundColor: 'transparent', border: '1px solid var(--st-border)' }}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`rounded-full px-3 py-1 text-xs ${row.side === 'long'
                        ? 'bg-st-chart-positive/10 text-st-chart-positive'
                        : 'bg-st-chart-negative/10 text-st-chart-negative'}`}>
                        {row.side.toUpperCase()}
                      </span>
                      <span className="text-st-secondary text-xs">Entry ${levelToPrice(row.entryLevel).toFixed(2)}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs font-bold tabular-nums" style={{ color: pnl >= 0 ? '#04df9d' : '#FF4B4B' }}>
                        {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}
                      </span>
                      <span className="text-xs text-st-secondary border border-st-border rounded px-2 py-0.5">Close</span>
                    </div>
                  </button>
                ) : (
                  <div
                    key={i}
                    className="relative w-full flex items-center justify-between rounded-lg px-3 py-2.5"
                    style={{
                      opacity: cashedRows[i] ? 1 : 0,
                      transform: cashedRows[i] ? 'translateY(0)' : 'translateY(3px)',
                      transition: 'opacity 200ms ease, transform 200ms ease',
                      backgroundColor: 'rgba(4,223,157,0.08)',
                      border: '1px solid rgba(4,223,157,0.2)',
                    }}
                  >
                    {/* Invisible ghost — forces same height as the open position button */}
                    <div className="flex items-center gap-3 invisible" aria-hidden="true">
                      <span className="rounded-full px-3 py-1 text-xs">x</span>
                    </div>
                    <span className="absolute inset-0 flex items-center justify-center text-[#04df9d] text-sm font-mono font-bold tabular-nums">
                      {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)} cashed out
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Real-money teaser, final slide only ── */}
          {slide === 4 && (
            <div className="mx-auto flex items-center rounded-full border border-st-border px-4 py-1.5">
              <span className="header-rainbow-text text-[11px] font-semibold uppercase tracking-[0.08em] select-none">
                Real money — coming soon
              </span>
            </div>
          )}

          <div className="flex flex-col gap-1.5 px-2">
            <p className="font-sans text-[1.25rem] font-semibold leading-tight tracking-[-0.025em] text-white text-center">
              {HEADLINES[slide - 1]}
            </p>
            <p className="font-sans text-sm font-normal leading-normal tracking-[-0.025em] text-center" style={{ color: 'var(--st-secondary)' }}>
              {SUBS[slide - 1]}
            </p>
          </div>

          </div>{/* end fade wrapper */}

          <button
            onClick={goNext}
            className="w-full bg-white rounded-full text-black text-sm font-semibold py-3 hover:opacity-90 active:scale-[0.98] transition-all duration-75"
          >
            {slide === 4 ? 'Start trading' : 'Next'}
          </button>

        </div>
      </div>
    </div>
    </>
  );
}
