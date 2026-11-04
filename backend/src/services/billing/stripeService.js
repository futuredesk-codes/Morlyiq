import Stripe from "stripe";

let stripeClient;

export function getStripe() {
  const key = String(process.env.STRIPE_SECRET_KEY || "").trim();
  if (!key) {
    const error = new Error("Stripe is not configured. Add STRIPE_SECRET_KEY to the backend environment.");
    error.code = "STRIPE_NOT_CONFIGURED";
    throw error;
  }
  const testOnly = process.env.STRIPE_TEST_MODE_ONLY !== "false";
  if (testOnly && !key.startsWith("sk_test_")) {
    const error = new Error("Development checkout requires a Stripe test secret key (sk_test_...).");
    error.code = "STRIPE_TEST_KEY_REQUIRED";
    throw error;
  }
  stripeClient ||= new Stripe(key);
  return stripeClient;
}

export function recurringFromPeriod(period) {
  const match = String(period || "").trim().match(/^(\d+)\s+(day|week|month|year)s?$/i);
  if (!match) return null;
  return { interval: match[2].toLowerCase(), interval_count: Number(match[1]) };
}

export function stripeId(value) {
  return typeof value === "string" ? value : value?.id || "";
}
