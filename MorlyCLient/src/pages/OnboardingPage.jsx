import React, { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { CheckCircle2, CreditCard, Download, Eye, EyeOff, FileText, Lock, ShieldCheck } from "lucide-react";
import { LOGO_ICON } from "../constants/theme";
import {
  confirmOnboardingPaymentApi,
  createOnboardingPasswordApi,
  getOnboardingApi,
  startOnboardingCheckoutApi,
} from "../services/onboardingService";

const money = (amount, currency) => new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: currency || "USD",
  maximumFractionDigits: 2,
}).format(Number(amount) || 0);

function InvoiceLinks({ invoice, centered = false }) {
  if (!invoice?.hostedInvoiceUrl && !invoice?.invoicePdf) return null;
  return (
    <div className={`flex flex-wrap gap-2 ${centered ? "justify-center" : ""}`}>
      {invoice.hostedInvoiceUrl && (
        <a href={invoice.hostedInvoiceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-[8px] border border-brand-border px-3 py-2 text-[12px] font-bold text-navy no-underline hover:bg-blueSoft2">
          <FileText size={14} /> View invoice
        </a>
      )}
      {invoice.invoicePdf && (
        <a href={invoice.invoicePdf} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-[8px] border border-brand-border px-3 py-2 text-[12px] font-bold text-navy no-underline hover:bg-blueSoft2">
          <Download size={14} /> Download PDF
        </a>
      )}
    </div>
  );
}

export default function OnboardingPage() {
  const { token } = useParams();
  const [searchParams] = useSearchParams();
  const checkoutResult = searchParams.get("checkout");
  const sessionId = searchParams.get("session_id");
  const booted = useRef(false);
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [redirecting, setRedirecting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [completed, setCompleted] = useState(null);

  async function openCheckout() {
    setError("");
    setRedirecting(true);
    try {
      const result = await startOnboardingCheckoutApi(token);
      if (result.paid) {
        setDetails(await getOnboardingApi(token));
        setRedirecting(false);
        return;
      }
      if (!result.checkoutUrl) throw new Error("Stripe checkout URL was not returned");
      window.location.assign(result.checkoutUrl);
    } catch (err) {
      setError(err.message);
      setRedirecting(false);
    }
  }

  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    let active = true;
    (async () => {
      try {
        if (checkoutResult === "success" && sessionId) {
          await confirmOnboardingPaymentApi(token, sessionId);
        }
        const data = await getOnboardingApi(token);
        if (!active) return;
        setDetails(data);
        setLoading(false);
        if (data.requiresPayment && checkoutResult !== "cancelled") {
          await openCheckout();
        }
      } catch (err) {
        if (active) {
          setError(err.message);
          setLoading(false);
        }
      }
    })();
    return () => { active = false; };
  }, [checkoutResult, sessionId, token]);

  async function submitPassword(event) {
    event.preventDefault();
    setError("");
    setFieldErrors({});
    if (password !== confirmPassword) {
      setFieldErrors({ confirmPassword: "Passwords do not match" });
      return;
    }
    setSubmitting(true);
    try {
      setCompleted(await createOnboardingPasswordApi(token, password, confirmPassword));
    } catch (err) {
      setError(err.message);
      setFieldErrors(Object.fromEntries((err.errors || []).map((item) => [item.field, item.message])));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#F4F7FD] font-sans flex flex-col">
      <header className="h-[68px] bg-white border-b border-brand-border flex items-center px-5 sm:px-8">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-[9px] bg-navy p-1"><img src={LOGO_ICON} alt="MorlyIQ" className="w-full h-full object-contain" /></div>
          <div><div className="font-extrabold text-[16px] text-navy">MorlyIQ</div><div className="text-[9.5px] text-textMute uppercase tracking-[0.5px]">Client onboarding</div></div>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-[560px] bg-white border border-brand-border rounded-[16px] shadow-card p-5 sm:p-8">
          {(loading || redirecting) && (
            <div className="py-10 text-center">
              <div className="w-9 h-9 rounded-full border-[3px] border-blueSoft border-t-brand-blue animate-spin mx-auto mb-4" />
              <div className="font-bold text-brand-text">{redirecting ? "Opening secure Stripe checkout…" : "Loading your invitation…"}</div>
              <div className="text-[12px] text-textMute mt-2">Please keep this page open.</div>
            </div>
          )}

          {!loading && !redirecting && error && !details && (
            <div className="py-8 text-center">
              <div className="text-[18px] font-bold text-brand-text">Invitation unavailable</div>
              <div className="text-[13px] text-red-700 mt-3">{error}</div>
            </div>
          )}

          {!loading && !redirecting && details && !completed && (
            <>
              <div className="flex items-start justify-between gap-4 mb-5">
                <div><h1 className="text-[22px] font-extrabold text-brand-text m-0">Welcome, {details.practice.ownerName}</h1><p className="text-[13px] text-textMute mt-1">Set up {details.practice.name}</p></div>
                <ShieldCheck size={24} className="text-brand-blue shrink-0" />
              </div>

              <div className="rounded-[11px] bg-blueSoft2 border border-brand-border p-4 mb-5 flex items-center justify-between gap-4">
                <div><div className="text-[11px] uppercase font-bold text-textMute">Selected plan</div><div className="text-[14px] font-bold text-brand-text mt-1">{details.plan.name}</div><div className="text-[11.5px] text-textMute mt-0.5">Billed every {details.plan.period}</div></div>
                <div className="text-right"><div className="text-[20px] font-extrabold text-navy">{money(details.plan.price, details.plan.currency)}</div><div className="text-[10.5px] text-textFaint">per billing period</div></div>
              </div>

              {error && <div role="alert" className="bg-red-50 border border-red-200 rounded-[9px] py-2.5 px-3 text-[12px] text-red-700 mb-4">{error}</div>}

              {details.requiresPayment ? (
                <div>
                  {checkoutResult === "cancelled" && <div className="bg-warnSoft rounded-[9px] p-3 text-[12px] text-brand-warn mb-4">Checkout was cancelled. No payment was taken.</div>}
                  <button onClick={openCheckout} className="w-full flex items-center justify-center gap-2 bg-navy text-white rounded-[9px] py-3 px-4 text-[14px] font-bold border-0">
                    <CreditCard size={17} /> Continue to Stripe test checkout
                  </button>
                  <div className="text-[10.5px] text-textFaint text-center mt-3">Secure test-mode checkout. MorlyIQ does not store card details.</div>
                </div>
              ) : (
                <form onSubmit={submitPassword}>
                  <div className="bg-green-50 border border-green-200 rounded-[9px] p-3 text-[12px] text-green-700 mb-5 flex gap-2"><CheckCircle2 size={16} className="shrink-0" /> Payment confirmed. Create your password to activate the practice.</div>
                  {details.invoice && (
                    <div className="rounded-[9px] border border-brand-border bg-slate-50 p-3 mb-5">
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <div><div className="text-[10.5px] uppercase font-bold text-textMute">Stripe invoice</div><div className="text-[13px] font-bold text-brand-text mt-0.5">{details.invoice.number || details.invoice.id}</div></div>
                        <div className="text-right"><div className="text-[13px] font-extrabold text-brand-text">{money(details.invoice.amountPaid || details.invoice.amount, details.invoice.currency)}</div><div className="text-[10.5px] uppercase font-bold text-brand-success">{details.invoice.status}</div></div>
                      </div>
                      <InvoiceLinks invoice={details.invoice} />
                    </div>
                  )}
                  <label className="block text-[11.5px] font-bold uppercase text-textMute mb-1.5">Create password</label>
                  <div className="relative mb-1">
                    <Lock size={15} className="absolute left-3 top-3 text-textFaint" />
                    <input type={showPassword ? "text" : "password"} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full py-2.5 pl-[38px] pr-10 rounded-[9px] border border-brand-border text-[13.5px] outline-none" placeholder="At least 8 characters" />
                    <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-2.5 top-2 bg-transparent border-0 p-1 text-textFaint">{showPassword ? <EyeOff size={15} /> : <Eye size={15} />}</button>
                  </div>
                  {fieldErrors.password && <div className="text-[11px] text-red-600 mb-3">{fieldErrors.password}</div>}
                  <div className="text-[10.5px] text-textFaint mb-4">Use 8+ characters with uppercase, lowercase and a number.</div>
                  <label className="block text-[11.5px] font-bold uppercase text-textMute mb-1.5">Confirm password</label>
                  <div className="relative mb-1"><Lock size={15} className="absolute left-3 top-3 text-textFaint" /><input type={showPassword ? "text" : "password"} autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full py-2.5 pl-[38px] pr-3 rounded-[9px] border border-brand-border text-[13.5px] outline-none" placeholder="Repeat your password" /></div>
                  {fieldErrors.confirmPassword && <div className="text-[11px] text-red-600 mb-3">{fieldErrors.confirmPassword}</div>}
                  <button type="submit" disabled={submitting || password.length < 8 || !confirmPassword} className="w-full mt-4 bg-navy text-white rounded-[9px] py-3 px-4 text-[14px] font-bold border-0 disabled:opacity-60">{submitting ? "Activating…" : "Activate account"}</button>
                </form>
              )}
            </>
          )}

          {completed && (
            <div className="py-5 text-center">
              <CheckCircle2 size={48} className="text-brand-success mx-auto mb-4" />
              <h1 className="text-[22px] font-extrabold text-brand-text m-0">Account activated</h1>
              <p className="text-[13px] text-textMute mt-2 mb-5">Sign in with {completed.email} and the password you just created.</p>
              <div className="mb-5"><InvoiceLinks invoice={completed.invoice} centered /></div>
              <a href={completed.loginUrl || "/login"} className="inline-flex bg-navy text-white rounded-[9px] py-2.5 px-5 text-[13.5px] font-bold no-underline">Go to sign in</a>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
