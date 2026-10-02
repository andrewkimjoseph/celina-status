import { createServerFn } from "@tanstack/react-start";

import { statsApiBaseUrl } from "./stats-api";

export const DEGRADED_LATENCY_MS = 1000;
const PING_TIMEOUT_MS = 8_000;

export const MONITORED_SERVICES = [
  { id: "mcp", name: "MCP Remote", url: "https://mcp.usecelina.xyz/health" },
  { id: "api", name: "API", url: "https://api.usecelina.xyz/health" },
  { id: "bot", name: "Bot", url: "https://bot.usecelina.xyz/health" },
  { id: "stats", name: "Stats API", url: "https://api.stats.usecelina.xyz/health" },
  { id: "website", name: "Website", url: "https://usecelina.xyz/" },
  { id: "celeste", name: "Celeste AI", url: "https://celeste.usecelina.xyz/" },
  { id: "chat", name: "Celina Chat", url: "https://chat.usecelina.xyz/" },
  { id: "status", name: "Status", url: "https://status.usecelina.xyz/" },
] as const;

export type ServiceId = (typeof MONITORED_SERVICES)[number]["id"];
export type ServiceStatus = "operational" | "degraded" | "down";

export type ServicePing = {
  id: string;
  name: string;
  url: string;
  status: ServiceStatus;
  latencyMs: number | null;
  ok: boolean;
};

export type LiveHealth = {
  services: ServicePing[];
  checkedAt: number;
};

export type UptimeDay = {
  date: string;
  results: ServicePing[];
};

export type UptimeHistory = {
  days: UptimeDay[];
  error: string | null;
};

function statusFromResponse(ok: boolean, latencyMs: number | null): ServiceStatus {
  if (!ok || latencyMs === null) return "down";
  if (latencyMs > DEGRADED_LATENCY_MS) return "degraded";
  return "operational";
}

async function pingOne(service: (typeof MONITORED_SERVICES)[number]): Promise<ServicePing> {
  // This check runs inside the status Worker. Fetching its own public URL is
  // rejected by Cloudflare (error 1042), so record Status in-process instead.
  if (service.id === "status") {
    return {
      id: service.id,
      name: service.name,
      url: service.url,
      status: "operational",
      latencyMs: null,
      ok: true,
    };
  }

  const started = Date.now();
  try {
    const res = await fetch(service.url, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(PING_TIMEOUT_MS),
    });
    const latencyMs = Date.now() - started;
    await res.body?.cancel();
    return {
      id: service.id,
      name: service.name,
      url: service.url,
      status: statusFromResponse(res.ok, latencyMs),
      latencyMs,
      ok: res.ok,
    };
  } catch {
    return {
      id: service.id,
      name: service.name,
      url: service.url,
      status: "down",
      latencyMs: null,
      ok: false,
    };
  }
}

export const checkHealthNow = createServerFn({ method: "GET" }).handler(
  async (): Promise<LiveHealth> => {
    const settled = await Promise.allSettled(MONITORED_SERVICES.map((service) => pingOne(service)));
    const services = settled.map((result, index) => {
      if (result.status === "fulfilled") return result.value;
      const service = MONITORED_SERVICES[index]!;
      return {
        id: service.id,
        name: service.name,
        url: service.url,
        status: "down" as const,
        latencyMs: null,
        ok: false,
      };
    });
    return { services, checkedAt: Date.now() };
  },
);

export const getUptimeHistory = createServerFn({ method: "GET" }).handler(
  async (): Promise<UptimeHistory> => {
    try {
      const res = await fetch(`${statsApiBaseUrl()}/uptime`);
      if (!res.ok) {
        return { days: [], error: `Uptime history is unavailable (${res.status}).` };
      }
      const json = (await res.json()) as { days?: UptimeDay[]; error?: string };
      return { days: json.days ?? [], error: json.error ?? null };
    } catch (error) {
      console.error("[status] uptime history failed:", error);
      return { days: [], error: "Uptime history is temporarily unavailable." };
    }
  },
);
