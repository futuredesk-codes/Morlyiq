import { ActivityLog } from "../../../models/client/ActivityLog.js";
import { ok, fail } from "../../../utils/client/apiResponse.js";

const isOwner = (user) => user.memberships.some((m) => m.active && m.clinicId === "*" && m.role === "Owner");

// GET /api/client-panel/activity?limit=100&before=<ISO date> — Owner only, newest first.
// `before` loads the next page: pass the last entry's `ts` from the previous page.
export const listActivity = async (req, res) => {
  if (!isOwner(req.user)) return fail(res, 403, "Only the practice Owner can view the activity log", { code: "ROLE_NOT_ALLOWED" });

  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 100, 1), 200);
  const filter = { tenantId: req.user.tenantId._id };
  const before = req.query.before && new Date(req.query.before);
  if (before && !isNaN(before)) filter.createdAt = { $lt: before };

  const rows = await ActivityLog.find(filter).sort({ createdAt: -1 }).limit(limit);
  ok(res, "Activity log loaded", rows.map((a) => ({ id: a.id, ts: a.createdAt, actor: a.actorName, action: a.action, target: a.target })));
};
