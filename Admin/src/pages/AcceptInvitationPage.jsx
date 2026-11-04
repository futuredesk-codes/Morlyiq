import React, { useEffect, useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, Eye, EyeOff, LockKeyhole, ShieldCheck } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { C } from "../constants/theme.js";
import { LOGO_ICON } from "../constants/logo.js";
import { acceptAdminInvitation, fetchAdminInvitation } from "../services/authService.js";

const inputStyle = {
  width: "100%",
  padding: "12px 42px 12px 40px",
  border: `1px solid ${C.border}`,
  borderRadius: 10,
  outline: "none",
  color: C.text,
  fontSize: 14,
};

export default function AcceptInvitationPage() {
  const { token = "" } = useParams();
  const [invitation, setInvitation] = useState(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchAdminInvitation(token)
      .then(({ invitation: loaded }) => {
        if (active) setInvitation(loaded);
      })
      .catch((requestError) => {
        if (active) setError(requestError.message || "This invitation cannot be opened.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [token]);

  const validPassword = useMemo(
    () => password.length >= 8 && /[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password),
    [password],
  );
  const canSubmit = validPassword && password === confirmPassword && !saving;

  const submit = async (event) => {
    event.preventDefault();
    if (!canSubmit) return;
    setError("");
    setSaving(true);
    try {
      await acceptAdminInvitation(token, password, confirmPassword);
      setAccepted(true);
      setPassword("");
      setConfirmPassword("");
    } catch (requestError) {
      setError(requestError.message || "The invitation could not be accepted.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8" style={{ background: C.bg, fontFamily: "Inter, sans-serif" }}>
      <div className="w-full max-w-[500px]">
        <div className="flex items-center justify-center gap-2.5 mb-5">
          <div className="w-11 h-11 rounded-xl bg-white flex items-center justify-center p-1.5 shadow-sm">
            <img src={LOGO_ICON} alt="MorlyIQ" className="w-full h-full object-contain" />
          </div>
          <div>
            <div className="text-lg font-extrabold" style={{ color: C.text }}>MorlyIQ</div>
            <div className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: C.textMute }}>Admin Console</div>
          </div>
        </div>

        <main className="bg-white rounded-2xl border shadow-sm overflow-hidden" style={{ borderColor: C.border }}>
          <div className="h-1.5" style={{ background: C.navy }} />
          <div className="p-6 sm:p-8">
            {loading ? (
              <div className="py-12 text-center text-sm" style={{ color: C.textMute }}>Checking your invitation…</div>
            ) : accepted ? (
              <div className="text-center py-5">
                <CheckCircle2 size={50} color={C.success} className="mx-auto mb-4" />
                <h1 className="text-2xl font-extrabold mb-2" style={{ color: C.text }}>Your account is ready</h1>
                <p className="text-sm leading-6 mb-6" style={{ color: C.textMute }}>
                  Your password has been created and your assigned role and permissions are now active.
                </p>
                <Link to="/login" className="inline-flex items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-bold text-white" style={{ background: C.navy }}>
                  Continue to sign in <ArrowRight size={16} />
                </Link>
              </div>
            ) : !invitation ? (
              <div className="text-center py-5">
                <ShieldCheck size={46} color={C.danger} className="mx-auto mb-4" />
                <h1 className="text-xl font-extrabold mb-2" style={{ color: C.text }}>Invitation unavailable</h1>
                <p className="text-sm leading-6 mb-6" style={{ color: C.textMute }}>{error}</p>
                <Link to="/login" className="text-sm font-bold" style={{ color: C.navy }}>Back to sign in</Link>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-2" style={{ color: C.blue }}>
                  <ShieldCheck size={17} />
                  <span className="text-xs font-bold uppercase tracking-wider">Secure invitation</span>
                </div>
                <h1 className="text-2xl font-extrabold mb-2" style={{ color: C.text }}>Create your password</h1>
                <p className="text-sm leading-6 mb-5" style={{ color: C.textMute }}>
                  Welcome, {invitation.name}. Create a password to activate your Admin access.
                </p>

                <div className="rounded-xl p-4 mb-5 text-sm" style={{ background: C.blueSoft2, color: C.textMute }}>
                  <div className="flex justify-between gap-4 mb-2"><span>Email</span><strong className="text-right" style={{ color: C.text }}>{invitation.email}</strong></div>
                  <div className="flex justify-between gap-4 mb-2"><span>Client</span><strong className="text-right" style={{ color: C.text }}>{invitation.client}</strong></div>
                  <div className="flex justify-between gap-4"><span>Assigned role</span><strong className="text-right" style={{ color: C.text }}>{invitation.role}</strong></div>
                </div>

                {error && <div className="rounded-lg px-3.5 py-3 mb-4 text-sm" style={{ background: C.dangerSoft, color: C.danger }}>{error}</div>}

                <form onSubmit={submit}>
                  <label className="block text-xs font-bold uppercase tracking-wide mb-2" style={{ color: C.textMute }}>New password</label>
                  <div className="relative mb-2">
                    <LockKeyhole size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2" color={C.textFaint} />
                    <input
                      autoFocus
                      autoComplete="new-password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      style={inputStyle}
                      placeholder="At least 8 characters"
                    />
                    <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-3 top-1/2 -translate-y-1/2 p-1" aria-label={showPassword ? "Hide password" : "Show password"}>
                      {showPassword ? <EyeOff size={16} color={C.textFaint} /> : <Eye size={16} color={C.textFaint} />}
                    </button>
                  </div>
                  <p className="text-[11px] mb-4" style={{ color: password && !validPassword ? C.danger : C.textFaint }}>
                    Use 8+ characters with uppercase, lowercase, and a number.
                  </p>

                  <label className="block text-xs font-bold uppercase tracking-wide mb-2" style={{ color: C.textMute }}>Confirm password</label>
                  <div className="relative mb-5">
                    <LockKeyhole size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2" color={C.textFaint} />
                    <input
                      autoComplete="new-password"
                      type={showPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      style={inputStyle}
                      placeholder="Re-enter your password"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={!canSubmit}
                    className="w-full rounded-lg px-4 py-3 text-sm font-bold text-white flex items-center justify-center gap-2 disabled:cursor-not-allowed"
                    style={{ background: canSubmit ? C.navy : "#91A7CE" }}
                  >
                    {saving ? "Activating account…" : "Create password & activate"}
                    {!saving && <ArrowRight size={16} />}
                  </button>
                </form>
              </>
            )}
          </div>
        </main>
        <p className="text-center text-xs mt-4" style={{ color: C.textFaint }}>Single-use secure invitation · MorlyIQ Platform</p>
      </div>
    </div>
  );
}
