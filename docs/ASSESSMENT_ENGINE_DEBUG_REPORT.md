# Assessment Engine Debug Report

## Root cause

The prior generator made only one Gemini request per topic. Any quota above that
single ten-question batch was filled by a fixed local template pool. This made
repeated attempts predictably similar, and no dedicated candidate question ledger
existed to enforce cross-attempt exclusions.

## Changes made

- Replaced the assessment generator with a Gemini-only, batched pipeline. It
  validates every response, retries invalid or similar batches, and fails clearly
  with HTTP 503 rather than inserting fallback/template questions.
- Added balanced deterministic topic quotas (for example 40 questions across
  React, JavaScript, and Node becomes 14, 13, and 13 in selected-topic order).
- Added `assessment_question_history`, which stores the candidate, session,
  question reference, SHA-256 normalized-question fingerprint, topic,
  difficulty, generation time, and attempt number. Question text/options/correct
  answer/explanation remain stored on `assessment_questions`.
- Added exact fingerprint exclusion plus 70% lexical/sequence-similarity
  rejection against every prior question for the candidate and the current paper.
  Legacy assessment questions are also included until they have corresponding
  history rows.
- Added API validation for the supported counts (10, 20, 30, 40, 50, 75, 100)
  and durations from 5 through 180 minutes.
- Added a custom-duration input to the Practice Assessment configuration; the
  preset durations remain available, including 180 minutes.
- Added `aiosqlite` as the missing SQLite async runtime/test dependency.

## APIs and files

- `POST /api/v1/aptitude/start` now rejects unsupported counts and durations,
  persists a session in `generating` status, and returns HTTP 503 if Gemini cannot
  deliver a complete unique paper.
- `backend/app/services/assessment_service.py` owns Gemini batching, validation,
  uniqueness enforcement, storage, and scoring.
- `backend/app/models/domain.py` defines the durable history table.
- `frontend/src/pages/practice/PracticeHubPage.tsx` exposes custom duration.

## Gemini prompt strategy

Every batch tells Gemini the selected topic, difficulty, generation pass, desired
count, required response schema, question-type variation, and a recent exclusion
excerpt. The server is authoritative: it validates the complete candidate history
and rejects anything at or above 70% similarity before persistence.

## Verification

`python -m pytest app/tests/test_assessment_engine.py -q` completed successfully:

- 10 tests passed.
- Three consecutive 20-question React attempts had zero question pairs at or
  above the 70% duplicate threshold (0% overlap, below the required 5%).
- The candidate ledger contained all 60 generated questions.
- A 100-question, 180-minute assessment completed in ten Gemini batches.
