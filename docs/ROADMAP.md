# SkillSwap roadmap and progress

Goal: a working, deployed MEAN-stack app (MongoDB, Express, Angular, Node) good enough to
put on a resume and GitHub. Tick items off here as they're finished.

**Next step:** Phase 3, smart matching (rank two-way swaps with an aggregation pipeline).

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
- [ ] **Smart matching.** A "Best matches" page ranking two-way swaps (A teaches what B wants and B teaches
      what A wants) with a MongoDB aggregation pipeline and a match score.
- [ ] **Sessions and time credits.** Schedule a session from an accepted swap, both people confirm it
      happened, and credits move (teach 1 hour = earn 1 credit) inside a **MongoDB transaction**.
- [ ] **Reviews and reputation.** Rate someone after a completed session, show the average on their profile.
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
