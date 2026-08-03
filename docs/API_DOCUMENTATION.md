# SmartHire AI REST API Documentation

Swagger OpenAPI Docs accessible at `/api/v1/docs` when server is running.

## Authentication (`/api/v1/auth`)

- `POST /register`: Registers new user (Candidate, Recruiter, or Admin). Returns JWT access and refresh tokens.
- `POST /login`: Authenticates email and password. Returns tokens.
- `POST /refresh`: Issues new access token from refresh token.
- `POST /google`: OAuth Google login endpoint.

## Candidate & Resume (`/api/v1/resume`)

- `POST /parse`: Upload PDF resume. Returns extracted skills, ATS score, summary, and missing skills.
- `POST /match-jd`: Match resume skills against target job description. Returns match percentage and salary estimation.

## AI Interview Engine (`/api/v1/interview`)

- `POST /start`: Initializes dynamic AI mock interview session. Returns first AI generated question.
- `POST /submit-answer`: Submits candidate audio transcript & vision telemetry. Returns filler word analysis, WPM, and next question (or adaptive follow-up).
- `GET /report/{session_id}`: Retrieves complete weighted evaluation report.

## Code Sandbox (`/api/v1/coding`)

- `POST /run`: Executes code submission in Python, JS, C++, or Java against test cases. Returns execution time and test results.

## Recruiter & Admin (`/api/v1/recruiter`, `/api/v1/admin`)

- `GET /recruiter/candidates/compare`: Retrieves candidate comparison matrix.
- `GET /admin/dashboard-analytics`: Retrieves system health, active AI models, and ELK log telemetry.
