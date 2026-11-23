# SkillSwap roadmap and progress

Goal: a working, deployed MEAN-stack app (MongoDB, Express, Angular, Node) good enough to
put on a resume and GitHub. Tick items off here as they're finished.

**Next step:** Phase 4 polish: README screenshots/GIF, Playwright e2e suite in CI (from the scratch walkthrough scripts), accessibility pass. Optional: notifications center, auto-resolving unconfirmed sessions.

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

## Phase 4: Polish
- [ ] Screenshots and a short GIF in the README (explore, profile, chat)
- [ ] Playwright end-to-end test of the main flow (register → request → accept → chat), run in CI
- [ ] Mobile layout, loading/empty/error states, accessibility pass (labels, focus, contrast)
- [ ] Write resume bullets (draft below), adding real numbers once they exist

---

## Draft resume bullets
- Built **SkillSwap**, a full-stack MEAN skill-exchange platform (Angular 20, Node/Express 5, MongoDB,
  socket.io) with real-time chat, typing indicators, read receipts and online presence.
- Built secure auth: short-lived JWTs kept in memory plus rotating httpOnly refresh tokens
  with reuse detection, and silent refresh in an Angular HTTP interceptor.
- Prevented double-acceptance race conditions with conditional atomic updates and a partial unique index;
  covered the API with Jest/Supertest tests against an in-memory MongoDB replica set, run in GitHub Actions CI.
- _(after Phase 3)_ Ranked two-way skill matches with a MongoDB aggregation pipeline, and moved time credits
  between users inside MongoDB transactions.
