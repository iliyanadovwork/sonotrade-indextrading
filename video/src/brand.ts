import { loadFont } from "@remotion/google-fonts/Inter";
import { loadFont as loadMono } from "@remotion/google-fonts/JetBrainsMono";

const inter = loadFont();
const jetbrains = loadMono();

// Sonotrade uses Inter for everything (sans + mono tokens both alias Inter in
// the app); JetBrains Mono is loaded but rarely surfaces.
export const fonts = {
  sans: inter.fontFamily,
  mono: jetbrains.fontFamily,
  wordmark: inter.fontFamily,
};

// Mirrors frontend/app/globals.css :root + common raw hexes.
export const colors = {
  bg: "rgb(10,10,10)",
  surface: "#131313", // search pills, footer, trading panel card
  raised: "#18181b",
  line: "#262626", // header/footer hairlines
  grid: "#2a2a2a",
  gridStrong: "#3a3a3a",
  border: "#27272a",
  borderStrong: "#3f3f46",
  fg: "#ffffff",
  secondary: "#808080",
  zinc400: "#a1a1aa",
  zinc500: "#71717a",
  zinc600: "#52525b",
  positive: "#04df9d",
  negative: "#FF4B4B",
};

// frontend/lib/constants.ts RELEASE_COLORS
export const RELEASE_COLORS = [
  "#818cf8",
  "#34d399",
  "#f472b6",
  "#fb923c",
  "#a78bfa",
  "#60a5fa",
  "#facc15",
  "#04df9d",
  "#FF4B4B",
  "#38bdf8",
];

// Deterministic avatar color, mirrors the frontend's initials fallback vibe.
export const avatarColor = (name: string) => {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) % 360;
  }
  return `hsl(${h}, 45%, 38%)`;
};
