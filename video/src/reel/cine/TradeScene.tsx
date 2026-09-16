import React from "react";
import { ArtistFull, ArtistLite } from "../data";
import { Stage } from "./stage";
import { AppFrame, HEADER_H } from "../app/chrome";
import { ArtistPage, ARTIST_H } from "../app/ArtistPage";
import { TradingPanel, TRADING_PANEL_W } from "../app/TradingPanel";
import { Sfx } from "../sfx";

// Placing a trade: cursor picks Up, types the amount, hits Trade, and the
// confirmation card pops. ~190 frames.
export const TRADE_DURATION = 190;

const oy = (y: number) => y + HEADER_H;

// The trading panel overlays the artist page's empty right-rail card. Rail
// spans x 1160..1540 in world space; card starts just under the app header.
const PANEL_LEFT = 1160;
const PANEL_TOP = HEADER_H + 8;

export const TradeScene: React.FC<{
  artist: ArtistFull;
  related?: ArtistLite[];
}> = ({ artist, related = [] }) => {
  return (
    <>
      <Sfx name="pop" at={102} volume={0.4} />
      <Sfx name="chime" at={118} volume={0.45} />
      <Stage
        keyframes={[
          // Frame the whole trading panel.
          { frame: 0, x: 1350, y: 480, scale: 2.0 },
          { frame: 24, x: 1350, y: 480, scale: 2.05 },
          // Push right onto the amount as it types.
          { frame: 38, x: 1300, y: oy(225), scale: 2.9 },
          { frame: 72, x: 1300, y: oy(228), scale: 3.05 },
          // Down to the submit button for the click.
          { frame: 88, x: 1350, y: oy(400), scale: 2.4 },
          // Confirmation pops — hold tight on it.
          { frame: 114, x: 1350, y: oy(310), scale: 2.0 },
          { frame: 150, x: 1350, y: oy(312), scale: 2.05 },
          // Slow push to close the beat, still on the confirmation.
          { frame: 186, x: 1350, y: oy(315), scale: 2.12 },
        ]}
      >
        <AppFrame
          height={ARTIST_H}
          user={{ cash: "$10,000.00", portfolio: "$10,000.00", name: "Angel" }}
        >
          <ArtistPage
            artist={artist}
            priceAt={-40}
            liveDotOn
            statsAt={-40}
            chartProps={{ drawAt: -40, markersAt: -40 }}
          />
          <div
            style={{
              position: "absolute",
              left: PANEL_LEFT,
              top: PANEL_TOP,
              width: TRADING_PANEL_W,
            }}
          >
            <TradingPanel
              artistName={artist.name}
              price={artist.price}
              side="up"
              sideSelectAt={28}
              amountText="100"
              typeAt={[48, 66]}
              submitAt={102}
              confirmAt={118}
              related={related}
            />
          </div>
        </AppFrame>
      </Stage>
    </>
  );
};
