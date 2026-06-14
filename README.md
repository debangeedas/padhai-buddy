# Padhai Buddy

Padhai Buddy is a voice-first AI learning platform built for students in India who aren't fluent in English. Students can speak to the AI in Hindi, Hinglish, or English — like talking to a smart senior — and have a real back-and-forth conversation to understand their textbook concepts better.

The goal is simple: every student deserves a patient teacher who speaks their language. Padhai Buddy uses NVIDIA's Nemotron model to understand spoken questions (even in mixed Hindi-English), retrieves relevant content from NCERT textbooks via RAG, and responds in the student's chosen language with follow-up questions that keep the learning going.

## Features

- **Voice-first interaction** — tap and talk, just like a conversation with a tutor
- **Multilingual support** — English, Hinglish (Hindi in Roman script), and Hindi (Devanagari)
- **NCERT RAG pipeline** — answers grounded in actual textbook content (Class X–XII Biology)
- **Conversational teaching** — broad questions get broken into back-and-forth exchanges, not textbook dumps
- **Academic guardrails** — off-topic questions are politely redirected back to studies
- **Student profiles** — avatar picker, language preference, GitHub-style activity grid
- **Chat history** — review past learning sessions
- **Text-to-speech** — responses are read aloud via ElevenLabs

## Tech Stack

| Layer | Technology |
|-------|------------|
| AI Model | NVIDIA Nemotron-3-Nano-Omni-30B (audio-in, text-out via NIM API) |
| Backend | FastAPI + WebSocket |
| Frontend | React + Vite |
| Auth & DB | Supabase (auth, profiles, chat sessions, messages) |
| RAG | ChromaDB + sentence-transformers (all-MiniLM-L6-v2) |
| PDF Ingestion | PyMuPDF |
| TTS | ElevenLabs (multilingual_v2) |
| Speech Recognition | Browser Web Speech API |

## Prerequisites

- Python 3.10+
- Node.js 18+
- An [NVIDIA NIM](https://build.nvidia.com/) API key
- An [ElevenLabs](https://elevenlabs.io/) API key (free tier works, limited credits)
- A [Supabase](https://supabase.com/) project

## Setup

### 1. Clone the repo

```bash
git clone https://github.com/debangeedas/padhai-buddy.git
cd padhai-buddy
```

### 2. Backend

Create a virtual environment and install dependencies:

```bash
python -m venv venv
venv\Scripts\activate   # On Windows
# source venv/bin/activate  # On macOS/Linux
pip install -r requirements.txt
pip install chromadb sentence-transformers
```

Create a `.env` file in the project root:

```
NVIDIA_API_KEY=your_nvidia_api_key
ELEVENLABS_API_KEY=your_elevenlabs_api_key
```

### 3. Supabase

Create a Supabase project and set up these tables:

- **profiles** — `user_id` (text, PK), `display_name` (text), `avatar_id` (text), `language` (text), `updated_at` (timestamptz)
- **chat_sessions** — `id` (uuid, PK, default gen_random_uuid()), `user_id` (text), `created_at` (timestamptz, default now())
- **messages** — `id` (uuid, PK, default gen_random_uuid()), `user_id` (text), `session_id` (uuid, FK to chat_sessions), `role` (text), `content` (text), `created_at` (timestamptz, default now())

Enable email/password auth in your Supabase project settings.

### 4. Frontend

```bash
cd frontend
npm install
```

Create a `frontend/.env` file:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
```

### 5. Ingest textbooks (RAG)

Place NCERT PDFs in a `textbooks/` directory structured like:

```
textbooks/
├── class-x-biology/
│   ├── chapter1.pdf
│   └── chapter2.pdf
├── class-xi-biology/
└── class-xii-biology/
```

Run the ingestion script:

```bash
python ingest.py --pdf_dir textbooks
```

### 6. Run

Start the backend and frontend in separate terminals:

```bash
# Terminal 1 — Backend (port 8000)
python server.py

# Terminal 2 — Frontend (port 3000)
cd frontend
npm run dev
```

Open http://localhost:3000, sign up, set your language in Profile, and start asking doubts.

## How It Works

1. Student taps the mic button and speaks their question
2. Browser's Web Speech API provides a live transcript (used for RAG search)
3. Raw audio is sent to NVIDIA Nemotron via WebSocket for understanding
4. Relevant NCERT textbook chunks are retrieved from ChromaDB
5. The model generates a conversational response grounded in textbook content
6. Response is sent back as text and read aloud via ElevenLabs TTS

## License

MIT
