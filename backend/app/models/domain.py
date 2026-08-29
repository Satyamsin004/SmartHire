import uuid
from datetime import datetime
from sqlalchemy import (
    Column, String, Boolean, DateTime, Integer, Float, BigInteger, ForeignKey, JSON, Enum, Text, Index, UniqueConstraint
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
    headline = Column(String(255), nullable=True)
    location = Column(String(255), nullable=True)
    preferred_location = Column(String(255), nullable=True)
    expected_salary = Column(String(100), nullable=True)
    employment_preference = Column(String(100), nullable=True)
    work_authorization = Column(String(100), nullable=True)
    github_url = Column(String(500), nullable=True)
    linkedin_url = Column(String(500), nullable=True)
    portfolio_url = Column(String(500), nullable=True)
    languages = Column(JSON, nullable=True)
    interview_preferences = Column(JSON, default=dict)
    assessment_preferences = Column(JSON, default=dict)
    notification_settings = Column(JSON, default=dict)
    resume_url = Column(String(500), nullable=True)
    is_test_data = Column(Boolean, default=False, index=True)
    environment = Column(String(50), default="PRODUCTION", index=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="candidate_profile")
    resumes = relationship("Resume", back_populates="candidate")
    sessions = relationship("InterviewSession", back_populates="candidate")
    recordings = relationship("InterviewRecording", back_populates="candidate")
    transcripts = relationship("InterviewTranscript", back_populates="candidate")
    vision_analyses = relationship("InterviewVisionAnalysis", back_populates="candidate")
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
    objective = Column(Text, nullable=True)
    ats_score = Column(Float, nullable=True)
    keyword_density = Column(JSON, default=dict)
    missing_skills = Column(JSON, default=list)
    projects = Column(JSON, default=list)
    certifications = Column(JSON, default=list)
    languages = Column(JSON, default=list)
    experience_years = Column(String(50), nullable=True)
    education_level = Column(String(100), nullable=True)
    version = Column(Integer, default=1)
    is_active = Column(Boolean, default=True, index=True)
    is_test_data = Column(Boolean, default=False, index=True)
    environment = Column(String(50), default="PRODUCTION", index=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    candidate = relationship("Candidate", back_populates="resumes")
    skills = relationship("ResumeSkill", back_populates="resume", cascade="all, delete-orphan")
    educations = relationship("ResumeEducation", back_populates="resume", cascade="all, delete-orphan")
    experiences = relationship("ResumeExperience", back_populates="resume", cascade="all, delete-orphan")
    internships = relationship("ResumeInternship", back_populates="resume", cascade="all, delete-orphan")
    parsed_projects = relationship("ResumeProject", back_populates="resume", cascade="all, delete-orphan")
    parsed_certs = relationship("ResumeCertification", back_populates="resume", cascade="all, delete-orphan")
    parsed_achievements = relationship("ResumeAchievement", back_populates="resume", cascade="all, delete-orphan")
    parsed_languages = relationship("ResumeLanguage", back_populates="resume", cascade="all, delete-orphan")
    ats_record = relationship("ResumeATS", back_populates="resume", uselist=False, cascade="all, delete-orphan")

class ResumeSkill(Base):
    __tablename__ = "resume_skills"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    resume_id = Column(String(36), ForeignKey("resumes.id"), index=True, nullable=False)
    skill_name = Column(String(100), nullable=False)
    category = Column(String(50), default="Technical") # Technical, Soft, Tool, Language, Database, Cloud
    proficiency = Column(String(50), default="Expert")

    resume = relationship("Resume", back_populates="skills")

class ResumeEducation(Base):
    __tablename__ = "resume_educations"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    resume_id = Column(String(36), ForeignKey("resumes.id"), index=True, nullable=False)
    degree = Column(String(255), nullable=True)
    college = Column(String(255), nullable=True)
    university = Column(String(255), nullable=True)
    board = Column(String(255), nullable=True)
    cgpa = Column(String(50), nullable=True)
    percentage = Column(String(50), nullable=True)
    year = Column(String(50), nullable=True)
    branch = Column(String(100), nullable=True)
    specialization = Column(String(100), nullable=True)

    resume = relationship("Resume", back_populates="educations")

class ResumeExperience(Base):
    __tablename__ = "resume_experiences"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    resume_id = Column(String(36), ForeignKey("resumes.id"), nullable=False)
    company_name = Column(String(255), nullable=True)
    job_title = Column(String(255), nullable=True)
    employment_type = Column(String(100), default="Full-Time")
    location = Column(String(255), nullable=True)
    joining_date = Column(String(50), nullable=True)
    ending_date = Column(String(50), nullable=True)
    is_current = Column(Boolean, default=False)
    duration = Column(String(50), nullable=True)
    responsibilities = Column(JSON, default=list)
    achievements = Column(JSON, default=list)
    technologies = Column(JSON, default=list)
    projects_worked = Column(JSON, default=list)

    resume = relationship("Resume", back_populates="experiences")

class ResumeInternship(Base):
    __tablename__ = "resume_internships"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    resume_id = Column(String(36), ForeignKey("resumes.id"), nullable=False)
    company = Column(String(255), nullable=True)
    role = Column(String(255), nullable=True)
    duration = Column(String(100), nullable=True)
    description = Column(Text, nullable=True)
    skills_used = Column(JSON, default=list)
    projects = Column(JSON, default=list)
    technologies = Column(JSON, default=list)

    resume = relationship("Resume", back_populates="internships")

class ResumeProject(Base):
    __tablename__ = "resume_projects"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    resume_id = Column(String(36), ForeignKey("resumes.id"), nullable=False)
    project_name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    role = Column(String(255), nullable=True)
    responsibilities = Column(JSON, default=list)
    technologies = Column(JSON, default=list)
    programming_languages = Column(JSON, default=list)
    frameworks = Column(JSON, default=list)
    database = Column(String(100), nullable=True)
    cloud = Column(String(100), nullable=True)
    github_link = Column(String(500), nullable=True)
    live_link = Column(String(500), nullable=True)
    achievements = Column(JSON, default=list)

    resume = relationship("Resume", back_populates="parsed_projects")

class ResumeCertification(Base):
    __tablename__ = "resume_certifications"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    resume_id = Column(String(36), ForeignKey("resumes.id"), nullable=False)
    certificate_name = Column(String(255), nullable=False)
    organization = Column(String(255), nullable=True)
    issue_date = Column(String(50), nullable=True)
    credential_id = Column(String(255), nullable=True)
    verification_url = Column(String(500), nullable=True)

    resume = relationship("Resume", back_populates="parsed_certs")

class ResumeAchievement(Base):
    __tablename__ = "resume_achievements"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    resume_id = Column(String(36), ForeignKey("resumes.id"), nullable=False)
    title = Column(String(255), nullable=False)
    category = Column(String(100), default="Award") # Hackathon, Award, Competition, Open Source, Patent, Research
    description = Column(Text, nullable=True)

    resume = relationship("Resume", back_populates="parsed_achievements")

class ResumeLanguage(Base):
    __tablename__ = "resume_languages"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    resume_id = Column(String(36), ForeignKey("resumes.id"), nullable=False)
    language_name = Column(String(100), nullable=False)
    proficiency = Column(String(50), default="Fluent")

    resume = relationship("Resume", back_populates="parsed_languages")

class ResumeATS(Base):
    __tablename__ = "resume_ats"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    resume_id = Column(String(36), ForeignKey("resumes.id"), unique=True, nullable=False)
    ats_score = Column(Float, default=85.0)
    keyword_match_percentage = Column(Float, default=80.0)
    technical_keywords = Column(JSON, default=list)
    domain_keywords = Column(JSON, default=list)
    missing_keywords = Column(JSON, default=list)
    repeated_skills = Column(JSON, default=dict)
    strengths = Column(JSON, default=list)
    weaknesses = Column(JSON, default=list)
    formatting_issues = Column(JSON, default=list)
    suggestions = Column(JSON, default=list)

    resume = relationship("Resume", back_populates="ats_record")

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
    fsm_state = Column(String(50), default="WAITING_FOR_QUESTION")
    status = Column(String(50), default="completed") # scheduled, active, completed, terminated
    recording_status = Column(String(50), default="PENDING") # PENDING, UPLOADING, AVAILABLE, FAILED
    integrity_status = Column(String(50), default="CLEAN") # CLEAN, FLAGGED, CRITICAL, TERMINATED
    integrity_score = Column(Float, default=100.0)
    total_integrity_incidents = Column(Integer, default=0)
    termination_reason = Column(String(255), nullable=True)
    terminated_at = Column(DateTime, nullable=True)
    is_test_data = Column(Boolean, default=False, index=True)
    environment = Column(String(50), default="PRODUCTION", index=True)
    started_at = Column(DateTime, default=datetime.utcnow)
    ended_at = Column(DateTime, default=datetime.utcnow)

    candidate = relationship("Candidate", back_populates="sessions")
    questions = relationship("InterviewQuestion", back_populates="session", cascade="all, delete-orphan")
    scoring_report = relationship("ScoringReport", back_populates="session", uselist=False)
    recordings = relationship("InterviewRecording", back_populates="session", cascade="all, delete-orphan")
    transcripts = relationship("InterviewTranscript", back_populates="session", cascade="all, delete-orphan")
    transcript_segments = relationship("InterviewTranscriptSegment", back_populates="session", cascade="all, delete-orphan")
    speech_metrics = relationship("InterviewSpeechMetric", back_populates="session", uselist=False, cascade="all, delete-orphan")
    filler_events = relationship("InterviewFillerEvent", back_populates="session", cascade="all, delete-orphan")
    visual_metrics = relationship("InterviewVisualMetric", back_populates="session", uselist=False, cascade="all, delete-orphan")
    visual_observations = relationship("InterviewVisualObservation", back_populates="session", cascade="all, delete-orphan")
    vision_analyses = relationship("InterviewVisionAnalysis", back_populates="session", cascade="all, delete-orphan")
    integrity_events = relationship("InterviewIntegrityEvent", back_populates="session", cascade="all, delete-orphan")

class InterviewRecording(Base):
    __tablename__ = "interview_recordings"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String(36), ForeignKey("interview_sessions.id"), nullable=False, index=True)
    candidate_id = Column(String(36), ForeignKey("candidates.id"), nullable=False, index=True)
    recording_type = Column(String(50), default="VIDEO_AUDIO") # VIDEO, AUDIO, VIDEO_AUDIO
    file_path = Column(String(500), nullable=False)
    storage_key = Column(String(500), nullable=True)
    mime_type = Column(String(100), default="video/webm")
    file_size = Column(BigInteger, default=0)
    duration = Column(Float, default=0.0)
    status = Column(String(50), default="available", index=True) # pending, uploading, available, failed
    is_test_data = Column(Boolean, default=False, index=True)
    environment = Column(String(50), default="PRODUCTION", index=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    session = relationship("InterviewSession", back_populates="recordings")
    candidate = relationship("Candidate", back_populates="recordings")
    transcripts = relationship("InterviewTranscript", back_populates="recording", cascade="all, delete-orphan")
    vision_analyses = relationship("InterviewVisionAnalysis", back_populates="recording", cascade="all, delete-orphan")

class InterviewTranscript(Base):
    __tablename__ = "interview_transcripts"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    recording_id = Column(String(36), ForeignKey("interview_recordings.id"), nullable=False, index=True)
    session_id = Column(String(36), ForeignKey("interview_sessions.id"), nullable=False, index=True)
    candidate_id = Column(String(36), ForeignKey("candidates.id"), nullable=False, index=True)
    status = Column(String(50), default="PENDING", index=True) # PENDING, PROCESSING, COMPLETED, FAILED
    transcript_text = Column(Text, nullable=True)
    language = Column(String(50), default="en")
    provider = Column(String(50), default="groq_whisper")
    duration = Column(Float, default=0.0)
    error_message = Column(Text, nullable=True)
    is_test_data = Column(Boolean, default=False, index=True)
    environment = Column(String(50), default="PRODUCTION", index=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    recording = relationship("InterviewRecording", back_populates="transcripts")
    session = relationship("InterviewSession", back_populates="transcripts")
    candidate = relationship("Candidate", back_populates="transcripts")

class InterviewVisionAnalysis(Base):
    __tablename__ = "interview_vision_analysis"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    recording_id = Column(String(36), ForeignKey("interview_recordings.id"), nullable=False, index=True)
    session_id = Column(String(36), ForeignKey("interview_sessions.id"), nullable=False, index=True)
    candidate_id = Column(String(36), ForeignKey("candidates.id"), nullable=False, index=True)
    status = Column(String(50), default="PENDING", index=True) # PENDING, PROCESSING, COMPLETED, FAILED
    provider = Column(String(50), default="gemini_vision")
    duration = Column(Float, default=0.0)
    frames_analyzed = Column(Integer, default=0)
    face_presence_percentage = Column(Float, nullable=True)
    eye_contact_percentage = Column(Float, nullable=True)
    attention_score = Column(Float, nullable=True)
    confidence_percentage = Column(Float, nullable=True)
    multiple_person_percentage = Column(Float, nullable=True)
    multiple_faces_detected = Column(Boolean, default=False)
    error_message = Column(Text, nullable=True)
    is_test_data = Column(Boolean, default=False, index=True)
    environment = Column(String(50), default="PRODUCTION", index=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    recording = relationship("InterviewRecording", back_populates="vision_analyses")
    session = relationship("InterviewSession", back_populates="vision_analyses")
    candidate = relationship("Candidate", back_populates="vision_analyses")

class InterviewIntegrityEvent(Base):
    __tablename__ = "interview_integrity_events"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String(36), ForeignKey("interview_sessions.id"), nullable=False, index=True)
    candidate_id = Column(String(36), ForeignKey("candidates.id"), nullable=True, index=True)
    event_type = Column(String(50), nullable=False, index=True) # MULTIPLE_PERSON, MOBILE_PHONE, FACE_NOT_VISIBLE, TAB_SWITCH
    severity = Column(String(20), default="MEDIUM", index=True) # LOW, MEDIUM, HIGH, CRITICAL
    status = Column(String(20), default="ACTIVE", index=True) # ACTIVE, RESOLVED, TERMINATED
    started_at = Column(DateTime, default=datetime.utcnow, index=True)
    ended_at = Column(DateTime, nullable=True)
    duration_seconds = Column(Float, default=0.0)
    confidence = Column(Float, default=1.0)
    metadata_json = Column(JSON, default=dict)
    is_test_data = Column(Boolean, default=False, index=True)
    environment = Column(String(50), default="PRODUCTION", index=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    session = relationship("InterviewSession", back_populates="integrity_events")
    candidate = relationship("Candidate")

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
    dominant_emotion = Column(String(50), default="neutral")
    confidence_percentage = Column(Float, default=90.0)
    stress_level = Column(Float, default=12.0)
    smile_ratio = Column(Float, default=35.0)
    emotions_breakdown = Column(JSON, default=lambda: {"neutral": 0.6, "confident": 0.2, "focused": 0.2})

    answer = relationship("InterviewAnswer", back_populates="emotion_analysis")

class ScoringReport(Base):
    __tablename__ = "scoring_reports"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String(36), ForeignKey("interview_sessions.id"), nullable=False)
    candidate_id = Column(String(36), ForeignKey("candidates.id"), nullable=True, index=True)
    transcript_id = Column(String(36), ForeignKey("interview_transcripts.id"), nullable=True, index=True)
    vision_analysis_id = Column(String(36), ForeignKey("interview_vision_analysis.id"), nullable=True, index=True)
    status = Column(String(50), default="COMPLETED", index=True)
    communication_score = Column(Float, default=82.0)
    confidence_score = Column(Float, default=80.0)
    technical_score = Column(Float, default=85.0)
    professionalism_score = Column(Float, default=88.0)
    grammar_score = Column(Float, default=85.0)
    problem_solving_score = Column(Float, default=84.0)
    behavior_score = Column(Float, default=82.0)
    leadership_score = Column(Float, default=78.0)
    overall_score = Column(Float, default=83.5)
    recommendation = Column(String(50), default="Shortlist")
    overall_summary = Column(Text, nullable=True)
    technical_analysis = Column(Text, nullable=True)
    communication_analysis = Column(Text, nullable=True)
    behavioral_analysis = Column(Text, nullable=True)
    grammar_analysis = Column(Text, nullable=True)
    confidence_analysis = Column(Text, nullable=True)
    strengths = Column(JSON, default=lambda: [])
    weaknesses = Column(JSON, default=lambda: [])
    improvement_plan = Column(JSON, default=lambda: [])
    practice_recommendations = Column(JSON, default=lambda: [])
    learning_resources = Column(JSON, default=lambda: [])
    question_evaluations = Column(JSON, default=lambda: [])
    communication_metrics = Column(JSON, default=dict)
    confidence_metrics = Column(JSON, default=dict)
    technical_metrics = Column(JSON, default=dict)
    professionalism_metrics = Column(JSON, default=dict)
    speech_timeline = Column(JSON, default=list)
    gaze_timeline = Column(JSON, default=list)
    emotion_timeline = Column(JSON, default=list)
    missing_topics = Column(JSON, default=list)
    ideal_answers = Column(JSON, default=list)
    practice_suggestions = Column(JSON, default=list)
    model_version = Column(String(50), default="smart-hire-v2.0.0")
    analysis_version = Column(String(50), default="evidence_based_v2")
    pdf_url = Column(String(500), nullable=True)
    is_test_data = Column(Boolean, default=False, index=True)
    environment = Column(String(50), default="PRODUCTION", index=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    session = relationship("InterviewSession", back_populates="scoring_report")
    candidate = relationship("Candidate")
    transcript = relationship("InterviewTranscript")
    vision_analysis = relationship("InterviewVisionAnalysis")

class InterviewTranscriptSegment(Base):
    __tablename__ = "interview_transcript_segments"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String(36), ForeignKey("interview_sessions.id"), nullable=False, index=True)
    candidate_id = Column(String(36), ForeignKey("candidates.id"), nullable=True, index=True)
    question_id = Column(String(36), ForeignKey("interview_questions.id"), nullable=True, index=True)
    speaker = Column(String(50), nullable=False, default="CANDIDATE") # CANDIDATE, AI_INTERVIEWER
    text = Column(Text, nullable=False)
    start_time = Column(Float, default=0.0)
    end_time = Column(Float, default=0.0)
    duration = Column(Float, default=0.0)
    sequence_number = Column(Integer, default=1, index=True)
    confidence = Column(Float, default=1.0)
    is_test_data = Column(Boolean, default=False, index=True)
    environment = Column(String(50), default="PRODUCTION", index=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    session = relationship("InterviewSession", back_populates="transcript_segments")
    candidate = relationship("Candidate")
    question = relationship("InterviewQuestion")

class InterviewSpeechMetric(Base):
    __tablename__ = "interview_speech_metrics"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String(36), ForeignKey("interview_sessions.id"), nullable=False, unique=True, index=True)
    candidate_id = Column(String(36), ForeignKey("candidates.id"), nullable=True, index=True)
    total_words = Column(Integer, default=0)
    speaking_duration = Column(Float, default=0.0)
    average_wpm = Column(Float, default=0.0)
    min_wpm = Column(Float, default=0.0)
    max_wpm = Column(Float, default=0.0)
    wpm_classification = Column(String(50), default="Comfortable") # Comfortable, Fast, Very Fast, Slow
    filler_count = Column(Integer, default=0)
    filler_rate = Column(Float, default=0.0) # filler_count / total_words (percentage)
    filler_breakdown = Column(JSON, default=dict)
    grammar_error_count = Column(Integer, default=0)
    grammar_error_rate = Column(Float, default=0.0) # error_count / total_words (percentage)
    grammar_errors_sample = Column(JSON, default=list) # Concrete snippet evidence
    pronunciation_score = Column(Float, nullable=True) # None when insufficient audio
    pronunciation_status = Column(String(100), default="Available")
    clarity_score = Column(Float, default=85.0)
    pause_count = Column(Integer, default=0)
    long_pause_count = Column(Integer, default=0)
    average_pause_duration = Column(Float, default=0.0)
    response_latency_avg = Column(Float, default=0.0)
    vocabulary_richness = Column(Float, default=0.0)
    is_test_data = Column(Boolean, default=False, index=True)
    environment = Column(String(50), default="PRODUCTION", index=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    session = relationship("InterviewSession", back_populates="speech_metrics")
    candidate = relationship("Candidate")

class InterviewFillerEvent(Base):
    __tablename__ = "interview_filler_events"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String(36), ForeignKey("interview_sessions.id"), nullable=False, index=True)
    candidate_id = Column(String(36), ForeignKey("candidates.id"), nullable=True, index=True)
    transcript_segment_id = Column(String(36), ForeignKey("interview_transcript_segments.id"), nullable=True)
    word = Column(String(50), nullable=False) # e.g. "um", "like", "basically"
    timestamp = Column(Float, default=0.0)
    sequence_number = Column(Integer, default=1)
    is_test_data = Column(Boolean, default=False, index=True)
    environment = Column(String(50), default="PRODUCTION", index=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    session = relationship("InterviewSession", back_populates="filler_events")
    candidate = relationship("Candidate")

class InterviewVisualMetric(Base):
    __tablename__ = "interview_visual_metrics"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String(36), ForeignKey("interview_sessions.id"), nullable=False, unique=True, index=True)
    candidate_id = Column(String(36), ForeignKey("candidates.id"), nullable=True, index=True)
    face_presence_ratio = Column(Float, default=0.0)
    eye_contact_ratio = Column(Float, default=0.0)
    camera_facing_ratio = Column(Float, default=0.0)
    attention_score = Column(Float, default=0.0)
    engagement_score = Column(Float, default=0.0)
    dominant_emotion = Column(String(50), default="neutral")
    emotion_distribution = Column(JSON, default=dict) # {neutral: 62, confident: 21, ...}
    emotion_timeline = Column(JSON, default=list) # [{start, end, dominant_emotion, confidence}]
    model_version = Column(String(50), default="smart-hire-behavior-v2.0")
    head_pose_stability = Column(Float, default=0.0)
    long_away_periods = Column(Integer, default=0)
    is_test_data = Column(Boolean, default=False, index=True)
    environment = Column(String(50), default="PRODUCTION", index=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    session = relationship("InterviewSession", back_populates="visual_metrics")
    candidate = relationship("Candidate")

class InterviewVisualObservation(Base):
    __tablename__ = "interview_visual_observations"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String(36), ForeignKey("interview_sessions.id"), nullable=False, index=True)
    candidate_id = Column(String(36), ForeignKey("candidates.id"), nullable=True, index=True)
    timestamp = Column(Float, default=0.0)
    face_detected = Column(Boolean, default=True)
    face_confidence = Column(Float, default=1.0)
    head_yaw = Column(Float, default=0.0)
    head_pitch = Column(Float, default=0.0)
    head_roll = Column(Float, default=0.0)
    gaze_horizontal = Column(Float, default=0.0)
    gaze_vertical = Column(Float, default=0.0)
    eye_contact_state = Column(String(50), default="LOOKING_AT_CAMERA") # LOOKING_AT_CAMERA, LOOKING_LEFT, LOOKING_RIGHT, LOOKING_UP, LOOKING_DOWN, UNCERTAIN
    emotion = Column(String(50), default="neutral")
    emotion_confidence = Column(Float, default=1.0)
    attention_state = Column(String(50), default="FOCUSED")
    model_version = Column(String(50), default="smart-hire-behavior-v2.0")
    probability_distribution = Column(JSON, default=dict)
    observation_status = Column(String(50), default="VALID")
    is_test_data = Column(Boolean, default=False, index=True)
    environment = Column(String(50), default="PRODUCTION", index=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    session = relationship("InterviewSession", back_populates="visual_observations")
    candidate = relationship("Candidate")

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

class AssessmentSession(Base):
    __tablename__ = "assessment_sessions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    title = Column(String(255), nullable=False, default="Aptitude & Technical Assessment")
    candidate_id = Column(String(36), ForeignKey("candidates.id"), index=True, nullable=True)
    recruiter_id = Column(String(36), ForeignKey("recruiters.id"), nullable=True)
    job_id = Column(String(36), ForeignKey("job_postings.id"), nullable=True)
    job_application_id = Column(String(36), ForeignKey("job_applications.id"), nullable=True)
    topics = Column(JSON, default=lambda: ["Aptitude", "Technical", "Reasoning"])
    difficulty = Column(String(50), default="Medium")
    question_count = Column(Integer, default=10)
    duration_minutes = Column(Integer, default=15)
    passing_score = Column(Float, default=70.0)
    negative_marking = Column(Float, default=0.25)
    proctoring_enabled = Column(Boolean, default=True)
    is_recruiter_configured = Column(Boolean, default=False)
    status = Column(String(50), default="active") # active, completed, expired
    violations_count = Column(Integer, default=0)
    is_test_data = Column(Boolean, default=False, index=True)
    environment = Column(String(50), default="PRODUCTION", index=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

class AssessmentQuestion(Base):
    __tablename__ = "assessment_questions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String(36), ForeignKey("assessment_sessions.id"), index=True, nullable=False)
    order_index = Column(Integer, nullable=False, default=1)
    category = Column(String(100), default="General Aptitude")
    topic = Column(String(100), default="Reasoning")
    question_text = Column(Text, nullable=False)
    code_snippet = Column(Text, nullable=True)
    options = Column(JSON, nullable=False) # ["Option A", "Option B", "Option C", "Option D"]
    correct_option = Column(Integer, nullable=False, default=0) # 0-indexed int
    explanation = Column(Text, nullable=True)
    negative_marks = Column(Float, default=0.25)
    is_repeated = Column(Boolean, default=False, index=True)
    passage_text = Column(Text, nullable=True)
    dataset_json = Column(JSON, nullable=True)
    test_cases = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class CandidateQuestionHistory(Base):
    """Production-grade candidate question history tracking ledger."""
    __tablename__ = "candidate_question_history"
    __table_args__ = (
        Index("ix_cqh_candidate_topic_diff", "candidate_id", "topic", "difficulty"),
        Index("ix_cqh_candidate_question", "candidate_id", "question_id"),
        Index("ix_cqh_candidate_fingerprint", "candidate_id", "question_fingerprint"),
        Index("ix_cqh_candidate_served", "candidate_id", "served_at"),
        Index("ix_cqh_candidate_category", "candidate_id", "category"),
        Index("ix_cqh_candidate_difficulty", "candidate_id", "difficulty"),
    )

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    candidate_id = Column(String(36), ForeignKey("candidates.id"), index=True, nullable=True)
    question_id = Column(String(36), index=True, nullable=False)
    assessment_id = Column(String(36), ForeignKey("assessment_sessions.id"), index=True, nullable=False)
    attempt_number = Column(Integer, nullable=False, default=1)
    category = Column(String(100), nullable=True, index=True)
    subcategory = Column(String(100), nullable=True, index=True)
    topic = Column(String(100), nullable=True, index=True)
    difficulty = Column(String(50), nullable=True, index=True)
    question_fingerprint = Column(String(64), index=True, nullable=False)
    is_repeated = Column(Boolean, default=False, index=True)
    served_at = Column(DateTime, default=datetime.utcnow, index=True)

class AssessmentQuestionHistory(Base):
    """Immutable candidate question ledger used to prevent repeat assessment items."""
    __tablename__ = "assessment_question_history"
    __table_args__ = (
        UniqueConstraint("candidate_id", "question_fingerprint", name="uq_assessment_history_candidate_fingerprint"),
        Index("ix_assessment_history_candidate_generated", "candidate_id", "generated_at"),
    )

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    candidate_id = Column(String(36), ForeignKey("candidates.id"), index=True, nullable=True)
    session_id = Column(String(36), ForeignKey("assessment_sessions.id"), index=True, nullable=False)
    question_id = Column(String(36), ForeignKey("assessment_questions.id"), index=True, nullable=False)
    question_fingerprint = Column(String(64), index=True, nullable=False)
    normalized_question = Column(Text, nullable=False)
    topic = Column(String(100), nullable=True)
    difficulty = Column(String(50), nullable=True)
    attempt_number = Column(Integer, nullable=False, default=1)
    generated_at = Column(DateTime, default=datetime.utcnow, index=True)

class AssessmentAnswer(Base):
    __tablename__ = "assessment_answers"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String(36), ForeignKey("assessment_sessions.id"), index=True, nullable=False)
    question_id = Column(String(36), ForeignKey("assessment_questions.id"), index=True, nullable=False)
    selected_option = Column(Integer, nullable=True) # None if skipped, 0-3 if answered
    is_correct = Column(Boolean, default=False)
    points_earned = Column(Float, default=0.0)
    time_taken_seconds = Column(Integer, default=0)
    submitted_at = Column(DateTime, default=datetime.utcnow)

class AssessmentResult(Base):
    __tablename__ = "assessment_results"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String(36), ForeignKey("assessment_sessions.id"), unique=True, nullable=False)
    candidate_id = Column(String(36), ForeignKey("candidates.id"), index=True, nullable=True)
    overall_score = Column(Float, nullable=False, default=0.0)
    total_correct = Column(Integer, default=0)
    total_wrong = Column(Integer, default=0)
    total_skipped = Column(Integer, default=0)
    section_scores = Column(JSON, default=dict)
    weak_areas = Column(JSON, default=list)
    strong_areas = Column(JSON, default=list)
    improvement_suggestions = Column(JSON, default=list)
    hiring_recommendation = Column(String(50), default="Pass") # Pass, Fail, Review
    proctoring_violations = Column(Integer, default=0)
    report_pdf_url = Column(String(500), nullable=True)
    is_test_data = Column(Boolean, default=False, index=True)
    environment = Column(String(50), default="PRODUCTION", index=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)


class MasterQuestionBank(Base):
    """Permanent Master Question Bank for enterprise practice and recruiter assessments."""
    __tablename__ = "master_question_bank"
    __table_args__ = (
        UniqueConstraint("question_fingerprint", name="uq_master_question_fingerprint"),
        Index("ix_master_qb_topic_diff", "topic", "difficulty"),
        Index("ix_master_qb_concept_hash", "concept_hash"),
    )

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    topic = Column(String(100), nullable=False, index=True)
    subtopic = Column(String(100), nullable=False, default="General Concepts")
    concept = Column(String(150), nullable=False, default="Core Principles")
    difficulty = Column(String(50), nullable=False, default="Medium") # Beginner, Easy, Medium, Hard, Expert
    bloom_taxonomy = Column(String(50), nullable=False, default="Apply") # Remember, Understand, Apply, Analyze, Evaluate, Create
    question_type = Column(String(50), nullable=False, default="MCQ") # Conceptual, Scenario Based, Debugging, Output Prediction, Code Completion, Architecture, Performance, Security, MCQ, SQL, System Design
    scenario_type = Column(String(100), default="General Enterprise")
    technology = Column(String(100), default="Python")
    tags = Column(JSON, default=list)
    question_text = Column(Text, nullable=False)
    options = Column(JSON, nullable=False) # ["Option A", "Option B", "Option C", "Option D"]
    correct_option = Column(Integer, nullable=False, default=0) # 0-indexed int
    explanation = Column(Text, nullable=True)
    code_snippet = Column(Text, nullable=True)
    language = Column(String(50), nullable=True)
    passage_text = Column(Text, nullable=True)
    dataset_json = Column(JSON, nullable=True)
    test_cases = Column(JSON, nullable=True)
    created_by = Column(String(100), default="ai_factory") # system, ai_factory, recruiter_id
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    question_fingerprint = Column(String(64), nullable=False, index=True)
    concept_hash = Column(String(64), nullable=False, index=True)
    embedding = Column(JSON, nullable=True)


class RecruiterAssessmentHistory(Base):
    """Ledger tracking recruiter assessment question assignments to prevent duplicates."""
    __tablename__ = "recruiter_assessment_history"
    __table_args__ = (
        Index("ix_recruiter_history_recruiter_session", "recruiter_id", "session_id"),
    )

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    recruiter_id = Column(String(36), ForeignKey("recruiters.id"), nullable=False, index=True)
    session_id = Column(String(36), ForeignKey("assessment_sessions.id"), nullable=False, index=True)
    question_id = Column(String(36), nullable=False, index=True)
    question_fingerprint = Column(String(64), nullable=False, index=True)
    assigned_at = Column(DateTime, default=datetime.utcnow)



