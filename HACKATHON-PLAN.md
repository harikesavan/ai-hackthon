# HACKATHON PLAN — Serving a Nation

## The Hackathon

- **Event**: Hack-Nation × World Bank Youth Summit 2026
- **Challenge**: #03 — Serving a Nation (Databricks track)
- **Time left**: ~14 hours
- **Team**: 3 people
- **Stack**: Next.js + React + Tailwind + OpenAI

---

## The Problem (in plain English)

India has a spreadsheet with 10,000 healthcare facilities.

The spreadsheet has messy notes about each one — scraped from hospital websites, government reports, Google Maps. Some notes are clean. Most are a mess. Some are in Hindi. Some are empty. Some are lies.

Right now, if a health worker in a village needs to find a hospital that can handle an emergency C-section, she calls around. She finds one that says "yes, we do surgery." She sends the patient. They drive 2 hours. They arrive. The hospital doesn't actually have a surgeon. Or anesthesia. Or even an operating room. It just said it did.

**Nobody checks whether these facilities can actually do what they claim.**

That's what we build.

---

## What We Build

**One sentence**: A system that reads 10,000 messy hospital records, checks every claim against reality, and shows you which hospitals are trustworthy and which ones are probably lying.

**Three outputs**:

### Output 1: A Map of India with a Toggle

This is the hero. The thing that wins.

- **"Claimed Coverage" mode**: Shows every facility that SAYS it has emergency care. Map looks green. India looks well-covered.
- **"Verified Coverage" mode**: Shows only facilities where the claims actually check out. Huge red gaps appear. A counter flips: "487 districts → 312 districts."

That 5-second toggle moment is the entire pitch.

### Output 2: A Chat Box

Type a question like:
> "Which facilities in Bihar claim surgery but have no anesthesiologist?"

Get back a list of real facilities with:
- A trust rating (green / yellow / red)
- The specific reason it's flagged: "Claims surgery, no anesthesiologist listed (IPHS 2022, Ch.3)"
- The exact text from the original data that the claim was based on

### Output 3: A "Review" Button

When looking at a flagged facility, an NGO planner can click:
- "Confirm Ghost" / "Confirm Real" / "Needs Site Visit"

This writes to the database. It makes the tool a triage system, not an accusation system.

---

## How It Works (The Pipeline)

```
STEP 1: READ
────────────
Take each messy facility record.
Feed it to OpenAI: "Extract the structured data from this text."
Get back clean JSON: name, type, beds, doctors, services, equipment.

STEP 2: CHECK
─────────────
Feed the same record + the extraction back to OpenAI:
"Which claims in this extraction aren't actually 
 supported by a sentence in the original text?"
Get back: list of unsupported claims.

This catches the AI making stuff up.

STEP 3: VERIFY
──────────────
Run the extracted data through rules based on 
Indian Public Health Standards (IPHS 2022):

  - A PHC has 6-10 beds. If it claims 500 → flag it.
  - Surgery requires an anesthesiologist. No anesthesiologist → flag it.
  - 24/7 emergency needs minimum 3 staff for shifts. 1 doctor → flag it.
  - If 3 hospitals in one district all claim to be 
    "the only cardiac center" → at most 1 is right.

Every rule has a citation: "IPHS 2022, Chapter 3, page 14."

STEP 4: SCORE
─────────────
Each facility gets THREE separate trust signals:

  1. Extraction Confidence: Did the AI make up any claims?
  2. Rule Violations: Does it break any IPHS standards?
  3. Peer Comparison: Is it a statistical outlier vs similar facilities?

We don't mash these into one magic number.
For the map, we use the WORST of the three (a facility is 
only as trustworthy as its weakest signal).

STEP 5: SHOW
────────────
Put it all in a database. 
Serve it through a map and a chat box.
Let humans review and override the flags.
```

---

## What Makes This Different

Every other team will build: "Ask AI about hospitals → get answer."

We build: "Ask AI about hospitals → get answer → **here's why you should or shouldn't trust that answer, with a page citation from Indian government standards.**"

The trust verification is the product. Everything else exists to display it.

### What a judge hasn't seen before

| Other teams | Us |
|---|---|
| LLM extracts data, done | LLM extracts, then a SECOND call checks if it hallucinated |
| "Trust score: 0.7" (magic number) | Three separate signals, each with a specific reason and citation |
| Map with dots | Map with a TOGGLE that reveals the gap between claimed and real coverage |
| Chat that answers questions | Chat that answers AND tells you why to trust or distrust the answer |
| "This could help people" | "Here's a real facility from the dataset. It claims cardiac surgery. It has one doctor. Here's the row." |

---

## Who Does What

### Person A — AI / Data Pipeline

You are responsible for: **making the data real.**

```
Hour 0-1:  Open the Excel file. Extract 20-50 rows with OpenAI.
           Look at the output. Share findings with team.
           THIS DETERMINES EVERYTHING. Don't skip it.

Hour 1-4:  Run extraction + hallucination check on all 10,000 rows.
           Build the IPHS rule checker.
           Build the peer comparison checker.
           Compute trust signals for every facility.
           Export JSON file → give to Person C.

Hour 4-8:  Build the chat query agent:
           User question → OpenAI converts to SQL → query database
           → return results with trust signals and citations.
           Pre-compute 5 impressive demo queries as fallbacks.

Hour 8-12: Edge case testing. Fix broken queries.
           Find real examples from the data for the pitch:
           "This is [real facility name]. It claims [X]. 
            It has [Y]. Here's why that's suspicious."
```

**Your deliverable**: A JSON file with 10,000 facilities, each having extracted data + three trust signals + flags with citations. And a working query agent.

---

### Person B — Frontend

You are responsible for: **making it look incredible.**

```
Hour 0-1:  Set up Next.js + Tailwind + shadcn/ui project.
           Create layout: map (70% width) + chat sidebar (30%).

Hour 1-4:  BUILD THE MAP. This is your main job.
           - India centered, district boundaries from GeoJSON
           - THE TOGGLE (Claimed vs Verified) — build this FIRST
           - Counter that animates when toggle flips
           - Facility markers colored green/yellow/red
           - Click marker → popup with trust signals + flags
           Use react-leaflet (fastest) or deck.gl (prettier).

Hour 4-8:  BUILD THE CHAT.
           - Text input + message bubbles
           - Streaming responses
           - Suggested query buttons (5 pre-loaded)
           - Facility result cards with trust badges
           - Click facility → map flies to it

Hour 8-10: BUILD THE REVIEW PANEL.
           - Three buttons: Confirm Ghost / Confirm Real / Needs Visit
           - Writes to database (POST /api/review)
           - Real, not a mockup. 30-45 minutes of work.

Hour 10-12: Polish.
           - Dark mode
           - Loading skeletons
           - Animations (counter flip, map fly-to)
           - Responsive for projector (1920×1080)
           - Landing page with hero stats
```

**Your deliverable**: A beautiful, working web app with a map, a chat box, and a review panel. Deployed on Vercel.

---

### Person C — Integration / Infra / Pitch

You are responsible for: **making everything connect, and making us win the pitch.**

```
Hour 0-1:  Set up Neon PostgreSQL (free, 2 minutes).
           Set up Drizzle ORM in the Next.js project.
           Create the database schema.
           Set up Vercel deployment. First deploy (empty shell).

Hour 1-4:  Build API routes:
           - POST /api/chat (receives question → calls Person A's agent)
           - GET  /api/facilities (filtered facility list)
           - GET  /api/map-data (GeoJSON for the map)
           - POST /api/review (writes review status)
           Import Person A's data into PostgreSQL.

Hour 4-8:  Wire up all the APIs.
           Make sure map loads in <3 seconds.
           Handle errors gracefully.
           Continuous deploys to Vercel as features land.

Hour 8-10: Databricks (minimal, 30-45 min):
           - Sign up for Free Edition
           - Upload final data as Delta table
           - Run one extraction example in notebook with mlflow.trace
           - Screenshot the MLflow trace
           - This is for the pitch story, not for runtime.

Hour 10-12: Build pitch deck (5 slides):
           1. The toggle moment (GIF or screenshot)
           2. Headline stat + real example facility
           3. Live demo script (exact queries to type)
           4. Architecture + "every flag cites IPHS 2022"
           5. "An NGO planner could triage the country in 3 months"
           
           Record backup screen recording of demo.
```

**Your deliverable**: Working APIs, working deployment, Databricks screenshots, and a pitch deck.

---

## The Timeline

```
HOUR  0-1   ALL: Open dataset, extract 20 rows, eyeball it, sync
HOUR  1-5   PARALLEL: Person A extracts, Person B builds map, Person C builds infra
HOUR  5     SYNC: Does the map show real data? Does the chat UI exist?
HOUR  5-10  PARALLEL: Person A builds query agent, Person B polishes UI, Person C wires APIs
HOUR  10    SYNC: Full end-to-end test together
HOUR  10-12 PARALLEL: Person A tests edge cases, Person B polishes, Person C builds pitch
HOUR  12    CODE FREEZE
HOUR  12-13 ALL: Demo rehearsal × 3
HOUR  13-14 ALL: Fix what broke in rehearsal
HOUR  14-15 BUFFER (things will break)
```

---

## The Pitch (2 minutes)

### [0:00 - 0:10] The Toggle

Show the map. "Claimed Coverage." Looks green.
Toggle to "Verified Coverage." Red gaps. Counter flips.
Don't say anything. Let judges react.

### [0:10 - 0:30] The Framing

> "We analyzed 10,000 Indian healthcare facility records.
> [X] have at least one inconsistency worth verifying
> before a patient is sent there.
> Every flag cites Indian Public Health Standards.
> This is a triage tool, not an accusation tool."

### [0:30 - 1:30] Live Demo

Type a query. Show results with trust signals and citations.
Click a red facility. Show the specific flag.
Click "Needs Site Visit." Show it saves.

### [1:30 - 2:00] The Close

> "An NGO planner with a 40-hour week
> could triage the entire country in three months.
> We've ranked every flag by severity.
> Start here."

---

## What We're NOT Building

- No authentication (anyone can access)
- No file upload (dataset is pre-loaded)
- No separate dashboard page (stats go on landing page)
- No web scraping (data is provided)
- No PWA, no Redis, no resumable streams
- No 6-agent multi-agent system (one agent, one job)
- No 3D globe (2D map is faster to build and just as effective)

---

## What To Tell Judges If They Ask

**"Why not Databricks?"**
> "Our data lives in Delta format in Unity Catalog. Our pipeline traces are in MLflow. We deployed on Vercel so you can click the live demo right now. The pipeline is Databricks-compatible — we prioritized a working demo over platform lock-in."

**"How do you know your flags are correct?"**
> "Every flag cites a specific page of IPHS 2022. And we built the human review panel precisely because we DON'T assume we're always right. This is a triage queue, not a verdict."

**"What if the AI extracted something wrong?"**
> "That's why we have the second verification call. After extraction, we ask the model: 'which of these claims aren't actually supported by the source text?' Unsupported claims get flagged separately from rule violations."

**"What's technically new here?"**
> "The two-call extraction with hallucination checking, and the three-signal trust framework where we never combine signals into a magic number. You see exactly why each facility is flagged, with a citation."

---

## Rules

1. **Sync every 4-5 hours.** 5 minutes max. Share blockers. Adjust.
2. **Deploy early, deploy often.** First Vercel deploy should be hour 2.
3. **If something takes more than 45 minutes and isn't working, cut it.** Move to the next thing.
4. **No feature is done until it shows up in the demo.** If it doesn't appear in the 2-minute pitch, don't build it.
5. **Hour 12 is code freeze.** No exceptions. Rehearsal time is sacred.

---

## First 60 Minutes (Do This NOW)

1. Person A: Download the Excel file. Open it. Extract 20 rows with OpenAI. Share the output.
2. Person B: `npx create-next-app@latest` — get the project skeleton running.
3. Person C: Create Neon database. Set up Vercel project. Push first deploy.

After 60 minutes, sync. Share what you found. Adjust if needed.

**Go.**
