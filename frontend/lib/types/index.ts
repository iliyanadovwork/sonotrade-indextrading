export interface PricePoint {
  price: number;
  t: number; // ms epoch
}

export interface Profile {
  id: string;
  talent_id?: string | null;
  name: string;
  ticker: string;
  industry: string;
  bio: string;
  photo_url: string;
  price: number;
  market_cap: number;
  change_24h: number;
  change_1h: number;
  change_7d: number;
  change_30d: number;
  volume_24h: number;
  total_forecasts: number;
  holders: number;
  social_spotify: string;
  social_applemusic: string;
  social_genius: string;
  social_x: string;
  social_instagram: string;
  social_tiktok: string;
  social_youtube: string;
  social_facebook: string;
  social_linkedin: string;
  social_linktree: string;
  social_reddit: string;
  social_telegram: string;
  social_threads: string;
  social_twitch: string;
  social_ticketmaster: string;
  social_imdb: string;
  social_website: string;
  info_location: string;
  info_subcategory: string;
  info_active_since: string;
  info_language: string;
  price_history: PricePoint[];
  claim_status: "unclaimed" | "submitted" | "in_progress" | "verified" | "rejected";
  view_count: number;
  created_at: string;
  // Music widgets (sonotrade artists_with_history)
  releases?: unknown[];
  top_tracks?: unknown[];
  top_cities?: unknown[];
  events?: unknown[];
  gallery?: unknown[];
  followers?: number | null;
  monthly_listeners?: number | null;
  related?: Array<{ id: string; name: string; image?: string }>;
}

export const SOCIAL_PLATFORMS = [
  { key: "social_spotify",      label: "Spotify",      icon: "/spotify.png",      placeholder: "https://open.spotify.com/artist/..." },
  { key: "social_applemusic",   label: "Apple Music",  icon: "/applemusic.png",   placeholder: "https://music.apple.com/artist/..." },
  { key: "social_genius",       label: "Genius",       icon: "/genius.png",       placeholder: "https://genius.com/artists/..." },
  { key: "social_x",            label: "X",            icon: "/x.png",            placeholder: "https://x.com/..." },
  { key: "social_instagram",    label: "Instagram",    icon: "/instagram.png",    placeholder: "https://instagram.com/..." },
  { key: "social_tiktok",       label: "TikTok",       icon: "/tiktok.png",       placeholder: "https://tiktok.com/@..." },
  { key: "social_youtube",      label: "YouTube",      icon: "/youtube.png",      placeholder: "https://youtube.com/@..." },
  { key: "social_facebook",     label: "Facebook",     icon: "/facebook.png",     placeholder: "https://facebook.com/..." },
  { key: "social_linkedin",     label: "LinkedIn",     icon: "/linkedin.png",     placeholder: "https://linkedin.com/in/..." },
  { key: "social_linktree",     label: "Linktree",     icon: "/linktree.png",     placeholder: "https://linktr.ee/..." },
  { key: "social_reddit",       label: "Reddit",       icon: "/reddit.png",       placeholder: "https://reddit.com/u/..." },
  { key: "social_telegram",     label: "Telegram",     icon: "/telegram.png",     placeholder: "https://t.me/..." },
  { key: "social_threads",      label: "Threads",      icon: "/threads.png",      placeholder: "https://threads.net/@..." },
  { key: "social_twitch",       label: "Twitch",       icon: "/twitch.png",       placeholder: "https://twitch.tv/..." },
  { key: "social_ticketmaster", label: "Ticketmaster", icon: "/tickemaster.png",  placeholder: "https://ticketmaster.com/..." },
  { key: "social_imdb",         label: "IMDb",         icon: "/imdb.png",         placeholder: "https://imdb.com/name/..." },
  { key: "social_website",      label: "Website",      icon: "",                  placeholder: "https://..." },
] as const;

export const INFO_FIELDS = [
  { key: "info_location",     label: "Location",    icon: "MapPin" },
  { key: "info_subcategory",  label: "Subcategory", icon: "Tag" },
  { key: "info_active_since", label: "Active Since", icon: "Calendar" },
  { key: "info_language",     label: "Language",    icon: "Languages" },
] as const;
