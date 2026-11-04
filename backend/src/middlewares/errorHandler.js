import { fail } from "../utils/client/apiResponse.js";

// 404 for any URL no route handled
export const notFoundHandler = (req, res) =>
  fail(res, 404, `Route not found - ${req.method} ${req.originalUrl}`, { code: "ROUTE_NOT_FOUND" });

// Last stop for anything thrown (Express 5 forwards async errors here too). Same format as every other API error.
export const errorHandler = (err, req, res, next) => {
  if (res.headersSent) return next(err);

  // Body could not be parsed (e.g. broken JSON)
  if (err.type === "entity.parse.failed") return fail(res, 400, "Request body is not valid JSON", { code: "INVALID_JSON" });
  if (err.type === "entity.too.large") return fail(res, 413, "Request body is too large", { code: "PAYLOAD_TOO_LARGE" });

  // Mongoose / MongoDB
  if (err.name === "ValidationError") {
    const errors = Object.values(err.errors || {}).map((e) => ({ field: e.path, message: e.message }));
    return fail(res, 422, errors[0]?.message || "Validation failed", { code: "VALIDATION_ERROR", errors });
  }
  if (err.name === "CastError") return fail(res, 400, `Invalid ${err.path || "id"}`, { code: "BAD_REQUEST" });
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0] || "value";
    return fail(res, 409, `That ${field} already exists`, { code: "CONFLICT" });
  }

  // Unexpected: log it, and do not leak internals in production
  console.error(`[Error] ${req.method} ${req.originalUrl}:`, err);
  const status = err.status || err.statusCode || 500;
  const message = status >= 500 && process.env.NODE_ENV === "production" ? "Something went wrong on our side" : err.message || "Internal Server Error";
  res.status(status).json({
    success: false,
    statusCode: status,
    code: status >= 500 ? "INTERNAL_ERROR" : "ERROR",
    message,
    ...(process.env.NODE_ENV === "production" ? {} : { stack: err.stack }),
  });
};
