# API Endpoints for Frontend

Base URL: `http://localhost:3000` (local) or your Vercel URL

---

## 1. GET /api/map-data

**Purpose**: Get ALL 10,000 facilities as GeoJSON to plot on the map.

**When to call**: Once on page load.

**Request**:
```
GET /api/map-data
```

**Response**:
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {
        "type": "Point",
        "coordinates": [73.19, 22.35]
      },
      "properties": {
        "id": 21588,
        "name": "Kalavati Orthopaedic Clinic",
        "type": "Clinic",
        "state": "Gujarat",
        "district": "Vadodara",
        "beds": null,
        "services": ["Performs orthopedic surgery"],
        "emergencyAvailable": false,
        "ruleViolationCount": 3,
        "trustMin": 0.0,
        "reviewStatus": "pending"
      }
    }
  ]
}
```

**How to use**:
- Plot each feature as a dot on the map
- Color by `trustMin`:
  - Green: `trustMin > 0.7`
  - Yellow: `trustMin` between `0.3` and `0.7`
  - Red: `trustMin < 0.3`
  - Grey: `trustMin` is `null` (not scored yet)
- **THE TOGGLE**: "All Facilities" shows everything. "Verified Only" filters to `trustMin > 0.7`. Count how many pass → that's the counter that flips.

---

## 2. GET /api/facilities

**Purpose**: Get a filtered list of facilities with full details including trust flags.

**When to call**: When showing facility cards in chat results, or filtering by state/district.

**Request** (all params optional):
```
GET /api/facilities?state=Maharashtra&district=Mumbai&type=Clinic&max_trust=0.5&limit=20
```

| Param | Type | Description |
|-------|------|-------------|
| state | string | Filter by state |
| district | string | Filter by city/district |
| type | string | Clinic, Hospital, Dentist, Pharmacy |
| max_trust | number | Only facilities with trust ≤ this value |
| limit | number | Max results, default 100 |

**Response**:
```json
{
  "count": 2,
  "facilities": [
    {
      "id": 21588,
      "facilityName": "Kalavati Orthopaedic Clinic",
      "facilityType": "Clinic",
      "ownershipType": "private",
      "state": "Gujarat",
      "district": "Vadodara",
      "pincode": "390001",
      "lat": 22.35,
      "lon": 73.19,
      "beds": null,
      "doctors": null,
      "services": ["Performs orthopedic surgery", "Joint replacement"],
      "equipment": [],
      "specialties": ["orthopedicSurgery", "generalSurgery"],
      "emergencyAvailable": false,
      "trustMin": 0.0,
      "ruleViolations": [
        {
          "rule": "clinic_surgery",
          "description": "Clinic claims: orthopedicSurgery, generalSurgery",
          "citation": "Clinical Establishments Act 2010",
          "severity": "high"
        },
        {
          "rule": "surgery_no_equipment",
          "description": "Surgical procedures, zero equipment",
          "citation": "IPHS 2022",
          "severity": "medium"
        }
      ],
      "reviewStatus": "pending",
      "rawNotes": "Orthopaedic clinic in Vadodara..."
    }
  ]
}
```

**How to use**:
- Show each facility as a card
- Card shows: name, type, trust badge (green/yellow/red), rule violations
- Each rule violation has `description` (what's wrong) and `citation` (the source)
- Click a card → fly map to `lat`/`lon`

---

## 3. POST /api/chat

**Purpose**: User asks a natural language question. AI converts it to SQL, runs it, returns an answer with facilities.

**When to call**: When user types a question and hits enter.

**Request**:
```json
{
  "message": "Which clinics in Maharashtra claim cardiac surgery?"
}
```

**Response**:
```json
{
  "answer": "Found 47 clinics in Maharashtra claiming cardiac surgery. All are flagged — clinics don't have operating theaters for cardiac surgery (Clinical Establishments Act 2010).",
  "facilities": [
    {
      "id": 123,
      "facility_name": "Some Clinic",
      "trust_min": 0.0,
      "rule_violations": [...]
    }
  ],
  "query": "SELECT * FROM facilities WHERE ...",
  "explanation": "Searches for clinics in Maharashtra with cardiac surgery"
}
```

**How to use**:
- Show `answer` as the AI message bubble
- Show `facilities` as clickable cards below the answer
- Click a card → fly map to that facility
- `query` and `explanation` can go in a collapsible "How I found this" section (optional)

**Suggested queries** (pre-load as clickable buttons):
- "Which clinics in Maharashtra claim cardiac surgery?"
- "Show facilities in Bihar with emergency but fewer than 2 doctors"
- "Which pharmacies list medical specialties?"
- "Find the least trustworthy facilities in Delhi"
- "How many facilities are flagged in Uttar Pradesh?"

---

## 4. POST /api/review

**Purpose**: Save a human reviewer's verdict on a facility. The three buttons.

**When to call**: When user clicks "Confirm Ghost", "Confirm Real", or "Needs Site Visit".

**Request**:
```json
{
  "facilityId": 21588,
  "status": "confirmed_ghost"
}
```

Valid statuses:
- `pending` — not reviewed (default)
- `confirmed_real` — reviewer says facility is legit
- `confirmed_ghost` — reviewer confirms it can't do what it claims
- `needs_visit` — needs physical site verification

**Response**:
```json
{
  "success": true,
  "facilityId": 21588,
  "status": "confirmed_ghost"
}
```

**How to use**:
- Three buttons on the facility detail panel
- After click: show success toast, grey out the button
- Update the dot color on the map if you want (optional)

---

## Quick Reference

| Endpoint | Method | Purpose | When |
|----------|--------|---------|------|
| `/api/map-data` | GET | All facilities as GeoJSON | Page load |
| `/api/facilities` | GET | Filtered facility list | Chat results, sidebar filters |
| `/api/chat` | POST | Ask a question | User types query |
| `/api/review` | POST | Save human review | User clicks review button |

---

## Trust Score Color Guide

| trustMin | Color | Meaning |
|----------|-------|---------|
| > 0.7 | Green | No issues found |
| 0.3 - 0.7 | Yellow | Minor issues |
| < 0.3 | Red | Serious issues — likely can't deliver what it claims |
| null | Grey | Not scored |

## Real Numbers

- Total facilities: 10,000
- Flagged (≥1 issue): 1,515
- Clean: 8,485
- Most common flag: "Surgical procedures claimed, zero equipment listed" (791)
