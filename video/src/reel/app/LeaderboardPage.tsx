import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { fonts } from "../../brand";
import { SNAP } from "../text";
import { Avatar } from "./avatar";

// Pixel recreation of app/leaderboard/page.tsx: centered 680px column with
// border-x, title header, PnL/Volume tabs, and the fixed-colgroup table
// (# / TRADER / P&L / TRADES / WIN %).

const clamp = {
  extrapolateLeft: "clamp" as const,
  extrapolateRight: "clamp" as const,
};

const fmt2 = (n: number) =>
  Math.abs(n).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export type LeaderboardRow = {
  rank: number;
  name: string;
  pnl: number;
  volume: number;
  trades: number;
  winPct?: number;
};

export type LeaderboardPageProps = {
  rows: LeaderboardRow[];
  rowsAt?: number;
};

export const LEADERBOARD_W = 1600;
export const LEADERBOARD_H = 700;
const COLUMN_W = 680; // lib/mainColumnLayout MAIN_COLUMN_WIDTH_PX

// World-space anchors for camera keyframes.
export const LEADERBOARD_LANDMARKS = {
  top: { x: 800, y: 34 },
  tableCenter: { x: 800, y: 320 },
};

const Row: React.FC<{ row: LeaderboardRow; index: number; at: number }> = ({
  row,
  index,
  at,
}) => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [at, at + 9], [0, 1], { ...clamp, easing: SNAP });
  const ty = interpolate(frame, [at, at + 10], [10, 0], { ...clamp, easing: SNAP });
  const pnlPos = row.pnl >= 0;
  const winPct = row.winPct ?? Math.max(35, 70 - row.rank * 3);
  const cell = "px-3 py-3 align-middle text-right tabular-nums whitespace-nowrap";
  return (
    <tr
      className="border-b border-zinc-800"
      style={{ opacity: o, translate: `0px ${ty}px` }}
    >
      <td className="pl-0 pr-3 py-3 align-middle text-center tabular-nums whitespace-nowrap">
        <span className="text-xs" style={{ color: "var(--st-muted)" }}>
          {index + 1}
        </span>
      </td>
      <td className="px-3 py-3 align-middle min-w-0">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar src={null} name={row.name} size={24} />
          <span className="text-sm text-white truncate">{row.name}</span>
        </div>
      </td>
      <td className={cell}>
        <span
          className="text-xs"
          style={{
            color: pnlPos ? "var(--st-chart-positive)" : "var(--st-chart-negative)",
          }}
        >
          {pnlPos ? "+" : "-"}${fmt2(row.pnl)}
        </span>
      </td>
      <td className={cell}>
        <span className="text-xs text-white">{row.trades}</span>
      </td>
      <td className={cell}>
        <span className="text-xs text-white">{row.trades > 0 ? `${winPct}%` : "—"}</span>
      </td>
    </tr>
  );
};

export const LeaderboardPage: React.FC<LeaderboardPageProps> = ({
  rows,
  rowsAt = 8,
}) => {
  return (
    <div
      style={{
        width: LEADERBOARD_W,
        minHeight: LEADERBOARD_H,
        background: "rgb(10,10,10)",
        fontFamily: fonts.sans,
        color: "#fff",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div
        className="shrink-0 border-x border-[#262626]"
        style={{ width: COLUMN_W, minWidth: COLUMN_W, minHeight: LEADERBOARD_H }}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-[#262626]">
          <span
            className="text-md font-normal tracking-[-0.025em]"
            style={{ color: "var(--st-white)" }}
          >
            Leaderboard
          </span>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[#262626]">
          <div className="flex flex-1 items-center justify-center border-b-2 border-white -mb-px py-3.5">
            <span className="text-sm font-medium tracking-[-0.025em] text-white">
              P&L
            </span>
          </div>
          <div className="flex flex-1 items-center justify-center border-b-2 border-transparent py-3.5">
            <span
              className="text-sm font-medium tracking-[-0.025em]"
              style={{ color: "var(--st-muted)" }}
            >
              Volume
            </span>
          </div>
        </div>

        {/* Table */}
        <div className="border-b border-zinc-800 bg-[rgb(10,10,10)]">
          <table
            className="w-full text-xs table-fixed"
            style={{ borderCollapse: "collapse" }}
          >
            <colgroup>
              <col style={{ width: "7%" }} />
              <col style={{ width: "41%" }} />
              <col style={{ width: "17%" }} />
              <col style={{ width: "17%" }} />
              <col style={{ width: "18%" }} />
            </colgroup>
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="h-8 pl-0 pr-3 py-3 text-center align-middle tabular-nums whitespace-nowrap">
                  <span className="text-xs font-normal" style={{ color: "var(--st-muted)" }}>#</span>
                </th>
                <th className="h-8 px-3 py-3 text-left align-middle whitespace-nowrap tabular-nums">
                  <span className="text-xs font-normal" style={{ color: "var(--st-muted)" }}>TRADER</span>
                </th>
                <th className="h-8 px-3 py-3 text-right align-middle whitespace-nowrap tabular-nums">
                  <span className="text-xs font-normal" style={{ color: "var(--st-muted)" }}>P&L</span>
                </th>
                <th className="h-8 px-3 py-3 text-right align-middle whitespace-nowrap tabular-nums">
                  <span className="text-xs font-normal" style={{ color: "var(--st-muted)" }}>TRADES</span>
                </th>
                <th className="h-8 px-3 py-3 text-right align-middle whitespace-nowrap tabular-nums">
                  <span className="text-xs font-normal" style={{ color: "var(--st-muted)" }}>WIN %</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <Row key={row.name} row={row} index={i} at={rowsAt + i * 2.5} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
