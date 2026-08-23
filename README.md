---
title: Charisma Gym
emoji: 🎙️
colorFrom: indigo
colorTo: purple
sdk: docker
app_port: 7860
pinned: false
short_description: A voice call with a charismatic friend
---

# Charisma Gym

A voice call with a charismatic friend. You talk about anything; a silent analyst
in the background scores how you're talking and hands you back a recap afterwards.
The user experiences a *friend*, never a coach — that framing is enforced hard in
the prompts and is the core design constraint of the whole app.

Lives at `~/CharismaGym`.

---

## What it actually is

Three original personas, built from a style study of Russell Brand's and Craig
Ferguson's conversational techniques. They are deliberately *not* impressions —
the prompts explicitly forbid claiming to be either real person.

| Key | Name | Character | Default voice |
|---|---|---|---|
| `blend` | **Sterling** | Fusion of both schools — word-drunk mystic meets cheeky Scot | Algieba |
| `brand` | **Vale** | Baroque vocabulary, mystic swerves, dangerous affection | Fenrir |
| `ferguson` | **Rascal** | Self-deprecating charm, awkward pauses, flirty mischief | Puck |

**15 named techniques** (8 Brand school, 7 Ferguson school) form the shared
vocabulary of the entire app — the live personas embody them, the analyzer cites
them by exact name, the recap teaches them. Examples: *The Verbal Swoop*,
*The Awkward Pause*, *The Callback Trophy*, *The Second Question*.

**6 scoring dimensions**: energy, wit, curiosity, story, confidence, presence.

**6 moods**: catching up, party, interview, first date, pitch, banter.

---

## The ecosystem

The call is one module of ten. What makes this a system rather than a reference
book is a closed loop:

```
call + field log  →  data  →  diagnosis  →  prescription  →  next rep
                       ↑                                        │
                       └────────────── measured ────────────────┘
```

| Module | Role |
|---|---|
| **Call a friend** | Live voice practice. The analyzer scores six dimensions per turn. |
| **Warm up** | Articulators, consonant drills, 12 graded twisters, passages, load drills, guided timed session. |
| **Words** | Upgrade pairs and a word list. Spaced repetition counting only *distinct* days. |
| **Identity** | Behaviour → evidence → identity. Ladders and an evidence file. |
| **Warmth & standards** | Warmth and standards as two independent axes, not one dial. |
| **Read the room** | Cues with confidence tiers, plus six named myths. |
| **Playbook** | The eight mechanisms everything else derives from. |
| **Field log** | **The only channel from real life back in.** Predict → act → rate. |
| **Lab** | Experiments on yourself. Confirmed results graduate into a personal playbook. |
| **Signals** | Instruments: reps trend, dimension averages, calibration, weekly review. |

### Why each piece exists

- **Field log** — everything else is simulation. Without a reality input the
  system is a closed loop that cannot detect its own drift. It also captures a
  *prediction* before each interaction, which makes calibration measurable.
- **Calibration** — expecting things to go worse than they do suppresses
  attempts, and attempts are the only input fully under your control. The bias
  is often more limiting than technique, so the engine fixes it first.
- **Prescription engine** (`Coach.nextRep`) — ordered rules, first match wins,
  returning exactly one action. A list of suggestions is a decision handed back
  to the user.
- **Lab** — practice becomes knowledge only when it is falsifiable. Three reps
  is the floor; below that you are reading noise, which is how people conclude
  a technique "doesn't work for me".
- **Personal playbook** — over time it should replace the generic library.
  Evidence about you beats advice about people in general. This is the sense in
  which the app evolves.

### Data model

One **append-only event log**; every view is computed from it. Streaks, weekly
reps, calibration and prescriptions are reducers over history, not stored
counters. A new question about progress becomes a new reducer over data you
already have, rather than a schema change and six months of waiting.

Persisted to **localStorage**, not the server — the free-tier container wipes
its disk on rebuild, so a server-side history would silently reset. Export and
import are in the hub since this makes it per-device. v1 saves migrate
automatically.

### Charts

Inline SVG, no libraries. Colours validated against surface `#14162b`:
single-hue accent for magnitude, amber only as a non-adjacent highlight,
diverging danger↔accent with a neutral midpoint. Green is never placed adjacent
to amber — they are indistinguishable under protanopia (ΔE 3.0). The weakest
dimension carries a text label, never colour alone.

### Editorial rule

Every claim in the content files carries a tier — `solid` / `mixed` / `weak` /
`myth` — and popular-but-false claims are **named rather than omitted**: NLP eye
cues, Mehrabian 7-38-55, nonverbal lie detection, power posing, crossed-arms
mapping, deliberate mirroring. A charisma app that repeats folk psychology makes
you worse at reading people, because it hands you confident wrong answers.

### Assets are versioned

`index.html` carries `?v=N` on every local script and stylesheet. Bump it when
you change front-end files, or returning users get a half-old app from cache
after a deploy.

---

## Architecture

```
Browser (mic) ──16kHz PCM──> FastAPI /ws ──> Gemini Live API ──> voice
                                  │
                                  ├──> Analyzer (fast text model) ──> live scores
                                  ├──> Memory (memory.json)       ──> persists you
                                  └──> Debrief (POST /api/debrief) ──> markdown recap
```

Two Gemini models run at once: a **realtime voice model** (the friend's ears and
mouth) and a **fast text model** (the silent analyst). The analyzer runs
fire-and-forget so it never blocks the voice stream.

### Backend — `charisma-coach/backend/`

| File | Role |
|---|---|
| `main.py` | FastAPI app: `/ws`, `/api/config`, `/api/debrief`, `/api/memory`, static frontend |
| `bridge.py` | The core. One browser WebSocket ↔ one Gemini Live session. Also `MockBridge` |
| `personas.py` | Persona identities, technique library, rubric, moods, prompt assembly |
| `analyzer.py` | Scores each user turn against the rubric, picks one technique tip |
| `debrief.py` | End-of-call markdown recap in the friend's voice |
| `memory.py` | `memory.json` — name, durable facts, running jokes. Injected into every call |
| `config.py` | All settings, read from `.env` |
| `doctor.py` | **Diagnostic — run this first when anything breaks** |

### Frontend — `docs/` (served by Pages *and* copied into the container)

Vanilla JS, no build step, no bundler.

| File | Role |
|---|---|
| `gym.js` | Hub, hash router, and the six reference/drill modules |
| `evolve.js` | Prescription engine, field log, lab, signals, chart primitives |
| `store.js` | Event log + localStorage persistence, with legacy migration |
| `content-voice.js` | Articulation drills, twisters, passages, vocabulary |
| `content-read.js` | Mechanisms, body-language cues, myths, warmth model, identity |
| `app.js` | Live call orchestration: setup → call → debrief |
| `audio.js` | Mic capture (16 kHz PCM) and playback (24 kHz) |
| `character.js` | Animated persona avatar |
| `hud.js` | In-call score panel and markdown rendering |

---

## Running it

**Local only:** `Start Charisma Gym.command` handles everything.
**Check if it's alive:** `Check Charisma Gym.command`
**Stop:** `Stop Charisma Gym.command`

Door code: set as `APP_PASSCODE` in `backend/.env` (and as a secret on the host).
It is deliberately not written down in this repo.

Manual start, if you prefer:
```bash
cd ~/CharismaGym/charisma-coach/backend && ../.venv/bin/python -m uvicorn main:app --port 8787
```

---

## Where it runs — two places, on purpose

| Piece | Host | Why |
|---|---|---|
| **UI + all your data** | GitHub Pages — https://lorit0t.github.io/charisma-gym/ | Every sibling app serves from `lorit0t.github.io`, and a path does not scope web storage. Sitting on that origin is what lets the **Dīwān** hub read `charismagym.v1` in place, with no API and no pasted export. |
| **Voice backend only** | Render — good-company.onrender.com | The live call needs a server for the Gemini bridge and the API key. Nine of the ten modules do not. Its `/` **307-redirects** to the Pages URL. |

**There is exactly one link: https://lorit0t.github.io/charisma-gym/**

`app.js` does not hard-code the backend host. `BACKENDS` is an ordered list and
the first origin that answers *with a key* wins — a backend with no key cannot
place a call, which makes it the wrong answer even when it responds. The
canonical name is always tried first and is never displaced by a cached winner,
so the app returns to it by itself once the hosting is correct.

That is not cosmetic. The training history lives in the browser, so a user who
logs on one host today and the other tomorrow ends up with two localStorage
silos and a split record — with no error to warn them. `CANONICAL_UI` on the
Render service makes it redirect instead of serving a second copy. Unset (local
dev) it serves the UI normally.

### Why the data is not synced to the repo

Publishing the store to GitHub was considered and rejected. A browser cannot
hold a write token — the repo is public, so the token would be handed to
everyone who loads the page. Routing writes through this backend would work
technically, but the field log holds personal reflections ("what happened, and
what you avoided"), identity evidence and call scores; putting those in a public
repo makes them world-readable and permanent in git history. A private repo does
not help either, since Dīwān is a public static client and would need an embedded
read token — the same leak inverted.

Sitting on the shared origin gets the hub live data with none of that.

`docs/` is the single copy of the frontend: Pages serves it directly and the
Dockerfile copies the same directory into the container. One source, two
consumers, no drift.

`app.js` addresses the backend absolutely when `location.hostname` ends in
`github.io`, and same-origin otherwise (Render, localhost). The backend allows
CORS from the Pages origin; `/ws` needs none (WebSockets do not use CORS) and
stays gated by `APP_PASSCODE`.

**The repo is public because GitHub Pages requires it on a free account.** No
secrets are in it or in its history — the key lives in Render's environment and
the door code was purged from history on 2026-08-15.

---

## Hosting — the permanent link

**The app deploys as a Docker container on Render**, which gives a fixed URL that
does not expire, does not depend on this Mac being awake, and never needs
re-issuing:

```
https://good-company.onrender.com
```

That hostname is not a leftover to be tidied — it is **the address**, decided on
2026-08-23. See below for why chasing a prettier one is the wrong trade.

Source of truth is GitHub: **https://github.com/LoriT0T/charisma-gym** (private).
Render watches `main` and rebuilds on every push.

**First deploy:** go to https://dashboard.render.com/blueprints → *New Blueprint
Instance* → pick this repo. Render reads `render.yaml` and configures the service
itself; it prompts once for `GEMINI_API_KEY` and `APP_PASSCODE`.

The `Dockerfile` builds the real backend — Gemini Live bridge, analyzer, debrief,
memory — with nothing downgraded for hosting.

Secrets are **never committed**. `render.yaml` marks them `sync: false`, so Render
prompts for the values and stores them encrypted. `.gitignore` blocks `.env`.

### The backend address is `good-company.onrender.com` — settled 2026-08-23

| Host | State |
|---|---|
| `good-company.onrender.com` | **The service.** Key ✅ door code ✅. Display name is *charisma-gym*; the URL is this. |
| `charisma-gym.onrender.com` | **Suspended duplicate.** Returns `503 Service Suspended`. Holding a subdomain and nothing else. |

**A suspended service still holds its subdomain.** That is why renaming the live
service in the dashboard did not move its URL — the name it wanted was taken, so
Render changed the display name and left the hostname alone. Suspending is not
releasing.

The prettier URL could be recovered: delete the suspended service (not suspend —
delete), then re-trigger the rename. **We are not doing that**, and the reason is
worth writing down rather than rediscovering. A hostname is the one thing in this
setup that must not move. It is compiled into `app.js`, it is what anything
already bookmarked points at, and every change to it is a chance to end up with
two half-working addresses again — which is exactly the mess this section exists
to document. Trading a working, permanent address for a nicer-sounding one is a
bad trade at any price, and the name is invisible to the user anyway: the only
link anyone ever opens is the Pages URL.

So `good-company` is not a leftover. It is the address, it is first in `BACKENDS`,
and the app shows no warning for it. `charisma-gym.onrender.com` stays second in
the list purely so the app keeps working if that subdomain is ever freed and used.

**If a key ever goes on a service, `APP_PASSCODE` goes on it too.**
`_code_ok()` returns True for everyone when the passcode is empty, so a key
without a door code on a permanent public URL is an open Gemini account. The
live service has both. The app says so on the setup screen if it ever finds the
dangerous half of that pair on its own.

### Renaming the service — read before you touch `render.yaml`

**Do not rename the service by editing `name:` in `render.yaml`.** Render keys
blueprint services by name, so changing it does not rename anything — it
creates a SECOND service and leaves the original running. That happened on
2026-08-22 and produced two live services on the same repo.

Worse, secrets marked `sync: false` are **not** carried to the new service, so
the duplicate comes up with no `GEMINI_API_KEY` and — the dangerous half — no
`APP_PASSCODE`, which means the passcode gate is disabled entirely
(`_code_ok()` returns True for everyone when the value is empty).

To rename: **Render dashboard → service → Settings → Name**. That moves the
URL and keeps the environment. Then update `name:` in `render.yaml` to match,
so a later blueprint sync does not create a duplicate all over again.

### Redeploying after a change

```bash
cd ~/CharismaGym && git add -A && git commit -m "your change" && git push
```

Render rebuilds automatically. The URL stays the same.

### Env vars the container sets

| Var | Value | Why |
|---|---|---|
| `PORT` | injected by host (7860 default) | Render assigns its own; the CMD expands `$PORT` at runtime |
| `HOST` | 0.0.0.0 | Must bind all interfaces inside a container |
| `MEMORY_PATH` | `/home/user/data/memory.json` | Keeps memory off the code tree |

### Free-tier caveats

- **Spin-down after 15 min idle**, ~1 min cold start on the next request. Render
  now counts *WebSocket messages* as traffic, so a call in progress will not be
  cut off — the wait is only before the call connects. A free uptime pinger
  hitting `/api/config` every 10 minutes keeps it warm within the 750 free
  instance-hours/month.
- **512 MB RAM / 0.1 CPU.** Fine here — the backend relays audio and Gemini does
  the work.
- **Ephemeral storage**, so the friend's memory resets on rebuild. A persistent
  disk is a paid upgrade.

### Why not Hugging Face Spaces

Attempted first, and rejected on 2026-08-15: HF now returns **402 Payment
Required** for Docker Spaces — *"Static Spaces are free for everyone, but hosting
Gradio and Docker Spaces on free cpu-basic requires a PRO subscription"* ($9/mo).
Only static Spaces remain free, which cannot run this backend. `Deploy to Hugging
Face.command` and the README's HF frontmatter are kept for the day a PRO
subscription exists — the Dockerfile works on both.

**The door code matters more now.** The URL is public and permanent, so
`APP_PASSCODE` is the only thing between the internet and your Gemini quota.

---

## The old Cloudflare tunnel (superseded)

The local scripts still work for running on this Mac, and still mint a quick
tunnel for phone testing. But that link is **disposable by design** — a random
hostname every start, which Cloudflare will never hand back. Use the Render URL
as the real link.

### The failure that killed the old link

On 2026-07-22 a quick tunnel was started. Its hostname was later revoked, but
`cloudflared` kept running and retried forever — **20 days and ~15 MB of retry
errors**, serving nobody. Nothing announced the failure, because the old start
script declared "LIVE" the moment a URL appeared in the log, which proves
nothing.

Both scripts now **verify the public URL actually returns HTTP 200** before
claiming success, and rotate logs over 5 MB. `Check Charisma Gym.command`
detects this exact zombie state.

### Want a permanent domain?

You'd need a **named tunnel**, which requires a domain on a Cloudflare account:

```bash
cloudflared tunnel login
cloudflared tunnel create charisma-gym
cloudflared tunnel route dns charisma-gym charismagym.yourdomain.com
cloudflared tunnel run --url http://127.0.0.1:8787 charisma-gym
```

That gives a fixed hostname that survives restarts. It still requires this Mac
to be awake and running the server — for a link that works when the laptop is
shut, the app needs real hosting instead.

---

## When something breaks

**Always start here:**
```bash
cd ~/CharismaGym/charisma-coach/backend && ../.venv/bin/python doctor.py
```
It verifies the API key, lists which Live models the key can actually see, and
tests both the voice and analyzer models end to end.

| Symptom | Cause | Fix |
|---|---|---|
| Tunnel link returns 530, or dies after a few days | **This network blocks QUIC (UDP).** cloudflared's control stream fails with "no recent network activity" and the link stops serving | Use `--protocol http2` — already baked into the start script. Diagnosed 2026-08-15 |
| Phone link dead, server fine | Quick tunnel revoked (the zombie) | Re-run the start script — new link |
| "No Live model available" | Model retired or key lacks access | Run `doctor.py`, put a working model in `.env` as `LIVE_MODEL` |
| Call connects, no voice | Mic permission, or non-HTTPS origin | Browsers require HTTPS for mic — use the tunnel link, not the LAN IP |
| Want to test UI without burning API calls | — | Set `MOCK_MODE=1` in `.env` — full scripted session, zero API calls |
| Friend forgot everything | `memory.json` deleted or never written | It's written after the first debrief, not during the call |

### Model configuration

Models are pinned in `.env` but every one has a **fallback chain** in
`config.py` — if the preferred Live model is unavailable, `bridge.py` walks down
the list automatically. This is why the app survives Google retiring preview
models. Verified working as of 2026-08-11:

- `LIVE_MODEL=gemini-3.1-flash-live-preview`
- `TEXT_MODEL=gemini-flash-latest`

---

## Gotchas worth knowing

- **Calls cap at ~15 minutes** — a Gemini Live API session limit, not a bug. The
  bridge sends `session_expired` and the frontend handles it.
- **`.env` contains a live API key** — this folder is not a git repo and the key
  is not committed anywhere. Keep it that way.
- **`.env.example` says `PORT=8000`; the real `.env` uses `8787`.** The scripts
  all assume 8787.
- **Memory is a single local JSON file** for one user. There are no accounts.
  Anyone with the link and the door code talks to *your* friend and shares
  that memory.
- **The passcode is the only access control.** It's compared with
  `hmac.compare_digest`, but the link is public while the tunnel is up.
