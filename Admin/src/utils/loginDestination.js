export function loginDestination(from) {
  if (typeof from !== "string" || !from.startsWith("/")) return "/dashboard";
  try {
    const target = new URL(from, "https://admin.local.invalid");
    if (target.origin !== "https://admin.local.invalid" || target.pathname === "/login") return "/dashboard";
    return `${target.pathname}${target.search}${target.hash}`;
  } catch { return "/dashboard"; }
}
