"use client";

import { useEffect, useRef, useState } from "react";
import { CSXButton } from "@/components/sx/core/CSXButton";
import { CSXText } from "@/components/sx/core/CSXText";

export type AuthMode = "signin" | "signup";
type LoginMode = "password" | "otp";
type Step = "form" | "otp";

interface AuthFormProps {
  mode: AuthMode;
  onModeChange: (mode: AuthMode) => void;
  onSuccess?: () => void;
}

const INPUT_CLASS =
  "w-full h-9 md:h-11 rounded-full bg-st-surface-raised border border-transparent px-5 text-sm text-white placeholder:text-sm placeholder:text-[#52525b] focus:outline-none transition-colors";

/**
 * Custom-JWT auth form (login + signup + email OTP), matching the full-page
 * /sign-up flow. Posts to /api/auth/{login,signup,send-otp,verify-otp}, stores
 * the JWT + user in localStorage, dispatches `authChange`, then calls onSuccess
 * (used by <AuthModal /> to close the popup). No Supabase Auth.
 */
export default function AuthForm({ mode, onModeChange, onSuccess }: AuthFormProps) {
  const isSignup = mode === "signup";

  const [step, setStep] = useState<Step>("form");
  const [loginMode, setLoginMode] = useState<LoginMode>("password");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Reset transient state when the parent flips between signin/signup.
  /* eslint-disable react-hooks/set-state-in-effect -- one-shot reset on mode change */
  useEffect(() => {
    setStep("form");
    setLoginMode("password");
    setError("");
    setOtp(["", "", "", "", "", ""]);
  }, [mode]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setInterval(() => setResendCooldown(c => (c <= 1 ? 0 : c - 1)), 1000);
    return () => clearInterval(t);
  }, [resendCooldown]);

  useEffect(() => {
    if (step === "otp") setTimeout(() => otpRefs.current[0]?.focus(), 50);
  }, [step]);

  const handleSuccess = (token: string, user: unknown) => {
    localStorage.setItem("auth_token", token);
    localStorage.setItem("user", JSON.stringify(user));
    window.dispatchEvent(new Event("authChange"));
    onSuccess?.();
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (isSignup) {
        const res = await fetch("/api/auth/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, username, password, firstName, lastName }),
        });
        const data = await res.json();
        if (!res.ok) { setError(data.error || "Something went wrong"); return; }
        setResendCooldown(60);
        setStep("otp");
      } else {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        const data = await res.json();
        if (!res.ok) { setError(data.error || "Invalid email or password"); return; }
        if (data.token) handleSuccess(data.token, data.user);
      }
    } catch {
      setError("Failed to connect to server");
    } finally {
      setLoading(false);
    }
  };

  const handleLoginWithOtp = async () => {
    if (!email) { setError("Enter your email"); return; }
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Could not send code"); return; }
      setResendCooldown(60);
      setStep("otp");
    } catch {
      setError("Failed to connect to server");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Could not resend code"); return; }
      setResendCooldown(60);
      setOtp(["", "", "", "", "", ""]);
      otpRefs.current[0]?.focus();
    } catch {
      setError("Failed to connect to server");
    } finally {
      setLoading(false);
    }
  };

  const submitOtp = async (code: string) => {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Invalid code"); setLoading(false); return; }
      if (data.token) handleSuccess(data.token, data.user);
    } catch {
      setError("Failed to connect to server");
      setLoading(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, "").slice(-1);
    const next = [...otp];
    next[index] = digit;
    setOtp(next);
    if (digit && index < 5) otpRefs.current[index + 1]?.focus();
    if (next.every(d => d !== "")) submitOtp(next.join(""));
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) otpRefs.current[index - 1]?.focus();
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    const digits = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6).split("");
    if (!digits.length) return;
    e.preventDefault();
    const next = ["", "", "", "", "", ""];
    digits.forEach((d, i) => { next[i] = d; });
    setOtp(next);
    if (digits.length === 6) submitOtp(next.join(""));
    else otpRefs.current[Math.min(digits.length, 5)]?.focus();
  };

  if (step === "otp") {
    return (
      <>
        <div className="mb-2">
          <h2 className="m-0 p-0 text-xl font-semibold tracking-tight text-white">Enter code</h2>
        </div>
        <p className="mb-8 text-sm text-[#a1a1aa]">
          We sent a 6-digit code to <span className="text-white font-medium">{email}</span>
        </p>

        <div className="mb-6 flex gap-2 justify-between" onPaste={handleOtpPaste}>
          {otp.map((digit, i) => (
            <input
              key={i}
              ref={el => { otpRefs.current[i] = el; }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={e => handleOtpChange(i, e.target.value)}
              onKeyDown={e => handleOtpKeyDown(i, e)}
              disabled={loading}
              className="w-full aspect-square text-center text-xl font-semibold text-white bg-[#131313] border border-[#27272a] rounded-xl focus:outline-none focus:border-white transition-colors disabled:opacity-50"
            />
          ))}
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-[#3f3f46] bg-[#131313] px-4 py-3" role="alert">
            <CSXText variant="body2" color="STChartNegative">{error}</CSXText>
          </div>
        )}
        {loading && <p className="mb-4 text-center text-sm text-[#a1a1aa]">Verifying…</p>}

        <div className="flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={handleResend}
            disabled={resendCooldown > 0 || loading}
            className="text-sm text-[#a1a1aa] hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : "Resend code"}
          </button>
          <button
            type="button"
            onClick={() => { setStep("form"); setError(""); setOtp(["", "", "", "", "", ""]); }}
            className="text-sm text-[#71717a] hover:text-[#a1a1aa] transition-colors"
          >
            ← Back
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="mb-8 text-center">
        <h2 className="m-0 p-0">
          <CSXText variant="title" color="STWhite">
            {isSignup ? "Create your account" : loginMode === "otp" ? "Login with OTP" : "Welcome back"}
          </CSXText>
        </h2>
      </div>

      <form
        onSubmit={loginMode === "otp" ? async (e) => { e.preventDefault(); await handleLoginWithOtp(); } : handleFormSubmit}
        className="flex flex-col gap-4"
      >
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="Email"
          autoComplete="email"
          required
          className={INPUT_CLASS}
        />

        {isSignup && (
          <>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value.toLowerCase())}
              placeholder="Username (optional)"
              autoComplete="username"
              className={INPUT_CLASS}
            />
            <div className="grid grid-cols-2 gap-3">
              <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="First name" autoComplete="given-name" className={INPUT_CLASS} />
              <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Last name" autoComplete="family-name" className={INPUT_CLASS} />
            </div>
          </>
        )}

        {(isSignup || loginMode === "password") && (
          <div className="flex flex-col gap-1">
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Password"
              autoComplete={isSignup ? "new-password" : "current-password"}
              required
              minLength={8}
              className={INPUT_CLASS}
            />
            {isSignup && <p className="px-5 text-xs text-[#52525b]">Minimum 8 characters</p>}
          </div>
        )}

        {error && (
          <div className="rounded-full border border-st-border-strong bg-st-surface-raised px-5 py-3" role="alert">
            <CSXText variant="body2" color="STChartNegative">{error}</CSXText>
          </div>
        )}

        <div className="flex flex-col gap-3 pt-2">
          <div className="w-full [&>button]:w-full [&>button]:h-9 md:[&>button]:h-11">
            <CSXButton
              type="submit"
              variant="primary"
              disabled={loading}
              label={loading ? "Please wait…" : loginMode === "otp" ? "Send OTP" : isSignup ? "Sign up" : "Log in"}
            />
          </div>

          {!isSignup && loginMode === "password" && (
            <div className="w-full [&>button]:w-full [&>button]:h-9 md:[&>button]:h-11">
              <CSXButton type="button" variant="outline" disabled={loading} label="Login with OTP" onClick={() => { setLoginMode("otp"); setError(""); }} />
            </div>
          )}

          {!isSignup && loginMode === "otp" && (
            <button type="button" onClick={() => { setLoginMode("password"); setError(""); }} className="text-sm text-st-muted hover:text-st-secondary transition-colors text-center">
              ← Back to password login
            </button>
          )}

          {loginMode === "password" && (
            <div className="flex flex-col items-center gap-2 pt-2">
              <CSXText variant="body3" color="STMuted">
                {isSignup ? "Already have an account?" : "No account yet?"}
              </CSXText>
              <div className="w-full [&>button]:w-full [&>button]:h-9 md:[&>button]:h-11">
                <CSXButton type="button" variant="outline" label={isSignup ? "Log in" : "Sign up"} onClick={() => onModeChange(isSignup ? "signin" : "signup")} />
              </div>
            </div>
          )}
        </div>
      </form>
    </>
  );
}
