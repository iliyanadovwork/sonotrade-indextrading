import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { fonts } from "../../brand";
import { SNAP } from "../text";
import { Avatar } from "./avatar";

// Pixel recreation of app/portfolio/page.tsx (desktop): avatar header,
// NumberFlow summary tiles, and the bloomberg-style Open Positions table.

const clamp = {
  extrapolateLeft: "clamp" as const,
  extrapolateRight: "clamp" as const,
};

const fmt2 = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export type PortfolioPosition = {
  artist: string;
  image: string | null;
  side: "up" | "down";
  size: number;
  entry: number;
  mark: number;
  pnl: number;
};

export type PortfolioPageProps = {
  user: { name: string };
  stats: {
    portfolio: number;
    cash: number;
    marketValue: number;
    pnl: number;
    volume: number;
  };
  positions: PortfolioPosition[];
  statsAt?: number;
  rowsAt?: number;
};

export const PORTFOLIO_W = 1600;
export const PORTFOLIO_H = 620;

// Approximate world-space anchors for camera keyframes.
export const PORTFOLIO_LANDMARKS = {
  statsCenter: { x: 800, y: 150 },
  tableCenter: { x: 800, y: 400 },
};

// NumberFlow-style per-digit roller (mirrors @number-flow/react in the app):
// each digit column rolls 0→target with a slight stagger; separators static.
const FLOW_SIZE = 20; // 1.25rem
const FLOW_H = FLOW_SIZE * 1.3;

const FlowDigit: React.FC<{ digit: number; at: number; stagger: number; color: string }> = ({
  digit,
  at,
  stagger,
  color,
}) => {
  const frame = useCurrentFrame();
  const rolled = interpolate(frame, [at + stagger, at + stagger + 16], [0, digit], {
    ...clamp,
    easing: SNAP,
  });
  return (
    <span
      style={{
        height: FLOW_H,
        width: FLOW_SIZE * 0.6,
        overflow: "hidden",
        display: "inline-block",
        flexShrink: 0,
        verticalAlign: "top",
      }}
    >
      <span style={{ display: "block", transform: `translateY(${-rolled * FLOW_H}px)` }}>
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
          <span
            key={d}
            style={{
              height: FLOW_H,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: FLOW_SIZE,
              fontWeight: 400,
              letterSpacing: "-0.025em",
              color,
            }}
          >
            {d}
          </span>
        ))}
      </span>
    </span>
  );
};

const NumberFlowText: React.FC<{ text: string; at: number; color: string }> = ({
  text,
  at,
  color,
}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [at, at + 6], [0, 1], clamp);
  return (
    <span style={{ display: "inline-flex", alignItems: "center", height: FLOW_H, opacity }}>
      {text.split("").map((ch, i) => {
        const d = parseInt(ch, 10);
        if (!isNaN(d)) {
          return <FlowDigit key={i} digit={d} at={at} stagger={i * 1.6} color={color} />;
        }
        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              flexShrink: 0,
              fontSize: FLOW_SIZE,
              fontWeight: 400,
              letterSpacing: "-0.025em",
              lineHeight: `${FLOW_H}px`,
              color,
            }}
          >
            {ch}
          </span>
        );
      })}
    </span>
  );
};

const StatTile: React.FC<{
  label: string;
  value: number;
  at: number;
  color?: string;
  signed?: boolean;
}> = ({ label, value, at, color = "var(--st-white)", signed = false }) => {
  const sign = signed ? (value >= 0 ? "+" : "-") : "";
  return (
    <div className="bg-[rgb(10,10,10)] px-6 py-5">
      <div className="mb-1">
        <span className="text-xs" style={{ color: "var(--st-muted)" }}>
          {label}
        </span>
      </div>
      <NumberFlowText
        text={`${sign}$${fmt2(Math.abs(value))}`}
        at={at}
        color={color}
      />
    </div>
  );
};

const SideChip: React.FC<{ side: "up" | "down" }> = ({ side }) => {
  const isUp = side === "up";
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full px-1.5 pb-0.5 pt-[3px]"
      style={{
        background: isUp ? "rgba(4,223,157,0.15)" : "rgba(255,75,75,0.15)",
      }}
    >
      <span
        className="text-[0.625rem] font-medium leading-none tracking-[0.01em]"
        style={{ color: isUp ? "var(--st-chart-positive)" : "var(--st-chart-negative)" }}
      >
        {isUp ? "LONG" : "SHORT"}
      </span>
    </span>
  );
};

const PositionRow: React.FC<{ pos: PortfolioPosition; at: number }> = ({ pos, at }) => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [at, at + 9], [0, 1], { ...clamp, easing: SNAP });
  const ty = interpolate(frame, [at, at + 10], [10, 0], { ...clamp, easing: SNAP });
  const pnlPos = pos.pnl >= 0;
  const mvColor =
    pos.side === "up"
      ? pos.mark < pos.entry
        ? "var(--st-chart-negative)"
        : "var(--st-chart-positive)"
      : pos.mark > pos.entry
        ? "var(--st-chart-negative)"
        : "var(--st-chart-positive)";
  const cell = "px-4 py-3 align-middle text-right tabular-nums whitespace-nowrap";
  return (
    <tr
      className="border-b border-zinc-800"
      style={{ opacity: o, translate: `0px ${ty}px` }}
    >
      <td className="px-4 py-3 align-middle min-w-0">
        <span className="flex items-center gap-3 min-w-0">
          <Avatar src={pos.image} name={pos.artist} size={28} />
          <span className="text-xs text-white truncate">{pos.artist}</span>
        </span>
      </td>
      <td className="px-4 py-3 align-middle">
        <SideChip side={pos.side} />
      </td>
      <td className={cell}>
        <span className="text-xs text-white">{pos.size}</span>
      </td>
      <td className={cell}>
        <span className="text-xs text-white">${fmt2(pos.entry)}</span>
      </td>
      <td className={cell}>
        <span className="text-xs text-white">${fmt2(pos.entry * pos.size)}</span>
      </td>
      <td className={cell}>
        <span className="text-xs" style={{ color: "var(--st-secondary)" }}>
          ${fmt2(pos.mark)}
        </span>
      </td>
      <td className={cell}>
        <span className="text-xs" style={{ color: mvColor }}>
          ${fmt2(pos.mark * pos.size)}
        </span>
      </td>
      <td className={cell}>
        <span
          className="text-xs"
          style={{
            color: pnlPos ? "var(--st-chart-positive)" : "var(--st-chart-negative)",
          }}
        >
          {pnlPos ? "+" : "-"}${fmt2(Math.abs(pos.pnl))}
        </span>
      </td>
      <td className="px-4 py-3 align-middle text-right">
        <span
          className="inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-full border px-3 py-[5px]"
          style={{ borderColor: "var(--st-border)" }}
        >
          <span className="inline-flex items-center text-xs font-normal leading-none tracking-[-0.025em] text-white">
            Close
          </span>
        </span>
      </td>
    </tr>
  );
};

export const PortfolioPage: React.FC<PortfolioPageProps> = ({
  user,
  stats,
  positions,
  statsAt = 0,
  rowsAt = 12,
}) => {
  const pnlPositive = stats.pnl >= 0;
  const th =
    "px-4 py-3 h-8 align-middle whitespace-nowrap text-left";
  const thText = { color: "var(--st-muted)" };
  return (
    <div
      style={{
        width: PORTFOLIO_W,
        minHeight: PORTFOLIO_H,
        background: "rgb(10,10,10)",
        fontFamily: fonts.sans,
        color: "#fff",
      }}
      className="px-6 pt-2 pb-16"
    >
      <div className="w-full max-w-[1480px] mx-auto">
        {/* Avatar + username header */}
        <div className="mb-8 flex items-start gap-4">
          <Avatar src={null} name={user.name} size={56} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-col gap-0.5">
              <span
                className="text-md font-normal tracking-[-0.025em]"
                style={{ color: "var(--st-white)" }}
              >
                {user.name}
              </span>
              <span className="text-xs tracking-[-0.025em]" style={{ color: "var(--st-secondary)" }}>
                Change photo
              </span>
            </div>
          </div>
          <div className="flex-shrink-0">
            <span
              className="inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-full border px-3 py-[5px]"
              style={{ borderColor: "var(--st-border)" }}
            >
              <span className="inline-flex items-center text-xs font-normal leading-none tracking-[-0.025em] text-white">
                Log out
              </span>
            </span>
          </div>
        </div>

        {/* Summary tiles */}
        <div className="mb-10 grid grid-cols-5 gap-px border border-zinc-800 bg-zinc-800">
          <StatTile label="Total Value" value={stats.portfolio} at={statsAt} />
          <StatTile label="Available Balance" value={stats.cash} at={statsAt + 3} />
          <StatTile label="Open Positions Value" value={stats.marketValue} at={statsAt + 6} />
          <StatTile
            label="P&L"
            value={stats.pnl}
            at={statsAt + 9}
            signed
            color={pnlPositive ? "var(--st-chart-positive)" : "var(--st-chart-negative)"}
          />
          <StatTile label="Total Volume" value={stats.volume} at={statsAt + 12} />
        </div>

        {/* Open Positions */}
        <section className="mb-10">
          <h2 className="mb-4 mt-0">
            <span
              className="text-sm font-medium tracking-[-0.025em]"
              style={{ color: "var(--st-secondary)" }}
            >
              Open Positions
            </span>
          </h2>
          <div className="border-t border-b border-zinc-800 bg-[rgb(10,10,10)]">
            <table className="w-full text-xs" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className={th}>
                    <span className="text-xs font-normal" style={thText}>Artist</span>
                  </th>
                  <th className={th}>
                    <span className="text-xs font-normal" style={thText}>Side</span>
                  </th>
                  <th className={`${th} text-right`}>
                    <span className="text-xs font-normal" style={thText}>Contracts</span>
                  </th>
                  <th className={`${th} text-right`}>
                    <span className="text-xs font-normal" style={thText}>Entry</span>
                  </th>
                  <th className={`${th} text-right`}>
                    <span className="text-xs font-normal" style={thText}>Total Entry</span>
                  </th>
                  <th className={`${th} text-right`}>
                    <span className="text-xs font-normal" style={thText}>Current</span>
                  </th>
                  <th className={`${th} text-right`}>
                    <span className="text-xs font-normal" style={thText}>Market Value</span>
                  </th>
                  <th className={`${th} text-right`}>
                    <span className="text-xs font-normal" style={thText}>Unrealized P&L</span>
                  </th>
                  <th className={`${th} text-right`} />
                </tr>
              </thead>
              <tbody>
                {positions.map((pos, i) => (
                  <PositionRow key={pos.artist} pos={pos} at={rowsAt + i * 3} />
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
};
