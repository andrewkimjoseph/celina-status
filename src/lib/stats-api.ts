export const DEFAULT_STATS_API_BASE_URL = "https://api.stats.usecelina.xyz";

export function statsApiBaseUrl(): string {
  const raw = process.env.STATS_API_BASE_URL?.trim();
  return (raw || DEFAULT_STATS_API_BASE_URL).replace(/\/+$/, "");
}

/** Bearer token for dashboard reads. Empty when `STATS_READ_KEY` is unset. */
export function statsApiHeaders(): HeadersInit {
  const key = process.env.STATS_READ_KEY?.trim();
  if (!key) return {};
  return { Authorization: `Bearer ${key}` };
}
