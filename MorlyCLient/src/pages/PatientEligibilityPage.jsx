import React, { useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { useNavigate, useParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  FileCheck2,
  Layers,
  Pencil,
  ShieldCheck,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Badge, StatusBadge } from "../components/common/Badge";
import { Btn } from "../components/common/Button";
import { Card } from "../components/common/Card";
import { Field, Input, Select } from "../components/common/FormControls";
import { Modal } from "../components/common/Modal";
import { fetchDentalPayersApi } from "../services/payerService";
import {
  removeSecondaryInsuranceApi,
  saveSecondaryInsuranceApi,
  updatePatientApi,
  verifyPatientEligibilityApi,
} from "../services/patientService";
import { useApp } from "../store/useApp";
import { usePatients } from "../store/usePatients";
import { CDT_LIB } from "../constants/cdt";

const humanize = (value) => String(value || "Not returned")
  .toLowerCase()
  .replaceAll("_", " ")
  .replace(/\b\w/g, (letter) => letter.toUpperCase());

const formatAmount = (value) => {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "—";
  return amount.toLocaleString("en-US", { style: "currency", currency: "USD" });
};

const formatPercent = (value) => {
  const percent = Number(value);
  if (!Number.isFinite(percent)) return "—";
  return `${percent <= 1 ? percent * 100 : percent}%`;
};

const benefitValue = (benefit) => {
  if (benefit.amount !== null && benefit.amount !== "") return formatAmount(benefit.amount);
  if (benefit.percent !== null && benefit.percent !== "") return formatPercent(benefit.percent);
  if (benefit.quantity !== null && benefit.quantity !== "") return String(benefit.quantity);
  if (benefit.authorizationRequired !== null && benefit.authorizationRequired !== "") {
    return benefit.authorizationRequired ? "Authorization required" : "No authorization required";
  }
  return "See payer message";
};

const numberValue = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const isIndividual = (benefit) => !benefit?.coverageLevel || benefit.coverageLevel === "INDIVIDUAL";

const isGeneralDentalBenefit = (benefit) => ["30", "35"].includes(String(benefit?.service?.code || ""));

const findMoneyBenefit = (benefits, category, period) => benefits.find((benefit) =>
  benefit.category === category
  && benefit.timePeriod === period
  && isIndividual(benefit)
  && isGeneralDentalBenefit(benefit)
  && numberValue(benefit.amount) !== null
);

const includesCdtCode = (benefit, code) => {
  if (benefit?.service?.system === "CDT" && benefit?.service?.code === code) return true;
  return (benefit?.messages || []).some((message) => String(message).split(/\s+/).includes(code));
};

const networkPriority = (network) => ({
  IN_NETWORK: 0,
  IN_AND_OUT_OF_NETWORK: 1,
  OUT_OF_NETWORK: 2,
  "": 3,
}[network] ?? 4);

const findCodeBenefit = (benefits, code, category) => benefits
  .filter((benefit) => benefit.category === category && includesCdtCode(benefit, code))
  .sort((left, right) => networkPriority(left.network) - networkPriority(right.network))[0];

const displayNetwork = (value) => {
  if (!value || value === "NOT_RETURNED") return "Not returned";
  if (value === "IN_AND_OUT_OF_NETWORK") return "In & out of network";
  if (value === "IN_NETWORK") return "In network";
  if (value === "OUT_OF_NETWORK") return "Out of network";
  return humanize(value);
};

const formatFrequency = (benefit) => {
  if (!benefit) return "Not returned";
  const quantity = benefit.quantity;
  if (quantity && typeof quantity === "object") {
    const value = quantity.value ?? quantity.amount;
    const qualifier = humanize(quantity.qualifier || "uses");
    if (value !== undefined && value !== null && value !== "") {
      return `${value} ${qualifier}${benefit.timePeriod ? ` / ${humanize(benefit.timePeriod)}` : ""}`;
    }
  }
  if (quantity !== null && quantity !== undefined && quantity !== "") {
    return `${quantity}${benefit.timePeriod ? ` / ${humanize(benefit.timePeriod)}` : ""}`;
  }
  return "Not returned";
};

function MetricRing({ value, total, title, remainingLabel }) {
  const parsedTotal = numberValue(total);
  const hasTotal = parsedTotal !== null;
  const safeTotal = Math.max(parsedTotal || 0, 0);
  const safeValue = Math.min(Math.max(numberValue(value) || 0, 0), safeTotal || 0);
  const progress = safeTotal > 0 ? Math.round((safeValue / safeTotal) * 100) : 0;
  return (
    <div className="flex flex-col items-center text-center min-w-[118px]">
      <div
        className="w-[86px] h-[86px] rounded-full grid place-items-center"
        style={{ background: `conic-gradient(#2F73F2 ${progress}%, #E5EBF5 ${progress}% 100%)` }}
      >
        <div className="w-[68px] h-[68px] rounded-full bg-white grid place-items-center">
          <div>
            <div className="font-sans text-[17px] font-bold text-brand-text leading-tight">{hasTotal ? formatAmount(safeValue) : "N/A"}</div>
            <div className="font-sans text-[10px] text-textFaint">{hasTotal ? `of ${formatAmount(safeTotal)}` : "Not returned"}</div>
          </div>
        </div>
      </div>
      <div className="font-sans text-[12px] font-semibold text-brand-text mt-2">{title}</div>
      <div className="font-sans text-[11px] text-textMute">{remainingLabel}</div>
    </div>
  );
}

const claimRiskAssessment = ({ result, codeRows, annualMax, annualRemaining }) => {
  let score = 0;
  const reasons = [];
  const coverageStatus = String(result.coverage?.status || "").toUpperCase();

  if (result.outcome !== "completed" || result.errors?.length) {
    score += 100;
    reasons.push("The eligibility check contains payer errors.");
  }
  if (!coverageStatus.includes("ACTIVE")) {
    score += 100;
    reasons.push("Active coverage was not confirmed.");
  }
  if (codeRows.some((row) => row.coverageStatus === "Not covered")) {
    score += 80;
    reasons.push("At least one requested CDT code is not covered.");
  }
  if (annualMax !== null && annualRemaining !== null && annualMax > 0 && annualRemaining <= 0) {
    score += 80;
    reasons.push("The annual plan maximum appears exhausted.");
  }
  if (codeRows.some((row) => row.authorizationRequired)) {
    score += 35;
    reasons.push("Preauthorization is required for a requested service.");
  }
  if (codeRows.some((row) => row.network === "OUT_OF_NETWORK")) {
    score += 35;
    reasons.push("A requested service is shown as out of network.");
  }
  if (codeRows.some((row) => row.coverageStatus === "Not returned")) {
    score += 25;
    reasons.push("The payer did not return code-level coverage for every requested service.");
  }
  if (codeRows.some((row) => row.patientShare !== null && row.patientShare >= 50)) {
    score += 25;
    reasons.push("The patient share is 50% or more for a requested service.");
  }
  if (codeRows.some((row) => row.deductibleApplies)) {
    score += 20;
    reasons.push("A deductible applies to a requested service.");
  }

  if (score >= 60) {
    return {
      level: "HIGH",
      tone: "danger",
      message: `${reasons.slice(0, 2).join(" ")} Review the claim before submission.`,
    };
  }
  if (score >= 20) {
    return {
      level: "MEDIUM",
      tone: "warn",
      message: reasons.slice(0, 2).join(" ") || "Review the returned benefits before submitting the claim.",
    };
  }
  return {
    level: "LOW",
    tone: "success",
    message: "No unusual eligibility risk factors were detected for the requested services.",
  };
};

function ClaimRiskAlert({ assessment }) {
  const toneClasses = {
    success: "bg-successSoft text-brand-success",
    warn: "bg-warnSoft text-[#B66A00]",
    danger: "bg-dangerSoft text-brand-danger",
  };
  return (
    <div className={`mt-5 rounded-[9px] px-3.5 py-3 flex items-start gap-2.5 ${toneClasses[assessment.tone]}`}>
      <AlertCircle size={16} className="shrink-0 mt-0.5" />
      <div className="font-sans">
        <div className="text-[12.5px] font-semibold text-brand-text">
          Claim-risk alert - <span className={toneClasses[assessment.tone].split(" ")[1]}>{assessment.level}</span>
        </div>
        <div className="text-[11.5px] text-textMute mt-0.5">{assessment.message}</div>
      </div>
    </div>
  );
}

const buildBenefitSummaries = (patient, verification) => {
  const result = verification?.primary;
  if (!result) return null;
  const benefits = result.benefits || [];
  const deductibleTotal = numberValue(findMoneyBenefit(benefits, "deductible", "CALENDAR_YEAR")?.amount);
  const deductibleRemaining = numberValue(findMoneyBenefit(benefits, "deductible", "REMAINING")?.amount);
  const annualMax = numberValue(findMoneyBenefit(benefits, "limitations", "CALENDAR_YEAR")?.amount);
  const annualRemaining = numberValue(findMoneyBenefit(benefits, "limitations", "REMAINING")?.amount);
  const codes = [...new Set((patient.codes || []).map((code) => String(code).toUpperCase()).filter(Boolean))];
  const codeSummaries = codes.map((code) => {
    const coinsurance = findCodeBenefit(benefits, code, "coInsurance");
    const nonCovered = findCodeBenefit(benefits, code, "nonCovered");
    const rawPatientShare = numberValue(coinsurance?.percent);
    const patientShare = rawPatientShare === null ? null : (rawPatientShare <= 1 ? rawPatientShare * 100 : rawPatientShare);
    if (nonCovered) return `${code} is reported as not covered`;
    if (patientShare !== null) return `${code} shows ${Math.max(100 - patientShare, 0)}% plan coverage and ${patientShare}% patient coinsurance`;
    return `${code} does not have code-level coverage details`;
  });
  const relevantNetwork = codes
    .map((code) => findCodeBenefit(benefits, code, "coInsurance")?.network)
    .find(Boolean) || result.coverage?.network;
  const payer = patient.payer || result.payer?.name || "the payer";
  const plan = result.coverage?.planName || "dental plan";
  const coverage = humanize(result.coverage?.status).toLowerCase();
  const deductibleText = deductibleTotal === null
    ? "The payer did not return a general deductible."
    : `The plan has a ${formatAmount(deductibleTotal)} deductible with ${formatAmount(deductibleRemaining ?? deductibleTotal)} remaining.`;
  const maximumText = annualMax === null
    ? "The payer did not return an annual maximum."
    : `The annual maximum is ${formatAmount(annualMax)}, with ${formatAmount(annualRemaining ?? annualMax)} remaining.`;
  const treatmentText = codeSummaries.length ? ` Planned services: ${codeSummaries.join("; ")}.` : "";

  return {
    frontDesk: `${patient.name}'s ${payer} ${plan} coverage is ${coverage}. Network: ${displayNetwork(relevantNetwork)}. ${deductibleText} ${maximumText}${treatmentText} Verify fees, frequency limits, and authorization requirements before claim submission.`,
    patient: `Your ${payer} ${plan} coverage is ${coverage}. ${deductibleText} ${maximumText}${treatmentText} These are eligibility estimates from your payer and final payment is determined when the claim is processed.`,
  };
};

function CoordinationOfBenefitsModal({ patient, value, saving, onClose, onSave }) {
  const [payers, setPayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [payerStediId, setPayerStediId] = useState(value?.payerStediId || "");
  const [subscriberId, setSubscriberId] = useState(value?.subscriberId || "");
  const [groupNumber, setGroupNumber] = useState(value?.groupNumber || "");
  const [relationship, setRelationship] = useState(value?.relationship || "Spouse");

  useEffect(() => {
    let active = true;
    fetchDentalPayersApi()
      .then((directory) => {
        if (!active) return;
        setPayers((directory.payers || []).filter((payer) => payer.stediId !== patient.payerStediId));
      })
      .catch((error) => active && setLoadError(error.message))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [patient.payerStediId]);

  const options = useMemo(() => {
    const term = search.trim().toLowerCase();
    return payers.filter((payer) => !term || [payer.displayName, payer.primaryPayerId, ...(payer.aliases || [])]
      .some((field) => String(field || "").toLowerCase().includes(term))).slice(0, 150);
  }, [payers, search]);

  const valid = payerStediId && subscriberId.trim() && !loading && !saving;

  return (
    <Modal
      title="Coordination of Benefits"
      onClose={onClose}
      footer={
        <>
          <Btn variant="outline" onClick={onClose}>Cancel</Btn>
          <Btn
            disabled={!valid}
            onClick={() => onSave({
              payerStediId,
              subscriberId: subscriberId.trim(),
              groupNumber: groupNumber.trim(),
              relationship,
            })}
          >
            {saving ? "Saving..." : "Save"}
          </Btn>
        </>
      }
    >
      <div className="font-sans text-[12.5px] text-textMute mb-3.5">
        Primary insurance on file: <strong className="text-brand-text">{patient.payer}</strong>
      </div>
      <Field label="Find secondary insurance payer">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search payer name or payer ID"
        />
      </Field>
      <Field label="Secondary insurance payer *">
        <Select
          value={payerStediId}
          disabled={loading}
          onChange={(event) => setPayerStediId(event.target.value)}
        >
          <option value="">{loading ? "Loading dental payers..." : "Select payer"}</option>
          {options.map((payer) => (
            <option key={payer.stediId} value={payer.stediId}>
              {payer.displayName} — {payer.primaryPayerId}
            </option>
          ))}
        </Select>
      </Field>
      {loadError && <div className="text-brand-danger font-sans text-[12px] mb-3">{loadError}</div>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3">
        <Field label="Subscriber ID *">
          <Input
            value={subscriberId}
            onChange={(event) => setSubscriberId(event.target.value)}
            placeholder="e.g. 88213456"
          />
        </Field>
        <Field label="Group number (optional)">
          <Input
            value={groupNumber}
            onChange={(event) => setGroupNumber(event.target.value)}
            placeholder="e.g. GRP-2048"
          />
        </Field>
      </div>
      <Field label="Relationship to subscriber">
        <Select value={relationship} onChange={(event) => setRelationship(event.target.value)}>
          <option>Self</option>
          <option>Spouse</option>
          <option>Parent</option>
          <option>Child</option>
          <option>Other</option>
        </Select>
      </Field>
      {relationship !== "Self" && (
        <div className="rounded-[8px] bg-blueSoft2 px-3 py-2.5 font-sans text-[11.5px] text-textMute">
          The patient will be submitted as the dependent and this member ID as the secondary subscriber policy.
        </div>
      )}
    </Modal>
  );
}

function PatientLookupState({ loading, onBack }) {
  return (
    <div className="max-w-[980px]">
      <button type="button" onClick={onBack} className="bg-transparent border-0 flex items-center gap-1.5 text-textMute hover:text-brand-text cursor-pointer font-sans text-[13px] mb-3.5 transition-colors">
        <ArrowLeft size={15} /> Back to patients
      </button>
      <Card>
        <div className="py-8 text-center font-sans text-[13px] text-textMute">
          {loading ? "Loading patient details..." : "Patient not found."}
        </div>
      </Card>
    </div>
  );
}

function ProblemList({ title, items, tone = "danger" }) {
  if (!items?.length) return null;
  return (
    <div className={`mt-4 p-3.5 rounded-[9px] ${tone === "danger" ? "bg-dangerSoft" : "bg-warnSoft"}`}>
      <div className="font-sans text-[12.5px] font-bold text-brand-text mb-1.5">{title}</div>
      {items.map((item, index) => (
        <div key={`${item.code}-${index}`} className="font-sans text-[12px] text-textMute mb-1 last:mb-0">
          {item.code && <span className="font-mono mr-1.5">{item.code}</span>}{item.message}
        </div>
      ))}
    </div>
  );
}

function BenefitSummary({ patient, generating, showPatientVersion, onGenerate, onToggleVersion, onReview }) {
  const summary = showPatientVersion ? patient.patientSummary : patient.aiSummary;
  return (
    <div className="mt-6 pt-5 border-t border-brand-border">
      <div className="flex justify-between items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Sparkles size={15} className="text-brand-blue" />
          <span className="font-sans text-[13px] font-semibold text-brand-text">Benefit summary</span>
        </div>
        {!patient.aiSummary && (
          <Btn size="sm" icon={Sparkles} disabled={generating} onClick={onGenerate}>
            {generating ? "Generating..." : "Generate"}
          </Btn>
        )}
      </div>

      {patient.aiSummary ? (
        <div className="mt-3 rounded-[9px] bg-[#F1F5FF] border-l-[3px] border-brand-blue px-4 py-3.5">
          <div className="flex justify-between items-center gap-3 flex-wrap">
            <span className="font-sans text-[10.5px] font-semibold tracking-[0.4px] text-navy uppercase">
              {showPatientVersion ? "Patient-friendly version" : "Front-desk version"}
            </span>
            <button type="button" onClick={onToggleVersion} className="bg-transparent border-0 p-0 text-brand-blue font-sans text-[11.5px] cursor-pointer inline-flex items-center gap-1.5">
              {showPatientVersion ? <EyeOff size={13} /> : <Eye size={13} />}
              {showPatientVersion ? "Show front-desk version" : "Show patient-friendly version"}
            </button>
          </div>
          <p className="font-sans text-[13px] leading-5 text-brand-text my-3">{summary}</p>
          <div className="flex justify-between items-center gap-3 flex-wrap">
            <span className="font-sans text-[10.5px] text-textFaint">Generated from the payer response - review before sharing</span>
            {patient.aiReviewed ? (
              <Badge text="Reviewed" tone="success" />
            ) : (
              <Btn size="sm" variant="outline" onClick={onReview}>Mark reviewed</Btn>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-3 rounded-[9px] border border-dashed border-brand-border px-4 py-4 font-sans text-[12px] text-textMute">
          Generate a front-desk and patient-friendly summary from the latest eligibility response.
        </div>
      )}
    </div>
  );
}

function RawBenefitTable({ result }) {
  const benefits = result.benefits || [];
  return (
    <div className="mt-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
        <div className="border border-brand-border rounded-[9px] p-3">
          <div className="font-sans text-[11px] uppercase text-textFaint mb-1">Coverage</div>
          <div className="font-sans text-[13px] font-bold text-brand-text">{humanize(result.coverage?.status)}</div>
        </div>
        <div className="border border-brand-border rounded-[9px] p-3">
          <div className="font-sans text-[11px] uppercase text-textFaint mb-1">Network</div>
          <div className="font-sans text-[13px] font-bold text-brand-text">{humanize(result.coverage?.network)}</div>
        </div>
        <div className="border border-brand-border rounded-[9px] p-3">
          <div className="font-sans text-[11px] uppercase text-textFaint mb-1">Plan</div>
          <div className="font-sans text-[13px] font-bold text-brand-text">{result.coverage?.planName || "Not returned"}</div>
        </div>
        <div className="border border-brand-border rounded-[9px] p-3">
          <div className="font-sans text-[11px] uppercase text-textFaint mb-1">Stedi check ID</div>
          <div className="font-mono text-[11px] break-all text-brand-text">{result.stediCheckId || "Not returned"}</div>
        </div>
      </div>

      <ProblemList title="Payer / eligibility errors" items={result.errors} />
      <ProblemList title="Payer warnings" items={result.warnings} tone="warn" />

      <div className="mt-5">
        <div className="font-sans text-[13px] font-semibold text-brand-text mb-2.5">
          Dental benefits returned by payer
        </div>
        {benefits.length ? (
          <>
            {result.benefitsTruncated && (
              <div className="mb-2 font-sans text-[11.5px] text-textMute">
                Showing the first {benefits.length} of {result.benefitRowCount} benefit rows returned by the payer.
              </div>
            )}
            <div className="border border-brand-border rounded-[10px] overflow-x-auto">
              <div className="min-w-[760px]">
              <div className="grid grid-cols-[1fr_1.5fr_0.9fr_0.9fr_1.6fr] bg-[#F4F7FD] px-3 py-[9px] font-sans text-[11px] font-semibold text-textMute uppercase tracking-[0.3px]">
                <div>Benefit</div><div>Service</div><div>Network / level</div><div>Value</div><div>Period / message</div>
              </div>
              {benefits.map((item, index) => (
                <div key={`${item.category}-${item.service?.code}-${index}`} className="grid grid-cols-[1fr_1.5fr_0.9fr_0.9fr_1.6fr] px-3 py-2.5 border-t border-brand-border font-sans text-[12px] items-start">
                  <div className="font-semibold text-brand-text">{humanize(item.category)}</div>
                  <div className="text-textMute">
                    {item.service?.code && <span className="font-mono text-brand-text mr-1.5">{item.service.code}</span>}
                    {item.service?.description || "General dental coverage"}
                  </div>
                  <div className="text-textMute">{humanize(item.network)} · {humanize(item.coverageLevel)}</div>
                  <div className="font-semibold text-brand-text">{benefitValue(item)}</div>
                  <div className="text-textMute">
                    {humanize(item.timePeriod)}
                    {item.messages?.length ? ` · ${item.messages.join(" · ")}` : ""}
                  </div>
                </div>
              ))}
              </div>
            </div>
          </>
        ) : (
          <div className="border border-brand-border rounded-[9px] p-4 font-sans text-[12.5px] text-textMute">
            The payer did not return structured benefit rows for this request. Check the errors and coverage status above.
          </div>
        )}
      </div>
    </div>
  );
}

function PolicyResult({ result, requestedCodes = [] }) {
  const benefits = result.benefits || [];
  const deductibleTotalRow = findMoneyBenefit(benefits, "deductible", "CALENDAR_YEAR");
  const deductibleRemainingRow = findMoneyBenefit(benefits, "deductible", "REMAINING");
  const annualMaxRow = findMoneyBenefit(benefits, "limitations", "CALENDAR_YEAR");
  const annualRemainingRow = findMoneyBenefit(benefits, "limitations", "REMAINING");

  const deductibleTotal = numberValue(deductibleTotalRow?.amount);
  const deductibleRemaining = numberValue(deductibleRemainingRow?.amount);
  const deductibleMet = deductibleTotal === null
    ? null
    : Math.max(deductibleTotal - (deductibleRemaining ?? deductibleTotal), 0);
  const annualMax = numberValue(annualMaxRow?.amount);
  const annualRemaining = numberValue(annualRemainingRow?.amount);
  const annualUsed = annualMax === null
    ? null
    : Math.max(annualMax - (annualRemaining ?? annualMax), 0);

  const codes = [...new Set((requestedCodes || []).map((code) => String(code).toUpperCase()).filter(Boolean))];
  const codeRows = codes.map((code) => {
    const coinsurance = findCodeBenefit(benefits, code, "coInsurance");
    const nonCovered = findCodeBenefit(benefits, code, "nonCovered");
    const limitation = findCodeBenefit(benefits, code, "limitations");
    const deductible = findCodeBenefit(benefits, code, "deductible");
    const authorization = benefits.find((benefit) =>
      includesCdtCode(benefit, code)
      && benefit.authorizationRequired !== null
      && benefit.authorizationRequired !== undefined
      && benefit.authorizationRequired !== ""
    );
    const rawPatientShare = numberValue(coinsurance?.percent);
    const patientShare = rawPatientShare === null
      ? null
      : (rawPatientShare <= 1 ? rawPatientShare * 100 : rawPatientShare);
    return {
      code,
      description: CDT_LIB[code]?.desc || coinsurance?.service?.description || nonCovered?.service?.description || "Dental procedure",
      coverageStatus: nonCovered ? "Not covered" : (coinsurance ? "Covered" : "Not returned"),
      planPays: patientShare === null ? null : Math.max(100 - patientShare, 0),
      patientShare,
      network: coinsurance?.network || nonCovered?.network || result.coverage?.network,
      frequency: formatFrequency(limitation),
      authorizationRequired: authorization?.authorizationRequired === true,
      authorization: authorization ? (authorization.authorizationRequired ? "Required" : "Not required") : "Not returned",
      deductibleApplies: (numberValue(deductible?.amount) || 0) > 0,
    };
  });

  const firstRelevantBenefit = codes
    .map((code) => findCodeBenefit(benefits, code, "coInsurance") || findCodeBenefit(benefits, code, "statuses"))
    .find(Boolean);
  const summaryNetwork = firstRelevantBenefit?.network || result.coverage?.network;
  const authorizationValues = benefits
    .map((benefit) => benefit.authorizationRequired)
    .filter((value) => value !== null && value !== undefined && value !== "");
  const preauthorization = authorizationValues.length
    ? (authorizationValues.some(Boolean) ? "Required for some services" : "Not required")
    : "Not returned";
  const claimRisk = claimRiskAssessment({ result, codeRows, annualMax, annualRemaining });

  return (
    <div className="mt-5">
      <div className="grid grid-cols-1 lg:grid-cols-[270px_1fr] gap-5 items-center">
        <div className="flex items-start justify-center sm:justify-start gap-3">
          <MetricRing
            value={deductibleMet}
            total={deductibleTotal}
            title="Deductible met"
            remainingLabel={deductibleRemaining === null ? "Not returned" : `${formatAmount(deductibleRemaining)} remaining`}
          />
          <MetricRing
            value={annualUsed}
            total={annualMax}
            title="Annual max used"
            remainingLabel={annualRemaining === null ? "Not returned" : `${formatAmount(annualRemaining)} remaining`}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-2 font-sans text-[12.5px]">
          <div className="text-textMute">Coverage: <strong className="text-brand-success">{humanize(result.coverage?.status)}</strong></div>
          <div className="text-textMute">Plan: <strong className="text-brand-text">{result.coverage?.planName || "Not returned"}</strong></div>
          <div className="text-textMute">Network: <strong className="text-brand-text">{displayNetwork(summaryNetwork)}</strong></div>
          <div className="text-textMute">Waiting period: <strong className="text-brand-text">Not returned</strong></div>
          <div className="text-textMute sm:col-span-2">Preauthorization: <strong className="text-brand-text">{preauthorization}</strong></div>
        </div>
      </div>

      <ProblemList title="Payer / eligibility errors" items={result.errors} />
      <ProblemList title="Payer warnings" items={result.warnings} tone="warn" />

      <ClaimRiskAlert assessment={claimRisk} />

      <div className="mt-5">
        <div className="font-sans text-[13px] font-semibold text-brand-text mb-2.5">Requested CDT breakdown</div>
        {codeRows.length ? (
          <div className="border border-brand-border rounded-[10px] overflow-x-auto">
            <div className="min-w-[760px]">
              <div className="grid grid-cols-[0.7fr_1.7fr_0.65fr_0.7fr_0.8fr_1.1fr] bg-[#F4F7FD] px-3 py-[9px] font-sans text-[11px] font-semibold text-textMute uppercase tracking-[0.3px]">
                <div>Code</div><div>Description</div><div>Covered</div><div>Plan pays</div><div>Patient share</div><div>Frequency</div>
              </div>
              {codeRows.map((item) => (
                <div key={item.code} className="grid grid-cols-[0.7fr_1.7fr_0.65fr_0.7fr_0.8fr_1.1fr] px-3 py-3 border-t border-brand-border font-sans text-[12px] items-center">
                  <div className="font-mono font-semibold text-brand-text">{item.code}</div>
                  <div className="text-textMute">
                    <div>{item.description}</div>
                    <div className="text-[10.5px] text-textFaint mt-0.5">{displayNetwork(item.network)} / Preauth: {item.authorization}</div>
                  </div>
                  <div className={item.coverageStatus === "Covered" ? "text-brand-success font-semibold" : item.coverageStatus === "Not covered" ? "text-brand-danger font-semibold" : "text-textMute"}>
                    {item.coverageStatus === "Covered" ? "Yes" : item.coverageStatus}
                  </div>
                  <div className="font-semibold text-brand-text">{item.planPays === null ? "Not returned" : `${item.planPays}%`}</div>
                  <div className="font-semibold text-brand-text">{item.patientShare === null ? "Not returned" : `${item.patientShare}%`}</div>
                  <div className="text-textMute">{item.frequency}</div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="border border-brand-border rounded-[9px] p-4 font-sans text-[12px] text-textMute">No CDT codes were requested for this patient.</div>
        )}
      </div>

      {benefits.length ? (
        <details className="mt-5 border border-brand-border rounded-[10px] bg-white overflow-hidden">
          <summary className="cursor-pointer px-3.5 py-3 font-sans text-[12px] font-semibold text-navy bg-[#F8FAFE]">
            View all {result.benefitRowCount || benefits.length} payer benefit rows
          </summary>
          <div className="border-t border-brand-border px-3.5 pb-3">
            <RawBenefitTable result={result} />
          </div>
        </details>
      ) : (
        <div className="mt-5 border border-brand-border rounded-[9px] p-4 font-sans text-[12.5px] text-textMute">
          The payer did not return structured benefit rows for this request.
        </div>
      )}
    </div>
  );
}

export default function PatientEligibilityPage() {
  const navigate = useNavigate();
  const { patientId } = useParams();
  const { patients, setPatients, clinicId, token, push } = useApp();
  const patientsKey = useSelector((state) => state.data.patientsKey);
  usePatients();

  const patient = useMemo(() => patients.find((item) => item.id === patientId), [patientId, patients]);
  const [editingCob, setEditingCob] = useState(false);
  const [savingCob, setSavingCob] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [requestError, setRequestError] = useState("");
  const [selectedPolicy, setSelectedPolicy] = useState("primary");
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [showPatientSummary, setShowPatientSummary] = useState(false);

  const expectedPatientsKey = token && clinicId ? `${token}:${clinicId}` : null;
  const loadingPatient = Boolean(expectedPatientsKey && patientsKey !== expectedPatientsKey);

  useEffect(() => {
    setEditingCob(false);
    setRequestError("");
    setSelectedPolicy("primary");
    setShowPatientSummary(false);
  }, [patientId]);

  if (!patient) {
    return <PatientLookupState loading={loadingPatient} onBack={() => navigate("/patients")} />;
  }

  // Ignore legacy client-side mock results; only the real server response has
  // a primary policy result.
  const verification = patient.result?.primary ? patient.result : null;
  const selectedResult = selectedPolicy === "secondary" ? verification?.secondary : verification?.primary;
  const replacePatient = (next) => setPatients((current) => current.map((item) => item.id === next.id ? next : item));

  async function saveCob(payload) {
    setSavingCob(true);
    try {
      const updated = await saveSecondaryInsuranceApi(clinicId, patient.id, payload);
      replacePatient(updated);
      setEditingCob(false);
      push("Secondary insurance saved");
    } catch (error) {
      push(error.message, "danger");
    } finally {
      setSavingCob(false);
    }
  }

  async function removeCob() {
    setSavingCob(true);
    try {
      const updated = await removeSecondaryInsuranceApi(clinicId, patient.id);
      replacePatient(updated);
      setSelectedPolicy("primary");
      push("Secondary insurance removed");
    } catch (error) {
      push(error.message, "danger");
    } finally {
      setSavingCob(false);
    }
  }

  async function verifyEligibility() {
    setVerifying(true);
    setRequestError("");
    try {
      const data = await verifyPatientEligibilityApi(clinicId, patient.id, { includeSecondary: true });
      replacePatient(data.patient);
      setSelectedPolicy("primary");
      setShowPatientSummary(false);
      push(data.verification.status === "completed" ? "Eligibility check completed" : "Eligibility check completed with issues", data.verification.status === "completed" ? "success" : "warn");
    } catch (error) {
      setRequestError(error.message);
      push(error.message, "danger");
    } finally {
      setVerifying(false);
    }
  }

  async function generateSummary() {
    const summaries = buildBenefitSummaries(patient, verification);
    if (!summaries) return;
    setGeneratingSummary(true);
    try {
      const updated = await updatePatientApi(clinicId, patient.id, {
        aiSummary: summaries.frontDesk,
        patientSummary: summaries.patient,
        aiReviewed: false,
      });
      replacePatient(updated);
      setShowPatientSummary(false);
      push("Benefit summary generated");
    } catch (error) {
      push(error.message, "danger");
    } finally {
      setGeneratingSummary(false);
    }
  }

  async function markSummaryReviewed() {
    try {
      const updated = await updatePatientApi(clinicId, patient.id, { aiReviewed: true });
      replacePatient(updated);
      push("Benefit summary marked reviewed");
    } catch (error) {
      push(error.message, "danger");
    }
  }

  return (
    <div className="max-w-[980px]">
      <button type="button" onClick={() => navigate("/patients")} className="bg-transparent border-0 flex items-center gap-1.5 text-textMute hover:text-brand-text cursor-pointer font-sans text-[13px] mb-3.5 transition-colors">
        <ArrowLeft size={15} /> Back to patients
      </button>

      <Card>
        <div className="flex justify-between items-start gap-3 flex-wrap">
          <div>
            <div className="font-sans text-[21px] font-bold text-brand-text">{patient.name}</div>
            <div className="font-sans text-[13px] text-textMute mt-[3px]">
              DOB {patient.dob || "—"} · {patient.payer} · {patient.appt || "No appointment"}
            </div>
          </div>
          <StatusBadge status={verifying ? "in_progress" : verification ? patient.status : "not_verified"} />
        </div>

        <div className="mt-5 flex items-center gap-2 flex-wrap">
          <Btn icon={ShieldCheck} disabled={verifying} onClick={verifyEligibility}>
            {verifying ? "Checking eligibility..." : verification ? "Verify again" : "Verify eligibility"}
          </Btn>
          {verification?.checkedAt && (
            <span className="font-sans text-[11.5px] text-textFaint">
              Last checked {new Date(verification.checkedAt).toLocaleString()}
            </span>
          )}
        </div>
        {requestError && (
          <div className="mt-3 p-3 rounded-[8px] bg-dangerSoft font-sans text-[12.5px] text-brand-danger flex items-start gap-2">
            <AlertCircle size={15} className="shrink-0 mt-0.5" />
            <div>
              {requestError}
              {requestError.toLowerCase().includes("npi") && (
                <button type="button" onClick={() => navigate("/clinics")} className="block mt-1 bg-transparent border-0 p-0 text-navy font-semibold cursor-pointer">
                  Configure clinic eligibility provider
                </button>
              )}
            </div>
          </div>
        )}

        <div className="mt-5 p-3.5 border border-brand-border rounded-[9px]">
          <div className="flex justify-between items-center gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Layers size={15} className="text-navy" />
              <span className="font-sans text-[13px] font-semibold text-brand-text">Coordination of Benefits</span>
            </div>
            <div className="flex items-center gap-2">
              {patient.cob && (
                <Btn size="sm" variant="danger" icon={Trash2} disabled={savingCob} onClick={removeCob}>Remove</Btn>
              )}
              <Btn size="sm" variant="outline" icon={Pencil} onClick={() => setEditingCob(true)}>
                {patient.cob ? "Edit" : "Add secondary insurance"}
              </Btn>
            </div>
          </div>
          {patient.cob ? (
            <div className="mt-2.5 font-sans text-[12.5px] text-textMute">
              <div><strong className="text-brand-text">Primary:</strong> {patient.payer}</div>
              <div>
                <strong className="text-brand-text">Secondary:</strong> {patient.cob.payer} · Member ending {patient.cob.subscriberId?.slice(-4)} · {patient.cob.relationship}
              </div>
            </div>
          ) : (
            <div className="mt-2 font-sans text-[12px] text-textFaint">
              No secondary insurance on file — only the primary policy will be checked.
            </div>
          )}
        </div>

        {verification && (
          <div className="mt-6 pt-5 border-t border-brand-border">
            <div className="flex items-center gap-2 flex-wrap">
              <button type="button" onClick={() => setSelectedPolicy("primary")} className={`px-3.5 py-2 rounded-[8px] border font-sans text-[12.5px] font-semibold cursor-pointer ${selectedPolicy === "primary" ? "bg-navy text-white border-navy" : "bg-white text-textMute border-brand-border"}`}>
                Primary · {verification.primary?.payer?.name || patient.payer}
              </button>
              {verification.secondary && (
                <button type="button" onClick={() => setSelectedPolicy("secondary")} className={`px-3.5 py-2 rounded-[8px] border font-sans text-[12.5px] font-semibold cursor-pointer ${selectedPolicy === "secondary" ? "bg-navy text-white border-navy" : "bg-white text-textMute border-brand-border"}`}>
                  Secondary · {verification.secondary.payer?.name || patient.cob?.payer}
                </button>
              )}
            </div>
            {selectedResult && (
              <>
                <div className="mt-4 flex items-center gap-2">
                  {selectedResult.outcome === "completed" ? <CheckCircle2 size={16} className="text-brand-success" /> : <AlertCircle size={16} className="text-brand-danger" />}
                  <Badge text={selectedResult.outcome} tone={selectedResult.outcome === "completed" ? "success" : "danger"} />
                  <span className="font-sans text-[12px] text-textMute">Member ending {selectedResult.memberIdLast4 || "—"}</span>
                </div>
                <PolicyResult result={selectedResult} requestedCodes={patient.codes} />
              </>
            )}
          </div>
        )}

        {verification?.primary?.outcome === "completed" && (
          <BenefitSummary
            patient={patient}
            generating={generatingSummary}
            showPatientVersion={showPatientSummary}
            onGenerate={generateSummary}
            onToggleVersion={() => setShowPatientSummary((current) => !current)}
            onReview={markSummaryReviewed}
          />
        )}

        <div className="mt-6 pt-5 border-t border-brand-border flex justify-between items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <FileCheck2 size={15} className="text-navy" />
            <div>
              <div className="font-sans text-[13px] font-semibold text-brand-text">Claim</div>
              <div className="font-sans text-[10.5px] text-textFaint mt-0.5">Create an 837D draft from this patient</div>
            </div>
          </div>
          <Btn
            size="sm"
            onClick={() => navigate(`/claims?patientId=${patient.id}`)}
            title="Open a new synthetic test claim draft"
          >
            Create test claim
          </Btn>
        </div>
      </Card>

      {editingCob && (
        <CoordinationOfBenefitsModal
          patient={patient}
          value={patient.cob}
          saving={savingCob}
          onClose={() => setEditingCob(false)}
          onSave={saveCob}
        />
      )}
    </div>
  );
}
