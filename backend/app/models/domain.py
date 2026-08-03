import uuid
from datetime import datetime
from sqlalchemy import (
    Column, String, Boolean, DateTime, Integer, Float, ForeignKey, JSON, Enum, Text
)
from sqlalchemy.orm import relationship
from app.core.db import Base
import enum

class UserRole(str, enum.Enum):
    CANDIDATE = "candidate"
    RECRUITER = "recruiter"
    ADMIN = "admin"

class RoundType(str, enum.Enum):
    HR = "HR"
    TECHNICAL = "Technical"
    BEHAVIORAL = "Behavioral"
    APTITUDE = "Aptitude"
    CODING = "Coding"

class DifficultyLevel(str, enum.Enum):
    EASY = "Easy"
    MEDIUM = "Medium"
    HARD = "Hard"

class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    role = Column(String(50), default="candidate", index=True, nullable=False)
    provider = Column(String(50), default="local", index=True, nullable=False)
    is_verified = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    profile_image = Column(String(500), nullable=True)
    phone_number = Column(String(50), nullable=True)
    last_login = Column(DateTime, nullable=True)
    is_test_data = Column(Boolean, default=False, index=True)
    environment = Column(String(50), default="PRODUCTION", index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime, nullable=True)

    candidate_profile = relationship("Candidate", back_populates="user", uselist=False)
    recruiter_profile = relationship("Recruiter", back_populates="user", uselist=False)
    admin_profile = relationship("Admin", back_populates="user", uselist=False)

class Candidate(Base):
    __tablename__ = "candidates"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id"), unique=True, nullable=False)
    phone = Column(String(50), nullable=True)
    bio = Column(Text, nullable=True)
    target_role = Column(String(100), nullable=True)
    experience_level = Column(String(50), nullable=True)
    total_interviews = Column(Integer, default=0)
    avg_score = Column(Float, nullable=True)
    readiness_score = Column(Float, nullable=True)
    streak_days = Column(Integer, default=0)
    status = Column(String(50), default="Registered")
    recruiter_notes = Column(Text, nullable=True)
    rating = Column(Float, nullable=True)
    is_test_data = Column(Boolean, default=False, index=True)
    environment = Column(String(50), default="PRODUCTION", index=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="candidate_profile")
    resumes = relationship("Resume", back_populates="candidate")
    sessions = relationship("InterviewSession", back_populates="candidate")
    achievements = relationship("Achievement", back_populates="candidate")
    resume_views = relationship("ResumeView", back_populates="candidate")

class Recruiter(Base):
    __tablename__ = "recruiters"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id"), unique=True, nullable=False)
    company_name = Column(String(255), default="Acme Corp")
    company_domain = Column(String(255), default="acme.com")
    subscription_tier = Column(String(50), default="Enterprise")
    is_test_data = Column(Boolean, default=False, index=True)
    environment = Column(String(50), default="PRODUCTION", index=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="recruiter_profile")
    job_descriptions = relationship("JobDescription", back_populates="recruiter")
    templates = relationship("InterviewTemplate", back_populates="recruiter")

class Admin(Base):
    __tablename__ = "admins"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id"), unique=True, nullable=False)
    permissions = Column(JSON, default=lambda: ["manage_users", "manage_ai", "view_logs"])
    is_test_data = Column(Boolean, default=False, index=True)
    environment = Column(String(50), default="PRODUCTION", index=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="admin_profile")

class Resume(Base):
    __tablename__ = "resumes"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    candidate_id = Column(String(36), ForeignKey("candidates.id"), nullable=False)
    file_name = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=True)
    raw_text = Column(Text, nullable=True)
    summary = Column(Text, nullable=True)
    ats_score = Column(Float, nullable=True)
    keyword_density = Column(JSON, default=dict)
    missing_skills = Column(JSON, default=list)
    projects = Column(JSON, default=list)
    certifications = Column(JSON, default=list)
    languages = Column(JSON, default=list)
    experience_years = Column(String(50), nullable=True)
    education_level = Column(String(100), nullable=True)
    version = Column(Integer, default=1)
    is_test_data = Column(Boolean, default=False, index=True)
    environment = Column(String(50), default="PRODUCTION", index=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    candidate = relationship("Candidate", back_populates="resumes")
    skills = relationship("ResumeSkill", back_populates="resume", cascade="all, delete-orphan")

class ResumeSkill(Base):
    __tablename__ = "resume_skills"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    resume_id = Column(String(36), ForeignKey("resumes.id"), nullable=False)
    skill_name = Column(String(100), nullable=False)
    category = Column(String(50), default="Technical") # Technical, Soft, Tool
    proficiency = Column(String(50), default="Expert")

    resume = relationship("Resume", back_populates="skills")

class JobDescription(Base):
    __tablename__ = "job_descriptions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    recruiter_id = Column(String(36), ForeignKey("recruiters.id"), nullable=False)
    title = Column(String(255), nullable=False)
    department = Column(String(100), default="Engineering")
    description = Column(Text, nullable=False)
    required_skills = Column(JSON, default=lambda: ["React", "TypeScript", "FastAPI", "PostgreSQL", "Docker"])
    expected_experience = Column(String(50), default="3-5 Years")
    is_test_data = Column(Boolean, default=False, index=True)
    environment = Column(String(50), default="PRODUCTION", index=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    recruiter = relationship("Recruiter", back_populates="job_descriptions")

class SavedJob(Base):
    __tablename__ = "saved_jobs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    candidate_id = Column(String(36), ForeignKey("candidates.id"), nullable=False)
    job_id = Column(String(36), ForeignKey("job_postings.id"), nullable=False)
    is_test_data = Column(Boolean, default=False, index=True)
    environment = Column(String(50), default="PRODUCTION", index=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class InterviewTemplate(Base):
    __tablename__ = "interview_templates"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    recruiter_id = Column(String(36), ForeignKey("recruiters.id"), nullable=False)
    title = Column(String(255), nullable=False)
    domain = Column(String(100), default="Frontend System Design")
    difficulty = Column(String(50), default="Medium")
    rounds = Column(JSON, default=lambda: ["HR", "Technical", "Behavioral", "Coding"])
    is_test_data = Column(Boolean, default=False, index=True)
    environment = Column(String(50), default="PRODUCTION", index=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    recruiter = relationship("Recruiter", back_populates="templates")

class InterviewSession(Base):
    __tablename__ = "interview_sessions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    candidate_id = Column(String(36), ForeignKey("candidates.id"), nullable=False)
    recruiter_id = Column(String(36), ForeignKey("recruiters.id"), nullable=True)
    job_application_id = Column(String(36), ForeignKey("job_applications.id"), nullable=True)
    job_id = Column(String(36), ForeignKey("job_postings.id"), nullable=True)
    resume_id = Column(String(36), ForeignKey("resumes.id"), nullable=True)
    scheduled_interview_id = Column(String(36), ForeignKey("scheduled_interviews.id"), nullable=True)
    template_id = Column(String(36), ForeignKey("interview_templates.id"), nullable=True)
    title = Column(String(255), default="Frontend System Design Practice")
    role_target = Column(String(100), default="Senior Frontend Developer")
    round_type = Column(String(50), default="Technical")
    difficulty = Column(String(50), default="Medium")
    duration_minutes = Column(Integer, default=30)
    question_count = Column(Integer, default=6)
    interview_type = Column(String(50), default="Recruiter")
    config_json = Column(JSON, default=dict)
    status = Column(String(50), default="completed") # scheduled, active, completed
    is_test_data = Column(Boolean, default=False, index=True)
    environment = Column(String(50), default="PRODUCTION", index=True)
    started_at = Column(DateTime, default=datetime.utcnow)
    ended_at = Column(DateTime, default=datetime.utcnow)

    candidate = relationship("Candidate", back_populates="sessions")
    questions = relationship("InterviewQuestion", back_populates="session", cascade="all, delete-orphan")
    scoring_report = relationship("ScoringReport", back_populates="session", uselist=False)

class InterviewQuestion(Base):
    __tablename__ = "interview_questions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String(36), ForeignKey("interview_sessions.id"), nullable=False)
    order_index = Column(Integer, default=1)
    question_text = Column(Text, nullable=False)
    category = Column(String(50), default="System Design")
    difficulty = Column(String(50), default="Medium")
    expected_keywords = Column(JSON, default=lambda: ["Virtual DOM", "State Management", "SSR", "Optimization"])
    is_followup = Column(Boolean, default=False)
    is_test_data = Column(Boolean, default=False, index=True)
    environment = Column(String(50), default="PRODUCTION", index=True)

    session = relationship("InterviewSession", back_populates="questions")
    answer = relationship("InterviewAnswer", back_populates="question", uselist=False)

class InterviewAnswer(Base):
    __tablename__ = "interview_answers"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    question_id = Column(String(36), ForeignKey("interview_questions.id"), nullable=False)
    transcript_text = Column(Text, nullable=True)
    audio_url = Column(String(500), nullable=True)
    code_submission = Column(Text, nullable=True)
    execution_time_ms = Column(Float, nullable=True)
    passed_test_cases = Column(Integer, nullable=True)
    total_test_cases = Column(Integer, nullable=True)
    is_test_data = Column(Boolean, default=False, index=True)
    environment = Column(String(50), default="PRODUCTION", index=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    question = relationship("InterviewQuestion", back_populates="answer")
    speech_analysis = relationship("SpeechAnalysis", back_populates="answer", uselist=False)
    eye_tracking = relationship("EyeTracking", back_populates="answer", uselist=False)
    emotion_analysis = relationship("EmotionAnalysis", back_populates="answer", uselist=False)

class SpeechAnalysis(Base):
    __tablename__ = "speech_analysis"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    answer_id = Column(String(36), ForeignKey("interview_answers.id"), nullable=False)
    speaking_pace_wpm = Column(Float, default=145.0)
    filler_word_count = Column(Integer, default=3)
    filler_words = Column(JSON, default=lambda: ["um", "like", "you know"])
    grammar_score = Column(Float, default=92.0)
    vocabulary_richness = Column(Float, default=88.0)
    clarity_score = Column(Float, default=94.0)
    tone = Column(String(50), default="Confident & Professional")

    answer = relationship("InterviewAnswer", back_populates="speech_analysis")

class EyeTracking(Base):
    __tablename__ = "eye_tracking"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    answer_id = Column(String(36), ForeignKey("interview_answers.id"), nullable=False)
    eye_contact_percentage = Column(Float, default=91.5)
    blink_rate = Column(Float, default=14.2)
    attention_score = Column(Float, default=93.0)
    face_visibility_ratio = Column(Float, default=99.0)
    multiple_faces_detected = Column(Boolean, default=False)

    answer = relationship("InterviewAnswer", back_populates="eye_tracking")

class EmotionAnalysis(Base):
    __tablename__ = "emotion_analysis"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    answer_id = Column(String(36), ForeignKey("interview_answers.id"), nullable=False)
    dominant_emotion = Column(String(50), default="Focused / Calm")
    confidence_percentage = Column(Float, default=90.0)
    stress_level = Column(Float, default=12.0)
    smile_ratio = Column(Float, default=35.0)
    emotions_breakdown = Column(JSON, default=lambda: {"neutral": 0.7, "happy": 0.2, "surprised": 0.1})

    answer = relationship("InterviewAnswer", back_populates="emotion_analysis")

class ScoringReport(Base):
    __tablename__ = "scoring_reports"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String(36), ForeignKey("interview_sessions.id"), nullable=False)
    communication_score = Column(Float, default=88.0) # 30% weight
    confidence_score = Column(Float, default=90.0)    # 25% weight
    technical_score = Column(Float, default=82.0)     # 30% weight
    professionalism_score = Column(Float, default=85.0) # 15% weight
    grammar_score = Column(Float, default=90.0)
    problem_solving_score = Column(Float, default=85.0)
    overall_score = Column(Float, default=86.15)      # Comm*0.3 + Conf*0.25 + Tech*0.3 + Prof*0.15
    recommendation = Column(String(50), default="Shortlist")
    strengths = Column(JSON, default=lambda: ["Exceptional technical depth in system architecture", "Clear articulation without excessive filler words", "Maintained consistent eye contact throughout"])
    weaknesses = Column(JSON, default=lambda: ["Could detail GraphQL caching strategies further", "Slight hesitation during scenario questions"])
    improvement_plan = Column(JSON, default=lambda: ["Review Redis pub/sub patterns", "Practice micro-frontend architecture scenarios"])
    pdf_url = Column(String(500), nullable=True)
    is_test_data = Column(Boolean, default=False, index=True)
    environment = Column(String(50), default="PRODUCTION", index=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    session = relationship("InterviewSession", back_populates="scoring_report")

class Achievement(Base):
    __tablename__ = "achievements"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    candidate_id = Column(String(36), ForeignKey("candidates.id"), nullable=False)
    title = Column(String(100), nullable=False)
    description = Column(String(255), nullable=False)
    badge_icon = Column(String(100), default="Award")
    is_test_data = Column(Boolean, default=False, index=True)
    environment = Column(String(50), default="PRODUCTION", index=True)
    unlocked_at = Column(DateTime, default=datetime.utcnow)

    candidate = relationship("Candidate", back_populates="achievements")

class ActivityLog(Base):
    __tablename__ = "activity_logs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), nullable=True)
    action = Column(String(255), nullable=False)
    endpoint = Column(String(255), nullable=True)
    status_code = Column(Integer, default=200)
    latency_ms = Column(Float, default=45.2)
    is_test_data = Column(Boolean, default=False, index=True)
    environment = Column(String(50), default="PRODUCTION", index=True)
    timestamp = Column(DateTime, default=datetime.utcnow)

class ScheduledInterview(Base):
    __tablename__ = "scheduled_interviews"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    candidate_id = Column(String(36), ForeignKey("candidates.id"), nullable=False)
    recruiter_id = Column(String(36), ForeignKey("recruiters.id"), nullable=True)
    job_application_id = Column(String(36), ForeignKey("job_applications.id"), nullable=True)
    job_id = Column(String(36), ForeignKey("job_postings.id"), nullable=True)
    resume_id = Column(String(36), ForeignKey("resumes.id"), nullable=True)
    round_type = Column(String(50), default="Technical")
    scheduled_date = Column(DateTime, nullable=False, default=datetime.utcnow)
    duration_minutes = Column(Integer, default=30)
    difficulty = Column(String(50), default="Medium")
    question_count = Column(Integer, default=6)
    job_description_id = Column(String(36), ForeignKey("job_descriptions.id"), nullable=True)
    template_id = Column(String(36), ForeignKey("interview_templates.id"), nullable=True)
    instructions = Column(Text, nullable=True)
    config_json = Column(JSON, default=dict)
    status = Column(String(50), default="Scheduled") # Scheduled, Upcoming, In Progress, Completed, Cancelled, Expired
    session_id = Column(String(36), ForeignKey("interview_sessions.id"), nullable=True)
    is_test_data = Column(Boolean, default=False, index=True)
    environment = Column(String(50), default="PRODUCTION", index=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    notification_type = Column(String(50), default="interview_scheduled")
    is_read = Column(Boolean, default=False)
    is_test_data = Column(Boolean, default=False, index=True)
    environment = Column(String(50), default="PRODUCTION", index=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class JobPosting(Base):
    __tablename__ = "job_postings"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    recruiter_id = Column(String(36), ForeignKey("recruiters.id"), index=True, nullable=False)
    company_name = Column(String(255), default="SmartHire Corporate")
    company_logo = Column(String(500), nullable=True)
    title = Column(String(255), nullable=False)
    department = Column(String(100), default="Engineering")
    employment_type = Column(String(50), default="Full-Time") # Full Time, Part Time, Internship, Contract
    work_mode = Column(String(50), default="Remote") # Remote, Hybrid, On-site
    experience_required = Column(String(50), default="3-5 Years")
    location = Column(String(100), default="San Francisco, CA / Remote")
    salary_range = Column(String(100), default="$120,000 - $160,000")
    description = Column(Text, nullable=False)
    education_required = Column(String(255), nullable=True)
    required_skills = Column(JSON, default=lambda: ["React", "TypeScript", "FastAPI", "PostgreSQL"])
    preferred_skills = Column(JSON, default=lambda: ["Docker", "Kubernetes", "Redis", "System Design"])
    responsibilities = Column(Text, nullable=True)
    requirements = Column(Text, nullable=True)
    benefits = Column(Text, nullable=True)
    perks = Column(Text, nullable=True)
    openings = Column(Integer, default=2)
    selection_process = Column(Text, nullable=True)
    recruiter_contact = Column(String(100), nullable=True)
    recruiter_email = Column(String(255), nullable=True)
    recruiter_phone = Column(String(50), nullable=True)
    interview_rounds = Column(JSON, default=lambda: ["Resume Screening", "Technical Interview", "HR Round"])
    hiring_timeline = Column(String(100), nullable=True)
    status = Column(String(50), default="Published", index=True) # Published, Draft, Closed
    is_test_data = Column(Boolean, default=False, index=True)
    environment = Column(String(50), default="PRODUCTION", index=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    expiry_date = Column(DateTime, nullable=True)

class JobApplication(Base):
    __tablename__ = "job_applications"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    job_id = Column(String(36), ForeignKey("job_postings.id"), index=True, nullable=False)
    candidate_id = Column(String(36), ForeignKey("candidates.id"), index=True, nullable=False)
    resume_id = Column(String(36), ForeignKey("resumes.id"), nullable=True)
    cover_letter = Column(Text, nullable=True)
    phone = Column(String(50), nullable=True)
    address = Column(Text, nullable=True)
    linkedin_url = Column(String(500), nullable=True)
    github_url = Column(String(500), nullable=True)
    portfolio_url = Column(String(500), nullable=True)
    current_ctc = Column(String(50), nullable=True)
    expected_ctc = Column(String(50), nullable=True)
    expected_salary = Column(String(50), nullable=True)
    notice_period = Column(String(50), nullable=True)
    current_company = Column(String(100), nullable=True)
    work_authorization = Column(String(50), default="Authorized to work in US")
    availability = Column(String(100), nullable=True)
    declaration = Column(Boolean, default=True)
    ats_score = Column(Float, nullable=True)
    matching_skills = Column(JSON, default=list)
    missing_skills = Column(JSON, default=list)
    ai_recommendation = Column(String(50), default="Pending Review") # Shortlist, Maybe, Reject
    status = Column(String(50), default="Applied", index=True) # Applied, Screening Passed, Interview Scheduled, Evaluation Ready, Offer Sent, Hired, Rejected
    is_test_data = Column(Boolean, default=False, index=True)
    environment = Column(String(50), default="PRODUCTION", index=True)
    applied_at = Column(DateTime, default=datetime.utcnow, index=True)

class OfferLetter(Base):
    __tablename__ = "offer_letters"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    job_application_id = Column(String(36), ForeignKey("job_applications.id"), nullable=False)
    candidate_id = Column(String(36), ForeignKey("candidates.id"), nullable=False)
    recruiter_id = Column(String(36), ForeignKey("recruiters.id"), nullable=False)
    job_title = Column(String(255), nullable=False)
    salary_offered = Column(String(100), nullable=False)
    start_date = Column(DateTime, nullable=False)
    offer_letter_text = Column(Text, nullable=False)
    status = Column(String(50), default="Pending") # Pending, Accepted, Rejected
    is_test_data = Column(Boolean, default=False, index=True)
    environment = Column(String(50), default="PRODUCTION", index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    accepted_at = Column(DateTime, nullable=True)

class ResumeView(Base):
    __tablename__ = "resume_views"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    candidate_id = Column(String(36), ForeignKey("candidates.id"), index=True, nullable=False)
    recruiter_id = Column(String(36), ForeignKey("recruiters.id"), nullable=True)
    viewed_at = Column(DateTime, default=datetime.utcnow, index=True)
    is_test_data = Column(Boolean, default=False, index=True)
    environment = Column(String(50), default="PRODUCTION", index=True)

    candidate = relationship("Candidate", back_populates="resume_views")


