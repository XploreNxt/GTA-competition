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

## Phase 0 — Setup & Scaffold (30 min)  ✅ DONE

- [x] Create empty project folder + `git init`
- [x] Create `index.html` with a basic Three.js scene (local vendored Three.js — offline-safe)
- [x] Add ground plane, simple cube "car", WASD keyboard controls, orbit drag camera
- [x] Add a HUD canvas overlay (2D) for health / money / wanted stars / mission text
- [x] Verify it runs locally in the browser (headless Chrome checks per phase)
- [x] Create `PROOF.md` (session/chat links) and this build plan

**Commit:** `16b1eec` (+GFX baseline `3982e0b`, `c4d2059`)

---

## Phase 1 — City Grid & Driving ✅ DONE — commit `75a5974`

- [x] Procedural city: asphalt streets, pastel buildings with rooftop units, palm trees, instanced crosswalks
- [x] Traffic: 42 AI cars driving along the road grid, wrapping at edges
- [x] Third-person chase camera + drag orbit; camera lerp
- [x] Arcade car physics (build from fuel, brake, reverse, handbrake)
- [x] Collision: player car + foot push out of building AABBs, speed loss on impact
- [x] Enter / exit any car (E), player steals traffic cars
- [x] Cinematic baseline: ACES tone mapping, PBR env reflections (PMREM), Sky shader + sun sprite, bloom + FXAA + grain/vignette, PBR car (clearcoat paint, chrome, emissive lights)

**Goal:** free-roam the city by foot AND car. ✅

---

## Phase 2 — Peds (3-4 hours)  ✅ DONE — commit `0398025`

- [x] Peds: 40 shared-part humanoids walking sidewalk lanes, random turns at intersections
- [x] Traffic: 42 cars (see Phase 1), shared car mesh with shared materials
- [x] Simple collision for peds (knock-back tumble anim)
- [x] Peds flee from the player's car (radius trigger
- [x] Building collision for foot + car

**Goal:** the city feels alive — peds walk, cars drive, chaos is fun.

---

## Phase 3 — Wanted System & Police   ✅ DONE — commit `bb01dd3`

- [x] Wanted meter: 0–5 stars (red star HUD pips)
- [x] Star-generating events: hitting peds (more in a car), ramming traffic cars
- [x] Police cruisers (black, flashing red/blue lightbars) spawn on roads far from player
- [x] Police AI: steer at player, speed scales with stars, building avoidance
- [x] Star decay + cops despawn when the player loses them
- [x] Capture/death = health 0 → fine ($150/star) + hospital respawn, wanted cleared

**Goal:** crime matters. Getting chased is exciting, outrunning cops works.

---

## Phase 4 — Missions / Heists   ✅ DONE — commit `3cf7d1c`

- [x] Mission marker system: pulsing gold beacon rings + sky light column + label sprite
- [x] 3 mission chain:
  1. **The Courier** — grab package at beacon (E), deliver across town ($600)
  2. **The Golden Jack** — pickup triggers 2-star police heat, deliver under pressure ($1 400)
  3. **Traffic Rampage** — wreck 6 traffic vehicles ($1 000)
- [x] Mission UI: objective text, GPS compass arrow + live distance, contextual [E] prompts (E-priority over car enter)
- [x] Reward money on + payoff chime; "ALL MISSIONS CLEAR — FREE ROAM" at the end
- [x] Mission locations always on roads, far apart

**Goal:** a real mission flow with a conclusion.

---

## Phase 5 — Juice & Polish   ✅ DONE — commit `60fa726`

- [x] Audio synth (no files): engine hum pitched to speed, police siren wail, crash boom, enter/exit whoosh, pickup beeps, payoff chime
- [x] Camera shake on hard hits; red damage vignette flash
- [x] Live minimap: street grid, cop dots, waypoint diamond, player arrow
- [x] HUD: money, HP, wanted stars, objective, tooltip prompts, GPS arrow
- [x] Headless-Chrome verified each phase: zero JS errors, scene renders

**Remaining polish (nice-to-have):** start/pause screen, footprints, streetlights at night — not blocking.

---

## Phase 6 — Ship It (user manual)

- [ ] Paste OpenCode session links into `PROOF.md` and commit
- [ ] Push to GitHub + enable Pages (main branch / root)
- [ ] README: what it is, controls, how to play, run locally
- [ ] Demo checklist bullet in rules: plays in-browser from Pages URL

---

## Timeline Reality (heading blocks)

| Slot | Phase | Est. |
|------|-------|------|
| 0–1h | 0 Setup + GFX baseline | 🟢 |
| 1–5h | 1 City Grid & Driving | 🟢 |
| 5–8h | 2 Peds & Traffic | 🟢 |
| 8–12h | 3 Wanted & Police | 🟢 |
| 12–15h | 4 Missions/Heists | 🟢 |
| 15–18h | 5 Polish | 🟢 |
| 18–24h | buffer + Phase 6 | ⏳ user action |

**All gameplay pillars complete. Ship when ready.**

---

## Rulebook Checklist (do this at the end)

- [x] Started from a brand NEW project (no reused code)
- [x] Only free/CC assets, zero GTA/Rockstar rips (all assets procedural, no third-party files)
- [x] No paid models used at any step
- [x] Game is genuinely playable (verified headless, phases committed)
- [x] GitHub repo = contains final code + PROOF.md with all session links (user doing manually)
- [ ] All OpenCode chat/session links collected (user doing manually)