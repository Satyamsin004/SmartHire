export type RoleType = 'candidate' | 'recruiter' | 'admin';

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: RoleType;
  profile_image?: string;
}

export interface CandidateStats {
  target_role: string;
  experience_level: string;
  total_interviews: number;
  avg_score: number;
  readiness_score: number;
  streak_days: number;
}

export interface Question {
  question_id: string;
  session_id: string;
  order_index: number;
  question_text: string;
  category: string;
  difficulty: string;
  expected_keywords?: string[];
  is_followup?: boolean;
}

export interface SpeechEvaluation {
  speaking_pace_wpm: number;
  filler_word_count: number;
  filler_words: string[];
  grammar_score: number;
  vocabulary_richness: number;
  clarity_score: number;
  tone: string;
}

export interface VisionEvaluation {
  eye_contact_percentage: number;
  blink_rate: number;
  attention_score: number;
  face_visibility_ratio: number;
  multiple_faces_detected: boolean;
  dominant_emotion: string;
  confidence_percentage: number;
}

export interface ScoringReport {
  id: string;
  session_id: string;
  communication_score: number;
  confidence_score: number;
  technical_score: number;
  professionalism_score: number;
  overall_score: number;
  strengths: string[];
  weaknesses: string[];
  improvement_plan: string[];
  rating_rubric: string;
}

export interface ResumeData {
  id: string;
  file_name: string;
  ats_score: number;
  summary: string;
  skills: { skill_name: string; category: string; proficiency: string }[];
  keyword_density: Record<string, number>;
  missing_skills: string[];
}
