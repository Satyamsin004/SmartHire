# PostgreSQL Database Schema & ERD Documentation

## Database Schema Diagram

```mermaid
erDiagram
    users ||--o{ candidates : "has"
    users ||--o{ recruiters : "has"
    users ||--o{ admins : "has"
    candidates ||--o{ resumes : "uploads"
    resumes ||--o{ resume_skills : "contains"
    candidates ||--o{ interview_sessions : "attends"
    recruiters ||--o{ job_descriptions : "creates"
    recruiters ||--o{ interview_templates : "creates"
    interview_sessions ||--o{ interview_questions : "includes"
    interview_questions ||--|| interview_answers : "receives"
    interview_answers ||--|| speech_analysis : "analyzes"
    interview_answers ||--|| eye_tracking : "monitors"
    interview_answers ||--|| emotion_analysis : "evaluates"
    interview_sessions ||--|| scoring_reports : "generates"
```

## Entity Details

- **users**: Primary user account table with role ENUM (`candidate`, `recruiter`, `admin`).
- **candidates**: Stores readiness score, streak days, total interviews, target role.
- **resumes**: Stores ATS score, summary, keyword density JSON, missing skills.
- **interview_sessions**: Represents a full mock interview instance.
- **interview_questions**: Questions generated dynamically by AI engine.
- **interview_answers**: Transcripts, audio references, coding submissions.
- **speech_analysis**: WPM, filler word count, filler word list, grammar score.
- **eye_tracking**: Eye contact percentage, blink rate, attention score.
- **emotion_analysis**: Dominant emotion, confidence percentage, stress level.
- **scoring_reports**: 30-25-30-15 weighted score breakdown and improvement plan.
