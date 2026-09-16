// Generates one MP3 per narration line via ElevenLabs TTS, then probes each
// clip's duration and writes src/reel/voDurations.json for frame-accurate
// scene timing.
// Usage: node generate-voiceover.mjs   (reads .env, narration.json)
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const env = Object.fromEntries(
  readFileSync(new URL(".env", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]),
);

const API_KEY = env.ELEVENLABS_API_KEY;
const VOICE_ID = env.ELEVENLABS_VOICE_ID;
if (!API_KEY || !VOICE_ID) {
  throw new Error("Missing ELEVENLABS_API_KEY / ELEVENLABS_VOICE_ID in .env");
}

const lines = JSON.parse(
  readFileSync(new URL("narration.json", import.meta.url), "utf8"),
);

mkdirSync(new URL("public/voiceover", import.meta.url), { recursive: true });

for (const line of lines) {
  const outPath = new URL(`public/voiceover/${line.id}.mp3`, import.meta.url);
  if (existsSync(outPath) && !process.argv.includes("--force")) {
    console.log(`skip (exists): ${line.id}`);
    continue;
  }
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: {
        "xi-api-key": API_KEY,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text: line.text,
        model_id: "eleven_multilingual_v2",
        voice_settings: {
          stability: 0.45,
          similarity_boost: 0.8,
          style: 0.35,
        },
      }),
    },
  );
  if (!res.ok) {
    throw new Error(`${line.id}: ${res.status} ${await res.text()}`);
  }
  writeFileSync(outPath, Buffer.from(await res.arrayBuffer()));
  console.log(`wrote: ${line.id}.mp3`);
}

// Probe durations (seconds) and persist for the comps (30fps frames).
const durations = {};
for (const line of lines) {
  const p = fileURLToPath(new URL(`public/voiceover/${line.id}.mp3`, import.meta.url));
  const out = execSync(
    `npx remotion ffprobe -v error -show_entries format=duration -of csv=p=0 "${p}"`,
  )
    .toString()
    .trim();
  durations[line.id] = Math.ceil(parseFloat(out) * 30);
}
writeFileSync(
  new URL("src/reel/voDurations.json", import.meta.url),
  JSON.stringify(durations, null, 2) + "\n",
);
console.log("durations (frames):", durations);
