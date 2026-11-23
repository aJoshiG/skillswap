# SkillSwap roadmap and progress

Goal: a working, deployed MEAN-stack app (MongoDB, Express, Angular, Node) good enough to
put on a resume and GitHub. Tick items off here as they're finished.

**Next step:** optional extras: notifications center, then avatar upload. Prepare interview notes.

---

## ✅ Phase 0: Foundation (done, 2026-11-23)
- [x] Express 5 API: auth (JWT + rotating refresh tokens), profiles, explore search, swap requests
- [x] socket.io chat: typing indicators, read receipts, online status
- [x] Angular 20 client with Tailwind 4 and all core pages
- [x] Tests: server 17/17 (Jest + Supertest), client 7/7 (Karma)
- [x] Docker Compose, GitHub Actions CI, README
- [x] Fixed missing client dependencies and the server tests failing under Jest

## ✅ Phase 1: Run it and check every flow (done, 2026-11-23)
- [x] Seed the demo data into the local MongoDB (`cd server && npm run seed`)
- [x] Run the API (`npm run dev`, port 4000) and the client (`npm start`, port 4200)
- [x] Check every flow: 54 scripted API + socket checks through the dev proxy, plus a two-browser
      walkthrough in Edge (demo login, explore, request, accept, live chat, read receipts, online status,
      reload keeps you logged in, logout, mobile width)
- [x] Fixed what turned up:
  - Each accepted request opened a new thread, so the same two people got duplicate chats.
    Now there's one conversation per pair (unique `pairKey`), with a regression test.
  - Login, register and refresh shared one limit of 30 per 15 min, and refresh runs on every page
    load, so normal use could lock people out. Login/register now count only failed attempts, and
    refresh has its own limit.
  - Explore filter labels were cut off on desktop; rebalanced the layout and shortened labels.
  - Added `.gitattributes` (LF endings) so Prettier doesn't fail on Windows checkouts.
- Note: Docker isn't installed on this machine, so run natively; a MongoDB 8.0 Windows service is on :27017.
  Run client tests with `CHROME_BIN` pointing at Edge.

## ✅ Phase 2: Put it on GitHub and deploy it (done, 2026-11-23)
- [x] Create a GitHub repo, push, get CI green, add the CI badge to the README (github.com/aJoshiG/skillswap, 2026-11-23)
- [x] MongoDB Atlas free cluster (a replica set, so transactions work for Phase 3), AWS, created 2026-11-23.
      DB user password rotated, role reduced to readWriteAnyDatabase, network access 0.0.0.0/0 for Render.
- [x] Code ready for one-service deploy: Express serves the built Angular app (SPA fallback, caching,
      CSP), production client uses same-origin `/api`, root `package.json` build/start, `render.yaml`
      blueprint, `npm run seed:atlas`. Tested locally in production mode: 54 API checks + UI walkthrough.
- [x] Render service from `render.yaml`, live at https://skillswap-7dfr.onrender.com (2026-11-23)
- [x] Seed the demo data into Atlas (`npm run seed:atlas`, 2026-11-23)
- [x] Put the live link in the README
- [x] Verified live: 55 API/socket checks + two-browser UI walkthrough. Found and fixed a bug that only
      showed up on real network latency (reloading during a token refresh logged users out everywhere):
      30s grace period for reusing a just-rotated refresh token, with tests.

## Phase 3: Standout features (pick at least the first two)
- [x] **Smart matching** (2026-11-23). A Matches page (the post-login landing page) ranked by one aggregation
      pipeline: case-insensitive candidate filter on collation-aware indexes (explain(): examines only
      real matches), overlap in both directions, score (two-way swap, overlap, teacher level, same city
      in person / both online), $facet pagination, $lookup of open swaps. 5 tests. Also fixed: older
      accepted requests between the same pair lost their "Open chat" link (conversation lookup by pair).
- [x] **Sessions and time credits** (2026-11-23). Propose / accept / decline / cancel / confirm, with escrow:
      credits held on accept, refunded on cancel before the start, paid to the teacher when both confirm.
      Every credit move runs in a MongoDB transaction with a conditional update and an append-only ledger
      (the ledger always adds up to the balance). 10 tests, including simultaneous accepts and confirms
      (a probe showed MongoDB retrying on real write conflicts). UI: Sessions page, schedule dialog in chat
      and on Requests, navbar balance and action badge, live socket updates. `npm run db` gives local dev a
      replica set on :27018 without touching the Windows MongoDB service.
      Follow-ups: auto-resolve sessions nobody confirms (e.g. refund after 7 days), reviews after completion.
- [x] **Reviews and reputation** (2026-11-23). Rate each other after a completed session (once each,
      unique index + transaction with `$inc` stats). Profiles: rating, sessions/hours taught (from completed
      sessions), reviews list. Ratings on Explore/Matches; matching adds a Bayesian-average bonus. Accessible
      star picker (radio buttons; fixed a stale-hover label bug found in a keyboard test). 6 server tests
      + Stars unit tests. Also fixed: a router on /users with router.use(requireAuth) briefly locked the
      public /users/meta, so a regression test now covers it.
- [ ] **Avatar upload** to Cloudinary instead of pasting an image URL.
- [ ] **Notifications.** A bell icon with live notifications over the existing socket.

## ✅ Extras
- [x] **Auto-resolve forgotten sessions** (2026-11-24). Session sweeper (startup + every 15 min): one
      confirmation → auto-complete and pay 72h after the end; none → expire and refund after 7 days; past
      proposals → expired. Conditional + transactional, so concurrent or repeated runs never double-pay
      (tested). The UI shows each deadline. 6 server tests + client unit tests.
- [ ] Notifications center (persisted, unread badge, live)
- [ ] Avatar upload (Cloudinary)

## ✅ Phase 4: Polish (done, 2026-11-23)
- [x] Screenshots and a tour GIF in the README, generated by `npm run screenshots` in e2e/ (Playwright, so
      they're easy to refresh after UI changes)
- [x] Playwright end-to-end suite in `e2e/`, run in CI: in-memory MongoDB replica set + seed + the real
      server in production mode serving the built app. 15 tests: demo login/reload/logout, wrong password,
      sign-up → matches, matches/explore/deep links, two-person request → accept → live chat (typing,
      read receipts), decline, credits lifecycle (hold → confirm → pay → refund), schedule from chat,
      keyboard-only review → profile. Stable over repeated runs.
- [x] Accessibility: axe-core WCAG 2.1 AA checks on every page and dialog (zero violations). Fixed: low-
      contrast grey/green text, unlabelled ARIA on skill-level dots, dialogs now make the page behind them
      inert, move focus in and return it on close (found an orphaned-dialog bug while doing this).
- [x] Mobile layout checked (no horizontal overflow; balance in the mobile menu)

---

## Resume bullets
**SkillSwap**: full-stack skill-exchange platform · Angular 20, Node.js/Express 5, MongoDB Atlas, socket.io ·
[live demo](https://skillswap-7dfr.onrender.com) · [code](https://github.com/aJoshiG/skillswap)
- Built and deployed a MEAN-stack app (single Render service, MongoDB Atlas) with real-time chat (typing
  indicators, read receipts, presence) over JWT-authenticated WebSockets.
- Ranked two-way skill matches with a single MongoDB aggregation pipeline (case-insensitive indexed filter,
  scoring, `$facet` pagination, `$lookup`), with a Bayesian-average rating signal; checked with `explain()`.
- Designed a time-credit economy (escrow on booking, refunds, payment on mutual confirmation) using MongoDB
  transactions, conditional updates and an append-only ledger; tests prove no double-spend or double payment
  under concurrent requests.
- Secured auth with in-memory JWTs and rotating httpOnly refresh tokens with theft detection; found and fixed a
  latency-only session bug by testing the live deployment.
- 41 API tests (Jest/Supertest), 9 Angular unit tests and 15 Playwright end-to-end tests with axe-core WCAG 2.1
  AA checks, all in GitHub Actions CI.
