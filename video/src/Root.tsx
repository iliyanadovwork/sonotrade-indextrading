import "./index.css";
import React from "react";
import { CalculateMetadataFunction, Composition } from "remotion";
import { FALLBACK_DATA, FilmData, loadFilmData } from "./reel/data";
import { Film, FILM_DURATION } from "./reel/cine/Film";
import { HookScene, HOOK_DURATION } from "./reel/cine/HookScene";
import { HomeScene, HOME_DURATION } from "./reel/cine/HomeScene";
import { SearchScene, SEARCH_DURATION } from "./reel/cine/SearchScene";
import { CardTapScene, CARDTAP_DURATION } from "./reel/cine/CardTapScene";
import { ArtistScene, ARTIST_DURATION } from "./reel/cine/ArtistScene";
import {
  ChartDrawScene,
  CHARTDRAW_DURATION,
} from "./reel/cine/ChartDrawScene";
import { ChartScene, CHART_DURATION } from "./reel/cine/ChartScene";
import { TradeScene, TRADE_DURATION } from "./reel/cine/TradeScene";
import { PortfolioScene, PORTFOLIO_DURATION } from "./reel/cine/PortfolioScene";
import {
  LeaderboardScene,
  LEADERBOARD_DURATION,
} from "./reel/cine/LeaderboardScene";
import { CtaScene, CTA_DURATION } from "./reel/cine/CtaScene";
import { TextBeat, textBeatDuration } from "./reel/cine/TextBeat";
import {
  CardStackScene,
  CARDSTACK_DURATION,
} from "./reel/cine/CardStackScene";

// Instagram Reels format.
const VERTICAL = { fps: 30, width: 1080, height: 1920 } as const;
// Twitter-friendly 3:4 portrait.
const PORTRAIT_34 = { fps: 30, width: 1080, height: 1440 } as const;

type DataProps = { data: FilmData };

// Fetches live Sonotrade data (same Supabase requests as the app) once per
// render; falls back to deterministic sample data offline.
const withData: CalculateMetadataFunction<DataProps> = async ({ props }) => ({
  props: { ...props, data: await loadFilmData() },
});

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="SonotradeFilm"
        component={Film}
        durationInFrames={FILM_DURATION}
        {...VERTICAL}
        defaultProps={{ data: FALLBACK_DATA }}
        calculateMetadata={withData}
      />
      <Composition
        id="SonotradeFilm34"
        component={Film}
        durationInFrames={FILM_DURATION}
        {...PORTRAIT_34}
        defaultProps={{ data: FALLBACK_DATA }}
        calculateMetadata={withData}
      />
      <Composition
        id="HookScene"
        component={HookScene}
        durationInFrames={HOOK_DURATION}
        {...VERTICAL}
      />
      <Composition
        id="HookBeat"
        component={() => (
          <TextBeat
            text="What if you could trade your favorite artist?"
            voId="vo-hook"
          />
        )}
        durationInFrames={textBeatDuration("vo-hook")}
        {...VERTICAL}
      />
      <Composition
        id="CardStackScene"
        component={({ data }: DataProps) => (
          <CardStackScene artists={data.artists} />
        )}
        durationInFrames={CARDSTACK_DURATION}
        {...VERTICAL}
        defaultProps={{ data: FALLBACK_DATA }}
        calculateMetadata={withData}
      />
      <Composition
        id="HomeScene"
        component={({ data }: DataProps) => (
          <HomeScene artists={data.artists} albums={data.albums} />
        )}
        durationInFrames={HOME_DURATION}
        {...VERTICAL}
        defaultProps={{ data: FALLBACK_DATA }}
        calculateMetadata={withData}
      />
      <Composition
        id="CardTapScene"
        component={({ data }: DataProps) => (
          <CardTapScene artists={data.artists} albums={data.albums} />
        )}
        durationInFrames={CARDTAP_DURATION}
        {...VERTICAL}
        defaultProps={{ data: FALLBACK_DATA }}
        calculateMetadata={withData}
      />
      <Composition
        id="SearchScene"
        component={({ data }: DataProps) => (
          <SearchScene artists={data.artists} />
        )}
        durationInFrames={SEARCH_DURATION}
        {...VERTICAL}
        defaultProps={{ data: FALLBACK_DATA }}
        calculateMetadata={withData}
      />
      <Composition
        id="ArtistScene"
        component={({ data }: DataProps) => (
          <ArtistScene artist={data.hero} related={data.heroRelated} />
        )}
        durationInFrames={ARTIST_DURATION}
        {...VERTICAL}
        defaultProps={{ data: FALLBACK_DATA }}
        calculateMetadata={withData}
      />
      <Composition
        id="ChartDrawScene"
        component={({ data }: DataProps) => (
          <ChartDrawScene artist={data.hero} related={data.heroRelated} />
        )}
        durationInFrames={CHARTDRAW_DURATION}
        {...VERTICAL}
        defaultProps={{ data: FALLBACK_DATA }}
        calculateMetadata={withData}
      />
      <Composition
        id="ChartScene"
        component={({ data }: DataProps) => (
          <ChartScene artist={data.hero} related={data.heroRelated} />
        )}
        durationInFrames={CHART_DURATION}
        {...VERTICAL}
        defaultProps={{ data: FALLBACK_DATA }}
        calculateMetadata={withData}
      />
      <Composition
        id="TradeScene"
        component={({ data }: DataProps) => (
          <TradeScene artist={data.hero} related={data.heroRelated} />
        )}
        durationInFrames={TRADE_DURATION}
        {...VERTICAL}
        defaultProps={{ data: FALLBACK_DATA }}
        calculateMetadata={withData}
      />
      <Composition
        id="PortfolioScene"
        component={({ data }: DataProps) => (
          <PortfolioScene artists={data.artists} />
        )}
        durationInFrames={PORTFOLIO_DURATION}
        {...VERTICAL}
        defaultProps={{ data: FALLBACK_DATA }}
        calculateMetadata={withData}
      />
      <Composition
        id="LeaderboardScene"
        component={LeaderboardScene}
        durationInFrames={LEADERBOARD_DURATION}
        {...VERTICAL}
      />
      <Composition
        id="CtaScene"
        component={CtaScene}
        durationInFrames={CTA_DURATION}
        {...VERTICAL}
      />
    </>
  );
};
