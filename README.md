# CardioCommand

**AI-powered post-cardiac surgery monitoring and care coordination platform.**

Built for the Healthcare AI Hackathon. Solo build. Demo-first architecture.

---

## What It Does

CardioCommand closes the communication gap between hospital discharge and home recovery for cardiac surgery patients.

**MD Dashboard** — Dark, clinical, data-dense. For cardiologists and care coordinators.
- 12 live vitals metrics streamed via WebSocket at 10 readings/sec
- LangGraph AI agent: RAG → Vitals Analysis → Risk Scoring → Action Generation
- Ambient visit documentation: live transcript → SOAP note via GPT-4o
- War Room: population risk overview with sortable patient table
- Demo scenario control panel

**Patient App** — Warm, mobile-first, conversational. For the patient at home.
- Live vitals in plain English (not medical jargon)
- Cora AI companion: GPT-4o chat with escalation detection
- Medication tracker, recovery progress bar, plain-English recovery plan
- Syncs alerts in real-time to MD Dashboard

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite + Tailwind CSS + Framer Motion + Recharts |
| Backend | Python FastAPI + LangGraph + OpenAI GPT-4o |
| Real-time | WebSockets (FastAPI native) |
| AI/ML | GPT-4o, FAISS RAG, Deterministic risk model |
| Deployment | Vercel (frontends) + Railway (backend) |

---

## Quickstart

### 1. Backend

```bash
cd backend
pip install -r requirements.txt

# Add your OpenAI API key
echo "OPENAI_API_KEY=sk-your-key-here" > .env

# Build the RAG index (run once)
python -c "from rag.indexer import build_index; build_index()"

# Start the server
uvicorn main:app --reload --port 8000
```

### 2. MD Dashboard

```bash
cd apps/md-dashboard
npm install
npm run dev
# → http://localhost:5173?demo=true
```

### 3. Patient App

```bash
cd apps/patient-app
npm install
npm run dev
# → http://localhost:5174?demo=true
```

---

## Demo Setup (8-Minute Presentation)

1. Open `http://localhost:5173?demo=true` in Tab 1 (MD Dashboard)
2. Open `http://localhost:5174?demo=true` in Tab 2 (Patient App)
3. Open patient app on phone at the same URL
4. Both apps default to **John Mercer — Day 8 Early Warning** scenario

### Demo Flow
- **0:00** — The hook: "1 in 5 cardiac patients readmitted within 30 days..."
- **0:45** — Patient app on phone → Chat with Cora → report chest soreness
- **2:15** — MD Dashboard alert fires in real-time
- **3:15** — Click "Run Full Analysis" → watch LangGraph pipeline stream
- **5:15** — Ambient Documentation → speak patient conversation → SOAP note builds live
- **7:15** — War Room → $98K predicted savings
- **7:45** — Close

---

## API Endpoints

```
GET  /patients                     → All patients with live vitals
GET  /patients/{id}                → Full patient record
GET  /patients/{id}/timeline       → Event log
WS   /vitals/stream/{patient_id}   → Live vitals (10 readings/sec)
GET  /vitals/{id}/history          → Last N readings
POST /ai/analyze                   → LangGraph agent (SSE)
POST /ai/chat                      → Cora patient chat (SSE)
POST /ai/pre-visit-brief           → Pre-visit intelligence brief (SSE)
POST /ai/soap-note                 → SOAP note from transcript
GET  /demo/scenarios               → List scenarios
POST /demo/set-scenario            → Switch scenario
POST /demo/trigger-alert           → Fire an alert
WS   /demo/events                  → Demo event broadcast
```

---

## Architecture

```
Patient Wearable (simulated)
         ↓ WebSocket (10hz)
   FastAPI Backend
         ├── Vitals Simulator (scenario-driven, Gaussian noise)
         ├── LangGraph Agent
         │   ├── [retrieve_guidelines] — FAISS RAG
         │   ├── [analyze_vitals] — GPT-4o
         │   ├── [score_risk] — Rule-based model
         │   ├── [decide_alert] — Conditional router
         │   ├── [generate_outreach_script] — Medium risk
         │   ├── [generate_urgent_brief] — High/Critical risk
         │   └── [generate_summary] — Final output
         └── Demo Control (WebSocket broadcast)
              ↓                     ↓
      MD Dashboard           Patient App
   (localhost:5173)        (localhost:5174)
```

---

## Mock Patients

| Patient | Surgery | Day | EF | Scenario |
|---|---|---|---|---|
| John Mercer, 67 | CABG | 8 | 35% | Early Warning (Risk 71) |
| Rosa Delgado, 54 | TAVR | 5 | 52% | AFib Detected (Risk 94) |
| Marcus Webb, 71 | ICD | 13 | 28% | Pre-Visit (Risk 55) |
| Sarah Kim, 48 | Mitral Valve Repair | 30 | 62% | Full Recovery (Risk 14) |

---

*CardioCommand — Healthcare AI Hackathon 2025*
