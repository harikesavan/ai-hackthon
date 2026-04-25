# Project Status Update

## What's Done

### Infrastructure
- Next.js project set up with TypeScript + Tailwind CSS
- PostgreSQL database live on Neon (free tier)
- Database schema pushed — `facilities` table with all columns:
  - Identity (name, type, ownership)
  - Location (state, district, pincode, lat/lon)
  - Capacity (beds, doctors)
  - Extracted data (services, equipment, specialties, staff)
  - Trust Signal 1: extraction confidence + unsupported claims
  - Trust Signal 2: IPHS rule violations with citations
  - Trust Signal 3: peer anomaly percentile + flags
  - Combined trust score (min of 3 signals)
  - Human review status (pending/confirmed_real/confirmed_ghost/needs_visit)
  - Raw notes (original text)
- Deployed on Vercel with auto-deploy on every push to main
- Environment variables set (DATABASE_URL + OPENAI_API_KEY) on both local and Vercel

### API Routes (Backend)
- `POST /api/chat` — Takes a natural language question, converts to SQL via OpenAI, queries the database, returns trust-scored results with explanations
- `GET /api/facilities` — Returns facility list with filters (state, district, type, max trust score)
- `GET /api/map-data` — Returns all facilities as GeoJSON for the map (only those with coordinates)
- `POST /api/review` — Writes human review status (Confirm Ghost / Confirm Real / Needs Visit)

### Data Pipeline (Python scripts ready for Person A)
- `scripts/extract.py` — Two-call extraction: Call 1 extracts structured data, Call 2 checks for hallucinations. Async with 30 concurrent requests. Defaults to 20 rows for testing (set EXTRACT_COUNT for more).
- `scripts/import_db.py` — Reads extracted JSON, geocodes PIN codes to lat/lon, computes trust_min score, inserts into PostgreSQL.
- `scripts/requirements.txt` — All Python dependencies listed.

### Map Data
- India states GeoJSON downloaded and served from `public/india_states.geojson` (1MB)

## What's NOT Done Yet

### Blocked on Person A
- No data extracted yet — Person A needs to put the Excel file in `data/` and run `python scripts/extract.py`
- No trust scores computed — happens after extraction
- No data in the database — happens after extraction + import

### Person B (Frontend)
- Landing page with hero stats
- Map component with Claimed/Verified toggle
- Chat interface
- Facility result cards with trust badges
- Human review panel (3 buttons)

### Later
- Edge case testing on chat queries
- Hardcoded fallback queries for demo
- Pitch deck (5 slides)
- Demo rehearsal

## How to Run

### Locally
```bash
npm install
npm run dev
# Open http://localhost:3000
```

### Person A (data pipeline)
```bash
cd scripts
pip install -r requirements.txt
# Put Excel file in data/ folder first
python extract.py          # extracts 20 rows as test
EXTRACT_COUNT=10000 python extract.py  # full run
python import_db.py        # pushes to database
```

### Deploy
Push to main. Vercel auto-deploys.

## Live URLs
- **App**: https://hackthon-neuronais-projects.vercel.app
- **Repo**: https://github.com/harikesavan/ai-hackthon
- **DB Studio**: `npx drizzle-kit studio` (local only)
