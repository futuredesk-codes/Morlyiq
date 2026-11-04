import { CdtCode } from "../../../models/admin/CdtCode.js";
import { ok } from "../../../utils/client/apiResponse.js";

// GET /api/client-panel/cdt
// The catalogue is global and read-only in the Client Panel. Admin permissions
// continue to control every create, edit, and delete operation.
export const listCdtCodes = async (req, res) => {
  const codes = await CdtCode.find()
    .select("code description defaultCoverage frequency")
    .sort({ code: 1 })
    .lean();

  return ok(res, "CDT catalogue loaded", codes.map((item) => ({
    id: String(item._id),
    code: item.code,
    description: item.description,
    defaultCoverage: item.defaultCoverage,
    frequency: item.frequency,
  })));
};
