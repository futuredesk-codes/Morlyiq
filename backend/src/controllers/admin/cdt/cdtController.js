import { CdtCode } from "../../../models/admin/CdtCode.js";

const normalizeCode = (value) => String(value || "").trim().toUpperCase();
const validCode = (value) => /^D\d{4}$/.test(value);

const coverageValue = (value) => {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 && number <= 100 ? number : null;
};

export const getCdtCodes = async (req, res) => {
  const codes = await CdtCode.find().sort({ code: 1 });
  return res.status(200).json({ success: true, count: codes.length, data: codes });
};

export const createCdtCode = async (req, res) => {
  const code = normalizeCode(req.body?.code);
  const description = String(req.body?.description ?? req.body?.desc ?? "").trim();
  const defaultCoverage = coverageValue(req.body?.defaultCoverage ?? req.body?.pct);
  const frequency = String(req.body?.frequency ?? req.body?.freq ?? "—").trim() || "—";

  if (!validCode(code) || !description || defaultCoverage === null) {
    return res.status(422).json({
      success: false,
      code: "VALIDATION_ERROR",
      message: "Enter a valid CDT code, description, and coverage percentage from 0 to 100",
    });
  }

  const created = await CdtCode.create({ code, description, defaultCoverage, frequency });
  return res.status(201).json({ success: true, message: "CDT code created", data: created });
};

export const updateCdtCode = async (req, res) => {
  const changes = {};

  if (req.body?.code !== undefined) {
    const code = normalizeCode(req.body.code);
    if (!validCode(code)) {
      return res.status(422).json({
        success: false,
        code: "VALIDATION_ERROR",
        message: "CDT code must use the format D followed by four digits",
      });
    }
    changes.code = code;
  }

  if (req.body?.description !== undefined || req.body?.desc !== undefined) {
    const description = String(req.body.description ?? req.body.desc ?? "").trim();
    if (!description) {
      return res.status(422).json({
        success: false,
        code: "VALIDATION_ERROR",
        message: "Description is required",
      });
    }
    changes.description = description;
  }

  if (req.body?.defaultCoverage !== undefined || req.body?.pct !== undefined) {
    const defaultCoverage = coverageValue(req.body.defaultCoverage ?? req.body.pct);
    if (defaultCoverage === null) {
      return res.status(422).json({
        success: false,
        code: "VALIDATION_ERROR",
        message: "Default coverage must be from 0 to 100",
      });
    }
    changes.defaultCoverage = defaultCoverage;
  }

  if (req.body?.frequency !== undefined || req.body?.freq !== undefined) {
    changes.frequency = String(req.body.frequency ?? req.body.freq ?? "").trim() || "—";
  }

  if (Object.keys(changes).length === 0) {
    return res.status(422).json({
      success: false,
      code: "VALIDATION_ERROR",
      message: "Provide at least one CDT field to update",
    });
  }

  const updated = await CdtCode.findByIdAndUpdate(req.params.id, changes, {
    returnDocument: "after",
    runValidators: true,
  });
  if (!updated) {
    return res.status(404).json({ success: false, code: "CDT_NOT_FOUND", message: "CDT code not found" });
  }
  return res.status(200).json({ success: true, message: "CDT code updated", data: updated });
};

export const deleteCdtCode = async (req, res) => {
  const deleted = await CdtCode.findByIdAndDelete(req.params.id);
  if (!deleted) {
    return res.status(404).json({ success: false, code: "CDT_NOT_FOUND", message: "CDT code not found" });
  }
  return res.status(200).json({
    success: true,
    message: "CDT code deleted",
    data: { id: String(deleted._id), code: deleted.code },
  });
};
