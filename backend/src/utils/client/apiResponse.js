// One response format for every Client Panel API.
//
// Success   -> HTTP 200 / 201
//   { "success": true,  "statusCode": 200, "message": "Login successful", "data": { ... } }
//
// Failure   -> HTTP 4xx / 5xx
//   { "success": false, "statusCode": 422, "code": "VALIDATION_ERROR", "message": "Email is required",
//     "errors": [ { "field": "email", "message": "Email is required" } ] }      <- `errors` only for validation
//
// `message` is always safe to show to the user; `code` is a stable machine-readable name for the frontend.

const DEFAULT_CODE = {
  400: "BAD_REQUEST",
  401: "UNAUTHENTICATED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  409: "CONFLICT",
  422: "VALIDATION_ERROR",
  429: "TOO_MANY_REQUESTS",
  500: "INTERNAL_ERROR",
  503: "SERVICE_UNAVAILABLE",
};

const send = (res, statusCode, message, data) =>
  res.status(statusCode).json({ success: true, statusCode, message, data });

/** 200 OK */
export const ok = (res, message, data = null) => send(res, 200, message, data);

/** 201 Created */
export const created = (res, message, data = null) => send(res, 201, message, data);

/**
 * Error response. `opts.code` overrides the default code for the status; `opts.errors` is the field list.
 *   fail(res, 404, "Patient not found")
 *   fail(res, 401, "Invalid email or password", { code: "INVALID_CREDENTIALS" })
 */
export const fail = (res, statusCode, message, opts = {}) =>
  res.status(statusCode).json({
    success: false,
    statusCode,
    code: opts.code || DEFAULT_CODE[statusCode] || "ERROR",
    message,
    ...(opts.errors ? { errors: opts.errors } : {}),
  });

/**
 * 422 Unprocessable Entity for bad input. `errors` = [{ field, message }, ...]
 * The top-level message is the first problem, so a single toast already says what is wrong.
 */
export const invalid = (res, errors) => fail(res, 422, errors[0].message, { code: "VALIDATION_ERROR", errors });
