import { clearAdminSession, loadAdminSession } from "./session.js";

const API_BASE = import.meta.env.VITE_API_URL;

const toPlan = (plan) => ({
  ...plan,
  id: plan.key,
  dbId: plan._id,
  features: plan.features || [],
  clientCount: Number(plan.clientCount || 0),
});

const toCoupon = (coupon) => ({
  ...coupon,
  id: coupon._id || coupon.id,
  expires: coupon.expiresAt ? String(coupon.expiresAt).slice(0, 10) : "",
  pct: Number(coupon.pct),
  redemptions: Number(coupon.redemptions || 0),
});

async function request(path, options = {}) {
  const token = loadAdminSession()?.token;
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
  } catch {
    throw new Error("Cannot reach the server. Please check your connection and try again.");
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.success === false) {
    if (response.status === 401) clearAdminSession();
    throw new Error(payload.message || `Request failed (${response.status})`);
  }
  return payload.data;
}

export const fetchPlansApi = () => request("/plans").then((rows) => rows.map(toPlan));
export const createPlanApi = (plan) => request("/plans", { method: "POST", body: JSON.stringify(plan) }).then(toPlan);
export const updatePlanApi = (key, changes) => request(`/plans/${key}`, { method: "PATCH", body: JSON.stringify(changes) }).then(toPlan);
export const deletePlanApi = (key) => request(`/plans/${key}`, { method: "DELETE" });

export const fetchCouponsApi = () => request("/coupons").then((rows) => rows.map(toCoupon));
export const createCouponApi = (coupon) => request("/coupons", { method: "POST", body: JSON.stringify({ ...coupon, expiresAt: coupon.expires }) }).then(toCoupon);
export const updateCouponApi = (id, changes) => request(`/coupons/${id}`, { method: "PATCH", body: JSON.stringify(changes) }).then(toCoupon);
export const deleteCouponApi = (id) => request(`/coupons/${id}`, { method: "DELETE" });
