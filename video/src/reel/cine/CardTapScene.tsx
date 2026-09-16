import React from "react";
import { AlbumSlide, ArtistLite, filterAdArtists } from "../data";
import { Stage } from "./stage";
import { AppFrame } from "../app/chrome";
import { HomePage, HOME_H, discoverCardCenter } from "../app/HomePage";
import { Sfx } from "../sfx";

// Drake's Discover card gets tapped (no pointer — just the press dip), the
// camera holds on the card, then a hard cut takes us to his page. ~70 frames.
export const CARDTAP_DURATION = 70;

const TAP_AT = 36;
// Drake is the first discover card (top volume).
const CARD = discoverCardCenter(0);

export const CardTapScene: React.FC<{
  artists: ArtistLite[];
  albums?: AlbumSlide[];
}> = ({ artists, albums }) => {
  const withArt = filterAdArtists(artists);
  return (
    <>
      <Sfx name="click" at={TAP_AT} volume={0.45} />
      <Stage
        keyframes={[
          // Discover row in frame.
          { frame: 0, x: 480, y: CARD.y + 30, scale: 1.7 },
          // Push onto Drake's card.
          { frame: 22, x: CARD.x, y: CARD.y, scale: 2.1 },
          { frame: TAP_AT, x: CARD.x, y: CARD.y, scale: 2.15 },
          // Hold on the card through the press dip — no zoom-in; the cut to
          // the artist page carries the transition.
          { frame: CARDTAP_DURATION - 1, x: CARD.x, y: CARD.y, scale: 2.2 },
        ]}
      >
        <AppFrame height={HOME_H}>
          <HomePage
            artists={withArt}
            albums={albums}
            rowsAppearAt={-40}
            sparklinesAt={-40}
            tap={{ index: 0, at: TAP_AT }}
          />
        </AppFrame>
      </Stage>
    </>
  );
};
