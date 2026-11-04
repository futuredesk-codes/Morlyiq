import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Eye, EyeOff, Lock, Mail, ShieldCheck } from "lucide-react";
import { LOGO_ICON } from "../constants/theme";
import { useApp } from "../store/useApp";
import { loginApi, mfaVerifyApi, mfaResendApi, forgotPasswordApi, resetPasswordApi } from "../services/authService";

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, push } = useApp();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [mfaToken, setMfaToken] = useState(null); // set after the password step when MFA is on
  const [code, setCode] = useState("");
  const [emailHint, setEmailHint] = useState("");
  const [resendWait, setResendWait] = useState(0);

  // Forgot password: "login" -> "forgot" (ask for the email) -> "reset" (code + new password) -> back to "login"
  const [mode, setMode] = useState("login");
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [notice, setNotice] = useState("");

  function goTo(next) {
    setMode(next);
    setError("");
    setFieldErrors({});
    if (next !== "reset") {
      setResetCode("");
      setNewPassword("");
      setConfirmPassword("");
    }
  }

  // Server validation errors ([{ field, message }]) shown under the matching input
  function showError(err) {
    setError(err.message);
    setFieldErrors(Object.fromEntries((err.errors || []).map((e) => [e.field, e.message])));
  }

  async function sendResetCode(e) {
    e?.preventDefault();
    setSubmitting(true);
    setError("");
    setFieldErrors({});
    try {
      const r = await forgotPasswordApi(email.trim());
      setEmailHint(r.email);
      setResendWait(30);
      setMode("reset");
      push("If that email has an account, a code is on its way");
    } catch (err) {
      showError(err);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReset(e) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setFieldErrors({ confirmPassword: "Passwords do not match" });
      return;
    }
    setSubmitting(true);
    setError("");
    setFieldErrors({});
    try {
      await resetPasswordApi({ email: email.trim(), code: resetCode, newPassword });
      goTo("login");
      setPassword("");
      setNotice("Your password has been reset. Sign in with your new password.");
    } catch (err) {
      showError(err);
    } finally {
      setSubmitting(false);
    }
  }

  function finish(session) {
    login(session);
    push(`Welcome back, ${session.user.name.split(" ")[0]}!`);
    const from = location.state?.from?.pathname;
    navigate(from && from !== "/login" ? from : "/dashboard", { replace: true });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const result = await loginApi(email, password);
      if (result.mfaRequired) {
        setMfaToken(result.mfaToken);
        setEmailHint(result.emailHint);
        setResendWait(30);
      } else {
        finish(result);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  // 30s cooldown before "Resend code" (the server enforces it too)
  useEffect(() => {
    if (resendWait <= 0) return undefined;
    const id = setTimeout(() => setResendWait((w) => w - 1), 1000);
    return () => clearTimeout(id);
  }, [resendWait]);

  async function resendCode() {
    setError("");
    try {
      await mfaResendApi(mfaToken);
      setResendWait(30);
      push(`New code sent to ${emailHint}`);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleMfa(e) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      finish(await mfaVerifyApi(mfaToken, code));
    } catch (err) {
      setError(err.message);
      if (err.code === "MFA_SESSION_EXPIRED") setMfaToken(null);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex bg-[#F4F7FD] font-sans">
      <div className="hidden lg:flex w-[42%] min-w-[360px] bg-gradient-to-br from-navy to-navyDeep p-12 flex-col justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-[10px] bg-white flex items-center justify-center shrink-0 p-1">
            <img
              src={LOGO_ICON}
              alt="MorlyIQ"
              className="w-full h-full object-contain"
            />
          </div>
          <div>
            <div className="font-extrabold text-[17px] text-white tracking-[0.2px]">
              MorlyIQ
            </div>
            <div className="font-medium text-[10.5px] text-[#9FB3E0] uppercase tracking-[0.5px]">
              Smarter Dental Operations
            </div>
          </div>
        </div>

        <div>
          <h1 className="text-white text-[30px] font-extrabold leading-[1.25] mb-3.5 mt-0">
            Eligibility &amp; verification,<br />without the hold music.
          </h1>
          <p className="text-[#B8C7EA] text-[14px] leading-[1.6] max-w-[380px] m-0">
            Sign in to check patient coverage, manage claims, and keep every clinic's front desk running on real-time data.
          </p>
        </div>

        <div className="flex items-center gap-2 text-[#9FB3E0] text-[12.5px]">
          <ShieldCheck size={15} />
          <span>HIPAA-conscious &middot; encrypted in transit</span>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-5 sm:p-8">
        <div className="w-full max-w-[380px]">
          <div className="lg:hidden flex items-center gap-2.5 mb-6">
            <div className="w-9 h-9 rounded-[9px] bg-navy flex items-center justify-center shrink-0 p-1">
              <img
                src={LOGO_ICON}
                alt="MorlyIQ"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <div className="font-extrabold text-[16px] text-navy tracking-[0.2px]">
                MorlyIQ
              </div>
              <div className="font-medium text-[10px] text-textMute uppercase tracking-[0.4px]">
                Smarter Dental Operations
              </div>
            </div>
          </div>

          <div className="mb-7">
            <h2 className="text-[22px] font-extrabold text-brand-text mb-1.5 mt-0">
              {mode === "forgot" ? "Forgot your password?" : mode === "reset" ? "Reset your password" : "Welcome back"}
            </h2>
            <p className="text-[13.5px] text-textMute m-0">
              {mode === "forgot"
                ? "Enter your email and we'll send you a code to reset it."
                : mode === "reset"
                  ? "Enter the code we emailed you and choose a new password."
                  : mfaToken
                    ? "Check your email for the verification code."
                    : "Sign in to your MorlyIQ workspace."}
            </p>
          </div>

          {notice && mode === "login" && !mfaToken && (
            <div role="status" className="bg-green-50 border border-green-200 rounded-[9px] py-2 px-3 text-[12px] text-green-700 mb-5">
              {notice}
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="bg-red-50 border border-red-200 rounded-[9px] py-2 px-3 text-[12px] text-red-700 mb-5"
            >
              {error}
            </div>
          )}

          {mode === "forgot" && (
            <form onSubmit={sendResetCode}>
              <div className="mb-5">
                <div className="font-sans text-[12px] font-semibold text-textMute mb-1.5 uppercase tracking-[0.3px]">Email</div>
                <div className="relative">
                  <Mail size={15} className="absolute left-3 top-3 text-textFaint" />
                  <input
                    type="email"
                    required
                    autoFocus
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@practice.com"
                    className="w-full py-2.5 pl-[38px] pr-3 rounded-[9px] border border-brand-border font-sans text-[13.5px] text-brand-text outline-none bg-white focus:border-brand-blue focus:ring-2 focus:ring-blueSoft transition-colors"
                  />
                </div>
                {fieldErrors.email && <div className="font-sans text-[11.5px] text-red-600 mt-1.5">{fieldErrors.email}</div>}
              </div>
              <button type="submit" disabled={submitting || !email.trim()} className="w-full flex items-center justify-center gap-2 bg-navy text-white border-0 rounded-[9px] py-[11px] px-[15px] font-sans text-[14px] font-bold cursor-pointer hover:opacity-95 transition-opacity disabled:opacity-70 disabled:cursor-not-allowed">
                {submitting ? "Sending..." : "Send reset code"}
              </button>
              <button type="button" onClick={() => goTo("login")} className="w-full mt-3 bg-transparent border-0 cursor-pointer font-sans text-[12.5px] text-brand-blue font-semibold hover:underline">
                Back to sign in
              </button>
            </form>
          )}

          {mode === "reset" && (
            <form onSubmit={handleReset}>
              <div className="mb-4">
                <div className="font-sans text-[12px] font-semibold text-textMute mb-1.5 uppercase tracking-[0.3px]">Reset code</div>
                <input
                  type="text"
                  inputMode="numeric"
                  autoFocus
                  autoComplete="one-time-code"
                  required
                  maxLength={7}
                  value={resetCode}
                  onChange={(e) => setResetCode(e.target.value)}
                  placeholder="123456"
                  className="w-full py-2.5 px-3 rounded-[9px] border border-brand-border font-sans text-[15px] tracking-[2px] text-brand-text outline-none bg-white focus:border-brand-blue focus:ring-2 focus:ring-blueSoft transition-colors"
                />
                {fieldErrors.code && <div className="font-sans text-[11.5px] text-red-600 mt-1.5">{fieldErrors.code}</div>}
                <div className="font-sans text-[11.5px] text-textFaint mt-1.5">
                  If {emailHint || "that email"} has an account, we sent a 6-digit code. It expires in 10 minutes.{" "}
                  <button
                    type="button"
                    disabled={resendWait > 0 || submitting}
                    onClick={sendResetCode}
                    className="bg-transparent border-0 p-0 cursor-pointer font-semibold text-brand-blue disabled:text-textFaint disabled:cursor-not-allowed hover:underline"
                  >
                    {resendWait > 0 ? `Resend in ${resendWait}s` : "Resend code"}
                  </button>
                </div>
              </div>

              <div className="mb-4">
                <div className="font-sans text-[12px] font-semibold text-textMute mb-1.5 uppercase tracking-[0.3px]">New password</div>
                <div className="relative">
                  <Lock size={15} className="absolute left-3 top-3 text-textFaint" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={8}
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    className="w-full py-2.5 pl-[38px] pr-10 rounded-[9px] border border-brand-border font-sans text-[13.5px] text-brand-text outline-none bg-white focus:border-brand-blue focus:ring-2 focus:ring-blueSoft transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2.5 top-2 bg-transparent border-0 cursor-pointer text-textFaint p-1 hover:text-textMute"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                {fieldErrors.newPassword && <div className="font-sans text-[11.5px] text-red-600 mt-1.5">{fieldErrors.newPassword}</div>}
              </div>

              <div className="mb-5">
                <div className="font-sans text-[12px] font-semibold text-textMute mb-1.5 uppercase tracking-[0.3px]">Confirm new password</div>
                <div className="relative">
                  <Lock size={15} className="absolute left-3 top-3 text-textFaint" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat the new password"
                    className="w-full py-2.5 pl-[38px] pr-3 rounded-[9px] border border-brand-border font-sans text-[13.5px] text-brand-text outline-none bg-white focus:border-brand-blue focus:ring-2 focus:ring-blueSoft transition-colors"
                  />
                </div>
                {fieldErrors.confirmPassword && <div className="font-sans text-[11.5px] text-red-600 mt-1.5">{fieldErrors.confirmPassword}</div>}
              </div>

              <button
                type="submit"
                disabled={submitting || resetCode.replace(/\s/g, "").length !== 6 || newPassword.length < 8 || !confirmPassword}
                className="w-full flex items-center justify-center gap-2 bg-navy text-white border-0 rounded-[9px] py-[11px] px-[15px] font-sans text-[14px] font-bold cursor-pointer hover:opacity-95 transition-opacity disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {submitting ? "Resetting..." : "Reset password"}
              </button>
              <button type="button" onClick={() => goTo("forgot")} className="w-full mt-3 bg-transparent border-0 cursor-pointer font-sans text-[12.5px] text-brand-blue font-semibold hover:underline">
                Use a different email
              </button>
              <button type="button" onClick={() => goTo("login")} className="w-full mt-1 bg-transparent border-0 cursor-pointer font-sans text-[12.5px] text-textMute font-semibold hover:underline">
                Back to sign in
              </button>
            </form>
          )}

          {mode !== "login" ? null : mfaToken ? (
          <form onSubmit={handleMfa}>
            <div className="mb-4">
              <div className="font-sans text-[12px] font-semibold text-textMute mb-1.5 uppercase tracking-[0.3px]">
                Authentication code
              </div>
              <input
                type="text"
                inputMode="text"
                autoFocus
                autoComplete="one-time-code"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="123456"
                className="w-full py-2.5 px-3 rounded-[9px] border border-brand-border font-sans text-[15px] tracking-[2px] text-brand-text outline-none bg-white focus:border-brand-blue focus:ring-2 focus:ring-blueSoft transition-colors"
              />
              <div className="font-sans text-[11.5px] text-textFaint mt-1.5">
                We emailed a 6-digit code to {emailHint}. It expires in 10 minutes.{" "}
                <button
                  type="button"
                  disabled={resendWait > 0}
                  onClick={resendCode}
                  className="bg-transparent border-0 p-0 cursor-pointer font-semibold text-brand-blue disabled:text-textFaint disabled:cursor-not-allowed hover:underline"
                >
                  {resendWait > 0 ? `Resend in ${resendWait}s` : "Resend code"}
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 bg-navy text-white border-0 rounded-[9px] py-[11px] px-[15px] font-sans text-[14px] font-bold cursor-pointer hover:opacity-95 transition-opacity disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {submitting ? "Verifying..." : "Verify"}
            </button>
            <button
              type="button"
              onClick={() => {
                setMfaToken(null);
                setCode("");
                setError("");
              }}
              className="w-full mt-3 bg-transparent border-0 cursor-pointer font-sans text-[12.5px] text-brand-blue font-semibold hover:underline"
            >
              Back to sign in
            </button>
          </form>
          ) : (
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <div className="font-sans text-[12px] font-semibold text-textMute mb-1.5 uppercase tracking-[0.3px]">
                Email
              </div>
              <div className="relative">
                <Mail
                  size={15}
                  className="absolute left-3 top-3 text-textFaint"
                />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@practice.com"
                  className="w-full py-2.5 pl-[38px] pr-3 rounded-[9px] border border-brand-border font-sans text-[13.5px] text-brand-text outline-none bg-white focus:border-brand-blue focus:ring-2 focus:ring-blueSoft transition-colors"
                />
              </div>
            </div>

            <div className="mb-4">
              <div className="font-sans text-[12px] font-semibold text-textMute mb-1.5 uppercase tracking-[0.3px]">
                Password
              </div>
              <div className="relative">
                <Lock
                  size={15}
                  className="absolute left-3 top-3 text-textFaint"
                />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full py-2.5 pl-[38px] pr-10 rounded-[9px] border border-brand-border font-sans text-[13.5px] text-brand-text outline-none bg-white focus:border-brand-blue focus:ring-2 focus:ring-blueSoft transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-2.5 top-2 bg-transparent border-0 cursor-pointer text-textFaint p-1 hover:text-textMute"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between mb-5">
              <label className="flex items-center gap-[7px] text-[12.5px] text-textMute cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="accent-[#2F6FED] cursor-pointer"
                />
                Remember me
              </label>
              <button
                type="button"
                onClick={() => {
                  setNotice("");
                  goTo("forgot");
                }}
                className="bg-transparent border-0 p-0 cursor-pointer text-[12.5px] text-brand-blue font-semibold hover:underline"
              >
                Forgot password?
              </button>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 bg-navy text-white border-0 rounded-[9px] py-[11px] px-[15px] font-sans text-[14px] font-bold cursor-pointer hover:opacity-95 transition-opacity disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {submitting ? "Signing in..." : "Sign in"}
            </button>
          </form>
          )}

          <p className="mt-6 text-center text-[12px] text-textFaint">
            MorlyIQ Client Panel
          </p>
        </div>
      </div>
    </div>
  );
}
