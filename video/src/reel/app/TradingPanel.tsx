import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { colors, fonts } from "../../brand";
import { POP, SNAP } from "../text";
import type { ArtistLite } from "../data";
import { Avatar } from "./avatar";

// Pixel recreation of components/sx/SXTradingPanel.tsx (desktop card, dollars
// mode) with the mobile trade-success popup from ProfileClient.tsx.

const clamp = {
  extrapolateLeft: "clamp" as const,
  extrapolateRight: "clamp" as const,
};

// Button press: quick dip to `depth`, POP back.
const pressScale = (frame: number, at: number | null | undefined, depth = 0.9) => {
  if (at == null) return 1;
  const dip = interpolate(frame, [at, at + 3], [1, depth], clamp);
  const recover = interpolate(frame, [at + 3, at + 10], [0, 1 - depth], {
    ...clamp,
    easing: POP,
  });
  return dip + recover;
};

export type TradingPanelProps = {
  artistName: string;
  price: number;
  side?: "up" | "down";
  sideSelectAt?: number;
  amountText?: string;
  typeAt?: [number, number] | null;
  submitAt?: number | null;
  confirmAt?: number | null;
  balance?: number;
  related?: ArtistLite[];
};

export const TRADING_PANEL_W = 380;

export const TradingPanel: React.FC<TradingPanelProps> = ({
  price,
  side = "up",
  sideSelectAt,
  amountText = "100",
  typeAt = null,
  submitAt = null,
  confirmAt = null,
  balance = 10000,
  related = [],
}) => {
  const frame = useCurrentFrame();

  // Typewritten amount digits.
  const typedChars = typeAt
    ? Math.round(
        interpolate(frame, [typeAt[0], typeAt[1]], [0, amountText.length], clamp),
      )
    : amountText.length;
  const typed = amountText.slice(0, typedChars);
  const typingActive = typeAt !== null && frame >= typeAt[0] && frame <= typeAt[1] + 15;
  const caretOn = frame % 18 < 9;

  const amount = parseFloat(typed) || 0;
  const contractsQty = price > 0 ? Math.floor((amount / price) * 10) / 10 : 0;
  const total = contractsQty > 0 ? contractsQty * price : null;
  const hasAmount = amount > 0;

  const fmt2 = (n: number) =>
    n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const sideLabel = side === "up" ? "Long" : "Short";

  // Confirmation: the whole card morphs into the success state (no popup) —
  // the form fades/scales away and the check takes over the same card.
  const bodyO = confirmAt == null ? 1 : interpolate(frame, [confirmAt, confirmAt + 8], [1, 0], clamp);
  const bodyS = confirmAt == null ? 1 : interpolate(frame, [confirmAt, confirmAt + 10], [1, 0.96], clamp);
  const cardScale = confirmAt == null ? 1 : interpolate(frame, [confirmAt + 4, confirmAt + 16], [0.8, 1], { ...clamp, easing: POP });
  const cardO = confirmAt == null ? 0 : interpolate(frame, [confirmAt + 4, confirmAt + 11], [0, 1], { ...clamp, easing: SNAP });

  return (
    <div
      style={{ width: TRADING_PANEL_W, position: "relative", fontFamily: fonts.sans }}
    >
      <div className="bg-[#131313] rounded-2xl p-5" style={{ position: "relative" }}>
        <div style={{ opacity: bodyO, scale: `${bodyS}` }}>
        {/* Long/Short toggle + mode label */}
        <div className="flex items-center justify-between pb-6">
          <div className="flex gap-4">
            <button
              className="px-0 rounded-full text-[1.25rem] leading-none"
              style={{
                color: side === "up" ? "#fff" : "#5c5c5c",
                scale: `${side === "up" ? pressScale(frame, sideSelectAt) : 1}`,
                background: "none",
                border: "none",
              }}
            >
              Long
            </button>
            <button
              className="px-0 rounded-full text-[1.25rem] leading-none"
              style={{
                color: side === "down" ? "#fff" : "#5c5c5c",
                scale: `${side === "down" ? pressScale(frame, sideSelectAt) : 1}`,
                background: "none",
                border: "none",
              }}
            >
              Short
            </button>
          </div>
          <span
            className="px-0 text-[1.25rem] leading-none"
            style={{ color: "var(--st-secondary)" }}
          >
            Dollars
          </span>
        </div>

        {/* Amount input */}
        <div className="flex items-baseline gap-2 flex-wrap py-4">
          <span className="text-[40px] leading-none text-white">$</span>
          <span className="text-[40px] leading-none text-white" style={{ minWidth: 35 }}>
            {typed === "" ? (typingActive ? "" : "0") : typed}
            {typingActive ? (
              <span
                style={{
                  display: "inline-block",
                  width: 2,
                  height: 34,
                  marginLeft: 3,
                  background: "#fff",
                  opacity: caretOn ? 1 : 0,
                  translate: "0px 3px",
                }}
              />
            ) : null}
          </span>
        </div>

        {/* Trade info — py-6 + space-y-2 rows like the app */}
        <div
          className="py-6"
          style={{ display: "flex", flexDirection: "column", gap: 8 }}
        >
          <p className="text-xs m-0" style={{ color: "var(--st-secondary)" }}>
            1 contract ≈ {price > 0 ? `$${price.toFixed(2)}` : "--"}
          </p>
          <p className="text-xs text-white m-0">
            Available funds: ${fmt2(balance)}
          </p>
          <p
            className="text-xs text-white m-0"
            style={{
              opacity: hasAmount && contractsQty > 0 ? 1 : 0,
            }}
          >
            You&apos;ll get: {contractsQty.toFixed(1)} contracts
          </p>
          <p className="text-xs text-white m-0">
            Total: {total !== null ? `$${total.toFixed(2)}` : "--"}
          </p>
          <p
            className="text-xs text-white m-0"
            style={{ opacity: total !== null ? 1 : 0 }}
          >
            ${fmt2(Math.max(0, balance - (total ?? 0)))} will stay in your wallet
          </p>
        </div>

        {/* Submit */}
        <button
          className="w-full bg-[#FFFFFF] rounded-full text-black text-[16px] py-3"
          style={{
            border: "none",
            scale: `${pressScale(frame, submitAt, 0.95)}`,
            opacity: hasAmount ? 1 : 0.5,
          }}
        >
          {hasAmount
            ? `Place ${side === "up" ? "long" : "short"} order`
            : "Enter amount"}
        </button>

        <p
          className="mt-5 mb-0 text-center text-xs tracking-[-0.025em]"
          style={{ color: "var(--st-secondary)" }}
        >
          By trading, you agree to the{" "}
          <span style={{ textDecoration: "underline" }}>Terms of Use</span>.
        </p>
        </div>

        {/* Success state — takes over the same card */}
        {confirmAt != null ? (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              scale: `${cardScale}`,
              opacity: cardO,
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 999,
                background: "rgba(4,223,157,0.12)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <path
                  d="M5 12.5 10 17.5 19 7"
                  stroke={colors.positive}
                  strokeWidth={2.2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <span
              className="text-[18px] font-medium text-white"
              style={{ marginTop: 20, whiteSpace: "nowrap" }}
            >
              Trade confirmed
            </span>
            <span
              className="text-sm"
              style={{ marginTop: 6, color: "var(--st-secondary)", whiteSpace: "nowrap" }}
            >
              {sideLabel} · ${amountText}
            </span>
          </div>
        ) : null}
      </div>

      {/* Similar Artists (SXRelatedProfiles) below the panel, like the app */}
      {related.length > 0 ? (
        <div className="mt-6">
          <div className="flex items-center justify-between mt-6 mb-3">
            <div className="flex flex-col gap-0.5">
              <span className="m-0 p-0 text-[16px] font-normal leading-normal tracking-[-0.025em] text-white">
                Similar Artists
              </span>
              <span
                className="m-0 p-0 text-xs font-normal leading-normal tracking-[-0.025em]"
                style={{ color: "var(--st-secondary)" }}
              >
                Also on Sonotrade
              </span>
            </div>
          </div>
          <div>
            {related.map((a) => {
              const change = a.change_1m;
              const pos = (change ?? 0) >= 0;
              return (
                <div key={a.id} className="relative w-full text-left">
                  <span className="relative z-10 flex w-full items-center gap-3 py-3">
                    <Avatar src={a.image} name={a.name} size={36} />
                    <div className="flex min-w-0 flex-1 flex-col gap-px">
                      <span className="m-0 p-0 text-sm font-normal leading-normal tracking-[-0.025em] text-white truncate">
                        {a.name}
                      </span>
                      <span
                        className="m-0 p-0 text-xs font-normal leading-normal tracking-[-0.025em]"
                        style={{ color: "var(--st-secondary)" }}
                      >
                        Index
                      </span>
                    </div>
                    <div className="flex gap-2 flex-shrink-0 flex-col items-end text-right">
                      <span
                        className="m-0 p-0 text-xs font-normal leading-normal tracking-[-0.025em]"
                        style={{ color: "var(--st-secondary)" }}
                      >
                        {a.price.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                        <span className="ml-1 text-[10px] font-normal">USD</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <svg
                          viewBox="0 0 24 18"
                          width={10}
                          height={10}
                          fill="none"
                          style={{
                            color: `var(--${pos ? "st-positive" : "st-chart-negative"})`,
                            transform: `rotate(${pos ? "0deg" : "180deg"}) translateY(1px)`,
                          }}
                        >
                          <path fill="currentColor" d="m12 0 10.392 14.25H1.608z" />
                        </svg>
                        <span
                          className="text-xs font-medium leading-none tracking-[-0.025em] tabular-nums"
                          style={{
                            color: `var(--${pos ? "st-positive" : "st-chart-negative"})`,
                          }}
                        >
                          {Math.abs(change ?? 0).toFixed(2)}%
                        </span>
                      </span>
                    </div>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
};
