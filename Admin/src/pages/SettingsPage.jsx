import React, { useEffect, useState } from "react";
import { Check, Lock, ArrowRight } from "lucide-react";
import { C } from "../constants/theme.js";
import { Card, SectionHeader } from "../components/common/Card.jsx";
import { Btn } from "../components/common/Button.jsx";
import {
  Input,
  Select,
  Field,
  Toggle,
} from "../components/common/FormControls.jsx";
import { useAdmin } from "../store/useAdmin.js";
import { Modal } from "../components/common/Modal.jsx";
import {
  fetchPlatformSettingsApi,
  updateSuperAdminMfaApi,
  updatePlatformSettingsApi,
} from "../services/settingsService.js";

function RowToggle({ label, desc, on, onChange, disabled = false }) {
  return (
    <div className="flex justify-between items-start gap-3">
      <div>
        <div
          style={{
            fontFamily: "Inter, sans-serif",
            fontSize: 13.5,
            fontWeight: 600,
            color: C.text,
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontFamily: "Inter, sans-serif",
            fontSize: 12,
            color: C.textMute,
            marginTop: 2,
          }}
        >
          {desc}
        </div>
      </div>
      <Toggle on={on} onChange={onChange} disabled={disabled} />
    </div>
  );
}

export default function SettingsPage() {
  const { push } = useAdmin();
  const [maintenance, setMaintenance] = useState(false);
  const [allowSignups, setAllowSignups] = useState(true);
  const [requireMfa, setRequireMfa] = useState(false);
  const [mfaLoading, setMfaLoading] = useState(true);
  const [mfaSaving, setMfaSaving] = useState(false);
  const [pendingMfa, setPendingMfa] = useState(null);
  const [mfaPassword, setMfaPassword] = useState("");
  const [mfaError, setMfaError] = useState("");
  const [autoSuspend, setAutoSuspend] = useState(true);
  const [logFailedAuth, setLogFailedAuth] = useState(true);
  const [requireSsoLinks, setRequireSsoLinks] = useState(false);
  const [supportEmail, setSupportEmail] = useState("support@dentalverify.ai");
  const [trialLength, setTrialLength] = useState(14);
  const [settingsReady, setSettingsReady] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);

  function applySettings(settings) {
    setRequireMfa(Boolean(settings.security?.requireMfaForSuperAdmins));
    setMaintenance(Boolean(settings.maintenanceMode));
    setAllowSignups(settings.allowSignups !== false);
    setSupportEmail(settings.supportEmail || "");
    setTrialLength(settings.trialLengthDays ?? 14);
  }

  useEffect(() => {
    let active = true;
    fetchPlatformSettingsApi()
      .then((settings) => {
        if (active) { applySettings(settings); setSettingsReady(true); }
      })
      .catch((error) => {
        if (active) push(error.message, "danger");
      })
      .finally(() => {
        if (active) setMfaLoading(false);
      });
    return () => { active = false; };
  }, [push]);

  function requestMfaChange(enabled) {
    setPendingMfa(enabled);
    setMfaPassword("");
    setMfaError("");
  }

  async function confirmMfaChange() {
    if (!mfaPassword) {
      setMfaError("Enter your current password.");
      return;
    }
    setMfaSaving(true);
    setMfaError("");
    try {
      const settings = await updateSuperAdminMfaApi({ enabled: pendingMfa, password: mfaPassword });
      setRequireMfa(Boolean(settings.security?.requireMfaForSuperAdmins));
      setPendingMfa(null);
      setMfaPassword("");
      push(pendingMfa ? "Super Admin MFA requirement enabled" : "Super Admin MFA requirement disabled");
    } catch (error) {
      setMfaError(error.message || "Could not update MFA policy.");
    } finally {
      setMfaSaving(false);
    }
  }

  async function saveSettings() {
    if (!settingsReady || settingsSaving) return;
    setSettingsSaving(true);
    try {
      const settings = await updatePlatformSettingsApi({ supportEmail: supportEmail.trim(), trialLengthDays: trialLength, verificationProvider: "stedi", maintenanceMode: maintenance, allowSignups });
      applySettings(settings);
      push("Platform settings saved");
    } catch (error) { push(error.message, "danger"); }
    finally { setSettingsSaving(false); }
  }

  const chain = [
    "Authenticated",
    "Correct tenant",
    "Subscription feature enabled",
    "Role permission granted",
    "Resource access allowed",
  ];

  return (
    <div>
      <SectionHeader
        title="Platform Settings"
        subtitle="Global configuration for MorlyIQ"
        action={
          <Btn icon={Check} onClick={saveSettings} disabled={!settingsReady || settingsSaving || mfaSaving}>
            {settingsSaving ? "Saving..." : "Save changes"}
          </Btn>
        }
      />

      {/* Security & Access Control Chain Card */}
      <Card style={{ marginBottom: 14 }}>
        <div className="flex items-center gap-2 mb-3.5">
          <Lock size={15} color={C.navy} />
          <div
            style={{
              fontFamily: "Inter, sans-serif",
              fontSize: 14,
              fontWeight: 700,
              color: C.text,
            }}
          >
            Security &amp; access control
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-1.5 mb-4">
          {chain.map((step, i) => (
            <React.Fragment key={step}>
              <div
                className="px-3 py-2 rounded-lg font-semibold text-xs"
                style={{
                  background: C.blueSoft2,
                  border: `1px solid ${C.border}`,
                  fontFamily: "Inter, sans-serif",
                  color: C.navy,
                }}
              >
                {step}
              </div>
              {i < chain.length - 1 && (
                <ArrowRight size={14} color={C.textFaint} />
              )}
            </React.Fragment>
          ))}
        </div>

        <div
          className="text-xs mb-4 leading-relaxed"
          style={{
            fontFamily: "Inter, sans-serif",
            color: C.textMute,
          }}
        >
          Every protected request is checked against this chain server-side. UI
          hiding alone is never treated as access control — a disabled feature,
          expired plan, or missing permission is rejected at the API even if a
          request is made directly.
        </div>

        <div className="flex flex-col gap-4">
          <RowToggle
            label="Log failed authorization attempts"
            desc="Record every denied request — tenant mismatch, disabled feature or missing permission."
            on={logFailedAuth}
            onChange={setLogFailedAuth}
            disabled
          />
          <RowToggle
            label="Require SSO for external links where supported"
            desc="Block adding a client link with stored third-party credentials."
            on={requireSsoLinks}
            onChange={setRequireSsoLinks}
            disabled
          />
          <RowToggle
            label="Require MFA for all Super Admins"
            desc={mfaLoading ? "Loading security policyâ€¦" : "Enforce an emailed 6-digit verification code after password login for every Super Admin."}
            on={requireMfa}
            onChange={requestMfaChange}
            disabled={mfaLoading || mfaSaving || settingsSaving}
          />
        </div>
      </Card>

      {/* Access and General Preferences Split */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        <Card>
          <div
            style={{
              fontFamily: "Inter, sans-serif",
              fontSize: 14,
              fontWeight: 700,
              color: C.text,
              marginBottom: 14,
            }}
          >
            Platform access
          </div>
          <div className="flex flex-col gap-4">
            <RowToggle
              label="Maintenance mode"
              desc="Take the client portal offline for scheduled maintenance."
              on={maintenance}
              onChange={setMaintenance}
              disabled={!settingsReady || settingsSaving}
            />
            <RowToggle
              label="Allow new signups"
              desc="Allow creating and inviting new clients. Existing invitations can still be completed."
              on={allowSignups}
              onChange={setAllowSignups}
              disabled={!settingsReady || settingsSaving}
            />
            <RowToggle
              label="Auto-suspend on failed payment"
              desc="Suspend a client automatically after 3 failed payment retries."
              on={autoSuspend}
              onChange={setAutoSuspend}
              disabled
            />
          </div>
        </Card>

        <Card>
          <div
            style={{
              fontFamily: "Inter, sans-serif",
              fontSize: 14,
              fontWeight: 700,
              color: C.text,
              marginBottom: 14,
            }}
          >
            General
          </div>
          <Field label="Support email">
            <Input
              type="email"
              maxLength={254}
              disabled={!settingsReady || settingsSaving}
              value={supportEmail}
              onChange={(e) => setSupportEmail(e.target.value)}
            />
          </Field>
          <Field label="Trial length (days)" hint="Applies to new trials. Existing dated trials and paid Stripe subscriptions are unchanged.">
            <Input
              type="number"
              min={1}
              max={365}
              step={1}
              disabled={!settingsReady || settingsSaving}
              value={trialLength}
              onChange={(e) => setTrialLength(Number(e.target.value))}
            />
          </Field>
          <Field label="Default verification provider" hint="Current eligibility integration. Additional providers are not configured.">
            <Select value="stedi" disabled>
              <option value="stedi">Stedi</option>
            </Select>
          </Field>
        </Card>
      </div>

      {pendingMfa !== null && (
        <Modal
          title={pendingMfa ? "Enable Super Admin MFA" : "Disable Super Admin MFA"}
          width={480}
          onClose={() => !mfaSaving && setPendingMfa(null)}
          footer={
            <>
              <Btn variant="outline" disabled={mfaSaving} onClick={() => setPendingMfa(null)}>Cancel</Btn>
              <Btn disabled={mfaSaving || !mfaPassword} onClick={confirmMfaChange}>
                {mfaSaving ? "Confirmingâ€¦" : pendingMfa ? "Enable MFA" : "Disable MFA"}
              </Btn>
            </>
          }
        >
          <div className="text-[13px] leading-relaxed mb-4" style={{ color: C.textMute }}>
            {pendingMfa
              ? "Every Super Admin will need a one-time code sent to their registered email after entering their password."
              : "Super Admins will return to password-only sign in. Existing signed-in sessions will remain active."}
          </div>
          <Field label="Current password" hint="Required for both enabling and disabling this platform security policy.">
            <Input
              type="password"
              value={mfaPassword}
              onChange={(event) => setMfaPassword(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") confirmMfaChange();
              }}
              autoComplete="current-password"
              autoFocus
              placeholder="Enter your Super Admin password"
              disabled={mfaSaving}
            />
          </Field>
          {mfaError && (
            <div role="alert" className="rounded-lg px-3 py-2.5 text-[12px]" style={{ background: C.dangerSoft, color: C.danger }}>
              {mfaError}
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
