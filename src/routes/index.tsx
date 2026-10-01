import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faNpm } from "@fortawesome/free-brands-svg-icons";

import {
  MONITORED_SERVICES,
  checkHealthNow,
  getUptimeHistory,
  type LiveHealth,
  type ServicePing,
  type ServiceStatus,
  type UptimeHistory,
} from "../lib/health";
import {
  getNpmPackages,
  type NpmSnapshot,
} from "../lib/npm";
import {
  getOffchainDaily,
  getOffchainTools,
  getOffchainWallets,
  getOnchainStats,
  getPackageStats,
  type DailyStats,
  type PackageStats,
  type ToolStats,
  type WalletStats,
  type OnchainStats,
} from "../lib/stats";

const HISTORY_DAYS = 30;
const REFRESH_MS = 30_000;

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Celina Status" },
      {
        name: "description",
        content:
          "Live status and usage stats for the Celina stack — MCP, API, bot, SDK, website, and Celeste.",
      },
    ],
  }),
  component: StatusPage,
});

type DayStatus = ServiceStatus | "unknown";
type Tab = "onchain" | "offchain" | "downloads";
type Point = { label: string; value: number };

function utcDays(count: number): string[] {
  const now = new Date();
  return Array.from({ length: count }, (_, index) => {
    const day = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (count - 1 - index)),
    );
    return day.toISOString().slice(0, 10);
  });
}

function storedStatus(history: UptimeHistory | null, serviceId: string, date: string): DayStatus {
  const row = history?.days
    .find((day) => day.date === date)
    ?.results.find((result) => result.id === serviceId);
  if (!row) return "unknown";
  if (row.status === "operational" || row.status === "degraded" || row.status === "down") {
    return row.status;
  }
  return "unknown";
}

function uptimeLabel(statuses: DayStatus[]): string {
  const known = statuses.filter((status) => status !== "unknown");
  if (known.length === 0) return "No history yet";
  const up = known.filter((status) => status === "operational" || status === "degraded").length;
  const pct = (up / known.length) * 100;
  const rounded = pct === 100 ? "100%" : `${pct.toFixed(1)}%`;
  return `${rounded} uptime`;
}

function overall(services: ServicePing[] | null): { label: string; tone: DayStatus | "checking" } {
  if (!services) return { label: "Checking", tone: "checking" };
  if (services.some((service) => service.status === "down")) {
    return { label: "Partial outage", tone: "down" };
  }
  if (services.some((service) => service.status === "degraded")) {
    return { label: "Degraded", tone: "degraded" };
  }
  return { label: "Operational", tone: "operational" };
}

function formatTxTime(value: string): string {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? value || "—" : formatStamp(parsed);
}

function formatStamp(ts: number): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(ts));
}

function formatCount(value: number): string {
  return new Intl.NumberFormat().format(value);
}

function shortHash(value: string): string {
  if (value.length < 18) return value;
  return `${value.slice(0, 10)}…${value.slice(-6)}`;
}

function shortAddr(value: string): string {
  if (!value || value.length < 12) return value || "—";
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

function lastPoints(
  rows: Array<{ day: string; value: number }>,
): Point[] {
  return [...rows]
    .sort((a, b) => a.day.localeCompare(b.day))
    .slice(-HISTORY_DAYS)
    .map((row) => ({ label: row.day, value: row.value }));
}

const BAR: Record<DayStatus, string> = {
  operational: "bg-[var(--celo-forest)]",
  degraded: "bg-[var(--celo-yellow)]",
  down: "bg-destructive",
  unknown: "bg-muted",
};

const PILL: Record<DayStatus | "checking", string> = {
  operational: "bg-[var(--celo-forest)] text-[var(--celo-cream)]",
  degraded: "bg-[var(--celo-yellow)] text-black",
  down: "bg-destructive text-white",
  unknown: "bg-muted text-foreground",
  checking: "bg-muted text-foreground",
};

function StatusPage() {
  const [health, setHealth] = useState<LiveHealth | null>(null);
  const [uptime, setUptime] = useState<UptimeHistory | null>(null);
  const [onchain, setOnchain] = useState<OnchainStats | null>(null);
  const [daily, setDaily] = useState<DailyStats | null>(null);
  const [tools, setTools] = useState<ToolStats | null>(null);
  const [wallets, setWallets] = useState<WalletStats | null>(null);
  const [packages, setPackages] = useState<PackageStats | null>(null);
  const [npm, setNpm] = useState<NpmSnapshot | null>(null);
  const [tab, setTab] = useState<Tab>("onchain");
  const running = useRef(false);

  const load = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    try {
      const [healthR, uptimeR, onchainR, dailyR, toolsR, walletsR, packageR, npmR] =
        await Promise.all([
          checkHealthNow(),
          getUptimeHistory(),
          getOnchainStats(),
          getOffchainDaily(),
          getOffchainTools(),
          getOffchainWallets(),
          getPackageStats(),
          getNpmPackages(),
        ]);
      setHealth(healthR);
      setUptime(uptimeR);
      setOnchain(onchainR);
      setDaily(dailyR);
      setTools(toolsR);
      setWallets(walletsR);
      setPackages(packageR);
      setNpm(npmR);
    } finally {
      running.current = false;
    }
  }, []);

  useEffect(() => {
    void load();
    const refreshId = window.setInterval(() => void load(), REFRESH_MS);
    return () => window.clearInterval(refreshId);
  }, [load]);

  const checkedAt = health?.checkedAt ?? null;
  const banner = overall(health?.services ?? null);
  const dates = utcDays(HISTORY_DAYS);
  const today = dates.at(-1);
  const downloadTotal = (packages?.rows ?? []).reduce((sum, row) => sum + row.downloads, 0);
  const txByDay = lastPoints(
    Object.entries(
      (onchain?.rows ?? []).reduce<Record<string, number>>((counts, row) => {
        counts[row.day] = (counts[row.day] ?? 0) + 1;
        return counts;
      }, {}),
    ).map(([day, value]) => ({ day, value })),
  );
  const recent = [...(onchain?.rows ?? [])]
    .sort((a, b) => b.block_time.localeCompare(a.block_time))
    .slice(0, 12);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <p className="text-center text-sm text-muted-foreground">
        {checkedAt ? `Last updated ${formatStamp(checkedAt)}` : "Checking services"}
      </p>

      <section className="mt-6 border-2 border-foreground bg-card shadow-[var(--shadow-brutal)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-foreground px-4 py-3">
          <h2 className="font-display text-lg font-semibold">Services</h2>
          <span
            className={`inline-flex items-center gap-2 rounded-[2px] border-2 border-foreground px-3 py-1 text-sm font-semibold ${PILL[banner.tone]}`}
          >
            <span className="h-2 w-2 bg-current" />
            {banner.label}
          </span>
        </div>
        <div className="px-4 py-4">
          <div className="mb-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
            <Legend className="bg-[var(--celo-forest)]" label="Operational" />
            <Legend className="bg-[var(--celo-yellow)]" label="Slow" />
            <Legend className="bg-destructive" label="Down" />
            <Legend className="bg-muted" label="No data" />
          </div>
          <div className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
            {MONITORED_SERVICES.map((service) => {
              const live = health?.services.find((row) => row.id === service.id) ?? null;
              const stored = dates.map((date) => storedStatus(uptime, service.id, date));
              const shown = stored.map((status, index) =>
                dates[index] === today && status === "unknown" && live ? live.status : status,
              );
              return (
                <ServiceRow
                  key={service.id}
                  name={service.name}
                  url={service.url}
                  live={live}
                  shown={shown}
                  dates={dates}
                  uptime={uptimeLabel(stored)}
                />
              );
            })}
          </div>
          {uptime?.error ? (
            <p className="mt-4 text-sm text-muted-foreground">{uptime.error}</p>
          ) : null}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="font-display text-lg font-semibold">npm packages</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          {(npm?.packages ?? NPM_PLACEHOLDERS).map((pkg) => (
            <article
              key={pkg.name}
              className="border-2 border-foreground bg-card p-4 shadow-[var(--shadow-brutal-sm)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <a
                    href={`https://www.npmjs.com/package/${pkg.name}`}
                    className="inline-flex items-center gap-1.5 font-mono text-sm font-semibold underline decoration-2 underline-offset-4"
                  >
                    <FontAwesomeIcon icon={faNpm} className="h-4 w-4" />
                    {pkg.name}
                  </a>
                  <p className="mt-1 font-display text-2xl font-semibold">
                    {pkg.version ? `v${pkg.version}` : "—"}
                  </p>
                </div>
                <p className="text-right text-sm">
                  <span className="block font-display text-xl font-semibold">
                    {pkg.weeklyDownloads === null ? "—" : formatCount(pkg.weeklyDownloads)}
                  </span>
                  <span className="text-muted-foreground">this week</span>
                </p>
              </div>
              <Bars
                points={lastPoints(pkg.daily.map((row) => ({ day: row.day, value: row.downloads })))}
                label={`${pkg.name} downloads`}
                compact
              />
              {pkg.error ? <p className="mt-2 text-xs text-muted-foreground">{pkg.error}</p> : null}
            </article>
          ))}
        </div>
      </section>

      <section className="mt-8 border-2 border-foreground bg-card shadow-[var(--shadow-brutal)]">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b-2 border-foreground px-4 py-3">
          <h2 className="font-display text-lg font-semibold">Stats</h2>
          <div className="flex flex-wrap gap-2">
            <TabButton active={tab === "onchain"} onClick={() => setTab("onchain")}>
              On-chain
            </TabButton>
            <TabButton active={tab === "offchain"} onClick={() => setTab("offchain")}>
              Off-chain
            </TabButton>
            <TabButton active={tab === "downloads"} onClick={() => setTab("downloads")}>
              Downloads
            </TabButton>
          </div>
        </div>
        <div className="grid gap-3 border-b-2 border-foreground px-4 py-4 sm:grid-cols-4">
          <Stat label="Transactions" value={onchain ? formatCount(onchain.rows.length) : "—"} />
          <Stat label="Tool calls" value={daily ? formatCount(daily.total) : "—"} />
          <Stat label="Wallets" value={wallets ? formatCount(wallets.total) : "—"} />
          <Stat label="Downloads" value={packages ? formatCount(downloadTotal) : "—"} />
        </div>
        <div className="px-4 py-4">
          {tab === "onchain" ? (
            <div>
              {onchain?.error ? <ErrorNote message={onchain.error} /> : null}
              <h3 className="mb-3 text-sm font-semibold">Transactions per day</h3>
              <Bars points={txByDay} label="On-chain transactions per day" />
            </div>
          ) : null}
          {tab === "offchain" ? (
            <div className="grid gap-6 lg:grid-cols-2">
              <div>
                {daily?.error ? <ErrorNote message={daily.error} /> : null}
                <h3 className="mb-3 text-sm font-semibold">Tool calls per day</h3>
                <Bars
                  points={lastPoints((daily?.rows ?? []).map((row) => ({ day: row.day, value: row.count })))}
                  label="Tool calls per day"
                />
              </div>
              <div>
                {wallets?.error ? <ErrorNote message={wallets.error} /> : null}
                <h3 className="mb-3 text-sm font-semibold">Wallets per day</h3>
                <Bars
                  points={lastPoints((wallets?.daily ?? []).map((row) => ({ day: row.day, value: row.count })))}
                  label="Wallets per day"
                />
              </div>
              <div className="lg:col-span-2">
                {tools?.error ? <ErrorNote message={tools.error} /> : null}
                <h3 className="mb-3 text-sm font-semibold">Top tools</h3>
                <ToolTable rows={tools?.rows ?? []} />
              </div>
            </div>
          ) : null}
          {tab === "downloads" ? (
            <div>
              {packages?.error ? <ErrorNote message={packages.error} /> : null}
              {packages?.partial ? (
                <p className="mb-3 text-sm text-muted-foreground">
                  Partial npm history
                  {packages.failedPackages.length
                    ? `: ${packages.failedPackages.join(", ")}`
                    : "."}
                </p>
              ) : null}
              <h3 className="mb-3 text-sm font-semibold">Combined downloads per day</h3>
              <Bars
                points={lastPoints(
                  (packages?.rows ?? []).map((row) => ({ day: row.day, value: row.downloads })),
                )}
                label="npm downloads per day"
              />
            </div>
          ) : null}
        </div>
      </section>

      <section className="mt-8 border-2 border-foreground bg-card shadow-[var(--shadow-brutal)]">
        <div className="border-b-2 border-foreground px-4 py-3">
          <h2 className="font-display text-lg font-semibold">Recent transactions</h2>
        </div>
        <div className="overflow-x-auto px-4 py-3">
          {onchain?.error && recent.length === 0 ? <ErrorNote message={onchain.error} /> : null}
          {recent.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">No transactions yet.</p>
          ) : (
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b-2 border-foreground font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="py-2 pr-3 font-medium">Time</th>
                  <th className="py-2 pr-3 font-medium">Hash</th>
                  <th className="py-2 pr-3 font-medium">From</th>
                  <th className="py-2 font-medium">To</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((row) => (
                  <tr key={row.hash} className="border-b border-foreground/20 font-mono text-xs">
                    <td className="py-2 pr-3">{formatTxTime(row.block_time)}</td>
                    <td className="py-2 pr-3">
                      <a
                        href={`https://celoscan.io/tx/${row.hash}`}
                        className="underline decoration-1 underline-offset-2"
                      >
                        {shortHash(row.hash)}
                      </a>
                    </td>
                    <td className="py-2 pr-3">{shortAddr(row.from)}</td>
                    <td className="py-2">{shortAddr(row.to)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </main>
  );
}

const NPM_PLACEHOLDERS: NpmSnapshot["packages"] = [
  {
    name: "@andrewkimjoseph/celina-sdk",
    version: null,
    weeklyDownloads: null,
    daily: [],
    error: null,
  },
  {
    name: "@andrewkimjoseph/celina-mcp",
    version: null,
    weeklyDownloads: null,
    daily: [],
    error: null,
  },
];

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-3 w-3 border border-foreground ${className}`} />
      {label}
    </span>
  );
}

function ServiceRow({
  name,
  url,
  live,
  shown,
  dates,
  uptime,
}: {
  name: string;
  url: string;
  live: ServicePing | null;
  shown: DayStatus[];
  dates: string[];
  uptime: string;
}) {
  const status = live?.status ?? "unknown";
  const latency = live?.latencyMs == null ? "—" : `${live.latencyMs} ms`;
  return (
    <div className="py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <a href={url} className="inline-flex items-center gap-2 font-display text-base font-semibold">
          <span className={`h-2.5 w-2.5 ${BAR[status]}`} />
          {name}
        </a>
        <div className="flex items-baseline gap-4 text-sm">
          <span className="font-mono">{latency}</span>
          <span className="font-semibold">{uptime}</span>
        </div>
      </div>
      <div className="mt-3 flex gap-1" role="img" aria-label={`${name} 30 day status`}>
        {shown.map((dayStatus, index) => (
          <div
            key={dates[index]}
            title={`${dates[index]} · ${dayStatus}`}
            className={`h-7 min-w-0 flex-1 ${BAR[dayStatus]}`}
          />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[11px] uppercase tracking-wide text-muted-foreground">
        <span>30 days ago</span>
        <span>Today</span>
      </div>
    </div>
  );
}

function Bars({ points, label, compact = false }: { points: Point[]; label: string; compact?: boolean }) {
  if (points.length === 0) {
    return <p className={`${compact ? "mt-4" : ""} text-sm text-muted-foreground`}>No data yet.</p>;
  }
  const max = Math.max(...points.map((point) => point.value), 1);
  return (
    <div className={compact ? "mt-4" : ""}>
      <div className={`flex items-end gap-px ${compact ? "h-12" : "h-32"}`} aria-label={label}>
        {points.map((point) => (
          <div
            key={point.label}
            title={`${point.label}: ${formatCount(point.value)}`}
            className="flex h-full min-w-0 flex-1 items-end"
          >
            <div
              className="w-full bg-[var(--celo-forest)] dark:bg-[var(--celo-yellow)]"
              style={{ height: `${Math.max(point.value > 0 ? 6 : 0, (point.value / max) * 100)}%` }}
            />
          </div>
        ))}
      </div>
      {compact ? null : (
        <div className="mt-1 flex justify-between font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
          <span>{points[0]?.label}</span>
          <span>{points.at(-1)?.label}</span>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-display text-2xl font-semibold">{value}</p>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "rounded-[2px] border-2 border-foreground bg-[var(--celo-forest)] px-3 py-1 text-sm font-semibold text-white shadow-[var(--shadow-brutal-sm)] dark:bg-[var(--celo-yellow)] dark:text-[var(--celo-ink)]"
          : "rounded-[2px] border-2 border-transparent px-3 py-1 text-sm font-medium text-muted-foreground hover:text-foreground"
      }
    >
      {children}
    </button>
  );
}

function ErrorNote({ message }: { message: string }) {
  return <p className="mb-3 text-sm text-destructive">{message}</p>;
}

function ToolTable({ rows }: { rows: Array<{ event: string; count: number }> }) {
  const top = [...rows].sort((a, b) => b.count - a.count).slice(0, 12);
  if (top.length === 0) {
    return <p className="text-sm text-muted-foreground">No tool calls yet.</p>;
  }
  return (
    <table className="w-full text-left text-sm">
      <thead className="border-b-2 border-foreground font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
        <tr>
          <th className="py-2 pr-3 font-medium">Tool</th>
          <th className="py-2 text-right font-medium">Calls</th>
        </tr>
      </thead>
      <tbody>
        {top.map((row) => (
          <tr key={row.event} className="border-b border-foreground/20">
            <td className="py-2 pr-3 font-mono text-xs">{row.event}</td>
            <td className="py-2 text-right font-mono text-xs">{formatCount(row.count)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
