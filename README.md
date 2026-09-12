# SmartHire AI

SmartHire AI is an enterprise-grade autonomous AI-powered interview and candidate assessment platform designed to deliver high-fidelity, real-time technical and behavioral assessments, automated proctoring verification, multi-dimensional scoring rubrics, and executive evaluation reports.

---

## Overview

SmartHire AI bridges the gap between hiring teams and job seekers by modernizing traditional recruitment workflows. By orchestrating a multi-provider Large Language Model (LLM) layer with real-time speech transcription, client-side proctoring, and deep behavioral computer vision, SmartHire conducts realistic conversational interviews, evaluates candidate proficiency objectively, and empowers recruiters to make evidence-based hiring decisions.

---

## Key Features

### Candidate Portal
* **Registration & Authentication**: Secure JWT-based registration and login, including Google OAuth 2.0 single sign-on support.
* **Profile & Resume Parsing**: Automated parsing of PDF/DOCX resumes extracting key technical skills, experience history, and educational background.
* **Job Discovery & Application**: Browse active job requisitions across engineering and product disciplines, review compensation and role specifications, and apply with a single click.
* **Interview Scheduling & Lobby**: Schedule interview slots and conduct automated hardware diagnostics (microphone, camera, speaker, and network latency) before entering live sessions.
* **AI Live Interviewer**: Interactive real-time interview room supporting Technical, Behavioral, System Design, and HR rounds.
* **Real-Time Transcription (STT)**: High-accuracy live speech-to-text capturing spoken candidate answers with low latency.
* **Speech & Acoustic Intelligence**: Evaluates speaking pace (Words Per Minute), vocal clarity, filler word frequency (*um*, *uh*, *like*), and hesitation markers.
* **Visual & Behavioral Telemetry**: Real-time facial emotion categorization and eye gaze tracking to observe engagement, focus, and poise.
* **In-Browser Integrity & Proctoring**: Real-time detection of tab switching, window blur, developer tools activation, and unauthorized multi-person presence.
* **Session Recording**: Authenticated audio/video stream capture for complete interview auditing.
* **Candidate Analytics & Practice Hub**: Personalized candidate dashboards displaying score breakdowns, radar charts, and targeted practice recommendations with interactive code editors.
* **Notifications**: Real-time in-app alerts and notifications regarding application progress, interview invitations, and status changes.

### Recruiter Hub
* **Command Center Dashboard**: Live recruitment metrics, active job requisitions, pipeline conversion rates, and recent candidate assessments.
* **Job Creation & Management**: Create and manage detailed job postings specifying required competencies, assessment criteria, salary ranges, and job locations.
* **Candidate Management**: Search, filter, and review candidates across distinct pipeline stages (*Applied*, *Shortlisted*, *Interviewed*, *Evaluated*, *Offered*).
* **Interview Scheduling & Invitations**: Dispatch automated interview invitations and calendar slots to prospective candidates.
* **Candidate Comparison**: Side-by-side comparative analysis of multiple applicants evaluating core metrics, behavioral traits, and technical competency scores.
* **Executive Evaluation Reports**: Drill down into question-by-question scoring, transcribed answers, integrity incident logs, and audio/video playback.
* **PDF Report Generation**: Export authoritative, publication-ready multi-page PDF evaluation dossiers for hiring managers and stakeholders.
* **Offer Management**: Draft, configure, and issue formal employment offers with customized compensation, benefits, and start dates.
* **Recruiter Settings & Notifications**: Notification center and company profile settings including custom branding and logo uploads.

### Administrative Monitoring
* **Administrative Monitoring**: System-wide operational dashboards tracking user registrations, active sessions, and database entity counts.
* **System Statistics**: Metric aggregation measuring platform throughput, assessment completion rates, and average scoring curves.
* **User & Role Management**: Administrative visibility across candidate, recruiter, and administrator user accounts.

---

## AI Capabilities

SmartHire AI incorporates a multi-tiered artificial intelligence and machine learning pipeline:

* **Adaptive Question Generation**: Dynamically drafts contextual interview questions tailored to the candidate's declared target role, experience level, and responses to previous questions.
* **Evidence-Based Answer Scoring**: Scores candidate responses across four standard industry dimensions:
  * *Technical Depth & Correctness* (0–100)
  * *Communication & Articulation* (0–100)
  * *Confidence & Composure* (0–100)
  * *Professionalism & Problem Solving* (0–100)
* **Speech & Acoustic Analytics**: Measures pacing, pause durations, and verbal fluency to highlight communicative strengths and areas for improvement.
* **Behavioral & Visual Analysis**: Custom neural networks and computer vision models analyze facial engagement, head-pose consistency, and gaze vectors during video interviews.
* **Multi-Provider AI Fallback Engine**: A resilient, load-balanced model gateway supporting Google Gemini, Groq, and OpenRouter. In the event of rate limits, latency spikes, or provider downtime, the system automatically rotates through configured API keys and falls back to alternate models without disrupting the candidate's session.

---

## Interview Architecture

SmartHire enforces a deterministic, strictly tracked interview lifecycle:

```
Candidate
   └──> Job Application
           └──> Scheduled Interview
                   └──> Interview Session
                           ├──> Dynamic Questions
                           ├──> Spoken / Written Answers
                           ├──> Real-Time Transcript
                           ├──> Multi-Modal Telemetry (Gaze, Voice, Integrity)
                           ├──> Session Video Recording
                           └──> AI Evaluation & Scoring Report
```

Every interview recording, transcript segment, and evaluation metric is cryptographically and relationally bound to its specific `session_id` and authorized `candidate_id`, preventing cross-session leakage or improper data binding.

---

## Security & Recording Isolation

* **JSON Web Token (JWT) Cryptography**: Stateless token authentication utilizing cryptographic signatures (HS256) with configurable access and refresh expirations.
* **Role-Based Access Control (RBAC)**: Enforced endpoint-level authorization separating Candidate, Recruiter, and Admin operations.
* **Candidate Ownership Validation & IDOR Prevention**: Every interaction with application data, interview sessions, transcripts, and evaluation dossiers strictly verifies resource ownership against the authenticated user ID.
* **Deterministic Recording Isolation**: Video and audio recording artifacts are saved in isolated directories structured by candidate and session identifiers (`/uploads/recordings/{candidate_id}/{session_id}/`). Unsafe directory scanning, global array indexing, and ambiguous path matching are strictly prohibited.
* **Authenticated Media Streaming**: Video and audio playback endpoints support HTTP 206 Partial Content (range requests) and require Bearer token authorization; unauthenticated access is rejected.
* **Path Traversal Protection**: File storage managers sanitize all path inputs against directory traversal vulnerabilities (`../`).
* **Environment-Driven Credential Management**: Database credentials, encryption keys, and external API tokens are managed exclusively through external environment variables.
* **Network Boundary Protection**: Database and Redis caches reside in internal application networks with strict access control.

---

## Tech Stack

### Frontend
* **Core Framework**: React 18 with TypeScript
* **Build System**: Vite
* **Styling**: TailwindCSS, Vanilla CSS tokens, PostCSS, Lucide Icons
* **Rich Components**: Monaco Editor (`@monaco-editor/react`), Recharts, Canvas-based gauge and spline visualizations
* **Machine Learning & Proctoring**: TensorFlow.js, COCO-SSD

### Backend
* **Web Framework**: FastAPI (Python 3.10+) with Uvicorn / Starlette
* **Asynchronous ORM**: SQLAlchemy 2.0 (Async Engine) with Alembic migration patterns
* **Relational Database**: PostgreSQL 18 (with SQLite support for lightweight development)
* **Caching & Broker**: Redis 7
* **PDF Synthesis**: ReportLab Enterprise Engine
* **Machine Learning**: PyTorch, Torchvision, Pillow, NumPy

### Infrastructure & Deployment
* **Containerization**: Docker, Docker Compose
* **Web Server & Reverse Proxy**: Nginx (Alpine-based production image)

---

## Architecture Diagram

```
+-----------------------------------------------------------------------------+
|                                CLIENT LAYER                                 |
|                                                                             |
|      +-------------------------+            +-------------------------+     |
|      |    Candidate Portal     |            |  Recruiter Command Ctr  |     |
|      |   (React 18 / Vite / TS)|            |  (React 18 / Vite / TS) |     |
|      +------------+------------+            +------------+------------+     |
+-------------------|--------------------------------------|------------------+
                    | HTTPS / WSS                          | HTTPS
+-------------------|--------------------------------------|------------------+
|                   v                                      v                  |
|                             NGINX REVERSE PROXY                             |
|                           (Port 3001 / Port 80)                             |
+-------------------|--------------------------------------|------------------+
                    |                                      |
                    +------------------+-------------------+
                                       |
                                       v
+-----------------------------------------------------------------------------+
|                                BACKEND LAYER                                |
|                                                                             |
|                   FastAPI Enterprise Gateway (Port 8000)                    |
|                                                                             |
|  +-----------------------------------------------------------------------+  |
|  | Routers: /auth, /interview, /recruiter, /jobs, /uploads, /analytics  |  |
|  +-----------------------------------------------------------------------+  |
|  | Core Services:                                                        |  |
|  |   - Multi-LLM Provider Engine (Gemini / Groq / OpenRouter)           |  |
|  |   - Behavioral Vision Engine (PyTorch SmartHireBehaviorCNN)          |  |
|  |   - Acoustic & Speech Analysis (Whisper & Speech Metrics)            |  |
|  |   - Anti-Cheating Integrity Engine & Proctoring Auditor              |  |
|  |   - ReportLab Enterprise PDF Synthesis Engine                        |  |
|  |   - Storage Service (Isolated Session Storage & Range Streaming)     |  |
|  +-----------------------------------------------------------------------+  |
+--------------------------------------|--------------------------------------+
                                       |
        +------------------------------+------------------------------+
        |                                                             |
        v                                                             v
+--------------------------------+           +--------------------------------+
|       PERSISTENCE LAYER        |           |        CACHING & MEDIA         |
|                                |           |                                |
|   PostgreSQL 18 Database       |           |   Redis 7 In-Memory Cache      |
|   (Relational Data, Users,     |           |   (Token Blacklists, Events)   |
|    Applications, Reports)      |           |                                |
|                                |           |   Isolated File Volume         |
|                                |           |   (Session Recordings, PDFs)   |
+--------------------------------+           +--------------------------------+
```

---

## Environment Variables

Configure your local or production environment by creating a `.env` file from the provided template:

```bash
cp .env.example .env
```

Ensure all placeholder values in `.env` are updated with your credentials:

```ini
# Core Environment
ENVIRONMENT=development
PROJECT_NAME="SmartHire AI Engine"
VERSION="1.0.0"

# Application Security
SECRET_KEY=<generate-a-strong-64-character-secret>
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440

# PostgreSQL Database Configuration
USE_SQLITE=false
POSTGRES_SERVER=postgres
POSTGRES_PORT=5432
POSTGRES_USER=postgres
POSTGRES_PASSWORD=<your-secure-postgres-password>
POSTGRES_DB=smarthire_db

# Redis
REDIS_HOST=redis
REDIS_PORT=6379

# Domains & CORS
FRONTEND_URL=http://localhost:3001
CORS_ORIGINS=http://localhost:3001

# AI Provider API Keys (Configure at least one)
GEMINI_API_KEY_1=<your-gemini-api-key>
GEMINI_MODEL=gemini-2.5-flash
GROQ_API_KEY_1=<your-groq-api-key>
GROQ_MODEL=llama-3.3-70b-versatile
OPENROUTER_API_KEY_1=<your-openrouter-api-key>
OPENROUTER_MODEL=meta-llama/llama-3.3-70b-instruct

# OAuth & Email (Optional)
GOOGLE_CLIENT_ID=<your-google-client-id>
GOOGLE_CLIENT_SECRET=<your-google-client-secret>
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=<your-email-address>
SMTP_PASSWORD=<your-smtp-app-password>
```

---

## Docker Setup

Run the entire platform with Docker Compose:

```bash
# 1. Build and start all containers
docker compose up --build -d

# 2. Check container status
docker compose ps

# 3. View backend logs
docker compose logs -f backend
```

Exposed service endpoints:
* **Frontend Application**: `http://localhost:3001`
* **FastAPI Backend & Swagger**: `http://localhost:8000/docs`
* **pgAdmin 4**: `http://localhost:5050`
* **PostgreSQL Database**: `localhost:5432`
* **Redis Cache**: `localhost:6379`

---

## Database

SmartHire AI uses an asynchronous SQLAlchemy ORM layer targeting PostgreSQL 18 (with automatic fallback to SQLite for local development when `USE_SQLITE=true`).

* **Dynamic Schema Migration**: The backend includes automated schema synchronization (`backend/ensure_db_schema.py` and `backend/app/core/migrations.py`) executed on application startup to ensure all tables, relationships, and indexes are up to date.
* **Manual Schema Verification**:
  ```bash
  cd backend
  python ensure_db_schema.py
  ```

---

## Running Locally

### Backend Service
```bash
cd backend

# Create and activate virtual environment
python -m venv venv

# Windows (PowerShell):
.\venv\Scripts\Activate.ps1
# Linux / macOS:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start development server
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### Frontend Service
```bash
cd frontend

# Install Node dependencies
npm install

# Start Vite dev server
npm run dev
```

---

## Testing & Verification

SmartHire features comprehensive automated test suites covering API contracts, RBAC authorization, scoring engines, PDF generation, and full interview workflows:

```bash
cd backend

# Run the primary test suite
pytest tests/test_api.py -v

# Run RBAC and authorization verification
pytest tests/test_rbac_and_idor.py -v

# Run scoring engine and resume parsing stress tests
pytest tests/test_scoring_and_resume_stress.py -v

# Run PDF report generation stress tests
pytest tests/test_pdf_stress.py -v

# Verify frontend production build
cd ../frontend
npm run build
```

---

## Production Deployment

SmartHire AI is packaged for deployment using Docker and container orchestration platforms (e.g., AWS ECS, DigitalOcean App Platform, Kubernetes, or self-hosted Docker hosts):

1. **Reverse Proxy Configuration**: Nginx is configured in `frontend/nginx.conf` to serve pre-built static assets, route `/api/v1` to the backend upstream, and proxy WebSocket connections (`/ws/`) with HTTP/1.1 upgrade headers.
2. **Persistent Storage Volumes**: Mount dedicated volumes for `postgres_data` and uploaded media (`/app/static/uploads`) to ensure persistence across container updates.
3. **Zero Secrets in Images**: Docker images contain only application code and pre-trained weights; all sensitive configurations and keys are injected at runtime via environment variables.

---

## Project Structure

```
SmartHire/
├── .env.example                          # Environment variable template
├── .gitignore                            # Comprehensive git exclusion rules
├── docker-compose.yml                    # Multi-container orchestration
├── README.md                             # Repository documentation
├── backend/
│   ├── app/
│   │   ├── api/v1/                       # REST and WebSocket endpoints
│   │   │   ├── admin.py                  # Administrative statistics
│   │   │   ├── analytics.py              # Candidate & recruiter analytics
│   │   │   ├── aptitude.py               # Practice assessments
│   │   │   ├── auth.py                   # Authentication & token endpoints
│   │   │   ├── interview.py              # Live interview lifecycle
│   │   │   ├── jobs.py                   # Requisition management
│   │   │   ├── notifications.py          # Real-time user notifications
│   │   │   ├── recruiter.py              # Hiring pipeline & candidates
│   │   │   ├── resume.py                 # Resume parsing
│   │   │   ├── scheduling.py             # Interview invitations & calendar
│   │   │   ├── uploads.py                # Uploads, recordings & streaming
│   │   │   └── users.py                  # User profiles
│   │   ├── core/                         # Configuration, database & migrations
│   │   ├── models/domain.py              # SQLAlchemy domain entities
│   │   ├── schemas/domain.py             # Pydantic validation schemas
│   │   ├── services/                     # Business logic and AI services
│   │   │   ├── ai_engine.py              # Multi-LLM query and prompt pipeline
│   │   │   ├── ai_provider.py            # Provider pool & fallback manager
│   │   │   ├── analytics_service.py      # Analytics data aggregation
│   │   │   ├── emotion_service.py        # Facial emotion classification
│   │   │   ├── gaze_analyzer.py          # Eye gaze vector computation
│   │   │   ├── integrity_service.py      # Anti-cheating & proctoring log
│   │   │   ├── pdf_service.py            # ReportLab evaluation dossier engine
│   │   │   ├── scoring_engine.py         # Multi-metric scoring calculator
│   │   │   └── storage_service.py        # Isolated file & recording storage
│   │   └── main.py                       # FastAPI application entrypoint
│   ├── ml/                               # Behavioral CNN models & weights
│   ├── tests/                            # Automated pytest test suites
│   ├── requirements.txt                  # Python dependencies
│   └── ensure_db_schema.py               # Schema integrity verification script
└── frontend/
    ├── src/
    │   ├── components/                   # Modals, layout, and UI components
    │   ├── context/                      # Auth and WebSocket state providers
    │   ├── pages/                        # Candidate, Recruiter, and Admin pages
    │   ├── services/                     # Axios API client and IntegrityEngine
    │   ├── App.tsx                       # React router entrypoint
    │   └── index.css                     # Design system styles
    ├── package.json                      # Frontend dependencies
    └── vite.config.ts                    # Vite build configuration
```

---

## Future Improvements

* **Multi-Language Audio Transcription**: Extend speech-to-text fine-tuning to support multi-lingual technical interviews.
* **Granular Coding Sandboxes**: Integrate isolated Docker or WebAssembly containers for executing candidate submitted code in real time across 10+ programming languages.
* **Automated Calendar Integrations**: Add bidirectional synchronization with Google Calendar and Microsoft Outlook for recruiter interview schedules.
* **Custom Enterprise Rubric Builder**: Allow hiring organizations to define bespoke assessment weights, custom competencies, and tailored behavioral benchmarks.

---

## Disclaimer

SmartHire AI is a portfolio demonstration and technical evaluation project. Performance, latency, and analysis quality are subject to external AI provider availability, client browser camera and microphone permissions, hosting environment specifications, and third-party API rate quotas.
