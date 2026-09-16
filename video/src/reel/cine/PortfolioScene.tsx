import React from "react";
import { ArtistLite, filterAdArtists } from "../data";
import { Stage } from "./stage";
import { AppFrame } from "../app/chrome";
import { PortfolioPage, PORTFOLIO_H } from "../app/PortfolioPage";
import { Sfx } from "../sfx";

// Portfolio: KPI tiles count up, open positions cascade in. ~140 frames.
export const PORTFOLIO_DURATION = 140;

// Deterministic demo positions derived from live market data.
const buildPositions = (artists: ArtistLite[]) =>
  artists.slice(0, 8).map((a, i) => {
    const side = i % 2 === 0 ? ("up" as const) : ("down" as const);
    const entry = a.price / (1 + a.change_1d / 100);
    const size = [40, 25, 60, 15, 30, 50, 20, 35][i];
    const pnl =
      (side === "up" ? a.price - entry : entry - a.price) * size;
    return {
      artist: a.name,
      image: a.image,
      side,
      size,
      entry,
      mark: a.price,
      pnl,
    };
  });

export const PortfolioScene: React.FC<{ artists: ArtistLite[] }> = ({
  artists,
}) => {
  const positions = buildPositions(filterAdArtists(artists));
  const marketValue = positions.reduce((s, p) => s + p.mark * p.size, 0);
  const pnl = positions.reduce((s, p) => s + p.pnl, 0);

  return (
    <>
      <Sfx name="pop" at={70} volume={0.4} />
      <Stage
        keyframes={[
          // Pan across the KPI tiles while they count up; y sits low enough
          // that the viewport top stays inside the page.
          { frame: 0, x: 460, y: 505, scale: 1.9 },
          { frame: 44, x: 1140, y: 505, scale: 1.9 },
          // Dive to the first column (artist avatar + name) and ride
          // vertically down the positions as they cascade in.
          { frame: 58, x: 215, y: 400, scale: 2.0 },
          { frame: 100, x: 215, y: 660, scale: 2.05 },
          // Zoom out over the whole portfolio.
          { frame: 116, x: 800, y: 520, scale: 1.55 },
          { frame: 139, x: 800, y: 525, scale: 1.58 },
        ]}
      >
        <AppFrame
          height={PORTFOLIO_H}
          user={{ cash: "$12,847.32", portfolio: "$13,120.55", name: "Angel" }}
        >
          <PortfolioPage
            user={{ name: "Angel" }}
            stats={{
              portfolio: 12847.32 + marketValue,
              cash: 12847.32,
              marketValue,
              pnl,
              volume: 48210.5,
            }}
            positions={positions}
            statsAt={6}
            rowsAt={54}
          />
        </AppFrame>
      </Stage>
    </>
  );
};
