import { redirect } from "next/navigation";

// Legacy OLD route. `/account` and its sub-routes have been replaced by
// `/portfolio` in NEW; this redirect keeps old share-links and bookmarks
// working without 404s.
export const dynamic = "force-dynamic";

export default function AccountIndex() {
  redirect("/portfolio");
}
