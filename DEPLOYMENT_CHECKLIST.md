# FundingEdge launch checklist

## Before you share the public URL
- [ ] Deploy to a hosting provider and test `/api/health`.
- [ ] Confirm both Binance and Bybit show `live` in `/api/market`.
- [ ] Compare several displayed funding rates with the exchange websites.
- [ ] Verify funding interval overrides for contracts with non-standard intervals.
- [ ] Check the scanner's two legs, funding direction and projected spread calculations.
- [ ] Add a privacy policy, terms, risk disclosure and contact details.
- [ ] Review exchange API terms and local legal/regulatory requirements.
- [ ] Add uptime monitoring and error logging.
- [ ] Do not add user trading keys or enable order execution without a security and legal review.

## Current scope
This release is an analytics MVP. It has no login, persistent user accounts, billing, email/Telegram delivery, trading execution or durable historical data warehouse. Watchlists live in local browser storage. The historical API routes are available, but a historical chart UI is not included yet.
