import React, { useEffect, useState, useCallback } from "react";
import { KeyRound, Smartphone, Activity, Ban } from "lucide-react";
import { Card } from "../common/Card";
import { Btn, IconBtn } from "../common/Button";
import { Badge } from "../common/Badge";
import { Modal } from "../common/Modal";
import { Field, Input, Toggle } from "../common/FormControls";
import { useApp } from "../../store/useApp";
import {
  changePasswordApi,
  mfaStatusApi,
  mfaSetApi,
  fetchSessionsApi,
  revokeSessionApi,
  revokeOtherSessionsApi,
} from "../../services/accountService";

const timeAgo = (iso) => {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`;
};

function CardTitle({ icon: Icon, children }) {
  return (
    <div className="flex items-center gap-2 mb-3.5">
      <Icon size={15} className="text-navy" />
      <div className="font-sans text-[14px] font-bold text-brand-text">{children}</div>
    </div>
  );
}

// ------------------------------------------------------------------ Password
function PasswordCard() {
  const { push } = useApp();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const mismatch = confirm && next !== confirm;
  const ready = current && next.length >= 8 && next === confirm;

  async function submit() {
    setBusy(true);
    try {
      const { signedOutOtherDevices } = await changePasswordApi(current, next);
      setCurrent("");
      setNext("");
      setConfirm("");
      push(
        signedOutOtherDevices
          ? `Password updated — ${signedOutOtherDevices} other device${signedOutOtherDevices > 1 ? "s" : ""} signed out`
          : "Password updated"
      );
    } catch (err) {
      push(err.message, "danger");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardTitle icon={KeyRound}>Password</CardTitle>
      <Field label="Current password">
        <Input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} placeholder="••••••••" />
      </Field>
      <Field label="New password" hint="At least 8 characters. Changing it signs you out of your other devices.">
        <Input type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} placeholder="••••••••" />
      </Field>
      <Field label="Confirm new password" hint={mismatch ? "Passwords do not match" : undefined}>
        <Input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="••••••••" />
      </Field>
      <Btn size="sm" variant="outline" disabled={!ready || busy} onClick={submit}>
        {busy ? "Updating..." : "Update password"}
      </Btn>
    </Card>
  );
}

// ------------------------------------------------------------------ MFA (6-digit code emailed at login)
function MfaCard() {
  const { push } = useApp();
  const [status, setStatus] = useState(null); // { enabled, email }
  const [target, setTarget] = useState(null); // the state the user asked for: true | false (asks for the password)
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    mfaStatusApi().then(setStatus).catch((err) => push(err.message, "danger"));
  }, [push]);

  function close() {
    setTarget(null);
    setPassword("");
  }

  async function confirm() {
    setBusy(true);
    try {
      await mfaSetApi(target, password);
      setStatus((prev) => ({ ...prev, enabled: target }));
      push(target ? "MFA enabled" : "MFA disabled", target ? "success" : "warn");
      close();
    } catch (err) {
      push(err.message, "danger");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardTitle icon={Smartphone}>Multi-factor authentication</CardTitle>
      <div className="flex justify-between items-start gap-3">
        <div>
          <div className="font-sans text-[13.5px] font-semibold text-brand-text">Require a code from your email at login</div>
          <div className="font-sans text-[12px] text-textMute mt-0.5">
            Adds a second verification step beyond your password
            {status ? ` — a 6-digit code is emailed to ${status.email} each time you sign in.` : "."}
          </div>
        </div>
        <Toggle on={Boolean(status?.enabled)} disabled={!status || status.policyRequired} onChange={(v) => setTarget(v)} />
      </div>

      {target !== null && (
        <Modal
          title={target ? "Turn on multi-factor authentication" : "Turn off multi-factor authentication"}
          onClose={close}
          footer={
            <>
              <Btn variant="outline" onClick={close}>
                Cancel
              </Btn>
              <Btn variant={target ? "primary" : "danger"} disabled={!password || busy} onClick={confirm}>
                {busy ? "Please wait..." : target ? "Turn on" : "Turn off"}
              </Btn>
            </>
          }
        >
          <p className="font-sans text-[13px] text-textMute m-0 mb-3">Enter your password to confirm it&apos;s you.</p>
          <Field label="Password">
            <Input
              autoFocus
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && password && !busy && confirm()}
            />
          </Field>
        </Modal>
      )}
    </Card>
  );
}

// ------------------------------------------------------------------ Active sessions
function SessionsCard() {
  const { push } = useApp();
  const [sessions, setSessions] = useState(null);

  const load = useCallback(() => fetchSessionsApi().then(setSessions).catch((err) => push(err.message, "danger")), [push]);
  useEffect(() => {
    load();
  }, [load]);

  async function revoke(s) {
    try {
      await revokeSessionApi(s.id);
      setSessions((prev) => prev.filter((x) => x.id !== s.id));
      push(`Signed out ${s.device}`);
    } catch (err) {
      push(err.message, "danger");
    }
  }

  async function revokeOthers() {
    try {
      const { revoked } = await revokeOtherSessionsApi();
      setSessions((prev) => prev.filter((x) => x.current));
      push(`Signed out ${revoked} other device${revoked === 1 ? "" : "s"}`);
    } catch (err) {
      push(err.message, "danger");
    }
  }

  const others = (sessions || []).filter((s) => !s.current).length;

  return (
    <Card>
      <div className="flex justify-between items-start mb-3.5">
        <CardTitle icon={Activity}>Active sessions</CardTitle>
        {others > 0 && (
          <Btn size="sm" variant="outline" onClick={revokeOthers}>
            Sign out all other devices
          </Btn>
        )}
      </div>
      <div className="flex flex-col gap-2.5">
        {sessions === null && <div className="font-sans text-[12.5px] text-textFaint">Loading...</div>}
        {(sessions || []).map((s) => (
          <div key={s.id} className="flex justify-between items-center p-[10px_12px] bg-[#F4F7FD] rounded-[9px]">
            <div>
              <div className="font-sans text-[13px] font-medium text-brand-text flex items-center gap-2">
                <span>{s.device}</span>
                {s.current && <Badge text="This device" tone="blue" />}
              </div>
              <div className="font-sans text-[11.5px] text-textFaint mt-0.5">
                {s.current ? "Active now" : `Last active ${timeAgo(s.lastActiveAt)}`} · signed in {timeAgo(s.signedInAt)}
              </div>
            </div>
            {!s.current && <IconBtn icon={Ban} tone="danger" title="Sign out this device" onClick={() => revoke(s)} />}
          </div>
        ))}
      </div>
    </Card>
  );
}

/** "Your account" tab — every role (Owner, Manager, Front Desk, Billing, Dentist) manages their OWN security here. */
export function AccountSecurity() {
  return (
    <div className="flex flex-col gap-3.5">
      <PasswordCard />
      <MfaCard />
      <SessionsCard />
    </div>
  );
}
