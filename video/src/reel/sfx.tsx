import React from "react";
import { Audio, Sequence, staticFile } from "remotion";

// One-shot sound effect at a frame. Files live in public/sfx.
export const Sfx: React.FC<{
  name: "click" | "pop" | "chime" | "whoosh";
  at: number;
  volume?: number;
}> = ({ name, at, volume = 0.5 }) => (
  <Sequence from={at}>
    <Audio src={staticFile(`sfx/${name}.mp3`)} volume={volume} />
  </Sequence>
);
