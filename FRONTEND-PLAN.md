# Agentic Healthcare Map — Frontend Plan (Map-First + NLP Hybrid)

## 0. Core Philosophy

Primary interaction = Map + Filters  
Secondary interaction = NLP query (as a shortcut, not the main UI)

- The map is always the center of gravity.
- Filters provide structured, reliable control.
- NLP provides speed and flexibility for advanced queries.

---

## 1. High-Level Layout

Top control bar with filters  
Full-screen map as the main view  
Bottom-centered NLP input field  
Optional bottom bar for scenario controls  

Key rules:
- No permanent side panels
- No chat window
- No clutter
- Details appear only on interaction

---

## 2. Top Control Bar (Primary Interaction Layer)

### 2.1 Structured Filters (Always Visible)

These define the core system state.

#### A. Capability Selector

Dropdown that switches the map layer.

Options:
- Emergency Surgery
- ICU Availability
- Trauma Care
- Dialysis
- Oncology

---

#### B. Location Filter

Hierarchy-based filtering:
- Country
- State
- District
- Rural toggle

---

#### C. Trust Threshold Slider

Numeric slider that filters out low-confidence facilities.

---

#### D. Availability Filters

Boolean toggles:
- Open 24/7
- Full-time staff only

---

## 3. Bottom-Centered NLP Input

Acts like a lightweight command/search bar.

Position:
- Floating at the bottom center of the screen
- Does not interfere with map visibility

Example inputs:
- Emergency surgery in rural Bihar
- Dialysis centers within 50km
- Hospitals with ICU but low trust

Behavior:
- Parse query into structured filters
- Update map state
- Show interpreted query

Example:
Input: Emergency surgery in rural Bihar  
Parsed as: Capability: Emergency Surgery, Location: Bihar, Rural: true

---

## 4. Map Visualization (Core UI)

### 4.1 Facility Representation

Each facility is a point with visual encoding:

- Color represents capability level:
  - Green: fully capable
  - Yellow: partially capable
  - Red: missing critical requirements

- Opacity represents trust score:
  - Solid: high confidence
  - Faded: low confidence

- Size represents capacity:
  - Example: number of ICU beds

---

### 4.2 Legend

Floating legend explaining:
- Color meaning
- Opacity meaning
- Size meaning

---

## 5. Interaction Model

### 5.1 Hover

Displays lightweight tooltip:
- Facility name
- Capability summary
- Trust percentage

---

### 5.2 Click

Opens a temporary detail panel.

Content includes:
- Facility name
- Trust score
- Distance (if relevant)
- Capability breakdown
- Evidence from source text
- Trust explanation (penalties and inconsistencies)

---

## 6. Advanced Mode

### 6.1 Medical Desert Mode

Toggle to show underserved areas.

Behavior:
- Hide individual facilities
- Display heatmap of missing capabilities
- Highlight regions lacking services within a defined radius

---

## 7. NLP Integration (Hybrid System)

### 7.1 Role of NLP

NLP acts as a translator from natural language to structured filters.

---

### 7.2 Pipeline

User query  
→ LLM parses into structured filters  
→ Frontend state updates  
→ Map re-renders  

---

### 7.3 Example

Input:
Trauma centers in Bihar with high reliability

Parsed:
- Capability: Trauma
- Location: Bihar
- Trust > 80%

---

### 7.4 UI Feedback

Always show interpreted query to the user:
Showing: Trauma Care | Bihar | Trust > 80%

---

## 8. State Model (Frontend)

Core state structure:

- capability (selected layer)
- location (country, state, district, rural flag)
- trustMin (minimum trust threshold)
- availability filters (24/7, full-time)

Parsed NLP queries produce partial updates to this state.

---

## 9. Component Breakdown (Next.js)

Core components:

- MapView
- TopBar
  - CapabilitySelector
  - LocationFilter
  - TrustSlider
  - AvailabilityFilters
- SearchInput (bottom-centered)
- FacilityLayer
- Legend
- FacilityDetailPanel

---

## 10. Tech Stack

- Map: Mapbox GL JS or Leaflet
- Frontend: Next.js with Tailwind CSS
- State management: Zustand or React Context
- NLP parsing: backend API using an LLM

---

## 11. MVP Build Order

Phase 1:
- Render map with facility markers

Phase 2:
- Implement filters (capability, trust)

Phase 3:
- Add facility click panel with details

Phase 4:
- Add NLP input and parsing

Phase 5:
- Add legend and UI polish

---

## 12. Final Positioning

This is a map-first healthcare intelligence system where structured filters drive decision-making, and natural language is used as a fast interface to configure complex queries.

It is not a chatbot and not a traditional dashboard. It is a spatial decision system for healthcare planning.