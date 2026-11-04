import { clearAdminSession, loadAdminSession } from "./session.js";
import { PERMS, RESOURCES } from "../constants/navigation.js";
import { emptyGrid } from "../utils/grid.js";

const API_BASE = import.meta.env.VITE_API_URL;
const resourceKey = (label) => label.toLowerCase().replaceAll(" ", "_");

async function request(path, options = {}) {
  const token = loadAdminSession()?.token;
  let response;
  try {
    response = await fetch(`${API_BASE}/roles${path}`, {
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

const toGrid = (entries = []) => {
  const result = emptyGrid();
  const byKey = new Map(entries.map((entry) => [entry.resource, entry.actions]));
  RESOURCES.forEach((resource) => {
    const granted = byKey.get(resourceKey(resource)) || [];
    PERMS.forEach((permission) => {
      result[resource][permission] = granted.includes(permission);
    });
  });
  return result;
};

const toPermissionEntries = (permissionGrid) =>
  RESOURCES.map((resource) => ({
    resource: resourceKey(resource),
    actions: PERMS.filter((permission) => permissionGrid?.[resource]?.[permission]),
  }));

const toRole = (role) => ({ ...role, permissions: toGrid(role.permissions) });

export const fetchRolesApi = () => request("").then((roles) => roles.map(toRole));

export const createRoleApi = ({ name, desc }) =>
  request("", {
    method: "POST",
    body: JSON.stringify({ name, description: desc, permissions: [] }),
  }).then(toRole);

export const updateRoleApi = (id, role) =>
  request(`/${id}`, {
    method: "PATCH",
    body: JSON.stringify({
      ...(role.name !== undefined ? { name: role.name } : {}),
      ...(role.desc !== undefined ? { description: role.desc } : {}),
      ...(role.permissions !== undefined
        ? { permissions: toPermissionEntries(role.permissions) }
        : {}),
    }),
  }).then(toRole);

export const deleteRoleApi = (id) =>
  request(`/${id}`, { method: "DELETE" });
