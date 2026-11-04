import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Mail, Lock, Eye, EyeOff, ShieldCheck, ArrowRight, LayoutGrid, Users2, ListChecks } from "lucide-react";
import { C } from "../constants/theme.js";
import { LOGO_ICON } from "../constants/logo.js";
import { useAdmin } from "../store/useAdmin.js";
import { forgotAdminPassword, resetAdminPassword } from "../services/authService.js";

const inputStyle = {
  width: "100%",
  padding: "11px 12px 11px 38px",
  borderRadius: 9,
  border: `1px solid ${C.border}`,
  fontFamily: "Inter, sans-serif",
  fontSize: 13.5,
  color: C.text,
  outline: "none",
  background: "#fff",
};

const HIGHLIGHTS = [
  { icon: LayoutGrid, text: "Multi-tenant client & billing control" },
  { icon: Users2, text: "Role-based access across every team" },
  { icon: ListChecks, text: "Full audit trail on every action" },
];

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, push, resendMfa, verifyMfa } = useAdmin();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [mode, setMode] = useState("login");
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [mfaToken, setMfaToken] = useState("");
  const [mfaEmailHint, setMfaEmailHint] = useState("");

  const changeMode = (next) => {
    setMode(next);
    setError("");
    setNotice("");
    if (next === "login") {
      setMfaCode("");
      setMfaToken("");
      setMfaEmailHint("");
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Enter both email and password to continue.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const result = await login({ email: email.trim(), password, remember });
      if (result.mfaRequired) {
        setMfaToken(result.mfaToken);
        setMfaEmailHint(result.emailHint || email.trim());
        setMfaCode("");
        setMode("mfa");
        setNotice(`A 6-digit verification code was sent to ${result.emailHint || "your email"}.`);
        return;
      }
      push("Welcome back!");
      navigate("/dashboard");
    } catch (err) {
      setError(err.message || "Sign in failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleMfa = async (e) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(mfaCode)) {
      setError("Enter the 6-digit verification code.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await verifyMfa({ mfaToken, code: mfaCode, remember });
      push("Welcome back!");
      navigate("/dashboard");
    } catch (err) {
      setError(err.message || "Verification failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const resendMfaCode = async () => {
    setError("");
    setNotice("");
    setLoading(true);
    try {
      const result = await resendMfa(mfaToken);
      setMfaToken(result.mfaToken || mfaToken);
      setNotice(`A new verification code was sent to ${result.emailHint || mfaEmailHint || "your email"}.`);
    } catch (err) {
      setError(err.message || "Could not resend the verification code.");
    } finally {
      setLoading(false);
    }
  };

  const sendResetCode = async (e) => {
    e?.preventDefault();
    if (!email.trim()) {
      setError("Enter your Admin email address.");
      return;
    }
    setError("");
    setNotice("");
    setLoading(true);
    try {
      await forgotAdminPassword(email.trim());
      setMode("reset");
      setNotice("A 6-digit password reset code has been sent to your Admin email.");
    } catch (err) {
      setError(err.message || "Could not send a reset code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(resetCode.trim())) {
      setError("Enter the 6-digit code from your email.");
      return;
    }
    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setError("");
    setLoading(true);
    try {
      await resetAdminPassword({ email: email.trim(), code: resetCode.trim(), newPassword });
      setPassword("");
      setResetCode("");
      setNewPassword("");
      setConfirmPassword("");
      setMode("login");
      setNotice("Password reset successfully. Sign in with your new password.");
    } catch (err) {
      setError(err.message || "Could not reset your password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const formSubmit = mode === "login" ? submit : mode === "forgot" ? sendResetCode : mode === "mfa" ? handleMfa : handleReset;
  const submitDisabled =
    loading ||
    (mode === "login" && (!email.trim() || !password)) ||
    (mode === "forgot" && !email.trim()) ||
    (mode === "mfa" && !/^\d{6}$/.test(mfaCode)) ||
    (mode === "reset" && (
      !/^\d{6}$/.test(resetCode.trim()) ||
      newPassword.length < 8 ||
      !confirmPassword ||
      newPassword !== confirmPassword
    ));

  return (
    <div
      className="h-screen min-h-screen overflow-x-hidden overflow-y-auto flex flex-col md:flex-row font-sans"
      style={{ background: C.bg, height: "100dvh", WebkitOverflowScrolling: "touch" }}
    >
      {/* Brand panel */}
      <div
        className="w-full shrink-0 px-5 py-5 sm:px-8 sm:py-6 md:w-[42%] md:min-h-screen md:p-10 lg:w-[44%] lg:p-14 flex flex-col md:justify-between"
        style={{
          background: `linear-gradient(160deg, ${C.navy} 0%, ${C.navyDeep} 100%)`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 10,
              background: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 5,
              flexShrink: 0,
            }}
          >
            <img
              src={LOGO_ICON}
              alt="MorlyIQ"
              style={{ width: "100%", height: "100%", objectFit: "contain" }}
            />
          </div>
          <div>
            <div
              style={{
                fontWeight: 800,
                fontSize: 18,
                color: "#fff",
                letterSpacing: 0.2,
              }}
            >
              MorlyIQ
            </div>
            <div
              style={{
                fontWeight: 500,
                fontSize: 10.5,
                color: "#9FB3E0",
                textTransform: "uppercase",
                letterSpacing: 0.6,
              }}
            >
              Admin Console
            </div>
          </div>
        </div>

        <div className="hidden md:block md:my-10 lg:my-12">
          <h1
            className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white leading-tight mb-3.5"
            style={{ margin: "0 0 14px" }}
          >
            One console for every client, plan &amp; permission.
          </h1>
          <p
            style={{
              color: "#C7D4EE",
              fontSize: 14.5,
              lineHeight: 1.7,
              margin: "0 0 28px",
              maxWidth: 420,
            }}
          >
            Manage tenants, feature entitlements, billing and support from a single
            blue-and-white control centre built for the MorlyIQ platform team.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {HIGHLIGHTS.map((h, i) => {
              const Icon = h.icon;
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 11 }}>
                  <div
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 8,
                      background: "rgba(255,255,255,0.12)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Icon size={15} color="#fff" />
                  </div>
                  <span style={{ color: "#DCE4F6", fontSize: 13.5 }}>{h.text}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-5 md:hidden" style={{ color: "#C7D4EE", fontSize: 13, lineHeight: 1.55 }}>
          Secure access to clients, plans and platform operations.
        </div>

        <div className="hidden md:block" style={{ color: "#7B93C9", fontSize: 11.5 }}>
          © 2026 MorlyIQ · FutureDesks Services
        </div>
      </div>

      {/* Form panel */}
      <div
        className="w-full min-w-0 flex-1 flex flex-col items-center px-4 py-8 sm:px-8 sm:py-10 md:min-h-screen md:px-10 md:py-12"
      >
        <form onSubmit={formSubmit} className="my-auto w-full max-w-[400px]">
          <div className="mb-6 sm:mb-[30px]">
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                color: C.blue,
                fontSize: 12,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: 0.5,
                marginBottom: 10,
              }}
            >
              <ShieldCheck size={14} /> {mode === "login" ? "Secure sign in" : mode === "mfa" ? "Two-step verification" : "Account recovery"}
            </div>
            <h2
              style={{
                fontSize: 25,
                fontWeight: 800,
                color: C.text,
                margin: "0 0 6px",
              }}
            >
              {mode === "login" ? "Welcome back" : mode === "forgot" ? "Forgot your password?" : mode === "mfa" ? "Verify your identity" : "Reset your password"}
            </h2>
            <p style={{ fontSize: 13.5, color: C.textMute, margin: 0 }}>
              {mode === "login"
                ? "Sign in to access the Admin console."
                : mode === "forgot"
                  ? "Enter your email and we'll send you a one-time reset code."
                  : mode === "mfa"
                    ? `Enter the code sent to ${mfaEmailHint || "your Admin email"}.`
                    : "Enter the code from your email and choose a new password."}
            </p>
          </div>

          {error && (
            <div
              style={{
                background: C.dangerSoft,
                color: C.danger,
                fontSize: 12.5,
                fontWeight: 500,
                padding: "10px 12px",
                borderRadius: 9,
                marginBottom: 16,
              }}
            >
              {error}
            </div>
          )}

          {notice && (
            <div style={{ background: "#EAF8F0", color: "#18794E", fontSize: 12.5, fontWeight: 500, padding: "10px 12px", borderRadius: 9, marginBottom: 16 }}>
              {notice}
            </div>
          )}

          {mode !== "mfa" && <div style={{ marginBottom: 16 }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: C.textMute,
                marginBottom: 6,
                textTransform: "uppercase",
                letterSpacing: 0.3,
              }}
            >
              Email
            </div>
            <div style={{ position: "relative" }}>
              <Mail
                size={15}
                color={C.textFaint}
                style={{ position: "absolute", left: 12, top: 12 }}
              />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                style={inputStyle}
                autoFocus
                autoComplete="email"
                readOnly={mode === "reset"}
              />
            </div>
          </div>}

          {mode === "login" && <div style={{ marginBottom: 12 }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: C.textMute,
                marginBottom: 6,
                textTransform: "uppercase",
                letterSpacing: 0.3,
              }}
            >
              Password
            </div>
            <div style={{ position: "relative" }}>
              <Lock
                size={15}
                color={C.textFaint}
                style={{ position: "absolute", left: 12, top: 12 }}
              />
              <input
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                style={{ ...inputStyle, paddingRight: 38 }}
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPw((s) => !s)}
                style={{
                  position: "absolute",
                  right: 10,
                  top: 9,
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: C.textFaint,
                  padding: 4,
                  display: "flex",
                }}
              >
                {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>}

          {mode === "reset" && (
            <>
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: C.textMute, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.3 }}>Reset code</div>
                <div style={{ position: "relative" }}>
                  <Lock size={15} color={C.textFaint} style={{ position: "absolute", left: 12, top: 12 }} />
                  <input type="text" inputMode="numeric" maxLength={6} value={resetCode} onChange={(e) => setResetCode(e.target.value.replace(/\D/g, ""))} placeholder="6-digit code" style={inputStyle} autoComplete="one-time-code" autoFocus />
                </div>
              </div>
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: C.textMute, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.3 }}>New password</div>
                <div style={{ position: "relative" }}>
                  <Lock size={15} color={C.textFaint} style={{ position: "absolute", left: 12, top: 12 }} />
                  <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Minimum 8 characters" style={inputStyle} autoComplete="new-password" />
                </div>
              </div>
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: C.textMute, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.3 }}>Confirm password</div>
                <div style={{ position: "relative" }}>
                  <Lock size={15} color={C.textFaint} style={{ position: "absolute", left: 12, top: 12 }} />
                  <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Re-enter new password" style={inputStyle} autoComplete="new-password" />
                </div>
              </div>
            </>
          )}

          {mode === "mfa" && (
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.textMute, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.3 }}>Verification code</div>
              <div style={{ position: "relative" }}>
                <Lock size={15} color={C.textFaint} style={{ position: "absolute", left: 12, top: 12 }} />
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={mfaCode}
                  onChange={(event) => setMfaCode(event.target.value.replace(/\D/g, ""))}
                  placeholder="6-digit code"
                  style={{ ...inputStyle, letterSpacing: 3, fontWeight: 700 }}
                  autoComplete="one-time-code"
                  autoFocus
                />
              </div>
            </div>
          )}

          {mode === "login" && <div className="my-[6px] mb-[22px] flex flex-wrap items-center gap-x-4 gap-y-2">
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                fontSize: 12.5,
                color: C.textMute,
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                style={{ accentColor: C.blue, width: 14, height: 14 }}
              />
              Remember me
            </label>
            <a
              className="ml-auto"
              href="#forgot"
              onClick={(e) => {
                e.preventDefault();
                changeMode("forgot");
              }}
              style={{
                fontSize: 12.5,
                color: C.blue,
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Forgot password?
            </a>
          </div>}

          <button
            type="submit"
            disabled={submitDisabled}
            className="transition-transform active:scale-[0.98]"
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              background: C.navy,
              color: "#fff",
              border: "none",
              borderRadius: 9,
              padding: "12px 15px",
              fontFamily: "Inter, sans-serif",
              fontSize: 14,
              fontWeight: 700,
              cursor: submitDisabled ? "not-allowed" : "pointer",
              opacity: submitDisabled ? 0.55 : 1,
            }}
          >
            {loading
              ? mode === "login" ? "Signing in…" : mode === "forgot" ? "Sending…" : mode === "mfa" ? "Verifying…" : "Resetting…"
              : mode === "login" ? "Sign in" : mode === "forgot" ? "Send reset code" : mode === "mfa" ? "Verify and sign in" : "Reset password"}
            {!loading && <ArrowRight size={15} />}
          </button>

          {mode === "reset" && (
            <button type="button" disabled={loading} onClick={sendResetCode} style={{ width: "100%", marginTop: 12, border: 0, background: "transparent", color: C.blue, fontWeight: 600, fontSize: 12.5, cursor: loading ? "not-allowed" : "pointer" }}>
              Resend code
            </button>
          )}

          {mode === "mfa" && (
            <button type="button" disabled={loading} onClick={resendMfaCode} style={{ width: "100%", marginTop: 12, border: 0, background: "transparent", color: C.blue, fontWeight: 600, fontSize: 12.5, cursor: loading ? "not-allowed" : "pointer" }}>
              Resend verification code
            </button>
          )}

          {mode !== "login" && (
            <button type="button" onClick={() => changeMode("login")} style={{ width: "100%", marginTop: 10, border: 0, background: "transparent", color: C.textMute, fontWeight: 600, fontSize: 12.5, cursor: "pointer" }}>
              Back to sign in
            </button>
          )}

          <div
            style={{
              textAlign: "center",
              marginTop: 22,
              fontSize: 12,
              color: C.textFaint,
            }}
          >
            Admin Access — Powered by MorlyIQ Platform
          </div>
        </form>
      </div>
    </div>
  );
}
