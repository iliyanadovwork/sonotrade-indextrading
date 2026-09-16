import React from "react";
import { Img, staticFile } from "remotion";
import { colors, fonts } from "../../brand";
import { Avatar } from "./avatar";

// World width. Real app: full-viewport bg with content max-w-[1480px] mx-auto.
export const APP_W = 1600;
// Header: pt-4 (16) + h-9 row (36) + pb-4 (16) + 1px border.
export const HEADER_H = 69;

const Magnifier: React.FC<{ size?: number }> = ({ size = 14 }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="shrink-0"
    style={{ color: "var(--st-muted)" }}
  >
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

// 1:1 recreation of components/sx/SXHeader.tsx (desktop, bordered).
export const Header: React.FC<{
  user?: { cash: string; portfolio: string; name: string };
}> = ({ user }) => {
  return (
    <header
      className="bg-[rgb(10,10,10)]"
      style={{ fontFamily: fonts.sans }}
    >
      <div className="mx-auto flex min-w-0 max-w-[1480px] items-center justify-between gap-4 pt-4 pb-4">
        {/* Left: logo + wordmark + nav */}
        <div className="flex min-w-0 shrink-0 items-center gap-8">
          <div className="flex min-w-0 items-center gap-0 select-none -translate-x-[7px]">
            <Img
              src={staticFile("st-glyph.png")}
              alt="Sonotrade"
              className="block h-8 w-auto"
              style={{ height: 32 }}
            />
            <h2 className="m-0 p-0 text-[1.5rem] font-normal leading-normal tracking-[-0.05em] text-white">
              Sonotrade
            </h2>
          </div>
          <nav className="flex items-center gap-8">
            <span
              className="m-0 p-0 text-[13px] font-normal leading-normal tracking-[-0.025em] shrink-0"
              style={{ color: "var(--st-secondary)" }}
            >
              Trade
            </span>
            {/* .header-rainbow-text — static frame of the shimmer gradient */}
            <span
              className="m-0 p-0 text-[13px] font-normal leading-normal tracking-[-0.025em] shrink-0"
              style={{
                background:
                  "linear-gradient(90deg, #808080 0%, #b8a0d4 30%, #c084fc 48%, #60a5fa 68%, #7ec8e3 84%, #808080 100%)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                WebkitTextFillColor: "transparent",
                color: "transparent",
              }}
            >
              Feed
            </span>
            <span
              className="m-0 p-0 text-[13px] font-normal leading-normal tracking-[-0.025em] shrink-0"
              style={{ color: "var(--st-secondary)" }}
            >
              How it works
            </span>
          </nav>
        </div>

        {/* Right: search pill + auth state */}
        <div className="flex h-9 shrink-0 items-center justify-end gap-4">
          <div
            className="flex items-center gap-2 rounded-full border border-transparent px-4 py-[7px] w-96"
            style={{ background: "#131313" }}
          >
            <Magnifier />
            <span
              className="m-0 p-0 inline-flex items-center text-sm font-normal leading-snug tracking-[-0.025em]"
              style={{ color: "var(--st-muted)" }}
            >
              Search markets...
            </span>
          </div>
          {user ? (
            <div className="flex min-w-0 items-center justify-end gap-5">
              <div className="flex items-center gap-4">
                <div className="flex flex-col items-center gap-0.5">
                  <span
                    className="m-0 p-0 text-xs font-normal leading-normal tracking-[-0.025em]"
                    style={{ color: "var(--st-secondary)" }}
                  >
                    Cash
                  </span>
                  <span
                    className="m-0 p-0 text-sm font-medium leading-normal tracking-[-0.025em]"
                    style={{ color: "var(--st-positive)" }}
                  >
                    {user.cash}
                  </span>
                </div>
                <div className="flex flex-col items-center gap-0.5">
                  <span
                    className="m-0 p-0 text-xs font-normal leading-normal tracking-[-0.025em]"
                    style={{ color: "var(--st-secondary)" }}
                  >
                    Portfolio
                  </span>
                  <span
                    className="m-0 p-0 text-sm font-medium leading-normal tracking-[-0.025em]"
                    style={{ color: "var(--st-positive)" }}
                  >
                    {user.portfolio}
                  </span>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-5">
                <div className="h-6 w-px shrink-0 bg-st-border-strong" />
                <Avatar src={null} name={user.name} size={36} colored />
              </div>
            </div>
          ) : (
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                className="inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-full border border-st-border bg-transparent px-4 py-[7px]"
              >
                <span className="m-0 p-0 inline-flex items-center text-sm font-normal leading-snug tracking-[-0.025em] text-white">
                  Log In
                </span>
              </button>
              <button
                type="button"
                className="inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-full border border-st-black bg-st-white px-4 py-[7px]"
              >
                <span className="m-0 p-0 inline-flex items-center text-sm font-medium leading-snug tracking-[-0.025em] text-black">
                  Sign Up
                </span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

// The app "window" the camera films: fixed world width, page bg, rounded
// window chrome with a soft shadow.
export const AppFrame: React.FC<{
  children: React.ReactNode;
  height: number;
  showHeader?: boolean;
  user?: { cash: string; portfolio: string; name: string };
}> = ({ children, height, showHeader = true, user }) => {
  return (
    <div
      className="relative"
      style={{
        width: APP_W,
        height,
        background: colors.bg,
        fontFamily: fonts.sans,
      }}
    >
      {showHeader ? <Header user={user} /> : null}
      {children}
    </div>
  );
};
