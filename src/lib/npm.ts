import { createServerFn } from "@tanstack/react-start";

export const NPM_PACKAGES = [
  "@andrewkimjoseph/celina-sdk",
  "@andrewkimjoseph/celina-mcp",
] as const;

export type NpmDay = { day: string; downloads: number };

export type NpmPackageSnapshot = {
  name: string;
  version: string | null;
  weeklyDownloads: number | null;
  daily: NpmDay[];
  error: string | null;
};

export type NpmSnapshot = {
  packages: NpmPackageSnapshot[];
  fetchedAt: number;
};

async function readPackage(name: string): Promise<NpmPackageSnapshot> {
  try {
    const [metaRes, downloadsRes] = await Promise.all([
      fetch(`https://registry.npmjs.org/${name}`),
      fetch(`https://api.npmjs.org/downloads/range/last-month/${name}`),
    ]);
    if (!metaRes.ok && !downloadsRes.ok) {
      return {
        name,
        version: null,
        weeklyDownloads: null,
        daily: [],
        error: `npm ${metaRes.status}`,
      };
    }

    let version: string | null = null;
    if (metaRes.ok) {
      const meta = (await metaRes.json()) as { "dist-tags"?: { latest?: string } };
      version = meta["dist-tags"]?.latest ?? null;
    } else {
      await metaRes.body?.cancel();
    }

    let daily: NpmDay[] = [];
    if (downloadsRes.ok) {
      const body = (await downloadsRes.json()) as { downloads?: NpmDay[] };
      daily = (body.downloads ?? []).map((row) => ({
        day: String(row.day),
        downloads: Number(row.downloads ?? 0),
      }));
    } else {
      await downloadsRes.body?.cancel();
    }

    const weeklyDownloads = downloadsRes.ok
      ? daily.slice(-7).reduce((sum, row) => sum + row.downloads, 0)
      : null;
    const error = !metaRes.ok
      ? `Version lookup failed (${metaRes.status}).`
      : !downloadsRes.ok
        ? `Download lookup failed (${downloadsRes.status}).`
        : null;
    return { name, version, weeklyDownloads, daily, error };
  } catch (error) {
    console.error(`[status] npm ${name} failed:`, error);
    return {
      name,
      version: null,
      weeklyDownloads: null,
      daily: [],
      error: "npm is temporarily unavailable.",
    };
  }
}

export const getNpmPackages = createServerFn({ method: "GET" }).handler(
  async (): Promise<NpmSnapshot> => {
    const packages = await Promise.all(NPM_PACKAGES.map((name) => readPackage(name)));
    return { packages, fetchedAt: Date.now() };
  },
);
