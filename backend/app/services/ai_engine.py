import json
import logging
from typing import List, Dict, Any, Optional
import google.generativeai as genai
from app.core.config import settings

logger = logging.getLogger(__name__)

class AIEngine:
    def __init__(self):
        self.model = None
        self.candidate_models = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-2.5-flash', 'gemini-flash-latest']
        if settings.GEMINI_API_KEY:
            try:
                genai.configure(api_key=settings.GEMINI_API_KEY)
                self.model = genai.GenerativeModel('gemini-2.0-flash')
            except Exception as e:
                logger.error(f"Gemini API init error: {e}")
        else:
            logger.warning("GEMINI_API_KEY not provided. Intelligent dynamic question generator active.")

    async def _call_gemini_with_fallback(self, prompt: str) -> Optional[str]:
        if not settings.GEMINI_API_KEY:
            return None
        for m_name in self.candidate_models:
            try:
                model = genai.GenerativeModel(m_name)
                res = await model.generate_content_async(prompt)
                if res and res.text:
                    return res.text.strip()
            except Exception as e:
                logger.warning(f"Gemini model '{m_name}' call failed/rate-limited: {e}")
        return None

    async def generate_interview_questions(
        self,
        role: str,
        round_type: str,
        difficulty: str,
        resume_summary: Optional[str] = None,
        job_description: Optional[str] = None,
        rag_context: Optional[str] = None,
        num_questions: int = 4
    ) -> List[Dict[str, Any]]:
        """Generates dynamic interview questions using Google Gemini with dynamic fallback."""
        prompt = f"""
        You are a supportive, technical interviewer conducting a {difficulty} level interview for a candidate applying for a {role} position.
        
        Candidate Resume Context:
        {resume_summary or 'Standard candidate resume focusing on software development.'}

        Instructions:
        1. Generate {num_questions} beginner-friendly, accessible interview questions based on the resume concepts, skills, and projects.
        2. Keep questions conceptual and practical.

        Return ONLY a JSON array of {num_questions} objects with keys: "question_text", "category", "difficulty", "expected_keywords".
        Do not wrap in markdown or code blocks. Return pure JSON.
        """

        raw_text = await self._call_gemini_with_fallback(prompt)
        if raw_text:
            try:
                text = raw_text
                if text.startswith("```json"):
                    text = text[7:]
                if text.startswith("```"):
                    text = text[3:]
                if text.endswith("```"):
                    text = text[:-3]
                text = text.strip()
                data = json.loads(text)
                if isinstance(data, list) and len(data) > 0:
                    return data
                elif isinstance(data, dict) and "questions" in data:
                    return data["questions"]
            except Exception as parse_err:
                logger.error(f"Gemini response parse error: {parse_err}")

        # Dynamic Heuristic Question Generator (Guarantees unique questions when Gemini is rate-limited)
        import random
        pool = [
            {"q": f"Can you walk me through your background as a {role} and highlight your primary architectural contributions?", "cat": "Resume & Experience", "kw": ["architecture", "experience", "stack"]},
            {"q": f"What specific core design patterns or software paradigms do you rely on most when building {role} applications?", "cat": "Software Design", "kw": ["patterns", "design", "structure"]},
            {"q": f"Describe a complex technical bug or system failure you encountered in your {role} work and how you diagnosed it.", "cat": "Debugging & Troubleshooting", "kw": ["debugging", "diagnosis", "root cause"]},
            {"q": f"How do you approach database schema design, indexing, and query optimization for high-throughput {role} services?", "cat": "Data Engineering", "kw": ["database", "indexing", "queries"]},
            {"q": f"Can you explain your experience with automated testing, CI/CD pipelines, and deployment strategy for {role} software?", "cat": "DevOps & Testing", "kw": ["testing", "cicd", "deployment"]},
            {"q": f"How do you ensure state management consistency and clean code architecture across your {role} projects?", "cat": "Code Quality", "kw": ["state", "clean code", "maintainability"]},
            {"q": f"What strategies do you use for secure authentication, authorization, and data encryption in {role} backend APIs?", "cat": "Security", "kw": ["security", "auth", "jwt"]},
            {"q": f"Describe a situation where you had to evaluate trade-offs between system speed, latency, and resource consumption.", "cat": "System Performance", "kw": ["performance", "latency", "optimization"]}
        ]
        
        random.shuffle(pool)
        questions = []
        for idx, item in enumerate(pool[:num_questions], start=1):
            questions.append({
                "question_text": item["q"],
                "category": item["cat"],
                "difficulty": difficulty,
                "expected_keywords": item["kw"]
            })
        return questions

    async def generate_followup_question(
        self,
        question_text: str,
        candidate_answer: str,
        role: str
    ) -> Dict[str, Any]:
        """Generates an adaptive follow-up question based on candidate's depth of response."""
        prompt = f"""
        Original Question: {question_text}
        Candidate Answer: {candidate_answer}
        Target Role: {role}
        
        Generate a sharp, probing follow-up question that dives deeper into any gaps or claims made in their answer.
        Return JSON with keys: "question_text", "category", "difficulty", "expected_keywords".
        Do not wrap the response in markdown blocks like ```json. Return pure JSON.
        """
        try:
            raw_text = await self._call_gemini_with_fallback(prompt)
            if raw_text:
                text = raw_text.strip()
                if text.startswith("```json"):
                    text = text[7:]
                if text.startswith("```"):
                    text = text[3:]
                if text.endswith("```"):
                    text = text[:-3]
                text = text.strip()
                return json.loads(text)
            raise ValueError("Empty response from Gemini models.")
        except Exception as e:
            logger.error(f"Gemini followup API call failed: {e}")
            return {
                "question_text": f"Could you elaborate a bit more on how you tested and validated your solution for that {role} project?",
                "category": "Deep Dive",
                "difficulty": "Medium",
                "expected_keywords": ["testing", "validation"]
            }

    async def evaluate_candidate_answer(
        self,
        question_text: str,
        candidate_answer: str,
        role: str
    ) -> str:
        """Generates a brief 1-sentence verbal feedback evaluation of the candidate's answer."""
        prompt = f"""
        Question Asked: {question_text}
        Candidate Answer: {candidate_answer}
        Role: {role}

        Provide a single, short, encouraging 1-sentence verbal evaluation of the answer (under 20 words).
        Example: "Great explanation of key concepts!" or "Good points on fundamental architecture."
        Return ONLY pure text. No markdown or quotes.
        """
        try:
            raw_text = await self._call_gemini_with_fallback(prompt)
            if raw_text:
                return raw_text.strip().replace('"', '')
            return "Good response! Let's continue."
        except Exception as e:
            logger.error(f"Evaluation feedback error: {e}")
            return "Good response! Let's continue."

ai_engine = AIEngine()
