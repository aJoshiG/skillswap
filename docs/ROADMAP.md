# SkillSwap roadmap and progress

Goal: a working, deployed MEAN-stack app (MongoDB, Express, Angular, Node) good enough to
put on a resume and GitHub. Tick items off here as they're finished.

**Next step:** Phase 1, the first unchecked item.

---

## ✅ Phase 0: Foundation (done, 2026-11-23)
- [x] Express 5 API: auth (JWT + rotating refresh tokens), profiles, explore search, swap requests
- [x] socket.io chat: typing indicators, read receipts, online status
- [x] Angular 20 client with Tailwind 4 and all core pages
- [x] Tests: server 17/17 (Jest + Supertest), client 7/7 (Karma)
- [x] Docker Compose, GitHub Actions CI, README
- [x] Fixed missing client dependencies and the server tests failing under Jest

## Phase 1: Run it and check every flow (not done yet: the app has never been run end to end)
- [ ] Seed the demo data into the local MongoDB (`cd server && npm run seed`, or `node scripts/seed.js`)
- [ ] Run the API (`npm run dev`, port 4000) and the client (`npm start`, port 4200)
- [ ] Check each flow by hand: register, log in, "Try the demo account", edit profile, explore and filters,
      send / accept / decline / cancel a request, chat in two browsers (typing, read receipts, online status)
- [ ] Fix whatever turns up, add a test for each fix
- [ ] Note: Docker isn't installed on this machine, so run natively; a MongoDB 8.0 Windows service is on :27017

## Phase 2: Put it on GitHub and deploy it (the most important part for a resume)
- [ ] Create a GitHub repo, push, get CI green, add the CI badge to the README
- [ ] MongoDB Atlas free cluster (a replica set, so transactions work for Phase 3)
- [ ] Deploy as **one service**: Express also serves the built Angular app, so the client and API share
      an origin. Then cookies, CORS and WebSockets need no cross-site setup.
      Host: Render (free web service) or Railway.
- [ ] Seed the demo data in production, put the live link in the README

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
