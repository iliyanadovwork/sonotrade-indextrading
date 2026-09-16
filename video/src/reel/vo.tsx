import React from "react";
import { Audio, Sequence, staticFile } from "remotion";
import durations from "./voDurations.json";

// Frame length of a narration clip (30fps), from generate-voiceover.mjs.
export const voFrames = (id: string): number =>
  (durations as Record<string, number>)[id] ?? 60;

// Places a narration clip at a frame within the current sequence.
export const Vo: React.FC<{ id: string; at?: number; volume?: number }> = ({
  id,
  at = 4,
  volume = 1,
}) => (
  <Sequence from={at}>
    <Audio src={staticFile(`voiceover/${id}.mp3`)} volume={volume} />
  </Sequence>
);
