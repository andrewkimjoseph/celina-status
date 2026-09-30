import { createServerFn } from "@tanstack/react-start";

import { statsApiBaseUrl, statsApiHeaders } from "./stats-api";

export type TxRow = {
  day: string;
  hash: string;
  block_time: string;
  block_number: number;
  from: string;
  to: string;
};

export type DayCount = { day: string; count: number };
export type ToolCount = { event: string; count: number };
export type DownloadDay = { day: string; downloads: number };

export type OnchainStats = {
  rows: TxRow[];
  lastSyncedAt: string | null;
  error: string | null;
};

export type DailyStats = {
  rows: DayCount[];
  total: number;
  error: string | null;
};

export type ToolStats = {
  rows: ToolCount[];
  error: string | null;
};

export type WalletStats = {
  daily: DayCount[];
  total: number;
  error: string | null;
};

export type PackageStats = {
  rows: DownloadDay[];
  lastSyncedAt: string | null;
  partial: boolean;
  failedPackages: string[];
  error: string | null;
};

async function readJson<T>(path: string): Promise<{ ok: boolean; status: number; json: T | null }> {
  const res = await fetch(`${statsApiBaseUrl()}${path}`, { headers: statsApiHeaders() });
  if (!res.ok && res.status !== 502) {
    return { ok: false, status: res.status, json: null };
  }
  const json = (await res.json()) as T;
  return { ok: res.ok, status: res.status, json };
}

export const getOnchainStats = createServerFn({ method: "GET" }).handler(
  async (): Promise<OnchainStats> => {
    try {
      const { ok, status, json } = await readJson<{
        rows?: TxRow[];
        lastSyncedAt?: string | null;
        error?: string;
      }>("/onchain");
      if (!json) return { rows: [], lastSyncedAt: null, error: `Stats API ${status}` };
      if (!ok && (!json.rows || json.rows.length === 0)) {
        return { rows: [], lastSyncedAt: json.lastSyncedAt ?? null, error: json.error ?? `Stats API ${status}` };
      }
      return { rows: json.rows ?? [], lastSyncedAt: json.lastSyncedAt ?? null, error: json.error ?? null };
    } catch (error) {
      console.error("[status] onchain failed:", error);
      return { rows: [], lastSyncedAt: null, error: "On-chain stats are temporarily unavailable." };
    }
  },
);

export const getOffchainDaily = createServerFn({ method: "GET" }).handler(
  async (): Promise<DailyStats> => {
    try {
      const { ok, status, json } = await readJson<{
        rows?: DayCount[];
        total?: number;
        error?: string;
      }>("/offchain/daily");
      if (!json || !ok) {
        return { rows: [], total: 0, error: json?.error ?? `Stats API ${status}` };
      }
      return { rows: json.rows ?? [], total: json.total ?? 0, error: null };
    } catch (error) {
      console.error("[status] offchain daily failed:", error);
      return { rows: [], total: 0, error: "Off-chain stats are temporarily unavailable." };
    }
  },
);

export const getOffchainTools = createServerFn({ method: "GET" }).handler(
  async (): Promise<ToolStats> => {
    try {
      const { ok, status, json } = await readJson<{ rows?: ToolCount[]; error?: string }>(
        "/offchain/tools",
      );
      if (!json || !ok) {
        return { rows: [], error: json?.error ?? `Stats API ${status}` };
      }
      return { rows: json.rows ?? [], error: null };
    } catch (error) {
      console.error("[status] offchain tools failed:", error);
      return { rows: [], error: "Tool stats are temporarily unavailable." };
    }
  },
);

export const getOffchainWallets = createServerFn({ method: "GET" }).handler(
  async (): Promise<WalletStats> => {
    try {
      const { ok, status, json } = await readJson<{
        daily?: DayCount[];
        total?: number;
        error?: string;
      }>("/offchain/wallets");
      if (!json || !ok) {
        return { daily: [], total: 0, error: json?.error ?? `Stats API ${status}` };
      }
      return { daily: json.daily ?? [], total: json.total ?? 0, error: null };
    } catch (error) {
      console.error("[status] offchain wallets failed:", error);
      return { daily: [], total: 0, error: "Wallet stats are temporarily unavailable." };
    }
  },
);

export const getPackageStats = createServerFn({ method: "GET" }).handler(
  async (): Promise<PackageStats> => {
    const empty = (error: string | null): PackageStats => ({
      rows: [],
      lastSyncedAt: null,
      partial: false,
      failedPackages: [],
      error,
    });
    try {
      const { status, json } = await readJson<{
        rows?: DownloadDay[];
        lastSyncedAt?: string | null;
        partial?: boolean;
        failedPackages?: string[];
        error?: string;
      }>("/package");
      if (!json) return empty(`Stats API ${status}`);
      if (json.error && (!json.rows || json.rows.length === 0)) return empty(json.error);
      return {
        rows: json.rows ?? [],
        lastSyncedAt: json.lastSyncedAt ?? null,
        partial: Boolean(json.partial),
        failedPackages: json.failedPackages ?? [],
        error: json.error ?? null,
      };
    } catch (error) {
      console.error("[status] package stats failed:", error);
      return empty("Download stats are temporarily unavailable.");
    }
  },
);
