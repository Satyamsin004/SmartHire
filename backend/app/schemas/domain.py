from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Dict, Any
from datetime import datetime

# --- Auth Schemas ---
class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(..., description="Min 8 chars, uppercase, lowercase, number, special char")
    full_name: str
    role: str = "candidate" # candidate, recruiter, admin

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    user: Dict[str, Any]
    tokens: Dict[str, Any]

class RefreshTokenRequest(BaseModel):
    refresh_token: str

class EmailVerifyRequest(BaseModel):
    token: str

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(..., description="Min 8 chars, uppercase, lowercase, number, special char")

class GoogleOAuthRequest(BaseModel):
    email: EmailStr
    full_name: str
    profile_image: Optional[str] = None
    role: Optional[str] = "candidate"

# --- Candidate Schemas ---
class CandidateProfileResponse(BaseModel):
    id: str
    user_id: str
    full_name: str
    email: str
    role: str
    profile_image: Optional[str] = None
    target_role: Optional[str] = None
    experience_level: Optional[str] = None
    total_interviews: int = 0
    avg_score: Optional[float] = None
    readiness_score: Optional[float] = None
    streak_days: int = 0
    status: Optional[str] = "Registered"

# --- Resume & JD Matching Schemas ---
class ResumeParseResponse(BaseModel):
    id: str
    file_name: str
    ats_score: float
    summary: str
    skills: List[Dict[str, str]]
    keyword_density: Dict[str, int]
    missing_skills: List[str]

class JDMatchRequest(BaseModel):
    job_title: str
    job_description: str
    resume_id: Optional[str] = None

class JDMatchResponse(BaseModel):
    match_percentage: float
    fit_score: str
    matching_skills: List[str]
    missing_skills: List[str]
    recommended_learning: List[str]
    expected_salary_range: str

# --- Interview Engine Schemas ---
class StartInterviewRequest(BaseModel):
    schedule_id: Optional[str] = None
    role_target: str = "Frontend System Design"
    round_type: str = "Technical" # HR, Technical, Behavioral, Aptitude, Coding
    difficulty: str = "Medium"
    resume_id: Optional[str] = None
    job_description_id: Optional[str] = None
    resume_text: Optional[str] = None
    parsed_resume: Optional[Dict[str, Any]] = None
    duration_minutes: Optional[int] = 10
    language: Optional[str] = "English"


class QuestionResponse(BaseModel):
    question_id: str
    session_id: str
    order_index: int
    question_text: str
    category: str
    difficulty: str
    is_followup: bool

class SubmitAnswerRequest(BaseModel):
    question_id: str
    session_id: str
    transcript_text: str
    speech_duration_seconds: Optional[float] = 45.0
    elapsed_seconds: Optional[float] = None
    audio_telemetry: Optional[Dict[str, Any]] = None
    vision_telemetry: Optional[Dict[str, Any]] = None

class AnswerEvaluationResponse(BaseModel):
    answer_id: str
    speaking_pace_wpm: float
    filler_word_count: int
    filler_words: List[str]
    eye_contact_percentage: float
    confidence_percentage: float
    dominant_emotion: str
    evaluation_feedback: Optional[str] = "Good explanation! Let's move to the next question."
    interviewer_remark: Optional[str] = "Good explanation! Let's move to the next question."
    next_question: Optional[QuestionResponse] = None

# --- Scoring & Report Schemas ---
class ScoringReportResponse(BaseModel):
    id: str
    session_id: str
    communication_score: float
    confidence_score: float
    technical_score: float
    professionalism_score: float
    grammar_score: Optional[float] = 85.0
    problem_solving_score: Optional[float] = 84.0
    behavior_score: Optional[float] = 82.0
    leadership_score: Optional[float] = 78.0
    overall_score: float
    recommendation: Optional[str] = "Shortlist"
    overall_summary: Optional[str] = None
    technical_analysis: Optional[str] = None
    communication_analysis: Optional[str] = None
    behavioral_analysis: Optional[str] = None
    grammar_analysis: Optional[str] = None
    confidence_analysis: Optional[str] = None
    strengths: List[str]
    weaknesses: List[str]
    improvement_plan: List[str]
    learning_resources: Optional[List[str]] = []
    rating_rubric: str

# --- Code Execution Schemas ---
class CodeRunRequest(BaseModel):
    language: str # python, javascript, cpp, java
    code: str
    problem_id: Optional[str] = "two-sum"

class CodeRunResponse(BaseModel):
    passed: bool
    passed_test_cases: int
    total_test_cases: int
    execution_time_ms: float
    memory_mb: float
    output: str
    error: Optional[str] = None

# --- Recruiter & Admin Schemas ---
class RecruiterTemplateCreate(BaseModel):
    title: str
    domain: str
    difficulty: str
    rounds: List[str]

class AdminAnalyticsResponse(BaseModel):
    total_users: int
    active_candidates: int
    total_interviews: int
    system_health: str
    api_latencies: Dict[str, float]
