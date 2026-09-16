import React from "react";
import { ArtistLite, filterAdArtists } from "../data";
import { Stage } from "./stage";
import { AppFrame, HEADER_H } from "../app/chrome";
import {
  SearchPage,
  SEARCH_H,
  SEARCH_LANDMARKS,
} from "../app/SearchPage";
import { Sfx } from "../sfx";

// Search: query typewrites into the pill, result cards pop in. ~120 frames.
export const SEARCH_DURATION = 120;

const L = SEARCH_LANDMARKS;
const oy = (y: number) => y + HEADER_H;

export const SearchScene: React.FC<{ artists: ArtistLite[] }> = ({
  artists,
}) => {
  return (
    <>
      <Sfx name="click" at={8} volume={0.4} />
      <Sfx name="pop" at={44} volume={0.4} />
      <Stage
        keyframes={[
          // Tight on the search pill while the query types.
          { frame: 0, x: L.searchBar.x, y: oy(L.searchBar.y), scale: 2.1 },
          { frame: 36, x: L.searchBar.x, y: oy(L.searchBar.y), scale: 2.2 },
          // Down to the results grid as cards pop.
          { frame: 50, x: L.grid.x, y: oy(L.grid.y - 60), scale: 1.35 },
          { frame: 88, x: L.grid.x, y: oy(L.grid.y + 30), scale: 1.4 },
          // Settle.
          { frame: 108, x: 800, y: oy(SEARCH_H / 2 - 60), scale: 0.85 },
        ]}
      >
        <AppFrame height={SEARCH_H}>
          <SearchPage
            artists={filterAdArtists(artists).slice(0, 6)}
            query="drake"
            typeAt={[8, 34]}
            resultsAt={44}
          />
        </AppFrame>
      </Stage>
    </>
  );
};
