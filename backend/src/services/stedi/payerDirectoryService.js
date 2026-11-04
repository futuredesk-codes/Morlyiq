import crypto from "node:crypto";
import { StediPayer } from "../../models/integrations/StediPayer.js";
import { IntegrationSyncState } from "../../models/integrations/IntegrationSyncState.js";
import { PlatformInsurer } from "../../models/admin/PlatformInsurer.js";

const DEFAULT_STEDI_PAYER_SEARCH_URL = "https://payers.us.stedi.com/2024-04-01/payers/search";
const SYNC_KEY = "stedi-dental-eligibility-payers-v1";
const DEFAULT_TTL_HOURS = 24;
const MAX_PAGES = 100;
let refreshInFlight = null;

const ttlMilliseconds = () => {
  const configured = Number(process.env.STEDI_PAYER_CACHE_TTL_HOURS || DEFAULT_TTL_HOURS);
  const hours = Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_TTL_HOURS;
  return hours * 60 * 60 * 1000;
};

const directoryKey = () => String(process.env.STEDI_API_KEY || "").trim();
const payerSearchUrl = () =>
  String(process.env.STEDI_PAYER_SEARCH_URL || DEFAULT_STEDI_PAYER_SEARCH_URL).trim();

const fetchPage = async (pageToken) => {
  const key = directoryKey();
  if (!key) {
    const error = new Error("Stedi payer directory is not configured");
    error.code = "STEDI_NOT_CONFIGURED";
    throw error;
  }

  const url = new URL(payerSearchUrl());
  url.searchParams.set("coverageTypes", "dental");
  url.searchParams.set("eligibilityCheck", "EITHER");
  url.searchParams.set("pageSize", "100");
  if (pageToken) url.searchParams.set("pageToken", pageToken);

  const response = await fetch(url, {
    headers: { Authorization: key, Accept: "application/json" },
    signal: AbortSignal.timeout(20_000),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(`Stedi payer request failed with status ${response.status}`);
    error.code = "STEDI_REQUEST_FAILED";
    throw error;
  }
  return payload;
};

const refreshDirectory = async () => {
  const syncId = crypto.randomUUID();
  const syncedAt = new Date();
  let pageToken = null;
  let pageCount = 0;
  let recordCount = 0;

  try {
    do {
      pageCount += 1;
      if (pageCount > MAX_PAGES) throw new Error("Stedi payer pagination exceeded the safety limit");
      const payload = await fetchPage(pageToken);
      const payers = (payload.items || [])
        .map((item) => item?.payer)
        .filter((payer) => payer?.stediId && payer?.primaryPayerId && payer?.displayName && payer?.coverageTypes?.includes("dental"));

      if (payers.length) {
        await StediPayer.bulkWrite(
          payers.map((payer) => ({
            updateOne: {
              filter: { stediId: payer.stediId },
              update: {
                $set: {
                  displayName: payer.displayName,
                  conciseName: payer.conciseName || "",
                  primaryPayerId: payer.primaryPayerId,
                  aliases: payer.aliases || [],
                  coverageTypes: payer.coverageTypes || [],
                  transactionSupport: payer.transactionSupport || {},
                  active: true,
                  syncId,
                  lastSyncedAt: syncedAt,
                },
              },
              upsert: true,
            },
          }))
        );
      }
      recordCount += payers.length;
      pageToken = payload.nextPageToken || null;
    } while (pageToken);

    await StediPayer.updateMany({ syncId: { $ne: syncId } }, { $set: { active: false } });
    await IntegrationSyncState.findOneAndUpdate(
      { key: SYNC_KEY },
      {
        $set: {
          provider: "Stedi",
          status: "ready",
          completedAt: syncedAt,
          recordCount,
          lastError: "",
        },
      },
      { upsert: true, returnDocument: "after", runValidators: true }
    );
    return { refreshedAt: syncedAt, recordCount };
  } catch (error) {
    await IntegrationSyncState.findOneAndUpdate(
      { key: SYNC_KEY },
      {
        $set: {
          provider: "Stedi",
          status: "failed",
          lastError: error.code || "STEDI_REFRESH_FAILED",
        },
      },
      { upsert: true, returnDocument: "after", runValidators: true }
    ).catch(() => null);
    throw error;
  }
};

const ensureFreshDirectory = async () => {
  const [state, activeCount] = await Promise.all([
    IntegrationSyncState.findOne({ key: SYNC_KEY }).lean(),
    StediPayer.countDocuments({ active: true }),
  ]);
  const fresh = state?.status === "ready"
    && state.completedAt
    && Date.now() - new Date(state.completedAt).getTime() < ttlMilliseconds()
    && activeCount > 0;
  if (fresh) return { source: "cache", stale: false, refreshedAt: state.completedAt };

  try {
    if (!refreshInFlight) refreshInFlight = refreshDirectory().finally(() => { refreshInFlight = null; });
    const refreshed = await refreshInFlight;
    return { source: "stedi", stale: false, refreshedAt: refreshed.refreshedAt };
  } catch (error) {
    if (activeCount > 0) {
      return { source: "stale-cache", stale: true, refreshedAt: state?.completedAt || null };
    }
    throw error;
  }
};

const toDirectoryOption = (payer) => ({
  stediId: payer.stediId,
  displayName: payer.displayName,
  conciseName: payer.conciseName || "",
  primaryPayerId: payer.primaryPayerId,
  aliases: payer.aliases || [],
  eligibilityCheck: payer.transactionSupport?.eligibilityCheck || "NOT_SUPPORTED",
  claimStatus: payer.transactionSupport?.claimStatus || "NOT_SUPPORTED",
  dentalClaimSubmission: payer.transactionSupport?.dentalClaimSubmission || "NOT_SUPPORTED",
  claimPayment: payer.transactionSupport?.claimPayment || "NOT_SUPPORTED",
  coordinationOfBenefits: payer.transactionSupport?.coordinationOfBenefits || "NOT_SUPPORTED",
  directoryActive: payer.active !== false,
  lastSyncedAt: payer.lastSyncedAt || null,
});

const selectedPayerIds = async () => {
  const configuredCount = await PlatformInsurer.countDocuments();
  if (configuredCount === 0) return null;
  const configured = await PlatformInsurer.find({ configuredStatus: "active" })
    .select("payerStediId")
    .lean();
  return configured.map((item) => item.payerStediId);
};

// The client dropdown uses the application allow-list once an Admin has
// configured at least one insurer. Before that, all live directory payers stay
// available so existing installations remain backwards compatible.
export const getDentalPayerDirectory = async ({ applicationOnly = true } = {}) => {
  const cache = await ensureFreshDirectory();
  const query = { active: true };
  if (applicationOnly) {
    const payerIds = await selectedPayerIds();
    if (payerIds) query.stediId = { $in: payerIds };
  }
  const payers = await StediPayer.find(query).sort({ displayName: 1, primaryPayerId: 1 }).lean();
  return { payers: payers.map(toDirectoryOption), cache };
};

// Admin selection includes historical/inactive directory rows too. Those rows
// can be selected, but their effective platform status is shown as an error.
export const getAllDentalPayerDirectory = async () => {
  const cache = await ensureFreshDirectory();
  const payers = await StediPayer.find({ coverageTypes: "dental" })
    .sort({ displayName: 1, primaryPayerId: 1 })
    .lean();
  return { payers: payers.map(toDirectoryOption), cache };
};

export const getSelectableDentalPayersByIds = async (values = []) => {
  const normalized = [...new Set(values
    .map((value) => String(value || "").trim().toUpperCase())
    .filter(Boolean))];
  if (!normalized.length) return [];

  const allowed = await selectedPayerIds();
  const payerIds = allowed === null
    ? normalized
    : normalized.filter((id) => allowed.includes(id));
  if (!payerIds.length) return [];

  return StediPayer.find({ stediId: { $in: payerIds }, active: true }).lean();
};
