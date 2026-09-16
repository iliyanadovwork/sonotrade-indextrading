"use client";

import { useEffect, useCallback, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { CSXText } from "@/components/sx/core/CSXText";
import AuthForm, { type AuthMode } from "./AuthForm";
import { Z_AUTH_MODAL } from "@/lib/zIndex";

/**
 * Global auth modal, mounted once in app/layout.tsx. Open state is driven
 * by `?auth=signin|signup` so the URL stays bookmarkable and the back
 * button works — any component on any page (mobile or desktop) can trigger
 * it by setting that query param. It renders identically on every
 * viewport; some entry points (SXHeader, MobileMorePanel) instead navigate
 * to the standalone /sign-in or /sign-up pages, which is a separate,
 * equally valid entry point, not this component gating itself on width.
 *
 * Portaled to document.body at Z_AUTH_MODAL (the top overlay tier) so it
 * can never end up rendering underneath another mounted overlay — e.g. the
 * mobile trade drawer, which stays open behind it so a typed trade amount
 * survives the signup round trip.
 */
export default function AuthModal() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const auth = searchParams.get("auth");
  const open = auth === "signin" || auth === "signup";
  const mode: AuthMode = auth === "signup" ? "signup" : "signin";

  // Pauv-v2 visibility animation state
  const [shouldRender, setShouldRender] = useState(open);
  const [visible, setVisible] = useState(false);
  // Portaling requires document.body, which doesn't exist during SSR —
  // gate the portal on client mount (same pattern as MobileTradeDrawer).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  /* eslint-disable react-hooks/set-state-in-effect --
     Synchronously syncs `shouldRender` + `visible` with the parent's
     `open` query-param so the modal mounts before the enter animation
     and unmounts ~80 ms after the exit animation. The cascading-render
     concern the rule targets doesn't apply: each `open` change schedules
     at most ONE synchronous transition, bounded by the prop. Matches
     the convention used in MobileMorePanel / SXTradingPanel. */
  useEffect(() => {
    if (open) {
      setShouldRender(true);
      requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
    } else {
      setVisible(false);
      const t = setTimeout(() => setShouldRender(false), 80);
      return () => clearTimeout(t);
    }
  }, [open]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const close = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("auth");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [router, pathname, searchParams]);

  const setMode = useCallback(
    (next: AuthMode) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("auth", next);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams]
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, close]);

  if (!mounted || !shouldRender) return null;

  return createPortal(
    <div
      className="flex fixed inset-0 items-center justify-center px-4 py-8"
      style={{ zIndex: Z_AUTH_MODAL }}
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{
          backgroundColor: "rgba(0,0,0,0.90)",
          opacity: visible ? 1 : 0,
          transition: "opacity 200ms ease",
          willChange: "opacity",
        }}
        onClick={close}
      />

      {/* Card */}
      <div
        className="w-full max-w-[25rem] relative"
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0)" : "translateY(6px)",
          transition: "opacity 80ms ease, transform 80ms ease",
          willChange: "opacity, transform",
        }}
      >
        <div className="relative w-full overflow-hidden rounded-xl border border-st-border bg-st-black px-5 pb-6 pt-11 shadow-xl md:px-8 md:pb-10 md:pt-14">
          {/* Monogram at the top of the card, fading into it */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/monogram.png"
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 z-0 w-full select-none"
            style={{
              height: '12.5rem',
              objectFit: "cover",
              objectPosition: "center top",
              opacity: 0.5,
              maskImage: "linear-gradient(to bottom, black 0%, black 35%, transparent 100%)",
              WebkitMaskImage: "linear-gradient(to bottom, black 0%, black 35%, transparent 100%)",
            }}
          />
          {/* Close button */}
          <button
            onClick={close}
            className="absolute right-4 top-4 z-20 leading-none text-st-secondary transition-colors hover:text-white"
            aria-label="Close"
            type="button"
          >
            <CSXText variant="title">×</CSXText>
          </button>

          <div className="relative z-10">
            <AuthForm mode={mode} onModeChange={setMode} onSuccess={close} />
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
