import { loadAdminSession } from "./session.js";

export const API_BASE = import.meta.env.VITE_API_URL;

const request = async (path, options = {}) => {
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, options);
  } catch {
    throw new Error("Cannot reach the server. Please check your connection and try again.");
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.success === false) {
    const error = new Error(payload.message || `Request failed (${response.status})`);
    error.status = response.status;
    error.code = payload.code || "ERROR";
    throw error;
  }
  return payload.data;
};

export const loginAdmin = (email, password) =>
  request("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

export const verifyAdminMfa = (mfaToken, code) =>
  request("/auth/mfa/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mfaToken, code }),
  });

export const resendAdminMfa = (mfaToken) =>
  request("/auth/mfa/resend", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mfaToken }),
  });

export const forgotAdminPassword = (email) =>
  request("/auth/forgot-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });

export const resetAdminPassword = ({ email, code, newPassword }) =>
  request("/auth/reset-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, code, newPassword }),
  });

export const fetchAdminInvitation = (token) =>
  request(`/auth/invitations/${encodeURIComponent(token)}`);

export const acceptAdminInvitation = (token, password, confirmPassword) =>
  request(`/auth/invitations/${encodeURIComponent(token)}/accept`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password, confirmPassword }),
  });

export const fetchAdminProfile = () => {
  const token = loadAdminSession()?.token;
  return request("/auth/profile", {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
};

export const logoutAdmin = () => {
  const token = loadAdminSession()?.token;
  return request("/auth/logout", {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
};
