export function getSafeRedirectPath(value: unknown, fallback = "/desk") {
  if (typeof value !== "string" || !value.trim() || value.startsWith("//")) {
    return fallback;
  }

  try {
    const origin = typeof window !== "undefined" ? window.location.origin : "https://local.app";
    const target = new URL(value, origin);

    if (target.origin !== origin) return fallback;

    const path = `${target.pathname}${target.search}${target.hash}`;
    return path.startsWith("/") ? path : fallback;
  } catch {
    return fallback;
  }
}

export function getSafeRedirectUri(value: unknown, fallback = "/desk") {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}${getSafeRedirectPath(value, fallback)}`;
}