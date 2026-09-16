import React from "react";
import { ArtistFull, ArtistLite } from "../data";
import { Stage } from "./stage";
import { AppFrame, HEADER_H } from "../app/chrome";
import { ArtistPage, ARTIST_H, ARTIST_LANDMARKS } from "../app/ArtistPage";
import { TradingPanel, TRADING_PANEL_W } from "../app/TradingPanel";
import { Sfx } from "../sfx";

// Artist page reveal: the about banner → avatar + name → price odometer.
// The chart stays undrawn — the next scene draws it snake-style. ~140 frames.
export const ARTIST_DURATION = 140;

const L = ARTIST_LANDMARKS;
const oy = (y: number) => y + HEADER_H;

export const ArtistScene: React.FC<{
  artist: ArtistFull;
  related?: ArtistLite[];
}> = ({ artist, related = [] }) => {
  return (
    <>
      <Sfx name="pop" at={40} volume={0.35} />
      <Stage
        keyframes={[
          // The about-card banner above the header, panning across it.
          { frame: 0, x: 400, y: oy(L.aboutBanner.y), scale: 1.55 },
          { frame: 30, x: 800, y: oy(L.aboutBanner.y), scale: 1.6 },
          // Whip to avatar + name.
          { frame: 44, x: L.profileHeader.x + 60, y: oy(L.profileHeader.y), scale: 2.2 },
          { frame: 70, x: L.profileHeader.x + 60, y: oy(L.profileHeader.y), scale: 2.3 },
          // The odometer price as it rolls.
          { frame: 84, x: L.price.x + 60, y: oy(L.price.y), scale: 2.5 },
          { frame: 112, x: L.price.x + 60, y: oy(L.price.y), scale: 2.6 },
          // Settle over banner + header, chart region waiting below.
          { frame: 138, x: L.chartCenter.x, y: oy(L.profileHeader.y) + 240, scale: 1.15 },
        ]}
      >
        <AppFrame
          height={ARTIST_H}
          user={{ cash: "$10,000.00", portfolio: "$10,000.00", name: "Angel" }}
        >
          <ArtistPage
            artist={artist}
            priceAt={20}
            liveDotOn
            statsAt={-40}
            chartProps={{ drawAt: 9000, markersAt: 9000 }}
          />
          <div
            style={{
              position: "absolute",
              left: 1160,
              top: HEADER_H + 8,
              width: TRADING_PANEL_W,
            }}
          >
            <TradingPanel
              artistName={artist.name}
              price={artist.price}
              side="up"
              amountText=""
              typeAt={null}
              related={related}
            />
          </div>
        </AppFrame>
      </Stage>
    </>
  );
};
