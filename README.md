# FundingEdge — Crypto Funding Intelligence

A deployable full-stack starter for live public-market funding-rate comparison and cross-exchange funding-spread research. It uses a Node.js/Express backend to proxy public exchange APIs and a responsive browser dashboard.

## Included
- Live Binance USDⓈ-M Futures funding snapshots and Bybit V5 linear perpetual tickers.
- Funding-rate interval normalization to hourly, daily and simple annualized estimates.
- Cross-exchange spread scanner for common USDT assets.
- Funding calculator, heatmap, search/sort, local-browser watchlist.
- Binance and Bybit historical funding API routes (`/api/history/:exchange/:symbol`).
- Server-side cache, health endpoint, Dockerfile and Render blueprint.

## Requirements
- Node.js 20 or newer
- npm
- Internet access from the server to public exchange API endpoints

## Run locally
```bash
npm install
cp .env.example .env # optional; this app reads environment variables directly
npm start
```
Open http://localhost:3000. No exchange API keys are required for public market data.

## API routes
- `GET /api/health` — health check
- `GET /api/market` — normalized current funding data and spread scan
- `GET /api/market?refresh=1` — bypass the short server cache
- `GET /api/history/binance/BTCUSDT` — recent Binance funding history
- `GET /api/history/bybit/BTCUSDT` — recent Bybit funding history

## Free deployment with Render
1. Create a GitHub account and a new public or private repository named `fundingedge`.
2. Upload the contents of this folder to the repository (not the enclosing folder).
3. Create a Render account and connect GitHub.
4. In Render choose **New → Blueprint**, select the repository and deploy the `render.yaml` service; or create a Web Service with build command `npm install`, start command `npm start`, and health check `/api/health`.
5. Render assigns a `*.onrender.com` URL. Open it and check `/api/health`.

Render's free web services may sleep when idle and are intended for hobby/testing, not production. Confirm current plan limits before launch. Free hosting terms can change.

## Important product limitations before public launch
This is a working MVP/starter, not yet a production-grade financial service. It currently uses Binance and Bybit only. The browser dashboard polls every 15 seconds; this is frequent REST refresh, not an exchange WebSocket feed. Historical endpoints are provided but historical charts are not yet wired into the UI. Watchlists are stored only in the current browser and are not synced to accounts. There is no login, billing, user database, email/Telegram alert delivery, admin panel, trade execution, or persistent historical data warehouse.

The spread scanner is an indicative normalized 24-hour funding differential, not an executable arbitrage quote. It does not yet net out actual fee schedules, settlement timestamp mismatch, order-book slippage, borrowing, basis movement, funding caps/floors, contract multipliers or liquidation/margin risk. Do not describe these figures as guaranteed returns or use them as automated trade instructions.

Before commercial launch: add WebSocket ingestion, more exchanges, robust symbol/contract mapping, exchange-specific funding interval and settlement validation, persistent Postgres storage, authentication, rate limiting, monitoring, tests, alert queues, security review, legal review and clear risk disclosures. Do not collect users' exchange API keys in this MVP.

## Free-tier note
The app itself has no paid API dependency. Hosting and database free tiers have limits and can change. Render free services can sleep, and its free Postgres is temporary; this MVP intentionally does not require a database. For a real production launch, budget for reliable always-on compute, durable storage, monitoring and backups.
