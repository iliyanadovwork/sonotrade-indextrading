import { redirect } from "next/navigation";

// OLD URL shape was `/[ticker]` (e.g. /SPOTIFY). NEW serves profiles at
// /profile/[ticker]; this catch-all preserves OLD share-links and bookmarks
// without 404s. Next.js App Router resolves more-specific static routes
// (e.g. /sign-in, /portfolio) before reaching this dynamic segment.
export const dynamic = "force-dynamic";

export default async function TickerRedirect({
  params,
}: {
  params: Promise<{ ticker: string }>;
}) {
  const { ticker } = await params;
  redirect(`/artist/${encodeURIComponent(ticker)}`);
}
