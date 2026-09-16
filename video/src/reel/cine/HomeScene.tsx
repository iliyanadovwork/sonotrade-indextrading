import React from "react";
import { AlbumSlide, ArtistLite, filterAdArtists } from "../data";
import { Stage } from "./stage";
import { AppFrame, APP_W } from "../app/chrome";
import { HomePage, HOME_H, HOME_LANDMARKS } from "../app/HomePage";
import { Sfx } from "../sfx";

// Home page tour: logo → animated top-artist carousel → featured cards →
// spotlight (album slideshow) → the table's first column, riding down the
// ranks → whole-table zoom-out → sparkline close-up with a beat to breathe
// after the minis draw. ~290 frames.
export const HOME_DURATION = 290;

const L = HOME_LANDMARKS;

export const HomeScene: React.FC<{
  artists: ArtistLite[];
  albums?: AlbumSlide[];
}> = ({ artists, albums }) => {
  const withArt = filterAdArtists(artists);
  return (
    <>
      <Sfx name="pop" at={150} volume={0.4} />
      <Stage
        keyframes={[
          // Tight on the wordmark, slow push while it registers.
          { frame: 0, x: 300, y: 60, scale: 2.1 },
          { frame: 22, x: 300, y: 60, scale: 2.2 },
          // The animated hero carousel (slide transition lands mid-hold).
          { frame: 36, x: 560, y: 480, scale: 1.55 },
          { frame: 62, x: 560, y: 480, scale: 1.6 },
          // Track across the featured Discover cards.
          { frame: 76, x: 400, y: L.discoverCenter.y, scale: 1.6 },
          { frame: 98, x: 800, y: L.discoverCenter.y, scale: 1.65 },
          // Spotlight: album slideshow cross-fades while we drift across.
          { frame: 112, x: L.spotlightCenter.x - 160, y: L.spotlightCenter.y, scale: 1.5 },
          { frame: 138, x: L.spotlightCenter.x + 180, y: L.spotlightCenter.y, scale: 1.55 },
          // Whip to the table's first column as rows cascade in, then ride
          // vertically down the ranks.
          { frame: 152, x: 250, y: L.tableTop.y + 150, scale: 1.8 },
          { frame: 186, x: 250, y: L.tableCenter.y + 180, scale: 1.85 },
          // Zoom out to the whole table.
          { frame: 200, x: APP_W / 2, y: L.tableCenter.y - 100, scale: 0.73 },
          { frame: 214, x: APP_W / 2, y: L.tableCenter.y - 90, scale: 0.75 },
          // End on the mini-chart column close-up: the minis draw, then the
          // camera holds with a slow push so the moment can land.
          { frame: 228, x: L.firstRowSparkline.x - 40, y: L.firstRowSparkline.y + 80, scale: 2.3 },
          { frame: 258, x: L.firstRowSparkline.x - 40, y: L.firstRowSparkline.y + 115, scale: 2.34 },
          { frame: 289, x: L.firstRowSparkline.x - 40, y: L.firstRowSparkline.y + 130, scale: 2.4 },
        ]}
      >
        <AppFrame height={HOME_H}>
          <HomePage
            artists={withArt}
            albums={albums}
            rowsAppearAt={148}
            sparklinesAt={224}
          />
        </AppFrame>
      </Stage>
    </>
  );
};
