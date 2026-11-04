import { Claim } from "../../../models/client/Claim.js";
import {
  StediEraError,
  listEraTransactions,
  retrieveEraPdf,
  retrieveEraReport,
} from "../../../services/stedi/eraService.js";
import { getEraMode } from "../../../config/stediRuntime.js";
import { fail, ok } from "../../../utils/client/apiResponse.js";

const scope = (req) => ({ tenantId: req.user.tenantId._id, clinicId: req.clinicId });
const clean = (value) => String(value || "").trim();
const key = (value) => clean(value).toUpperCase();
const toCents = (value) => Math.round((Number(value) || 0) * 100);
const compactDate = (value) => {
  const raw = clean(value);
  return /^\d{8}$/.test(raw) ? `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}` : raw;
};

const tenantHasEntitlement = (tenant, entitlement) => {
  const value = tenant.entitlements instanceof Map
    ? tenant.entitlements.get(entitlement)
    : tenant.entitlements?.[entitlement];
  return value !== false;
};

const adjustmentAmount = (adjustment) => {
  let total = 0;
  for (let index = 1; index <= 6; index += 1) total += Number(adjustment?.[`adjustmentAmount${index}`]) || 0;
  return total;
};

const serviceLine = (line) => {
  const info = line?.servicePaymentInformation || {};
  const adjustments = Array.isArray(line?.serviceAdjustments) ? line.serviceAdjustments : [];
  const billedCents = toCents(info.lineItemChargeAmount);
  const paidCents = toCents(info.lineItemProviderPaymentAmount);
  const patientResponsibilityCents = toCents(adjustments
    .filter((item) => clean(item.claimAdjustmentGroupCode).toUpperCase() === "PR")
    .reduce((sum, item) => sum + adjustmentAmount(item), 0));
  const adjustmentCents = toCents(adjustments.reduce((sum, item) => sum + adjustmentAmount(item), 0));
  return {
    code: clean(info.adjudicatedProcedureCode || info.submittedAdjudicatedProcedureCode || line.lineItemControlNumber),
    description: clean(info.submittedProcedureCodeDescription || info.productOrServiceIDQualifierValue),
    serviceDate: compactDate(line.serviceDate || line.serviceStartDate),
    billedCents,
    paidCents,
    patientResponsibilityCents,
    adjustmentCents,
    adjustmentReasons: adjustments.flatMap((item) => {
      const values = [];
      for (let index = 1; index <= 6; index += 1) {
        if (item?.[`adjustmentReason${index}`] || item?.[`adjustmentReasonCode${index}`]) {
          values.push({
            groupCode: clean(item.claimAdjustmentGroupCode),
            reasonCode: clean(item[`adjustmentReasonCode${index}`]),
            reason: clean(item[`adjustmentReason${index}`]),
            amountCents: toCents(item[`adjustmentAmount${index}`]),
          });
        }
      }
      return values;
    }),
  };
};

const paymentStatus = (info, billedCents, paidCents) => {
  if (clean(info.claimStatusCode) === "4") return "Denied";
  if (paidCents <= 0 && billedCents > 0) return "No payment";
  if (paidCents < billedCents) return "Partial";
  return "Paid";
};

export const normalizeEraReport = (report, transactionRecord, claimsByNumber) => {
  const rows = [];
  for (const transaction of report?.transactions || []) {
    const financial = transaction.financialInformation || {};
    const payer = transaction.payer || {};
    const trace = transaction.paymentAndRemitReassociationDetails || {};
    for (const detail of transaction.detailInfo || []) {
      for (const payment of detail.paymentInfo || []) {
        const info = payment.claimPaymentInfo || {};
        const claimNumber = clean(info.patientControlNumber);
        const claim = claimsByNumber.get(key(claimNumber));
        if (!claim) continue;
        const billedCents = toCents(info.totalClaimChargeAmount);
        const paidCents = toCents(info.claimPaymentAmount);
        const patientResponsibilityCents = toCents(info.patientResponsibilityAmount);
        const serviceLines = (payment.serviceLines || []).map(serviceLine);
        const calculatedAdjustment = Math.max(0, billedCents - paidCents - patientResponsibilityCents);
        rows.push({
          id: `${transactionRecord.transactionId}:${claimNumber}`,
          transactionId: transactionRecord.transactionId,
          eraReference: clean(transaction.controlNumber || report?.meta?.transactionId),
          claimNumber,
          patient: claim.patient?.fullName || [payment.patientName?.firstName, payment.patientName?.lastName].filter(Boolean).join(" "),
          patientId: String(claim.patientId),
          payer: clean(payer.name || claim.payer?.name),
          received: transactionRecord.processedAt || compactDate(transaction.productionDate),
          paymentDate: compactDate(financial.checkIssueOrEFTEffectiveDate),
          paymentMethod: clean(financial.paymentMethodCode || "Not returned"),
          traceNumber: clean(trace.checkOrEFTTraceNumber),
          payerClaimControlNumber: clean(info.payerClaimControlNumber),
          submissionDataSource: claim.stedi?.submissionDataSource || "application",
          billedCents,
          paidCents,
          patientResponsibilityCents,
          adjustmentCents: calculatedAdjustment,
          status: paymentStatus(info, billedCents, paidCents),
          claimStatusCode: clean(info.claimStatusCode),
          serviceLines,
          mode: clean(report?.meta?.applicationMode || transactionRecord.mode || "test").toLowerCase(),
        });
      }
    }
  }
  return rows;
};

const fetchReports = async (transactions, claimsByNumber) => {
  const rows = [];
  let failedReports = 0;
  for (let offset = 0; offset < transactions.length; offset += 5) {
    const batch = transactions.slice(offset, offset + 5);
    const results = await Promise.allSettled(batch.map(async (transaction) => {
      const report = await retrieveEraReport(transaction.transactionId);
      return normalizeEraReport(report, transaction, claimsByNumber);
    }));
    results.forEach((result) => {
      if (result.status === "fulfilled") rows.push(...result.value);
      else failedReports += 1;
    });
  }
  return { rows, failedReports };
};

const eraError = (res, error) => {
  const expected = error instanceof StediEraError;
  return fail(res, expected ? error.status : 503, expected ? error.message : "Stedi ERA service is unavailable", {
    code: expected ? error.code : "STEDI_ERA_UNAVAILABLE",
  });
};

export const listEras = async (req, res) => {
  if (!tenantHasEntitlement(req.user.tenantId, "era")) {
    return fail(res, 403, "ERAs are not included in this practice plan", { code: "ERA_NOT_INCLUDED" });
  }
  try {
    const mode = getEraMode();
    const claims = await Claim.find({ ...scope(req), environment: mode })
      .select("claimNumber patient patientId payer status submittedAt stedi.submissionDataSource")
      .lean();
    if (!claims.length) {
      return ok(res, "No clinic claims are available for ERA matching", {
        eras: [],
        pendingClaims: [],
        source: "stedi",
        mode,
        syncedAt: new Date().toISOString(),
        transactionCount: 0,
        failedReports: 0,
      });
    }
    const claimsByNumber = new Map(claims.map((claim) => [key(claim.claimNumber), claim]));
    const transactions = await listEraTransactions();
    const { rows, failedReports } = await fetchReports(transactions, claimsByNumber);
    rows.sort((left, right) => new Date(right.received || 0) - new Date(left.received || 0));
    const matchedNumbers = new Set(rows.map((row) => key(row.claimNumber)));
    const pendingClaims = claims
      .filter((claim) => claim.status === "stedi_accepted"
        && !matchedNumbers.has(key(claim.claimNumber)))
      .map((claim) => ({
        claimNumber: claim.claimNumber,
        submittedAt: claim.submittedAt,
        status: "awaiting_835",
        submissionDataSource: claim.stedi?.submissionDataSource || "application",
      }));
    return ok(res, "Stedi ERAs loaded", {
      eras: rows,
      pendingClaims,
      source: "stedi",
      mode,
      syncedAt: new Date().toISOString(),
      transactionCount: transactions.length,
      failedReports,
    });
  } catch (error) {
    return eraError(res, error);
  }
};

export const getEraPdf = async (req, res) => {
  if (!tenantHasEntitlement(req.user.tenantId, "era_pdfs")) {
    return fail(res, 403, "ERA PDFs are not included in this practice plan", { code: "ERA_PDF_NOT_INCLUDED" });
  }
  const transactionId = clean(req.params.transactionId);
  if (!/^[0-9a-fA-F-]{36}$/.test(transactionId)) {
    return fail(res, 422, "A valid Stedi ERA transaction ID is required", { code: "ERA_TRANSACTION_ID_INVALID" });
  }
  try {
    const [report, claims] = await Promise.all([
      retrieveEraReport(transactionId),
      Claim.find({ ...scope(req), environment: getEraMode() }).select("claimNumber").lean(),
    ]);
    const scopedNumbers = new Set(claims.map((claim) => key(claim.claimNumber)));
    const reportNumbers = [];
    for (const transaction of report?.transactions || []) {
      for (const detail of transaction.detailInfo || []) {
        for (const payment of detail.paymentInfo || []) {
          const number = key(payment.claimPaymentInfo?.patientControlNumber);
          if (number) reportNumbers.push(number);
        }
      }
    }
    if (!reportNumbers.length || reportNumbers.some((number) => !scopedNumbers.has(number))) {
      return fail(res, 403, "This ERA PDF is not isolated to the active clinic", { code: "ERA_PDF_SCOPE_MISMATCH" });
    }
    const pdf = await retrieveEraPdf(transactionId);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="morlyiq-era-${transactionId}.pdf"`);
    res.setHeader("Cache-Control", "private, no-store");
    return res.status(200).send(pdf);
  } catch (error) {
    return eraError(res, error);
  }
};
