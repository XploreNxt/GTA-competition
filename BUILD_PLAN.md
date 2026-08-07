# Mini GTA VI-Style Game — 24-Hour Build Plan

**Tech:** Three.js (browser 3D) + plain JS | **Time:** 24 hours | **Goal:** a fully playable mini open-world crime game

---

## Strategy (read this first)

- **MVP first, polish later.** A broken-feeling game that runs beats a beautiful game that doesn't.
- **One HTML entry point.** Everything loads from `index.html` — no build tools, no bundlers needed.
- **Free models only (AI + assets).** All code written with OpenCode free models. Assets from free/CC0 sources only (e.g. Kenney.nl). NO GTA/Rockstar assets, ever.
- **Start from a NEW, empty project folder.** No prior code may be reused.
- **Host the game.** Push to GitHub, enable GitHub Pages so the judge can play it in-browser.
- **Save proof.** Keep every OpenCode chat/session link. Put all links in `PROOF.md` and commit it.

---

## Phase 0 — Setup & Scaffold (30 min)

- [ ] Create empty project folder + `git init`
- [ ] Create `index.html` with a basic Three.js scene (link Three.js from CDN)
- [ ] Add ground plane, simple cube "car", WASD keyboard controls, orbit debug camera
- [ ] Add a HUD canvas overlay (2D) for health / money / wanted stars / mission text
- [ ] Verify it runs locally in the browser
- [ ] Create `PROOF.md` (session/chat links) and this build plan

**Done when:** A cube drives around a flat grid with WASD.

---

## Phase 1 — City Grid & Driving (3–4 hours)

- [ ] Procedural city: flat ground, green = grass, gray = road grid, crosswalks at intersections
- [ ] Simple AI-driven traffic cars following roads on the grid
- [ ] Third-person (chase) car camera + steering camera that follows the car
- [ ] Car physics: accelerate, brake, reverse, steer (not realistic — arcade feels fine)
- [ ] Collision: cars stop at intersections/red lights or slow for players
- [ ] Player can exit a car / enter any parked car (E key)
- [ ] Buildings as simple boxes with storefront facade colors (Miami pastel vibes)

**Goal:** Free-roam the city by foot AND car. This is your biggest phase — if it slips, everything else slips.

---

## Phase 2 — Peds & Traffic (3–4 hours)

- [ ] Peds: capsule/box humans walking along sidewalks, random turns
- [ ] Traffic: 10–30 cars driving straight-ish across roads, respawning at edges
- [ ] Simple collision for peds (knock-back anim) and cars
- [ ] Peds flee from cars/chaos (small radius "run away" trigger)
- [ ] Keep asset count tiny: 1 car model, 2 ped bodies, colored to vary clones

**Goal:** the city feels alive — peds walk, cars drive, chaos is fun.

---

## Phase 3 — Wanted System & Police (3–4 hours)

- [ ] Wanted meter: 0–5 stars
- [ ] Star-generating events: hitting a ped, wrecking cars, destroying public props
- [ ] Police cars spawn at a station and chase when stars > 0
- [ ] Police AI: drive toward player, bump, block; player outruns to lose them
- [ ] Star decay (cool-down) and "hide to lose wanted" mechanic
- [ ] Capture = fade-out + respawn at hospital, fine deducted

**Goal:** crime matters. Getting chased is exciting, outrunning cops works.

---

## Phase 4 — Missions / Heists (3–4 hours)

- [ ] Mission marker system: glowing rings / arrows at quest givers
- [ ] 3 missions minimum, e.g.:
  - Taxi/Fare run (drive NPC from A→B in time)
  - Getaway (taser a target ped, escape police)
  - Simple cash pickup / drop chain (GPS waypoint logic)
- [ ] Mission UI: objective text + waypoint arrow on screen
- [ ] Post mission rewards > money, unlocks a final "big heist" mission
- [ ] Reward money + unlock missions button in HUD

**Goal:** a real mission flow with a conclusion (final heist = "win").

---

## Phase 5 — UI, Sound & Polish (2–3 hours)

- [ ] Start screen (title, controls) + pause (Esc) + death/respawn overlay
- [ ] HUD polish: money counter, Wanted stars, current mission objective
- [ ] Minimap (simple 2D top-down canvas radar)
- [ ] Subtle audio: engine hum, horn beep, mission chime, footstep (CC-free or generated)
- [ ] Keyboard/mouse controls printed on start screen
- [ ] "How to play" text on start screen

---

## Phase 6 — Ship It (1–2 hours)

- [ ] Squash blocking bugs (can't get in car, getting stuck, camera jitter)
- [ ] Test on desktop Chrome/Firefox — tell the judge exactly what to expect
- [ ] Enable GitHub Pages (Settings → Pages → main branch / root)
- [ ] README: what the game is, controls, how to play, how to run locally
- [ ] Commit PROOF.md with all OpenCode session links + game URL

---

## Timeline Summary (24 hours)

| Slot | Phase | Est. |
|------|-------|------|
| 0–1h | 0 Setup | 0.5h |
| 1–5h | 1 City Grid & Driving | 4h |
| 5–8h | 2 Peds & Traffic | 3h |
| 8–12h | 3 Wanted & Police | 4h |
| 12–15h | 4 Missions/Heists | 3h |
| 15–18h | 5 Polish | 3h |
| 18–24h | buffer + Phase 6 | 6h |

**Remember:** the buffer is for the bugs that break the game. If you only complete Phases 1–3 fully plus a mission, you already have a playable, watchable game.

---

## Rulebook Checklist (do this at the end)

- [ ] Started from a brand NEW project (no reused code)
- [ ] Only free/CC assets, zero GTA/Rockstar rips
- [ ] No paid models used at any step
- [ ] Game is genuinely playable
- [ ] GitHub repo = contains final code + PROOF.md with all session links
- [ ] All OpenCode chat/session links collected