import { fail, ok } from "../../../utils/client/apiResponse.js";
import { getDentalPayerDirectory } from "../../../services/stedi/payerDirectoryService.js";

// GET /api/client-panel/payers — authenticated dental payer options backed by the daily Stedi cache
export const listDentalPayers = async (req, res) => {
  try {
    const directory = await getDentalPayerDirectory();
    return ok(res, "Dental payer directory loaded", directory);
  } catch (error) {
    console.error(`[Stedi] payer directory unavailable: ${error.code || error.message}`);
    return fail(res, 503, "The insurance payer directory is temporarily unavailable", {
      code: error.code === "STEDI_NOT_CONFIGURED" ? "PAYER_DIRECTORY_NOT_CONFIGURED" : "PAYER_DIRECTORY_UNAVAILABLE",
    });
  }
};
