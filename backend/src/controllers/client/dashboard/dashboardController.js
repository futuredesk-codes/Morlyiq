import { Patient } from "../../../models/client/Patient.js";
import { Plan } from "../../../models/admin/Plan.js";
import { CdtCode } from "../../../models/admin/CdtCode.js";
import { ok } from "../../../utils/client/apiResponse.js";

const USAGE_ROLES = new Set(["Owner", "Manager", "Billing"]);
const REVENUE_ROLES = new Set(["Owner", "Manager", "Billing"]);
const RISK_ROLES = new Set(["Owner", "Manager", "Billing"]);
const INSURANCE_ROLES = new Set(["Owner", "Manager", "Billing", "Front Desk"]);

const startOfUtcDay = (value) => {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
};

const emptyMetrics = () => ({
  verification: { pending: 0, completed: 0, failed: 0 },
  revenueSaved: 0,
  risk: { high: 0, medium: 0 },
  payers: [],
});

// GET /api/client-panel/dashboard/stats
// Returns dashboard-ready aggregates only; no patient/member/benefit records leave this endpoint.
export const getDashboardStats = async (req, res) => {
  const tenant = req.user.tenantId;
  const tenantId = tenant._id;
  const from = startOfUtcDay(req.query.from);
  const to = startOfUtcDay(req.query.to);
  const now = new Date();
  const fallbackFrom = new Date(now);
  fallbackFrom.setHours(0, 0, 0, 0);
  const fallbackTo = new Date(fallbackFrom);
  fallbackTo.setDate(fallbackTo.getDate() + 1);
  const dayStart = from || fallbackFrom;
  const dayEnd = to && to > dayStart ? to : fallbackTo;

  const text = (value) => ({ $toUpper: { $convert: { input: value, to: "string", onError: "", onNull: "" } } });
  const benefits = {
    $cond: [{ $isArray: "$result.primary.benefits" }, "$result.primary.benefits", []],
  };
  const requestedCodes = {
    $map: {
      input: { $cond: [{ $isArray: "$codes" }, "$codes", []] },
      as: "code",
      in: text("$$code"),
    },
  };
  const returnedCodes = {
    $filter: {
      input: {
        $map: {
          input: benefits,
          as: "benefit",
          in: text("$$benefit.service.code"),
        },
      },
      as: "code",
      cond: { $ne: ["$$code", ""] },
    },
  };
  const highBenefitCount = {
    $size: {
      $filter: {
        input: benefits,
        as: "benefit",
        cond: {
          $or: [
            {
              $and: [
                { $eq: [text("$$benefit.category"), "NONCOVERED"] },
                {
                  $or: [
                    { $eq: [text("$$benefit.service.code"), ""] },
                    { $in: [text("$$benefit.service.code"), requestedCodes] },
                  ],
                },
              ],
            },
            {
              $and: [
                { $eq: [text("$$benefit.category"), "LIMITATIONS"] },
                { $eq: [text("$$benefit.timePeriod"), "REMAINING"] },
                { $eq: [{ $convert: { input: "$$benefit.amount", to: "double", onError: null, onNull: null } }, 0] },
              ],
            },
          ],
        },
      },
    },
  };
  const mediumBenefitCount = {
    $size: {
      $filter: {
        input: benefits,
        as: "benefit",
        cond: {
          $or: [
            { $eq: ["$$benefit.authorizationRequired", true] },
            { $eq: [text("$$benefit.network"), "OUT_OF_NETWORK"] },
          ],
        },
      },
    },
  };
  const storedRisk = {
    $toLower: {
      $convert: {
        input: { $ifNull: ["$result.claimRisk.level", "$result.primary.claimRisk.level"] },
        to: "string",
        onError: "",
        onNull: "",
      },
    },
  };
  const computedRisk = {
    $switch: {
      branches: [
        { case: { $in: [storedRisk, ["high", "medium", "low"]] }, then: storedRisk },
        { case: { $eq: [{ $ifNull: ["$result.primary", null] }, null] }, then: "" },
        {
          case: {
            $or: [
              { $ne: [text("$result.primary.outcome"), "COMPLETED"] },
              { $gt: [{ $size: { $cond: [{ $isArray: "$result.primary.errors" }, "$result.primary.errors", []] } }, 0] },
              { $not: [{ $regexMatch: { input: text("$result.primary.coverage.status"), regex: "ACTIVE" } }] },
              { $gt: [highBenefitCount, 0] },
            ],
          },
          then: "high",
        },
        {
          case: {
            $or: [
              { $gt: [mediumBenefitCount, 0] },
              { $gt: [{ $size: { $setDifference: [requestedCodes, returnedCodes] } }, 0] },
            ],
          },
          then: "medium",
        },
      ],
      default: "low",
    },
  };

  const patientAggregation = Patient.aggregate([
    { $match: { tenantId, clinicId: req.clinicId } },
    {
      $project: {
        status: 1,
        payer: {
          $let: {
            vars: { normalized: { $trim: { input: { $ifNull: ["$payer", ""] } } } },
            in: { $cond: [{ $eq: ["$$normalized", ""] }, "Unknown payer", "$$normalized"] },
          },
        },
        activityAt: {
          $convert: {
            input: { $ifNull: ["$result.checkedAt", { $ifNull: ["$result.primary.checkedAt", "$appointment"] }] },
            to: "date",
            onError: null,
            onNull: null,
          },
        },
        revenueCents: {
          $sum: {
            $map: {
              input: { $cond: [{ $isArray: "$result.cdtResults" }, "$result.cdtResults", []] },
              as: "row",
              in: { $convert: { input: "$$row.insPay", to: "double", onError: 0, onNull: 0 } },
            },
          },
        },
        riskLevel: computedRisk,
      },
    },
    {
      $facet: {
        summary: [
          {
            $group: {
              _id: null,
              pending: {
                $sum: {
                  $cond: [
                    { $and: [{ $gte: ["$activityAt", dayStart] }, { $lt: ["$activityAt", dayEnd] }, { $in: ["$status", ["not_verified", "queued", "in_progress"]] }] },
                    1,
                    0,
                  ],
                },
              },
              completed: { $sum: { $cond: [{ $and: [{ $gte: ["$activityAt", dayStart] }, { $lt: ["$activityAt", dayEnd] }, { $eq: ["$status", "completed"] }] }, 1, 0] } },
              failed: { $sum: { $cond: [{ $and: [{ $gte: ["$activityAt", dayStart] }, { $lt: ["$activityAt", dayEnd] }, { $eq: ["$status", "failed"] }] }, 1, 0] } },
              revenueCents: { $sum: "$revenueCents" },
              highRisk: { $sum: { $cond: [{ $eq: ["$riskLevel", "high"] }, 1, 0] } },
              mediumRisk: { $sum: { $cond: [{ $eq: ["$riskLevel", "medium"] }, 1, 0] } },
            },
          },
        ],
        payers: [
          { $group: { _id: "$payer", count: { $sum: 1 } } },
          { $sort: { count: -1, _id: 1 } },
          { $limit: 6 },
          { $project: { _id: 0, name: "$_id", count: 1 } },
        ],
      },
    },
  ]);

  const planLookup = USAGE_ROLES.has(req.clinicRole)
    ? Plan.findOne({ key: tenant.planId }).select("key name usageLimit").lean()
    : Promise.resolve(null);
  const cdtLookup = CdtCode.find()
    .select("code description defaultCoverage")
    .sort({ code: 1 })
    .lean();

  const [aggregateRows, plan, cdtCodes] = await Promise.all([patientAggregation, planLookup, cdtLookup]);
  const aggregate = aggregateRows[0] || {};
  const summary = aggregate.summary?.[0];
  const metrics = summary
    ? {
        verification: {
          pending: summary.pending || 0,
          completed: summary.completed || 0,
          failed: summary.failed || 0,
        },
        revenueSaved: (summary.revenueCents || 0) / 100,
        risk: { high: summary.highRisk || 0, medium: summary.mediumRisk || 0 },
        payers: aggregate.payers || [],
      }
    : emptyMetrics();

  const usageLimit = plan?.usageLimit ?? null;
  const verificationsUsed = Math.max(Number(tenant.verifications) || 0, 0);
  const subscription = plan
    ? {
        plan: { id: plan.key, name: plan.name },
        usage: {
          verificationsUsed,
          limit: usageLimit,
          percent: usageLimit && usageLimit > 0 ? Math.min((verificationsUsed / usageLimit) * 100, 100) : null,
        },
      }
    : null;

  return ok(res, "Dashboard statistics loaded", {
    verification: metrics.verification,
    revenueSaved: REVENUE_ROLES.has(req.clinicRole) ? metrics.revenueSaved : null,
    risk: RISK_ROLES.has(req.clinicRole) ? metrics.risk : null,
    payers: INSURANCE_ROLES.has(req.clinicRole) ? metrics.payers : [],
    subscription,
    cdtCodes: cdtCodes.map((item) => ({
      id: String(item._id),
      code: item.code,
      description: item.description,
      defaultCoverage: item.defaultCoverage,
    })),
  });
};
