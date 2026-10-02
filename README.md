<p align="center">
  <img src="https://raw.githubusercontent.com/andrewkimjoseph/celina/main/assets/celina-banner.svg" alt="Celina — Give your LLM a wallet on Celo">
</p>

# Celina Status

Public status page for the Celina stack: live health of the hosted services, 30-day uptime, and usage stats (on-chain activity, off-chain tool calls, npm downloads).

**Live:** [status.usecelina.xyz](https://status.usecelina.xyz)

Deployed as a **Cloudflare Worker** (TanStack Start). It is not an npm package.

Live checks ping MCP Remote, the API, the bot, the stats API, the website, Celeste, Celina Chat, and this page. The Status row is recorded in-process, because this Worker cannot fetch its own public URL. Uptime history comes from [celina-stats-api](https://api.stats.usecelina.xyz) `GET /uptime`, which the stats Worker writes once a day. Usage panels read the same stats API (`GET /onchain`, `GET /offchain/*`, `GET /package`) with `STATS_READ_KEY`.

## Local dev

```bash
npm install
cp .env.example .env.local
# set STATS_READ_KEY to the same bearer token as on celina-stats-api
npm run dev
```

Requires Node.js ≥ 20. Vite serves the app on port 3000. Live health checks do not need the read key. On-chain, off-chain, and download stats stay empty until `STATS_READ_KEY` is set.

## Deploy

Production host: `https://status.usecelina.xyz` (custom domain in `wrangler.jsonc`).

```bash
npm run build
npx wrangler deploy
```

Set `STATS_READ_KEY` as a Worker secret (`npx wrangler secret put STATS_READ_KEY`). Set `STATS_API_BASE_URL` only if you need a non-production stats host. It defaults to `https://api.stats.usecelina.xyz`.

## License

MIT
