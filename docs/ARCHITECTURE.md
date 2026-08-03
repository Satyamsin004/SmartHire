# SmartHire AI System Architecture & Micro-Services Specification

## Architecture Overview

SmartHire AI is engineered as a decoupled micro-service platform designed for high concurrency, low latency video/audio inference processing, and robust dynamic evaluation.

```
+-------------------------------------------------------------------------------+
|                               FRONTEND CLIENT                                 |
|          React 19 + TypeScript + Vite + TailwindCSS + Monaco Editor           |
+-------------------------------------------------------------------------------+
                                      |
                             REST / WebSockets
                                      v
+-------------------------------------------------------------------------------+
|                           FASTAPI API GATEWAY                                 |
|            Async Endpoints, OpenAPI Docs, JWT Auth, RBAC Middleware           |
+-------------------------------------------------------------------------------+
       |                         |                        |
       v                         v                        v
+---------------+        +---------------+        +---------------+
|  PostgreSQL   |        | Redis Cache   |        |  Celery Task  |
|  (SQLAlchemy) |        |  & Sessions   |        |   Queue       |
+---------------+        +---------------+        +---------------+
                                                          |
                                                          v
                                                  +---------------+
                                                  |  AI Engine    |
                                                  | GPT / Whisper |
                                                  | MediaPipe /   |
                                                  | FAISS Vector  |
                                                  +---------------+
```

## System Modules

1. **Authentication & Authorization Module**:
   - OAuth2 Password Flow with Bcrypt password hashing.
   - Dual Token model: 24-hour Access JWT Token + 7-day Refresh Token.
   - Role-Based Access Control (RBAC): Candidate, Recruiter, Admin.

2. **AI Dynamic Question Generation Engine**:
   - Contextual prompt chain maintaining previous candidate answers.
   - Step-up / Step-down adaptive difficulty algorithm (Easy -> Medium -> Hard).
   - FAISS vector embedding index of company docs and JDs for semantic RAG question generation.

3. **Vision Telemetry & Emotion Processing**:
   - Client-side MediaPipe FaceMesh keypoint tracking.
   - Iris center offset tracking for eye contact ratio (Target: >= 90%).
   - Facial landmark movement monitoring for blink rate and DeepFace emotion classification.

4. **Speech-to-Text & Communication Analysis**:
   - OpenAI Whisper ASR audio processing.
   - WPM calculation (Optimal range: 130 - 165 WPM).
   - Filler word parser (`um`, `uh`, `like`, `you know`, `so`).
   - Sentence structure & grammar quality score.

5. **Code Execution Sandbox**:
   - Isolated execution environment for Python, JavaScript, C++, and Java.
   - Standard output capture, execution timer, and test case assertion verification.
