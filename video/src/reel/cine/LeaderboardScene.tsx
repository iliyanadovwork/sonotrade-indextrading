import React from "react";
import { Stage } from "./stage";
import { AppFrame } from "../app/chrome";
import { LeaderboardPage, LEADERBOARD_H } from "../app/LeaderboardPage";
import { Sfx } from "../sfx";

// Leaderboard: ranked traders cascade in under the PnL tab. ~110 frames.
export const LEADERBOARD_DURATION = 110;

const ROWS = [
  { rank: 1, name: "wavecap", pnl: 18420.55, volume: 214800, trades: 312 },
  { rank: 2, name: "indexqueen", pnl: 12931.02, volume: 188432, trades: 264 },
  { rank: 3, name: "tourbus", pnl: 9812.4, volume: 141002, trades: 198 },
  { rank: 4, name: "midasflow", pnl: 7204.88, volume: 122540, trades: 251 },
  { rank: 5, name: "a&rzero", pnl: 6110.35, volume: 98430, trades: 154 },
  { rank: 6, name: "chartseer", pnl: 5488.6, volume: 90211, trades: 171 },
  { rank: 7, name: "hooksniper", pnl: 4120.11, volume: 84520, trades: 132 },
  { rank: 8, name: "greenroom", pnl: 3902.75, volume: 71209, trades: 118 },
  { rank: 9, name: "setlistfund", pnl: 3411.2, volume: 66104, trades: 109 },
  { rank: 10, name: "vinylwhale", pnl: 3088.44, volume: 61873, trades: 97 },
  { rank: 11, name: "encorebets", pnl: 2745.9, volume: 55210, trades: 121 },
  { rank: 12, name: "stagefright", pnl: 2410.15, volume: 49877, trades: 88 },
  { rank: 13, name: "meloline", pnl: 2103.5, volume: 44120, trades: 92 },
  { rank: 14, name: "bpmtrader", pnl: 1844.05, volume: 39662, trades: 76 },
  { rank: 15, name: "reverbroi", pnl: 1512.8, volume: 34018, trades: 71 },
  { rank: 16, name: "demotapes", pnl: 1204.6, volume: 29441, trades: 64 },
];

export const LeaderboardScene: React.FC = () => {
  return (
    <>
      <Sfx name="pop" at={16} volume={0.4} />
      <Stage
        keyframes={[
          // Title + tabs at the top of the column; viewport top pinned to
          // the page top.
          { frame: 0, x: 800, y: 520, scale: 1.9 },
          { frame: 20, x: 800, y: 525, scale: 1.95 },
          // Down the ranks as rows cascade.
          { frame: 34, x: 800, y: 620, scale: 1.7 },
          { frame: 74, x: 800, y: 780, scale: 1.72 },
          // Settle over the column, frame filled by the longer table.
          { frame: 92, x: 800, y: 680, scale: 1.62 },
        ]}
      >
        <AppFrame
          height={LEADERBOARD_H}
          user={{ cash: "$12,847.32", portfolio: "$13,120.55", name: "Angel" }}
        >
          <LeaderboardPage rows={ROWS} rowsAt={14} />
        </AppFrame>
      </Stage>
    </>
  );
};
