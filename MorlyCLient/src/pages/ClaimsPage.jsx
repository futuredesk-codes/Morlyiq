import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  CheckCircle2,
  CircleDollarSign,
  ClipboardCheck,
  Clock3,
  ExternalLink,
  FileCheck2,
  FileText,
  LockKeyhole,
  Pencil,
  Plus,
  ReceiptText,
  RefreshCw,
  Send,
  ShieldCheck,
  Trash2,
  WalletCards,
} from "lucide-react";
import { Badge, StatusBadge } from "../components/common/Badge";
import { Btn, IconBtn } from "../components/common/Button";
import { Card } from "../components/common/Card";
import { EmptyState, SectionHeader } from "../components/common/Feedback";
import { Field, Input, Select } from "../components/common/FormControls";
import { Modal } from "../components/common/Modal";
import { fetchCdtCodesApi } from "../services/cdtService";
import {
  createClaimApi,
  fetchClaimsConfigurationApi,
  fetchClaimsApi,
  submitClaimApi,
  updateClaimApi,
  validateClaimApi,
} from "../services/claimService";
import { fetchEraPdfApi, fetchErasApi } from "../services/eraService";
import { useApp } from "../store/useApp";
import { usePatients } from "../store/usePatients";

const editableStatuses = new Set(["draft", "validation_failed", "ready", "stedi_rejected", "submission_error"]);
const submitRoles = new Set(["Owner", "Manager", "Billing"]);
const eligibilityLabels = {
  confirmed: "Confirmed",
  missing: "Not verified",
  failed: "Verification failed",
  partial: "Partially verified",
  stale: "Verification stale",
};
const today = () => new Date().toISOString().slice(0, 10);
const money = (cents) => `$${(Number(cents || 0) / 100).toFixed(2)}`;
const payerName = (value) => String(value || "").trim() === "Stedi Test Payer" ? "Stedi Payer" : value;
const readableDate = (value) => value
  ? new Date(value).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })
  : "—";

const emptyLine = (code = "") => ({
  code,
  serviceDate: today(),
  charge: "",
  units: 1,
  toothNumber: "",
  toothSurfaces: "",
});

const initialForm = (patientId = "", patient = null) => ({
  patientId,
  patient: {
    firstName: patient?.name?.split(/\s+/)[0] || "",
    lastName: patient?.name?.split(/\s+/).slice(1).join(" ") || patient?.name || "",
    gender: "U",
    address: { address1: "", city: "", state: "", postalCode: "" },
  },
  diagnosisCode: "",
  placeOfServiceCode: "11",
  serviceLines: [emptyLine(patient?.codes?.[0] || "")],
  testDataConfirmed: false,
});

const claimToForm = (claim) => ({
  patientId: claim.patientId,
  patient: {
    firstName: claim.patient.firstName,
    lastName: claim.patient.lastName,
    gender: claim.patient.gender,
    address: { ...claim.patient.address },
  },
  diagnosisCode: claim.diagnosisCode || "",
  placeOfServiceCode: claim.placeOfServiceCode || "11",
  serviceLines: claim.serviceLines.map((line) => ({
    code: line.code,
    serviceDate: line.serviceDate,
    charge: (line.chargeCents / 100).toFixed(2),
    units: line.units,
    toothNumber: line.toothNumber || "",
    toothSurfaces: (line.toothSurfaces || []).join(", "),
  })),
  testDataConfirmed: claim.testDataConfirmed,
});

function Stat({ label, value, tone = "text-brand-text" }) {
  return (
    <Card className="!p-4 min-w-0">
      <div className="font-sans text-[10.5px] font-bold uppercase tracking-[0.45px] text-textFaint">{label}</div>
      <div className={`font-sans text-[24px] font-extrabold mt-1 ${tone}`}>{value}</div>
    </Card>
  );
}

function EraMetric({ icon: Icon, label, value, note, tone = "text-brand-blue" }) {
  return (
    <Card className="!p-4 min-w-0">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blueSoft text-brand-blue">
          <Icon size={17} />
        </div>
        <div className="min-w-0">
          <div className="font-sans text-[10px] font-bold uppercase tracking-[0.45px] text-textFaint">{label}</div>
          <div className={`mt-0.5 truncate font-sans text-[21px] font-extrabold ${tone}`}>{value}</div>
          <div className="mt-0.5 truncate font-sans text-[10.5px] text-textMute">{note}</div>
        </div>
      </div>
    </Card>
  );
}

function EraTab({ tenant, eras, pendingClaims, sync, loading, error, pdfBusy, onOpenPdf }) {
  const entitlements = tenant?.entitlements || {};
  const eraEnabled = entitlements.era !== false;
  const pdfEnabled = eraEnabled && entitlements.era_pdfs !== false;
  const totals = eras.reduce((result, row) => ({
    paid: result.paid + row.paidCents,
    patient: result.patient + row.patientResponsibilityCents,
    adjustments: result.adjustments + row.adjustmentCents,
  }), { paid: 0, patient: 0, adjustments: 0 });
  const badgeTone = (status) => status === "Paid" ? "success" : status === "Partial" ? "warn" : status === "No payment" ? "neutral" : "danger";

  return (
    <div>
      <div className="mb-4 grid grid-cols-2 gap-2.5 xl:grid-cols-4">
        <EraMetric icon={ReceiptText} label="ERAs received" value={eras.length} note="Matched Stedi responses" />
        <EraMetric icon={CircleDollarSign} label="Total paid" value={money(totals.paid)} note="Insurance payments" tone="text-brand-success" />
        <EraMetric icon={WalletCards} label="Patient responsibility" value={money(totals.patient)} note="Estimated patient share" />
        <EraMetric icon={FileCheck2} label="Adjustments" value={money(totals.adjustments)} note="Contractual and payer adjustments" tone="text-brand-warn" />
      </div>

      {!eraEnabled && (
        <div className="mb-4 flex items-start gap-3 rounded-[11px] border border-amber-200 bg-warnSoft px-4 py-3 font-sans">
          <LockKeyhole size={17} className="mt-0.5 shrink-0 text-brand-warn" />
          <div>
            <div className="text-[12.5px] font-bold text-brand-text">ERA processing is not included in your plan</div>
            <div className="mt-0.5 text-[11.5px] text-textMute">Upgrade the clinic plan to retrieve Stedi 835 remittance responses.</div>
          </div>
        </div>
      )}
      {eraEnabled && !pdfEnabled && (
        <div className="mb-4 flex items-start gap-3 rounded-[11px] border border-brand-border bg-blueSoft/60 px-4 py-3 font-sans">
          <FileText size={17} className="mt-0.5 shrink-0 text-brand-blue" />
          <div>
            <div className="text-[12.5px] font-bold text-brand-text">ERA data is available, but ERA PDFs are not included in your plan</div>
            <div className="mt-0.5 text-[11.5px] text-textMute">Payment details remain visible. Stedi PDF access stays locked until the ERA PDFs feature is enabled.</div>
          </div>
        </div>
      )}

      {eraEnabled && error && (
        <div className="mb-4 flex items-start gap-3 rounded-[11px] border border-red-200 bg-dangerSoft px-4 py-3 font-sans">
          <AlertTriangle size={17} className="mt-0.5 shrink-0 text-brand-danger" />
          <div>
            <div className="text-[12.5px] font-bold text-brand-text">Stedi ERAs could not be loaded</div>
            <div className="mt-0.5 text-[11.5px] text-textMute">{error}</div>
          </div>
        </div>
      )}

      {eraEnabled && pendingClaims.length > 0 && (
        <div className="mb-4 rounded-[11px] border border-blue-200 bg-blueSoft/60 px-4 py-3 font-sans">
          <div className="flex items-start gap-3">
            <Clock3 size={17} className="mt-0.5 shrink-0 text-brand-blue" />
            <div className="min-w-0">
              <div className="text-[12.5px] font-bold text-brand-text">Waiting for Stedi 835</div>
              <div className="mt-0.5 text-[11.5px] text-textMute">The claim passed the initial submission step. MorlyIQ is checking for the asynchronous ERA response.</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {pendingClaims.map((claim) => (
                  <span key={claim.claimNumber} className="rounded-full border border-brand-border bg-white px-2.5 py-1 font-mono text-[10.5px] text-brand-text">
                    {claim.claimNumber}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {eraEnabled && !error && sync.failedReports > 0 && (
        <div className="mb-4 flex items-start gap-3 rounded-[11px] border border-amber-200 bg-warnSoft px-4 py-3 font-sans">
          <AlertTriangle size={17} className="mt-0.5 shrink-0 text-brand-warn" />
          <div className="text-[11.5px] text-textMute">{sync.failedReports} Stedi ERA report{sync.failedReports === 1 ? "" : "s"} could not be read during the latest refresh.</div>
        </div>
      )}

      <Card noPad className="overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-brand-border px-4 py-3">
          <div>
            <div className="font-sans text-[13px] font-bold text-brand-text">Electronic remittance advice</div>
            <div className="mt-0.5 font-sans text-[10.5px] text-textMute">Clinic-matched payment details from Stedi 835 responses</div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px] border-collapse font-sans text-[12.5px]">
            <thead className="bg-[#F4F7FD] text-[10px] uppercase tracking-[0.35px] text-textMute">
              <tr>
                <th className="p-3.5 text-left">ERA / Claim</th>
                <th className="p-3.5 text-left">Patient</th>
                <th className="p-3.5 text-left">Payer</th>
                <th className="p-3.5 text-left">Received</th>
                <th className="p-3.5 text-right">Billed</th>
                <th className="p-3.5 text-right">Paid</th>
                <th className="p-3.5 text-right">Patient share</th>
                <th className="p-3.5 text-right">Adjustments</th>
                <th className="p-3.5 text-left">Status</th>
                <th className="p-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {!loading && eras.map((row) => (
                <tr key={row.id} className="border-t border-brand-border hover:bg-slate-50/70">
                  <td className="p-3.5">
                    <div className="max-w-[180px] truncate font-mono text-[11px] font-semibold text-brand-text" title={row.transactionId}>{row.eraReference || row.transactionId}</div>
                    <div className="mt-1 font-mono text-[10px] text-textFaint">{row.claimNumber}</div>
                  </td>
                  <td className="p-3.5 font-semibold text-brand-text">{row.patient}</td>
                  <td className="p-3.5 text-textMute">{payerName(row.payer)}</td>
                  <td className="p-3.5 text-textMute">{row.received ? new Date(row.received).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}</td>
                  <td className="p-3.5 text-right font-mono">{money(row.billedCents)}</td>
                  <td className="p-3.5 text-right font-mono font-semibold text-brand-success">{money(row.paidCents)}</td>
                  <td className="p-3.5 text-right font-mono">{money(row.patientResponsibilityCents)}</td>
                  <td className="p-3.5 text-right font-mono text-textMute">{money(row.adjustmentCents)}</td>
                  <td className="p-3.5"><Badge tone={badgeTone(row.status)}>{row.status}</Badge></td>
                  <td className="p-3.5 text-right">
                    {!eraEnabled ? (
                      <span className="inline-flex max-w-[160px] items-center justify-end gap-1.5 text-left text-[10.5px] leading-tight text-textFaint"><LockKeyhole size={13} className="shrink-0" /> ERA not on your plan</span>
                    ) : !pdfEnabled ? (
                      <span className="inline-flex max-w-[160px] items-center justify-end gap-1.5 text-left text-[10.5px] leading-tight text-textFaint"><LockKeyhole size={13} className="shrink-0" /> ERA PDF not on your plan</span>
                    ) : (
                      <Btn size="sm" variant="outline" icon={ExternalLink} disabled={pdfBusy === row.transactionId} onClick={() => onOpenPdf(row)}>
                        {pdfBusy === row.transactionId ? "Opening…" : "Open PDF"}
                      </Btn>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {loading && <div className="py-12 text-center font-sans text-[13px] text-textMute">Loading Stedi ERAs…</div>}
          {!loading && eraEnabled && !error && eras.length === 0 && pendingClaims.length === 0 && (
            <EmptyState icon={ReceiptText} text="No ERA found yet. Create, validate and submit a claim to begin." />
          )}
          {!loading && eraEnabled && !error && eras.length === 0 && pendingClaims.length > 0 && (
            <EmptyState icon={Clock3} text="Claim accepted; waiting for Stedi to generate the 835 ERA." />
          )}
          {!eraEnabled && <EmptyState icon={LockKeyhole} text="ERA records are unavailable on the current plan." />}
        </div>
      </Card>
      <div className="mt-3 flex items-center gap-2 font-sans text-[11px] text-textFaint">
        <FileText size={14} className="shrink-0" /> Data comes from Stedi's 835 Report API and is matched to this clinic using the claim Patient Control Number.
      </div>
    </div>
  );
}

function ClaimFormModal({ claim, patients, codes, defaultPatientId, saving, requiresSyntheticDataConfirmation, onClose, onSave }) {
  const defaultPatient = patients.find((item) => item.id === defaultPatientId);
  const [form, setForm] = useState(() => claim ? claimToForm(claim) : initialForm(defaultPatientId, defaultPatient));
  const selectedPatient = patients.find((item) => item.id === form.patientId);

  const choosePatient = (patientId) => {
    const patient = patients.find((item) => item.id === patientId);
    setForm(initialForm(patientId, patient));
  };
  const setPatientField = (key, value) => setForm((current) => ({
    ...current,
    patient: { ...current.patient, [key]: value },
  }));
  const setAddress = (key, value) => setForm((current) => ({
    ...current,
    patient: { ...current.patient, address: { ...current.patient.address, [key]: value } },
  }));
  const setLine = (index, key, value) => setForm((current) => ({
    ...current,
    serviceLines: current.serviceLines.map((line, lineIndex) => lineIndex === index ? { ...line, [key]: value } : line),
  }));
  const addLine = () => setForm((current) => ({ ...current, serviceLines: [...current.serviceLines, emptyLine()] }));
  const removeLine = (index) => setForm((current) => ({
    ...current,
    serviceLines: current.serviceLines.filter((_, lineIndex) => lineIndex !== index),
  }));

  const valid = Boolean(
    form.patientId
    && form.patient.firstName.trim()
    && form.patient.lastName.trim()
    && form.patient.address.address1.trim()
    && form.patient.address.city.trim()
    && /^[A-Za-z]{2}$/.test(form.patient.address.state.trim())
    && /^\d{5}(-\d{4})?$/.test(form.patient.address.postalCode.trim())
    && form.serviceLines.length
    && form.serviceLines.every((line) => /^D\d{4}$/.test(line.code) && line.serviceDate && Number(line.charge) > 0)
    && (!requiresSyntheticDataConfirmation || form.testDataConfirmed)
  );

  return (
    <Modal
      title={claim ? `Edit ${claim.claimNumber}` : "New dental claim"}
      width={820}
      onClose={onClose}
      footer={(
        <>
          <Btn variant="outline" onClick={onClose}>Cancel</Btn>
          <Btn disabled={!valid || saving} onClick={() => onSave(form)}>{saving ? "Saving…" : "Save draft"}</Btn>
        </>
      )}
    >
      {requiresSyntheticDataConfirmation && (
        <div className="rounded-[10px] bg-warnSoft px-3.5 py-3 mb-4 flex gap-2.5 text-[12.5px] text-brand-text">
          <AlertTriangle size={16} className="text-brand-warn shrink-0 mt-0.5" />
          <div><strong>Use synthetic data only.</strong> Do not enter real patient PHI. Use synthetic patient, member and address data.</div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3.5">
        <Field label="Patient" className="sm:col-span-2">
          <Select className="w-full" value={form.patientId} disabled={Boolean(claim)} onChange={(event) => choosePatient(event.target.value)}>
            <option value="">Select patient</option>
            {patients.map((patient) => <option key={patient.id} value={patient.id}>{patient.name} — {patient.payer}</option>)}
          </Select>
        </Field>
        <Field label="First name"><Input value={form.patient.firstName} onChange={(event) => setPatientField("firstName", event.target.value)} /></Field>
        <Field label="Last name"><Input value={form.patient.lastName} onChange={(event) => setPatientField("lastName", event.target.value)} /></Field>
        <Field label="Gender">
          <Select className="w-full" value={form.patient.gender} onChange={(event) => setPatientField("gender", event.target.value)}>
            <option value="U">Unknown / unspecified</option><option value="M">Male</option><option value="F">Female</option>
          </Select>
        </Field>
        <Field label="Place of service"><Input value={form.placeOfServiceCode} maxLength={2} onChange={(event) => setForm({ ...form, placeOfServiceCode: event.target.value.replace(/\D/g, "") })} /></Field>
        <Field label="Street address" className="sm:col-span-2"><Input value={form.patient.address.address1} onChange={(event) => setAddress("address1", event.target.value)} /></Field>
        <Field label="City"><Input value={form.patient.address.city} onChange={(event) => setAddress("city", event.target.value)} /></Field>
        <div className="grid grid-cols-[100px_1fr] gap-2">
          <Field label="State"><Input value={form.patient.address.state} maxLength={2} onChange={(event) => setAddress("state", event.target.value.toUpperCase())} /></Field>
          <Field label="ZIP code"><Input value={form.patient.address.postalCode} onChange={(event) => setAddress("postalCode", event.target.value)} /></Field>
        </div>
        <Field label="Diagnosis code (optional)" className="sm:col-span-2" hint="Enter without punctuation, for example K029.">
          <Input value={form.diagnosisCode} onChange={(event) => setForm({ ...form, diagnosisCode: event.target.value.toUpperCase() })} />
        </Field>
      </div>

      <div className="flex items-center justify-between mt-2 mb-2">
        <div className="font-sans text-[13px] font-bold text-brand-text">CDT service lines</div>
        <Btn size="sm" variant="outline" icon={Plus} onClick={addLine}>Add line</Btn>
      </div>
      <div className="space-y-2.5">
        {form.serviceLines.map((line, index) => (
          <div key={index} className="border border-brand-border rounded-[10px] p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1.25fr_1fr_0.8fr_0.55fr_auto] gap-2 items-end">
            <Field label="CDT code" className="!mb-0">
              <Select className="w-full" value={line.code} onChange={(event) => setLine(index, "code", event.target.value)}>
                <option value="">Select code</option>
                {codes.map((code) => <option key={code.code} value={code.code}>{code.code} — {code.description}</option>)}
              </Select>
            </Field>
            <Field label="Service date" className="!mb-0"><Input type="date" value={line.serviceDate} onChange={(event) => setLine(index, "serviceDate", event.target.value)} /></Field>
            <Field label="Charge ($)" className="!mb-0"><Input type="number" min="0.01" step="0.01" value={line.charge} onChange={(event) => setLine(index, "charge", event.target.value)} /></Field>
            <Field label="Units" className="!mb-0"><Input type="number" min="1" max="99" value={line.units} onChange={(event) => setLine(index, "units", event.target.value)} /></Field>
            <IconBtn icon={Trash2} tone="danger" title="Remove line" onClick={() => removeLine(index)} />
            <Field label="Tooth number (optional)" className="!mb-0"><Input value={line.toothNumber} onChange={(event) => setLine(index, "toothNumber", event.target.value)} /></Field>
            <Field label="Surfaces (optional)" className="!mb-0 sm:col-span-1 lg:col-span-3"><Input value={line.toothSurfaces} placeholder="M, O, D" onChange={(event) => setLine(index, "toothSurfaces", event.target.value)} /></Field>
          </div>
        ))}
      </div>
      {selectedPatient && <div className="mt-3 text-[11.5px] text-textMute">Payer snapshot: {selectedPatient.payer} · Member ID ending {selectedPatient.subscriberId?.slice(-4) || "—"}</div>}
      {requiresSyntheticDataConfirmation && (
        <label className="mt-4 flex items-start gap-2.5 text-[12.5px] text-brand-text cursor-pointer">
          <input type="checkbox" className="mt-0.5 accent-[#2F6FED]" checked={form.testDataConfirmed} onChange={(event) => setForm({ ...form, testDataConfirmed: event.target.checked })} />
          I confirm this claim contains synthetic data only and no real patient PHI/PII.
        </label>
      )}
    </Modal>
  );
}

function ClaimDetailModal({ claim, role, busy, onClose, onEdit, onValidate, onSubmit, onProviderSetup, onEligibilityCheck }) {
  const issues = [...(claim.validationErrors || []), ...(claim.stedi?.errors || [])];
  const warnings = (claim.validationWarnings || []).filter((issue) => issue.field !== "eligibility");
  const providerIssue = issues.some((issue) => String(issue.field || "").startsWith("billingProvider"));
  const eligibilityConfirmed = claim.eligibility?.status === "confirmed";
  return (
    <Modal
      title={claim.claimNumber}
      width={760}
      onClose={onClose}
      footer={<Btn variant="outline" onClick={onClose}>Close</Btn>}
    >
      <div className="flex flex-wrap justify-between gap-3 items-start mb-4">
        <div>
          <div className="font-sans text-[18px] font-bold text-brand-text">{claim.patient.fullName}</div>
          <div className="font-sans text-[12.5px] text-textMute mt-1">{payerName(claim.payer.name)} · 837D · Created {readableDate(claim.createdAt)}</div>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={claim.status} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mb-4">
        <div className="bg-blueSoft2 rounded-[9px] p-3"><div className="text-[10.5px] uppercase font-bold text-textFaint">Total charge</div><div className="font-mono font-semibold mt-1">{money(claim.totalChargeCents)}</div></div>
        <div className="bg-blueSoft2 rounded-[9px] p-3"><div className="text-[10.5px] uppercase font-bold text-textFaint">Provider</div><div className="text-[12.5px] font-semibold mt-1">{claim.billingProvider.organizationName || "Not configured"}</div></div>
        <div className="bg-blueSoft2 rounded-[9px] p-3"><div className="text-[10.5px] uppercase font-bold text-textFaint">Stedi reference</div><div className="text-[12px] font-mono mt-1 break-all">{claim.stedi?.correlationId || "Not submitted"}</div></div>
      </div>

      <div className={`mb-4 rounded-[10px] border p-3.5 ${eligibilityConfirmed ? "border-emerald-200 bg-successSoft" : "border-amber-200 bg-warnSoft"}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 gap-2.5">
            {eligibilityConfirmed
              ? <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-brand-success" />
              : <AlertTriangle size={17} className="mt-0.5 shrink-0 text-brand-warn" />}
            <div>
              <div className="font-sans text-[12.5px] font-bold text-brand-text">
                Eligibility: {eligibilityLabels[claim.eligibility?.status] || "Not available"}
              </div>
              <div className="mt-0.5 font-sans text-[11.5px] text-textMute">{claim.eligibility?.message}</div>
              {claim.eligibility?.checkedAt && (
                <div className="mt-1 font-sans text-[10.5px] text-textFaint">Last checked {readableDate(claim.eligibility.checkedAt)}</div>
              )}
            </div>
          </div>
          {!eligibilityConfirmed && editableStatuses.has(claim.status) && (
            <Btn size="sm" variant="outline" icon={ShieldCheck} onClick={onEligibilityCheck}>Verify eligibility</Btn>
          )}
        </div>
      </div>

      <div className="overflow-x-auto border border-brand-border rounded-[10px] mb-4">
        <table className="w-full min-w-[600px] border-collapse font-sans text-[12.5px]">
          <thead className="bg-[#F4F7FD] text-[10.5px] uppercase text-textMute"><tr><th className="p-2.5 text-left">CDT</th><th className="p-2.5 text-left">Description</th><th className="p-2.5 text-left">Date</th><th className="p-2.5 text-right">Units</th><th className="p-2.5 text-right">Charge</th></tr></thead>
          <tbody>{claim.serviceLines.map((line) => <tr key={line._id || line.providerControlNumber} className="border-t border-brand-border"><td className="p-2.5 font-mono text-navy">{line.code}</td><td className="p-2.5">{line.description || "—"}</td><td className="p-2.5">{line.serviceDate}</td><td className="p-2.5 text-right">{line.units}</td><td className="p-2.5 text-right font-mono">{money(line.chargeCents)}</td></tr>)}</tbody>
        </table>
      </div>

      {(issues.length > 0 || warnings.length > 0) && (
        <div className="space-y-2 mb-4">
          {issues.map((issue, index) => <div key={`e-${index}`} className="flex gap-2 rounded-[9px] bg-dangerSoft p-3 text-[12.5px]"><AlertTriangle size={15} className="text-brand-danger shrink-0" /><span>{issue.message}</span></div>)}
          {warnings.map((issue, index) => <div key={`w-${index}`} className="flex gap-2 rounded-[9px] bg-warnSoft p-3 text-[12.5px]"><AlertTriangle size={15} className="text-brand-warn shrink-0" /><span>{issue.message}</span></div>)}
        </div>
      )}

      {claim.status === "stedi_accepted" && (
        <div className="flex gap-2 rounded-[9px] bg-successSoft p-3 mb-4 text-[12.5px]"><CheckCircle2 size={16} className="text-brand-success shrink-0" /><span>Stedi accepted the initial 837D submission. This does not mean the payer adjudicated, approved, or paid the claim.</span></div>
      )}

      <div className="flex flex-wrap gap-2">
        {providerIssue && <Btn variant="outline" icon={ShieldCheck} onClick={onProviderSetup}>Provider setup</Btn>}
        {editableStatuses.has(claim.status) && <Btn variant="outline" icon={Pencil} disabled={busy} onClick={onEdit}>Edit draft</Btn>}
        {editableStatuses.has(claim.status) && <Btn variant="outline" icon={ClipboardCheck} disabled={busy} onClick={onValidate}>{busy ? "Working…" : "Validate"}</Btn>}
        {claim.status === "ready" && submitRoles.has(role) && eligibilityConfirmed && <Btn icon={Send} disabled={busy} onClick={onSubmit}>{busy ? "Submitting…" : "Submit claim"}</Btn>}
        {claim.status === "ready" && submitRoles.has(role) && !eligibilityConfirmed && <div className="self-center text-[12px] font-medium text-brand-warn">Successful eligibility verification is required before submission.</div>}
        {claim.status === "ready" && !submitRoles.has(role) && <div className="text-[12px] text-textMute self-center">Only Owner, Manager or Billing can submit.</div>}
      </div>
    </Modal>
  );
}

export default function ClaimsPage() {
  usePatients();
  const navigate = useNavigate();
  const { clinicId, patients, clinicClaims, setClaims, role, tenant, push } = useApp();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState("claims");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [codes, setCodes] = useState([]);
  const [claimsConfiguration, setClaimsConfiguration] = useState({ environment: "test", requiresSyntheticDataConfirmation: true });
  const [formClaim, setFormClaim] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [detail, setDetail] = useState(null);
  const [eras, setEras] = useState([]);
  const [pendingEras, setPendingEras] = useState([]);
  const [eraSync, setEraSync] = useState({ mode: "test", transactionCount: 0, failedReports: 0, syncedAt: null });
  const [eraLoading, setEraLoading] = useState(false);
  const [eraError, setEraError] = useState("");
  const [pdfBusy, setPdfBusy] = useState("");
  const openedPatient = useRef("");
  const erasLoadedForClinic = useRef("");
  const erasRequestForClinic = useRef("");

  const refresh = async () => {
    if (!clinicId) return;
    setLoading(true);
    try {
      const [items, configuration] = await Promise.all([
        fetchClaimsApi(clinicId),
        fetchClaimsConfigurationApi(clinicId),
      ]);
      setClaims(items);
      setClaimsConfiguration(configuration);
    } catch (error) {
      push(error.message, "danger");
    } finally {
      setLoading(false);
    }
  };

  const refreshEras = async ({ notify = false } = {}) => {
    if (!clinicId || tenant?.entitlements?.era === false) return;
    if (erasRequestForClinic.current === clinicId) return;
    erasRequestForClinic.current = clinicId;
    setEraLoading(true);
    setEraError("");
    try {
      const result = await fetchErasApi(clinicId);
      setEras(Array.isArray(result?.eras) ? result.eras : []);
      setPendingEras(Array.isArray(result?.pendingClaims) ? result.pendingClaims : []);
      setEraSync({
        mode: result?.mode || "test",
        transactionCount: Number(result?.transactionCount) || 0,
        failedReports: Number(result?.failedReports) || 0,
        syncedAt: result?.syncedAt || null,
      });
      erasLoadedForClinic.current = clinicId;
      if (notify) push("Stedi ERAs refreshed");
    } catch (error) {
      setEras([]);
      setEraError(error.message);
      if (notify) push(error.message, "danger");
    } finally {
      if (erasRequestForClinic.current === clinicId) erasRequestForClinic.current = "";
      setEraLoading(false);
    }
  };

  const openStediEraPdf = async (era) => {
    const pdfWindow = window.open("about:blank", "_blank");
    if (pdfWindow) {
      pdfWindow.opener = null;
      pdfWindow.document.title = "Loading ERA PDF";
      pdfWindow.document.body.innerHTML = '<div style="font:14px Arial,sans-serif;padding:24px;color:#0f2344">Loading secure Stedi ERA PDF...</div>';
    }
    setPdfBusy(era.transactionId);
    try {
      const blob = await fetchEraPdfApi(clinicId, era.transactionId);
      const url = URL.createObjectURL(blob);
      if (pdfWindow) pdfWindow.location.replace(url);
      else window.open(url, "_blank", "noopener,noreferrer");
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) {
      if (pdfWindow) pdfWindow.close();
      push(error.message, "danger");
    } finally {
      setPdfBusy("");
    }
  };

  useEffect(() => { refresh(); }, [clinicId]);
  useEffect(() => {
    setEras([]);
    setPendingEras([]);
    setEraSync({ mode: "test", transactionCount: 0, failedReports: 0, syncedAt: null });
    setEraError("");
    erasLoadedForClinic.current = "";
    erasRequestForClinic.current = "";
  }, [clinicId]);
  useEffect(() => {
    if (activeTab === "eras" && clinicId && erasLoadedForClinic.current !== clinicId) refreshEras();
  }, [activeTab, clinicId]);
  useEffect(() => { fetchCdtCodesApi().then(setCodes).catch((error) => push(error.message, "danger")); }, [push]);
  useEffect(() => {
    const patientId = searchParams.get("patientId") || "";
    if (!patientId || !patients.some((patient) => patient.id === patientId) || openedPatient.current === patientId) return;
    openedPatient.current = patientId;
    setActiveTab("claims");
    setFormClaim(null);
    setShowForm(true);
  }, [searchParams, patients]);

  const stats = useMemo(() => ({
    drafts: clinicClaims.filter((item) => ["draft", "validation_failed"].includes(item.status)).length,
    ready: clinicClaims.filter((item) => item.status === "ready").length,
    accepted: clinicClaims.filter((item) => item.status === "stedi_accepted").length,
    issues: clinicClaims.filter((item) => ["stedi_rejected", "submission_error"].includes(item.status)).length,
  }), [clinicClaims]);

  const closeForm = () => {
    setShowForm(false);
    setFormClaim(null);
    if (searchParams.has("patientId")) {
      const next = new URLSearchParams(searchParams);
      next.delete("patientId");
      setSearchParams(next, { replace: true });
    }
  };

  const save = async (payload) => {
    setSaving(true);
    try {
      const saved = formClaim
        ? await updateClaimApi(clinicId, formClaim.id, payload)
        : await createClaimApi(clinicId, payload);
      setClaims((items) => formClaim
        ? items.map((item) => item.id === saved.id ? saved : item)
        : [saved, ...items]);
      closeForm();
      setDetail(saved);
      push("Claim draft saved");
    } catch (error) {
      push(error.message, "danger");
    } finally {
      setSaving(false);
    }
  };

  const runAction = async (action, successMessage) => {
    setBusy(true);
    try {
      const updated = await action();
      setClaims((items) => items.map((item) => item.id === updated.id ? updated : item));
      setDetail(updated);
      push(successMessage);
      return updated;
    } catch (error) {
      push(error.message, "danger");
      try {
        const items = await fetchClaimsApi(clinicId);
        setClaims(items);
        setDetail((current) => items.find((item) => item.id === current?.id) || null);
      } catch {
        setDetail(null);
      }
      return null;
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <SectionHeader
        title="Claims & ERAs"
        subtitle="Claim submission, validation, acknowledgments and electronic remittance advice"
        action={activeTab === "claims" ? (
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <Btn variant="outline" icon={RefreshCw} disabled={loading} onClick={refresh}>
              {loading ? "Refreshing…" : "Refresh"}
            </Btn>
            <Btn icon={Plus} onClick={() => { setFormClaim(null); setShowForm(true); }}>
              New claim
            </Btn>
          </div>
        ) : tenant?.entitlements?.era === false ? null : (
          <Btn variant="outline" icon={RefreshCw} disabled={eraLoading} onClick={() => refreshEras({ notify: true })}>
            {eraLoading ? "Refreshing…" : "Refresh ERAs"}
          </Btn>
        )}
      />
      <div className="mb-5 flex items-center gap-2 border-b border-brand-border pb-4">
        <button
          type="button"
          onClick={() => setActiveTab("claims")}
          className={`rounded-full border px-5 py-2 font-sans text-[12px] font-bold transition-colors ${activeTab === "claims" ? "border-navy bg-navy text-white" : "border-brand-border bg-white text-textMute hover:border-brand-blue hover:text-brand-blue"}`}
        >
          Claims
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("eras")}
          className={`rounded-full border px-5 py-2 font-sans text-[12px] font-bold transition-colors ${activeTab === "eras" ? "border-navy bg-navy text-white" : "border-brand-border bg-white text-textMute hover:border-brand-blue hover:text-brand-blue"}`}
        >
          ERAs
        </button>
      </div>

      {activeTab === "claims" ? <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mb-4">
        <Stat label="Drafts" value={stats.drafts} />
        <Stat label="Ready" value={stats.ready} tone="text-brand-blue" />
        <Stat label="Stedi accepted" value={stats.accepted} tone="text-brand-success" />
        <Stat label="Needs attention" value={stats.issues} tone="text-brand-danger" />
      </div>

      <Card noPad className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] border-collapse font-sans text-[13px]">
            <thead className="bg-[#F4F7FD] text-[10.5px] uppercase text-textMute">
              <tr><th className="p-3.5 text-left">Claim</th><th className="p-3.5 text-left">Patient</th><th className="p-3.5 text-left">Payer</th><th className="p-3.5 text-left">Services</th><th className="p-3.5 text-right">Charge</th><th className="p-3.5 text-left">Status</th><th className="p-3.5 text-right">Action</th></tr>
            </thead>
            <tbody>
              {!loading && clinicClaims.map((claim) => (
                <tr key={claim.id} className="border-t border-brand-border hover:bg-slate-50/70">
                  <td className="p-3.5"><button className="font-mono text-[12px] font-semibold text-navy hover:underline" onClick={() => setDetail(claim)}>{claim.claimNumber}</button></td>
                  <td className="p-3.5 font-semibold text-brand-text">{claim.patient.fullName}</td>
                  <td className="p-3.5 text-textMute">{payerName(claim.payer.name)}</td>
                  <td className="p-3.5 text-textMute">{claim.serviceLines.map((line) => line.code).join(", ")}</td>
                  <td className="p-3.5 text-right font-mono">{money(claim.totalChargeCents)}</td>
                  <td className="p-3.5"><StatusBadge status={claim.status} /></td>
                  <td className="p-3.5 text-right"><Btn size="sm" variant="outline" onClick={() => setDetail(claim)}>Open</Btn></td>
                </tr>
              ))}
            </tbody>
          </table>
          {loading && <div className="py-12 text-center font-sans text-[13px] text-textMute">Loading claims…</div>}
          {!loading && clinicClaims.length === 0 && <EmptyState icon={FileCheck2} text="No claim drafts yet. Create a claim to begin." />}
        </div>
      </Card>
      <div className="mt-3 flex items-center gap-2 font-sans text-[11.5px] text-textFaint"><ShieldCheck size={14} /> Acceptance confirms only the initial Stedi 837D step—not payer adjudication or payment.</div>
      </> : (
        <EraTab
          tenant={tenant}
          eras={eras}
          pendingClaims={pendingEras}
          sync={eraSync}
          loading={eraLoading}
          error={eraError}
          pdfBusy={pdfBusy}
          onOpenPdf={openStediEraPdf}
        />
      )}

      {showForm && (
        <ClaimFormModal
          claim={formClaim}
          patients={patients}
          codes={codes}
          defaultPatientId={searchParams.get("patientId") || ""}
          saving={saving}
          requiresSyntheticDataConfirmation={formClaim
            ? formClaim.environment === "test"
            : claimsConfiguration.requiresSyntheticDataConfirmation}
          onClose={closeForm}
          onSave={save}
        />
      )}
      {detail && (
        <ClaimDetailModal
          claim={detail}
          role={role}
          busy={busy}
          onClose={() => setDetail(null)}
          onEdit={() => { setFormClaim(detail); setShowForm(true); setDetail(null); }}
          onValidate={() => runAction(() => validateClaimApi(clinicId, detail.id), "Claim validation passed")}
          onSubmit={() => runAction(() => submitClaimApi(clinicId, detail.id), "Claim submitted to Stedi")}
          onProviderSetup={() => navigate("/clinics")}
          onEligibilityCheck={() => navigate(`/patients/${encodeURIComponent(detail.patientId)}/eligibility`)}
        />
      )}
    </div>
  );
}
