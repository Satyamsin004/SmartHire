# SmartHire AI - AI-Powered Mock Interview & Candidate Assessment Platform

SmartHire AI is an enterprise-grade AI-powered mock interview and candidate assessment platform designed for Candidates, Recruiters, and Admins.

![SmartHire AI Architecture](./docs/architecture.png)

## Features & Highlights

- **Candidate Portal**:
  - Interactive AI Mock Interviews (HR, Technical, Behavioral, Aptitude, Coding)
  - Live webcam vision telemetry (MediaPipe face mesh, eye-contact monitoring, blink rate, emotion analysis)
  - Microphone speech-to-text (Whisper ASR, WPM speaking pace, filler word counter, grammar evaluator)
  - Monaco Code Editor Sandbox (Python, JS, C++, Java execution)
  - Aptitude MCQ practice engine with negative marking (-0.25)
  - Resume PDF parsing & ATS Score calculation
  - Job Description Matcher (Match %, Missing Skills, Recommended Learning, Salary Range)
  - Circular readiness ring & weekly score trend graphs (matching design reference)

- **Recruiter Portal**:
  - Candidate comparison matrix (Overall score, Comm 30%, Conf 25%, Tech 30%, Prof 15%, ATS Match)
  - Talent hiring funnel tracking
  - Custom interview template builder

- **Admin Portal**:
  - System health monitoring (PostgreSQL, Redis, AI model status)
  - API latencies telemetry (Whisper ASR, Vision Mesh, Scoring Engine)
  - ELK & Prometheus action logs viewer

---

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite, TailwindCSS, Recharts, Monaco Editor, Lucide Icons, Axios.
- **Backend**: FastAPI, Python 3.11+, SQLAlchemy 2.0 (Async), PostgreSQL, Redis, Celery, JWT + Refresh Tokens, OAuth.
- **AI & ML**: OpenAI GPT-4o, Whisper ASR, MediaPipe FaceMesh, DeepFace, SentenceTransformers, FAISS RAG.
- **DevOps**: Docker, Docker Compose, Nginx, GitHub Actions CI/CD, Prometheus, ELK Stack.

---

## Quick Start (Docker Compose)

```bash
# Clone and enter project directory
git clone https://github.com/smarthire/smarthire-ai.git
cd hiringproject

# Build and start all services via Docker Compose
docker-compose up --build -d
```

Frontend accessible at: `http://localhost:3000`  
Backend API Documentation accessible at: `http://localhost:8000/api/v1/docs`

---

## Scoring Formula

The platform computes scores according to the strict weighted formula:
```
Overall Score = (Communication * 0.30) + (Confidence * 0.25) + (Technical * 0.30) + (Professionalism * 0.15)
```
Rubric:
- 90 - 100 : Excellent
- 75 - 89 : Good
- 60 - 74 : Average
- 40 - 59 : Needs Improvement
- Below 40 : Poor

---

## License
Commercial Startup Ready License © 2026 SmartHire AI Inc.
