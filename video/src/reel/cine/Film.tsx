import React from "react";
import { Series } from "remotion";
import { FilmData } from "../data";
import { Vo } from "../vo";
import { TextBeat, textBeatDuration } from "./TextBeat";
import { CardStackScene, CARDSTACK_DURATION } from "./CardStackScene";
import { HomeScene, HOME_DURATION } from "./HomeScene";
import { CardTapScene, CARDTAP_DURATION } from "./CardTapScene";
import { ArtistScene, ARTIST_DURATION } from "./ArtistScene";
import { ChartDrawScene, CHARTDRAW_DURATION } from "./ChartDrawScene";
import { ChartScene, CHART_DURATION } from "./ChartScene";
import { TradeScene, TRADE_DURATION } from "./TradeScene";
import { PortfolioScene, PORTFOLIO_DURATION } from "./PortfolioScene";
import { CtaScene, CTA_DURATION } from "./CtaScene";

// Narrated launch ad: hook → card-stack teaser → home tour → text beat →
// tap Drake → artist page → chart + album markers → text beat → trade →
// portfolio → CTA. Text beats are Apple-style horizontal word-follow lines
// synced to the narration.
const HOOK_BEAT = textBeatDuration("vo-hook");
const CULTURE_BEAT = textBeatDuration("vo-culture");
const UPDOWN_BEAT = textBeatDuration("vo-updown");

export const FILM_SCENES = [
  { id: "HookBeat", duration: HOOK_BEAT },
  { id: "CardStack", duration: CARDSTACK_DURATION },
  { id: "Home", duration: HOME_DURATION },
  { id: "CultureBeat", duration: CULTURE_BEAT },
  { id: "CardTap", duration: CARDTAP_DURATION },
  { id: "Artist", duration: ARTIST_DURATION },
  { id: "ChartDraw", duration: CHARTDRAW_DURATION },
  { id: "Chart", duration: CHART_DURATION },
  { id: "UpDownBeat", duration: UPDOWN_BEAT },
  { id: "Trade", duration: TRADE_DURATION },
  { id: "Portfolio", duration: PORTFOLIO_DURATION },
  { id: "Cta", duration: CTA_DURATION },
] as const;

export const FILM_DURATION = FILM_SCENES.reduce((s, x) => s + x.duration, 0);

export const Film: React.FC<{ data: FilmData }> = ({ data }) => {
  const { artists, hero } = data;
  return (
    <Series>
      <Series.Sequence durationInFrames={HOOK_BEAT}>
        <TextBeat text="What if you could trade your favorite artist?" voId="vo-hook" />
      </Series.Sequence>
      <Series.Sequence durationInFrames={CARDSTACK_DURATION}>
        <CardStackScene artists={artists} />
      </Series.Sequence>
      <Series.Sequence durationInFrames={HOME_DURATION}>
        <HomeScene artists={artists} albums={data.albums} />
        <Vo id="vo-index" at={30} />
      </Series.Sequence>
      <Series.Sequence durationInFrames={CULTURE_BEAT}>
        <TextBeat text="Culture moves. Now you can trade it." voId="vo-culture" />
      </Series.Sequence>
      <Series.Sequence durationInFrames={CARDTAP_DURATION}>
        <CardTapScene artists={artists} albums={data.albums} />
      </Series.Sequence>
      <Series.Sequence durationInFrames={ARTIST_DURATION}>
        <ArtistScene artist={hero} related={data.heroRelated} />
        <Vo id="vo-artist" at={10} />
      </Series.Sequence>
      <Series.Sequence durationInFrames={CHARTDRAW_DURATION}>
        <ChartDrawScene artist={hero} related={data.heroRelated} />
      </Series.Sequence>
      <Series.Sequence durationInFrames={CHART_DURATION}>
        <ChartScene artist={hero} related={data.heroRelated} />
        <Vo id="vo-releases" at={22} />
      </Series.Sequence>
      <Series.Sequence durationInFrames={UPDOWN_BEAT}>
        <TextBeat text="Go long. Or go short." voId="vo-updown" />
      </Series.Sequence>
      <Series.Sequence durationInFrames={TRADE_DURATION}>
        <TradeScene artist={hero} related={data.heroRelated} />
        <Vo id="vo-trade" at={30} />
      </Series.Sequence>
      <Series.Sequence durationInFrames={PORTFOLIO_DURATION}>
        <PortfolioScene artists={artists} />
        <Vo id="vo-portfolio" at={10} />
      </Series.Sequence>
      <Series.Sequence durationInFrames={CTA_DURATION}>
        <CtaScene />
        <Vo id="vo-cta" at={8} />
      </Series.Sequence>
    </Series>
  );
};
