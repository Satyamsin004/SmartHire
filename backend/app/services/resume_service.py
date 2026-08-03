import re
from typing import Dict, Any, List

COMMON_TECHNICAL_SKILLS = [
    "React", "React Native", "TypeScript", "JavaScript", "Python", "FastAPI", "Django",
    "Node.js", "Express", "PostgreSQL", "MongoDB", "Redis", "Docker", "Kubernetes",
    "AWS", "GCP", "System Design", "GraphQL", "REST API", "Microservices", "PyTorch",
    "TensorFlow", "TailwindCSS", "Redux", "SQL", "Git", "CI/CD", "Kafka"
]

class ResumeService:
    def parse_resume_text(self, text: str) -> Dict[str, Any]:
        """Parses raw resume text and extracts technical skills, Education, Experience, Projects, ATS score."""
        found_skills = []
        for skill in COMMON_TECHNICAL_SKILLS:
            if re.search(r'\b' + re.escape(skill) + r'\b', text, re.IGNORECASE):
                found_skills.append({"skill_name": skill, "category": "Technical", "proficiency": "Advanced"})

        # Calculate ATS score based on structural sections present
        score = 70.0
        if "experience" in text.lower():
            score += 10.0
        if "education" in text.lower():
            score += 5.0
        if "skills" in text.lower():
            score += 5.0
        if len(found_skills) >= 5:
            score += 8.5

        ats_score = min(98.0, round(score, 1))

        # Keyword density calculation
        density = {}
        for item in found_skills[:8]:
            k = item["skill_name"]
            density[k] = len(re.findall(r'\b' + re.escape(k) + r'\b', text, re.IGNORECASE)) or 1

        missing_skills = [s for s in COMMON_TECHNICAL_SKILLS if not re.search(r'\b' + re.escape(s) + r'\b', text, re.IGNORECASE)][:6]

        summary = self._generate_summary(text, found_skills)

        # Precise extraction for Education (Degree, College, Branch, CGPA)
        education_info = self._extract_education(text)
        experience_info = self._extract_experience(text)
        projects_info = self._extract_projects(text)
        certifications_info = self._extract_certifications(text)

        return {
            "ats_score": ats_score,
            "summary": summary,
            "skills": found_skills if found_skills else [],
            "keyword_density": density if density else {},
            "missing_skills": missing_skills,
            "education": education_info,
            "experience": experience_info,
            "projects": projects_info,
            "certifications": certifications_info
        }

    def _extract_education(self, text: str) -> Dict[str, str]:
        degree = "Not Available"
        college = "Not Available"
        branch = "Not Available"
        cgpa = "Not Available"

        # Regex search for degrees
        degree_match = re.search(r'\b(B\.?Tech|B\.?E|B\.?S|M\.?Tech|M\.?S|Ph\.?D|Bachelor|Master)\b.*?', text, re.IGNORECASE)
        if degree_match:
            degree = degree_match.group(0).strip()

        # Regex search for Branch / Field
        branch_match = re.search(r'\b(Computer Science|Information Technology|Electrical|Mechanical|Software Engineering|Data Science)\b', text, re.IGNORECASE)
        if branch_match:
            branch = branch_match.group(0).strip()

        # Regex search for CGPA or GPA
        cgpa_match = re.search(r'\b(CGPA|GPA|Score)[\s:]*([0-9]\.[0-9]{1,2}|\d{2,3}%)\b', text, re.IGNORECASE)
        if cgpa_match:
            cgpa = cgpa_match.group(2).strip()

        # Regex search for College / University
        college_match = re.search(r'([A-Z][a-zA-Z\s]+(?:University|Institute|College|School))', text)
        if college_match:
            college = college_match.group(0).strip()

        return {
            "degree": degree,
            "college": college,
            "branch": branch,
            "cgpa": cgpa
        }

    def _extract_experience(self, text: str) -> str:
        exp_match = re.search(r'(\d+\+?\s*(?:years?|yrs?)\s*(?:of)?\s*experience)', text, re.IGNORECASE)
        if exp_match:
            return exp_match.group(0).strip()
        return "Not Available"

    def _extract_projects(self, text: str) -> List[str]:
        projects = []
        lines = text.split('\n')
        in_projects = False
        for line in lines:
            if re.search(r'\b(projects|key projects|major projects)\b', line, re.IGNORECASE):
                in_projects = True
                continue
            if in_projects:
                if re.search(r'\b(education|experience|skills|certifications)\b', line, re.IGNORECASE):
                    break
                if len(line.strip()) > 15:
                    projects.append(line.strip()[:120])
                    if len(projects) >= 4:
                        break
        return projects if projects else ["Not Available"]

    def _extract_certifications(self, text: str) -> List[str]:
        certs = []
        lines = text.split('\n')
        in_certs = False
        for line in lines:
            if re.search(r'\b(certifications|licenses|courses)\b', line, re.IGNORECASE):
                in_certs = True
                continue
            if in_certs:
                if re.search(r'\b(education|experience|skills|projects)\b', line, re.IGNORECASE):
                    break
                if len(line.strip()) > 10:
                    certs.append(line.strip()[:100])
                    if len(certs) >= 3:
                        break
        return certs if certs else ["Not Available"]

    def _generate_summary(self, text: str, found_skills: List[Dict]) -> str:
        """Generates a concise summary from the actual resume text content."""
        # Try to extract the first meaningful paragraph as summary
        lines = [line.strip() for line in text.split('\n') if line.strip() and len(line.strip()) > 20]

        # Look for common summary/objective section headers
        summary_text = ""
        capture = False
        for i, line in enumerate(lines):
            lower = line.lower()
            if any(keyword in lower for keyword in ['summary', 'objective', 'about', 'profile', 'overview']):
                capture = True
                continue
            if capture:
                if any(keyword in lower for keyword in ['experience', 'education', 'skills', 'projects', 'work history', 'employment']):
                    break
                summary_text += line + " "
                if len(summary_text) > 200:
                    break

        if summary_text.strip() and len(summary_text.strip()) > 30:
            return summary_text.strip()[:300]

        # Fallback: build summary from found skills
        if found_skills:
            skill_names = [s["skill_name"] for s in found_skills[:5]]
            return f"Professional with experience in {', '.join(skill_names)}."

        # Last resort: use first meaningful line
        if lines:
            return lines[0][:300]

        return "Resume uploaded successfully. Skills analysis complete."

    def match_job_description(self, resume_skills: List[str] = None, jd_text: str = "", candidate_skills: List[str] = None, job_description: str = "") -> Dict[str, Any]:
        """Compares candidate skills against job description text."""
        skills_to_check = candidate_skills or resume_skills or []
        effective_jd = job_description or jd_text or ""
        required = [s for s in COMMON_TECHNICAL_SKILLS if re.search(r'\b' + re.escape(s) + r'\b', effective_jd, re.IGNORECASE)]
        if not required:
            required = ["React", "TypeScript", "FastAPI", "PostgreSQL", "Docker", "Redis"]

        matching = [s for s in required if any(s.lower() in str(cand_s).lower() for cand_s in skills_to_check)]
        missing = [s for s in required if not any(s.lower() in str(cand_s).lower() for cand_s in skills_to_check)]

        match_pct = round((len(matching) / max(len(required), 1)) * 100, 1)

        if match_pct >= 85:
            ai_recommendation = "Excellent Match"
            explanation = f"Strong experience in {', '.join(matching[:3])}. High technical alignment for this position."
        elif match_pct >= 70:
            ai_recommendation = "Good Match"
            explanation = f"Solid background in {', '.join(matching[:2])}, but missing {', '.join(missing[:2])}."
        elif match_pct >= 50:
            ai_recommendation = "Average Match"
            explanation = f"Partial skill match ({', '.join(matching[:2])}). Requires upskilling in {', '.join(missing[:2])}."
        else:
            ai_recommendation = "Poor Match"
            explanation = f"Low keyword coverage. Missing core requirements: {', '.join(missing[:3])}."

        return {
            "match_percentage": match_pct,
            "match_score": match_pct,
            "fit_score": ai_recommendation,
            "ai_recommendation": ai_recommendation,
            "ai_explanation": explanation,
            "matching_skills": matching,
            "missing_skills": missing,
            "missing_keywords": missing,
            "recommended_learning": [f"Learn {m} fundamentals and production patterns" for m in missing[:3]],
            "expected_salary_range": "$120,000 - $160,000 USD"
        }

resume_service = ResumeService()
