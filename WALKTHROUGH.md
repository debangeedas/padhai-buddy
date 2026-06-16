# Padhai Buddy — App Walkthrough

> **Padhai Buddy** is a voice-first AI tutor for Indian school students (Classes 6–12). It lets students ask doubts using voice or text in Hindi, Hinglish, or English, and get clear, textbook-backed explanations spoken back to them — like having a personal tutor available 24/7.

---

## The Problem

Millions of Indian students study from NCERT textbooks but don't have access to a tutor who can explain concepts clearly in their preferred language. Existing AI chatbots are generic, unfiltered, and not grounded in actual syllabus content. Students need:

- A **safe, academic-only** AI that won't go off-topic
- Answers **grounded in their actual textbooks** (CBSE/ICSE/State Board)
- Support for **Hindi, Hinglish, and English** — because most students think in Hindi but study in English
- **Voice-first interaction** — many students are more comfortable speaking than typing
- Tools for **active recall** — flashcards and quizzes, not just passive reading

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React + Vite (SPA) |
| Backend | Python FastAPI + WebSocket |
| AI (Teaching) | OpenAI GPT-4o-mini |
| AI (Speech-to-Text) | OpenAI Whisper (switchable to ElevenLabs Scribe v2 — see server.py) |
| Text-to-Speech | ElevenLabs (multilingual v2) |
| RAG (Textbook retrieval) | ChromaDB + sentence-transformers |
| Auth & Database | Supabase (PostgreSQL + Row Level Security) |
| Textbook Source | NCERT PDFs, chunked and embedded |

---

## App Screens & Features

### 1. Landing Page

The first screen visitors see. It introduces Padhai Buddy with four key value propositions:

- **🎙️ Voice-first learning** — Tap the mic and ask your doubt. No typing needed.
- **📚 Backed by your textbooks** — Answers grounded in actual NCERT textbooks.
- **💬 Conversational teaching** — A tutor that asks follow-ups and builds understanding.
- **🛡️ Safe for students** — Only talks academics; off-topic questions are redirected.

A simple 3-step flow is shown: Create account → Tap the mic → Get an explanation.

Two buttons lead to **Log in** and **Sign up**.

<img width="892" alt="Screenshot 2026-06-16 020245" src="https://github.com/user-attachments/assets/38c2c182-d0bf-4a51-80a5-c11b675f0adf" />

<img width="892" alt="image" src="https://github.com/user-attachments/assets/84a8b608-d961-45d4-9915-46e5045973bc" />


---

### 2. Login / Sign Up

A clean card-based form with:

- Email and password fields
- Toggle between "Log in" and "Sign up" modes
- "← Back" link to return to the landing page
- Supabase handles authentication (email/password with email verification)

<img width="892" alt="image" src="https://github.com/user-attachments/assets/06a917ef-bb70-448e-9677-781675b8dbde" />
---

### 3. Onboarding (First-Time Setup)

New users go through a 4-step onboarding wizard. This personalizes their experience:

**Step 1 — Name & Board**
- Enter your display name
- Pick your education board: CBSE, ICSE, State Board, or Other

**Step 2 — Class Level**
- Select your class (6 through 12)
- This determines which subjects appear (junior classes get Science/SST/Hindi; senior classes get Physics/Chemistry/Biology/History)

**Step 3 — Language Preference**
- **English** — Replies fully in English
- **Hinglish** — Hindi words in English script, mixed with English
- **Hindi** — Full Hindi in Devanagari script

**Step 4 — Avatar**
- Pick a fun avatar (owl, rocket, book, lightbulb, star, tree, etc.)
- This appears in the sidebar and profile

---

### 4. Dashboard — Main Chat

The core of the app. A dark-themed interface with a sidebar on the left and the chat area on the right.

#### Sidebar (Left)
- **"+ New chat"** button at top
- **Chat history** — all previous sessions listed with:
  - Subject label in color (e.g., "BIOLOGY", "CHEMISTRY")
  - Preview of the first message
  - Date stamp
  - Icons differentiate session types: 🗂️ for flashcards, 📝 for quizzes
- **User profile** at bottom — avatar, name, "View profile" link, and logout button

#### Welcome Screen (New Chat)
When starting a new chat, students see:
- A greeting: "Namaste, [Name]! 👋"
- Subject buttons — colored cards for each subject based on their class level:
  - Class 6–10: Science, Maths, English, SST, Hindi
  - Class 11–12: Physics, Chemistry, Biology, Maths, English, History
- Two additional mode buttons:
  - **🗂️ Flashcards** — Enter flashcard study mode
  - **📝 Revision Quiz** — Enter quiz mode
 
<img width="885" alt="image" src="https://github.com/user-attachments/assets/79cbcca3-5bfb-431f-9bf4-858096b8cc59" />

#### Chat Interaction
- Tapping a subject opens a voice/text chat scoped to that subject
- **BOLO button** (green circle) — Press to start recording your voice question
- **RUKO button** — Press to stop recording
- Live transcript appears as you speak (using browser's Web Speech API)
- Audio is sent to the backend → Whisper transcribes → GPT-4o-mini generates a teaching response → ElevenLabs speaks it back
- The response plays as audio and appears as text in the chat
- **Text input** — Students can also type doubts in the text field at the bottom
- The AI uses RAG to pull relevant textbook passages before answering, grounding responses in actual NCERT content

<img width="962" alt="image" src="https://github.com/user-attachments/assets/bbfe7026-7525-4802-b8c7-0fadcdb50c58" />


---

### 5. Flashcard Mode

For active recall study using textbook content.

#### Flow:
1. **Select a subject** — Same subject grid as the chat
2. **Select chapters** — Available chapters are fetched from the ingested textbook database. Students can:
   - Pick individual chapters
   - Select all chapters
3. **Study session** — 10 flashcards are generated from the selected textbook content:
   - Each card shows a **question** on the front
   - Tap to **flip** and reveal the answer
   - A **hint** button provides an extra clue
   - Navigate with **← Previous** and **Next →** buttons
   - Progress indicator: "Card 3 of 10"
   - **"Done — Exit"** button to finish

#### How it works:
- The backend queries ChromaDB for relevant textbook chunks matching the subject, class, and chapters
- These chunks are sent to GPT-4o-mini with a prompt to generate flashcard Q&A pairs
- All 10 cards are generated in one batch before the session starts (no mid-session loading)
- Sessions are saved to Supabase for later review in the history sidebar

<img height="402" alt="image" src="https://github.com/user-attachments/assets/38721a44-d0a1-4e3a-8a24-3bff1a72600d" /> <img height="402" alt="image" src="https://github.com/user-attachments/assets/27f8f92e-c16d-431a-a7d6-1a8a8202bcfb" />

---

### 6. Revision Quiz Mode

Multiple-choice quizzes generated from textbook content for self-assessment.

#### Flow:
1. **Select a subject** — Same subject grid
2. **Select chapters** — Same chapter picker as flashcards
3. **Take the quiz** — 10 MCQ questions:
   - Question text with 4 answer options (A, B, C, D)
   - Tap an option to select it
   - **"Check Answer"** button reveals whether you're correct
   - Correct answer highlighted in green, wrong selection in red
   - Running score displayed: "Score: 7/10"
   - Progress: "Question 5 of 10"
4. **Results screen** — After completing all 10 questions:
   - Final score with color-coded badge (green ≥70%, yellow ≥40%, red <40%)
   - **Review each question**: See the question, your answer, and the correct answer
   - Each reviewed question color-coded (green = correct, red = wrong)
   - **"New Quiz"** and **"Back to Chat"** buttons

#### How it works:
- Same RAG pipeline as flashcards — retrieves textbook chunks, sends to GPT-4o-mini with a quiz generation prompt
- Questions, answers, and scores are persisted to Supabase
- Each answer updates the session in real-time (so progress isn't lost if the page refreshes)

<img width="891" alt="image" src="https://github.com/user-attachments/assets/71b542d9-ba6c-4c74-9899-b11df25f6efd" />

---

### 7. Profile Page

Accessed via "View profile" in the sidebar.

#### Sections:

**Profile & Avatar**
- Large avatar display
- Editable display name
- Avatar picker grid to change your avatar

**Language Preference**
- Toggle between English, Hinglish, and Hindi
- Changes apply to all future AI responses

**Activity Grid**
- GitHub-style contribution heatmap
- Shows daily message activity over time
- Darker squares = more active days

**Quiz Results Dashboard**
- **Subject progress bars** — Aggregated accuracy per subject:
  - e.g., "Chemistry: 15/20 (75%) · 2 quizzes" with a colored progress bar
  - Each subject has its own color (Physics = blue, Chemistry = pink, Biology = green, etc.)
- **Recent Quizzes** — List of individual quiz sessions:
  - Subject name with colored dot
  - Chapters covered
  - Date and time
  - Score badge (color-coded: green/yellow/red)
  - Mini progress bar

**Save Button** — Persists profile changes to Supabase

<img width="895" alt="image" src="https://github.com/user-attachments/assets/e56d0175-deed-4e85-a927-cda0f176763f" />
<img width="895" alt="image" src="https://github.com/user-attachments/assets/f1714609-230e-43ee-9021-4acfdf93028a" />

---

### 8. History Sidebar

The left sidebar maintains a scrollable list of all past sessions:

- **Chat sessions** — Show subject label + first message preview
- **Flashcard sessions** (🗂️) — Show subject + chapter list (e.g., "Ch 1, 3, 5")
- **Quiz sessions** (📝) — Show subject + chapter list

Clicking any session loads it:
- Chat sessions restore the full message history
- Flashcard sessions restore all cards for re-study
- Quiz sessions restore questions, your answers, and the score

Sessions are sorted by date (newest first) and scoped to the logged-in user via Supabase Row Level Security.

<img width="341" height="445" alt="image" src="https://github.com/user-attachments/assets/d6fc01f4-8183-4a2f-a819-d1cf2526ab50" />


---

## Architecture Overview

```
┌─────────────┐     WebSocket      ┌──────────────────┐
│   Browser    │◄──────────────────►│  FastAPI Backend  │
│  (React SPA) │     REST API       │   (server.py)     │
└─────────────┘                    └──────┬───────────┘
                                          │
                          ┌───────────────┼───────────────┐
                          │               │               │
                    ┌─────▼─────┐  ┌──────▼──────┐ ┌─────▼──────┐
                    │  Whisper   │  │  GPT-4o-mini │ │ ElevenLabs │
                    │   (STT)    │  │  (Teaching)  │ │   (TTS)    │
                    └───────────┘  └──────┬──────┘ └────────────┘
                                          │
                                   ┌──────▼──────┐
                                   │  ChromaDB   │
                                   │  (Textbook  │
                                   │   RAG)      │
                                   └─────────────┘
```

**Voice flow:** Student speaks → Browser records audio → Sent via WebSocket → OpenAI Whisper transcribes (or ElevenLabs Scribe v2) → ChromaDB retrieves relevant textbook passages → GPT-4o-mini generates a teaching response using the textbook context → ElevenLabs converts response to speech → Audio streamed back to browser

**Text flow:** Same as above, minus the Whisper transcription step.

**Flashcard/Quiz flow:** Student picks subject + chapters → Backend queries ChromaDB for matching chunks → GPT-4o-mini generates flashcards/questions from the textbook content → Returned via REST API → Session saved to Supabase

---

## Data & Privacy

- All user data stored in Supabase with Row Level Security — users can only access their own data
- No student data is shared across accounts
- The AI is instructed to stay on-topic (academics only) and redirect off-topic questions
- Voice audio is processed for transcription and not stored long-term

---

## How to Add More Textbooks

1. Download NCERT PDFs using the included `download_textbooks.py` script
2. Place them in the `textbooks/` folder following the naming convention: `class-{roman}-{subject}/`
3. Run `python ingest.py --pdf_dir textbooks/` to chunk and embed them into ChromaDB
4. Restart the server — the new content is immediately available for chat, flashcards, and quizzes

---

*Built with ❤️ for Indian students who deserve a tutor that speaks their language.*
