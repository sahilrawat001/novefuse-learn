# Voice Study Agent 🎙️

A voice-first, real-time study application where students have spoken dialogues with an AI agent for **Revision** and **Interview Prep** modes, powered by **AssemblyAI's Voice Agent API** (`wss://agents.assemblyai.com/v1/ws`).

---

## Features

- **Voice-First Interaction**: No text-input crutches. Spoken conversation using Web Audio API (`AudioWorkletNode`) streaming 24kHz mono PCM16 audio bidirectionally over WebSockets.
- **Two Core Modes**:
  - **Revision Mode**: Active recall partner that quizzes you, listens to spoken explanations, follows up on misunderstandings, and evaluates topic mastery.
  - **Interview Prep Mode**: Role-playing interviewer evaluating responses using the STAR method and assessing technical depth.
- **Dynamic Weak-Topic Injection**: Tracks past session assessments (`strong`, `partial`, `weak`). Weak topics are dynamically injected into future prompts to focus practice where needed.
- **AssemblyAI Voice Agent API Integration**:
  - Single WebSocket connection handling STT, LLM reasoning, neural turn detection, barge-in interruption, and TTS voice output (`ivy`).
  - Function calling tools: `log_answer_quality` (records question evaluation immediately) and `end_session_summary` (generates comprehensive takeaway).
  - Session resumption window handling (30s grace period on disconnect).
- **Persistence & Accounts**: PostgreSQL with Prisma ORM and durable fallback store.
- **Unit Economics Tracking**: Automatic session duration tracking and cost computation at `$0.075 / minute`.

---

## Quick Start

### 1. Prerequisites
- Node.js 20+
- npm 10+
- (Optional) PostgreSQL 15+ (local, Docker, or hosted like Neon/Supabase)

### 2. Environment Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Edit `.env`:
```env
# Required for live AssemblyAI speech recognition & synthesis
ASSEMBLYAI_API_KEY=your_assemblyai_api_key

# PostgreSQL Connection URL (e.g. postgresql://user:pass@localhost:5432/voice_study)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/voice_study?schema=public

# Session Secret for signed auth tokens
SESSION_SECRET=your-secure-secret-here

PORT=3000
NODE_ENV=development
```

### 3. Install Dependencies
```bash
npm install
npm --prefix client install
```

### 4. Database Setup (Optional if running Postgres)
```bash
npx prisma generate
npx prisma db push # or npx prisma migrate dev
```
*Note: If PostgreSQL is not running, the application automatically uses a resilient in-memory store so you can develop and test immediately.*

### 5. Running the Application

#### Development (Hot-Reloading for Server + Vite Client)
```bash
npm run dev
```
- Backend runs on `http://localhost:3000`
- Vite frontend runs on `http://localhost:5173` (proxies `/api` and `/ws` to port 3000)

#### Production (Single Node Process)
```bash
npm run build
npm start
```
- A single process serves REST APIs, WebSocket voice relay, and static frontend on `http://localhost:3000`.

---

## Running Tests

Run the unit and integration test suite:
```bash
npx tsx test/integration.ts
```

---

## Project Structure

```
├── client/                     # Vite + React + TypeScript + Tailwind frontend
│   ├── public/
│   │   └── pcm-recorder-worklet.js  # AudioWorklet for 24kHz PCM16 mic capture
│   └── src/
│       ├── audio/              # Web Audio API capture and stream player
│       ├── components/         # StateIndicator, TopicBadge, Navbar
│       ├── context/            # AuthContext (session state)
│       └── pages/              # Login, Signup, Dashboard, VoiceSession, Summary, History
├── prisma/
│   ├── schema.prisma           # Prisma PostgreSQL schema
│   └── init.sql                # Raw SQL migration matching spec
├── src/
│   ├── server.ts               # Express HTTP + WS server entry point
│   ├── config.ts               # Configuration and environment validation
│   ├── db/client.ts            # Prisma client with connection check
│   ├── middleware/auth.ts       # Session authentication middleware
│   ├── routes/                 # Auth, StudyMaterial, Sessions, Topics, Stats, Token
│   ├── services/
│   │   ├── promptBuilder.ts    # Revision & Interview system prompt generators
│   │   └── toolHandlers.ts     # Handlers for log_answer_quality & end_session_summary
│   └── ws/
│       └── voiceRelay.ts       # AssemblyAI WebSocket relay & browser audio bridge
└── test/
    ├── integration.ts          # Automated test suite
    └── ws-client.ts            # WebSocket integration test client
```
