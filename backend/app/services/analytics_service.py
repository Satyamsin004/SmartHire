import logging
import re
from typing import Dict, Any, List, Optional
from datetime import datetime
from sqlalchemy import select, func, desc, asc, or_, and_
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.domain import (
    Candidate, User, InterviewSession, ScoringReport, JobApplication, JobPosting, Recruiter,
    Resume, ResumeSkill, AssessmentSession, AssessmentResult, ScheduledInterview
)
from app.services.feedback_generator import CURATED_RESOURCE_TAXONOMY

logger = logging.getLogger("smarthire.analytics_service")

# Configurable weak-area detection threshold
WEAK_THRESHOLD = 60.0

# Enterprise technical skills taxonomy for candidate skill evaluation
TECHNICAL_SKILLS_TAXONOMY = [
    {
        "name": "JavaScript",
        "category": "Frontend & Core",
        "keywords": ["javascript", "vanilla js", "ecmascript", "es6"]
    },
    {
        "name": "React",
        "category": "Frontend Frameworks",
        "keywords": ["react", "react.js", "reactjs", "redux", "next.js", "nextjs", "jsx"]
    },
    {
        "name": "Data Structures & Algorithms (DSA)",
        "category": "Core CS & Algorithms",
        "keywords": ["dsa", "data structures", "algorithms", "leetcode", "problem solving", "time complexity", "trees", "graphs", "sorting", "dynamic programming"]
    },
    {
        "name": "Python",
        "category": "Backend & Core",
        "keywords": ["python", "django", "fastapi", "flask", "numpy", "pandas", "pytest"]
    },
    {
        "name": "Node.js",
        "category": "Backend & Runtime",
        "keywords": ["node.js", "nodejs", "express.js", "express", "npm", "node runtime"]
    },
    {
        "name": "SQL & Databases",
        "category": "Data & Storage",
        "keywords": ["sql", "postgresql", "postgres", "mysql", "database", "sqlite", "mongodb", "nosql", "orm", "prisma", "sqlalchemy"]
    },
    {
        "name": "TypeScript",
        "category": "Frontend & Core",
        "keywords": ["typescript"]
    },
    {
        "name": "System Design",
        "category": "Architecture",
        "keywords": ["system design", "microservices", "distributed systems", "scalability", "architecture", "caching", "design patterns"]
    },
    {
        "name": "REST APIs",
        "category": "Backend & Integration",
        "keywords": ["rest api", "restful", "graphql", "api endpoints", "rest endpoints"]
    },
    {
        "name": "Docker & DevOps",
        "category": "DevOps & Cloud",
        "keywords": ["docker", "devops", "ci/cd", "kubernetes", "aws", "cloud infrastructure", "linux container"]
    }
]

# Skill taxonomy canonical mappings
SKILL_TAXONOMY_MAP = {
    # Technical skills
    "java": ("Java", "Technical"),
    "python": ("Python", "Technical"),
    "react": ("React", "Technical"),
    "javascript": ("JavaScript", "Technical"),
    "typescript": ("TypeScript", "Technical"),
    "system design": ("System Design", "Technical"),
    "data structures": ("Data Structures & Algorithms", "Technical"),
    "algorithms": ("Data Structures & Algorithms", "Technical"),
    "data structures & algorithms": ("Data Structures & Algorithms", "Technical"),
    "dsa": ("Data Structures & Algorithms", "Technical"),
    "dbms": ("Database Management", "Technical"),
    "database": ("Database Management", "Technical"),
    "sql": ("Database Management", "Technical"),
    "postgresql": ("Database Management", "Technical"),
    "redis": ("Caching & Redis", "Technical"),
    "docker": ("Cloud & Containers", "Technical"),
    "kubernetes": ("Cloud & Containers", "Technical"),
    "microservices": ("Distributed Systems", "Technical"),
    "operating systems": ("Operating Systems", "Technical"),
    "computer networks": ("Computer Networks", "Technical"),
    "network partition": ("Distributed Systems", "Technical"),
    "concurrency": ("Concurrency & Multithreading", "Technical"),
    "multithreading": ("Concurrency & Multithreading", "Technical"),
    "caching": ("Caching & Redis", "Technical"),

    # Communication submetrics
    "grammar": ("Grammar & Syntax", "Communication"),
    "clarity": ("Verbal Clarity", "Communication"),
    "vocabulary": ("Vocabulary Richness", "Communication"),
    "speaking pace": ("Speaking Pace", "Communication"),
    "filler words": ("Filler Word Control", "Communication"),
    "filler control": ("Filler Word Control", "Communication"),
    "pronunciation": ("Pronunciation", "Communication"),

    # Behavioral / Confidence submetrics
    "eye contact": ("Eye Contact Consistency", "Behavior"),
    "attention": ("Attention & Focus", "Behavior"),
    "facial engagement": ("Facial Engagement", "Behavior"),
    "hesitation": ("Hesitation Control", "Behavior"),
    "hesitation control": ("Hesitation Control", "Behavior"),
    "time management": ("Interview Time Management", "Professionalism"),
}


def normalize_skill_name(raw_name: str) -> tuple[str, str]:
    """Normalizes raw skill/topic string to canonical taxonomy (canonical_name, category)."""
    if not raw_name:
        return ("General Technical", "Technical")
    clean = raw_name.strip().lower()
    for key, (canon, cat) in SKILL_TAXONOMY_MAP.items():
        if key in clean or clean in key:
            return (canon, cat)
    return (raw_name.strip().title(), "Technical")


def extract_skill_scores_from_evaluations(
    scoring_reports: List[Any],
    assessment_results: Optional[List[Any]] = None
) -> Dict[str, Dict[str, Any]]:
    """Extracts granular per-skill scores from interview question evaluations,
    assessment results, and report metrics using TECHNICAL_SKILLS_TAXONOMY and canonical mappings.
    Returns: { skill_name: { "category": category, "scores": [float, ...] } }
    """
    skill_accumulator: Dict[str, Dict[str, Any]] = {}

    def add_score(s_name: str, cat: str, score: float):
        if not s_name or score is None:
            return
        if s_name not in skill_accumulator:
            skill_accumulator[s_name] = {"category": cat, "scores": []}
        skill_accumulator[s_name]["scores"].append(float(score))

    for report in (scoring_reports or []):
        # 1. Question-level evaluations
        q_evals = getattr(report, "question_evaluations", None) or []
        for qe in q_evals:
            if not isinstance(qe, dict):
                continue
            tech_sc = qe.get("technical_score")
            if tech_sc is None:
                continue
            tech_val = float(tech_sc)
            if tech_val <= 0:
                continue

            q_text = str(qe.get("question_text") or "").lower()
            cat = str(qe.get("category") or "").lower()
            concepts = [str(c).lower() for c in (qe.get("covered_concepts") or [])]
            combined_text = f"{cat} {q_text} {' '.join(concepts)}"

            matched_any = False
            for tax in TECHNICAL_SKILLS_TAXONOMY:
                for kw in tax["keywords"]:
                    pattern = r'(?:\b|_)' + re.escape(kw) + r'(?:\b|_)'
                    if re.search(pattern, combined_text, re.IGNORECASE):
                        add_score(tax["name"], tax["category"], tech_val)
                        matched_any = True
                        break
            if not matched_any and qe.get("category"):
                canon, c_cat = normalize_skill_name(qe["category"])
                add_score(canon, c_cat, tech_val)

        # 2. Assessment section scores or report core competencies
        tech_score = getattr(report, "technical_score", None)
        if tech_score is not None and float(tech_score) > 0:
            tech_f = float(tech_score)
            # Default Core CS & Algorithms (DSA) anchor if not specifically asked
            if "Data Structures & Algorithms (DSA)" not in skill_accumulator:
                ps = getattr(report, "problem_solving_score", None)
                dsa_sc = float(ps) if ps is not None and float(ps) > 0 else tech_f
                add_score("Data Structures & Algorithms (DSA)", "Core CS & Algorithms", dsa_sc)

    for a_res in (assessment_results or []):
        sec_scores = getattr(a_res, "section_scores", None) or {}
        if isinstance(sec_scores, dict):
            for sec_name, sc_val in sec_scores.items():
                if sc_val is None or float(sc_val) <= 0:
                    continue
                sec_lower = str(sec_name).lower()
                matched = False
                for tax in TECHNICAL_SKILLS_TAXONOMY:
                    for kw in tax["keywords"]:
                        pattern = r'(?:\b|_)' + re.escape(kw) + r'(?:\b|_)'
                        if re.search(pattern, sec_lower, re.IGNORECASE):
                            add_score(tax["name"], tax["category"], float(sc_val))
                            matched = True
                            break
                if not matched:
                    canon, c_cat = normalize_skill_name(sec_name)
                    add_score(canon, c_cat, float(sc_val))

    return skill_accumulator


class AnalyticsService:
    """Read-heavy enterprise analytics service consuming authoritative ScoringReport
    and InterviewSession records.
    Calculates:
    1. Historical Weak-Area Prediction & evidence-backed learning recommendations
    2. Performance Trends across completed interviews chronologically
    3. Deterministic Candidate Ranking metrics with tie-breaking rules
    """

    async def get_candidate_weak_areas(
        self,
        db: AsyncSession,
        candidate_id: str,
        threshold: float = WEAK_THRESHOLD
    ) -> Dict[str, Any]:
        """Identifies recurring weak areas across all completed interview sessions for a candidate.
        Calculates weakness frequency, average score, latest score, trend, severity, and recommendations.
        """
        stmt = (
            select(InterviewSession, ScoringReport)
            .join(ScoringReport, ScoringReport.session_id == InterviewSession.id)
            .where(InterviewSession.candidate_id == candidate_id)
            .where(InterviewSession.status.in_(["completed", "Completed"]))
            .order_by(InterviewSession.started_at.asc())
        )
        res = await db.execute(stmt)
        records = res.all()

        total_interviews = len(records)
        if total_interviews == 0:
            return {
                "candidate_id": candidate_id,
                "total_interviews": 0,
                "weak_areas": [],
                "message": "No completed interviews yet."
            }

        skill_tracker: Dict[str, Dict[str, Any]] = {}

        for sess_idx, (session, report) in enumerate(records):
            def record_observation(name: str, score: float, is_weak: bool, raw_category: Optional[str] = None):
                canon, category = normalize_skill_name(name)
                if raw_category:
                    category = raw_category

                if canon not in skill_tracker:
                    skill_tracker[canon] = {
                        "category": category,
                        "scores": [],
                        "weak_occurrences": 0,
                        "session_indices": [],
                        "evidence_snippets": []
                    }
                skill_tracker[canon]["scores"].append((sess_idx, score))
                if is_weak:
                    skill_tracker[canon]["weak_occurrences"] += 1
                    skill_tracker[canon]["session_indices"].append(sess_idx)

            # 1. Category-level scores
            if report.technical_score is not None:
                record_observation("Technical Core", report.technical_score, report.technical_score < threshold, "Technical")
            if report.communication_score is not None:
                record_observation("Communication Core", report.communication_score, report.communication_score < threshold, "Communication")
            if report.confidence_score is not None:
                record_observation("Confidence & Engagement", report.confidence_score, report.confidence_score < threshold, "Behavior")
            if report.professionalism_score is not None:
                record_observation("Professionalism Core", report.professionalism_score, report.professionalism_score < threshold, "Professionalism")

            # 2. Communication Submetrics
            comm_metrics = report.communication_metrics or {}
            if isinstance(comm_metrics, dict):
                grammar = comm_metrics.get("grammar")
                if grammar is not None:
                    record_observation("Grammar", float(grammar), float(grammar) < 75.0, "Communication")

                clarity = comm_metrics.get("clarity")
                if clarity is not None:
                    record_observation("Clarity", float(clarity), float(clarity) < 75.0, "Communication")

                wpm = comm_metrics.get("speaking_pace_wpm")
                if wpm is not None:
                    wpm_f = float(wpm)
                    wpm_score = 100.0 - min(60.0, abs(140.0 - wpm_f) * 1.5)
                    record_observation("Speaking Pace", round(wpm_score, 1), wpm_f < 115 or wpm_f > 175, "Communication")

                filler_cnt = comm_metrics.get("filler_words", comm_metrics.get("filler_count"))
                if filler_cnt is not None:
                    filler_score = max(20.0, 100.0 - (float(filler_cnt) * 8.0))
                    record_observation("Filler Words", round(filler_score, 1), float(filler_cnt) > 4, "Communication")

                pronun = comm_metrics.get("pronunciation")
                if pronun is not None:
                    record_observation("Pronunciation", float(pronun), float(pronun) < 70.0, "Communication")

                vocab = comm_metrics.get("vocabulary")
                if vocab is not None:
                    record_observation("Vocabulary", float(vocab), float(vocab) < 70.0, "Communication")

            # 3. Confidence / Visual Submetrics
            conf_metrics = report.confidence_metrics or {}
            if isinstance(conf_metrics, dict):
                eye_contact = conf_metrics.get("eye_contact")
                if eye_contact is not None:
                    record_observation("Eye Contact", float(eye_contact), float(eye_contact) < 70.0, "Behavior")

                attention = conf_metrics.get("attention")
                if attention is not None:
                    record_observation("Attention", float(attention), float(attention) < 70.0, "Behavior")

                engagement = conf_metrics.get("facial_engagement")
                if engagement is not None:
                    record_observation("Engagement", float(engagement), float(engagement) < 60.0, "Behavior")

                hesitation = conf_metrics.get("hesitation_control")
                if hesitation is not None:
                    record_observation("Hesitation Control", float(hesitation), float(hesitation) < 65.0, "Behavior")

            # 4. Missing Topics & Question Evaluations
            missing_topics = report.missing_topics or []
            if isinstance(missing_topics, list):
                for top in missing_topics:
                    if isinstance(top, str) and top.strip():
                        record_observation(top.strip(), 40.0, True, "Technical")

            q_evals = report.question_evaluations or []
            if isinstance(q_evals, list):
                for qe in q_evals:
                    if isinstance(qe, dict):
                        cat = qe.get("category") or "Technical"
                        tech_sc = qe.get("technical_score")
                        if tech_sc is not None:
                            record_observation(cat, float(tech_sc), float(tech_sc) < threshold, "Technical")
                        for mc in qe.get("missing_concepts") or []:
                            if isinstance(mc, str) and mc.strip():
                                record_observation(mc.strip(), 45.0, True, "Technical")

        weak_areas_list = []

        for skill_name, data in skill_tracker.items():
            weak_count = data["weak_occurrences"]
            scores = [sc for _, sc in data["scores"]]
            if not scores:
                continue

            avg_score = round(sum(scores) / len(scores), 1)
            latest_score = round(scores[-1], 1)
            prev_score = round(scores[-2], 1) if len(scores) > 1 else latest_score

            is_weak_area = (
                (weak_count >= 2) or
                (total_interviews == 1 and weak_count >= 1 and avg_score < threshold) or
                (avg_score < threshold and weak_count >= 1)
            )

            if not is_weak_area:
                continue

            # Calculate Trend
            if len(scores) < 2:
                trend = "stable"
            elif latest_score > prev_score + 3.0:
                trend = "improving"
            elif latest_score < prev_score - 3.0:
                trend = "declining"
            else:
                trend = "stable"

            # Calculate Severity
            if weak_count >= 3 or avg_score < 45.0 or latest_score < 45.0:
                severity = "high"
            elif weak_count >= 2 or avg_score < 60.0 or latest_score < 60.0:
                severity = "medium"
            else:
                severity = "low"

            # Calculate Confidence based on evidence history
            if total_interviews >= 3 and weak_count >= 2:
                confidence = "high"
            elif total_interviews >= 2 and weak_count >= 1:
                confidence = "medium"
            else:
                confidence = "low"

            rec_obj = self._match_learning_resource(skill_name, data["category"])

            weak_areas_list.append({
                "skill": skill_name,
                "category": data["category"],
                "average_score": avg_score,
                "weak_occurrences": weak_count,
                "total_observations": len(scores),
                "latest_score": latest_score,
                "trend": trend,
                "severity": severity,
                "confidence": confidence,
                "recommendation": rec_obj["recommendation"],
                "resources": rec_obj["resources"]
            })

        sev_order = {"high": 3, "medium": 2, "low": 1}
        weak_areas_list.sort(key=lambda x: (sev_order.get(x["severity"], 0), x["weak_occurrences"], -x["average_score"]), reverse=True)

        return {
            "candidate_id": candidate_id,
            "total_interviews": total_interviews,
            "weak_areas_count": len(weak_areas_list),
            "weak_areas": weak_areas_list,
            "message": (
                "No recurring weak areas detected from available interview history."
                if not weak_areas_list
                else f"Detected {len(weak_areas_list)} recurring or critical weak areas across {total_interviews} completed interviews."
            )
        }

    def _match_learning_resource(self, skill_name: str, category: str) -> Dict[str, Any]:
        """Matches a skill to existing CURATED_RESOURCE_TAXONOMY in feedback_generator.py."""
        skill_lower = skill_name.lower()

        if "java" in skill_lower:
            key = "Java"
            rec_text = f"Review {skill_name} core principles, collections, and concurrency models with hands-on practice."
        elif "react" in skill_lower or "frontend" in skill_lower or "javascript" in skill_lower:
            key = "React"
            rec_text = f"Practice state management, lifecycle patterns, and rendering optimization in {skill_name}."
        elif "design" in skill_lower or "system" in skill_lower or "distributed" in skill_lower or "microservices" in skill_lower:
            key = "System Design"
            rec_text = f"Deepen architectural knowledge on {skill_name} focusing on trade-offs, scaling, and fault tolerance."
        elif "data structures" in skill_lower or "algorithm" in skill_lower or "dsa" in skill_lower:
            key = "Data Structures & Algorithms"
            rec_text = f"Practice structured problem solving on {skill_name} using time/space complexity analysis."
        elif category == "Communication" or "communication" in skill_lower or "speaking" in skill_lower or "filler" in skill_lower:
            key = "Communication"
            rec_text = f"Perform structured speaking drills focusing on {skill_name} and replace verbal hesitations with deliberate pauses."
        elif category == "Behavior" or "eye contact" in skill_lower or "attention" in skill_lower:
            key = "Communication"
            rec_text = f"Align webcam directly with screen line-of-sight to improve {skill_name} and maintain steady engagement."
        else:
            key = "General Technical"
            rec_text = f"Strengthen fundamentals and code quality standards in {skill_name}."

        resources = CURATED_RESOURCE_TAXONOMY.get(key, CURATED_RESOURCE_TAXONOMY["General Technical"])
        return {
            "recommendation": rec_text,
            "resources": resources[:2]
        }

    async def get_candidate_performance_trends(
        self,
        db: AsyncSession,
        candidate_id: str
    ) -> Dict[str, Any]:
        """Calculates chronological performance trend across completed interviews.
        Compares overall, communication, confidence, technical, and professionalism scores.
        """
        stmt = (
            select(InterviewSession, ScoringReport)
            .join(ScoringReport, ScoringReport.session_id == InterviewSession.id)
            .where(InterviewSession.candidate_id == candidate_id)
            .where(InterviewSession.status.in_(["completed", "Completed"]))
            .order_by(InterviewSession.started_at.asc(), ScoringReport.created_at.asc())
        )
        res = await db.execute(stmt)
        records = res.all()

        total_interviews = len(records)
        if total_interviews == 0:
            return {
                "candidate_id": candidate_id,
                "total_interviews": 0,
                "overall_trend": "Insufficient Data",
                "summary": {
                    "latest_score": None,
                    "previous_score": None,
                    "score_change": 0.0,
                    "average_score": 0.0,
                    "highest_score": 0.0,
                    "lowest_score": 0.0
                },
                "timeline": [],
                "categories": {},
                "message": "No completed interviews yet."
            }

        timeline = []
        overall_scores = []
        comm_scores = []
        conf_scores = []
        tech_scores = []
        prof_scores = []

        for session, report in records:
            dt = session.started_at or report.created_at or datetime.utcnow()
            dt_str = dt.strftime("%Y-%m-%d")
            display_dt = dt.strftime("%b %d, %Y")

            overall = round(report.overall_score, 1) if report.overall_score is not None else 0.0
            comm = round(report.communication_score, 1) if report.communication_score is not None else 0.0
            conf = round(report.confidence_score, 1) if report.confidence_score is not None else 0.0
            tech = round(report.technical_score, 1) if report.technical_score is not None else 0.0
            prof = round(report.professionalism_score, 1) if report.professionalism_score is not None else 0.0

            overall_scores.append(overall)
            comm_scores.append(comm)
            conf_scores.append(conf)
            tech_scores.append(tech)
            prof_scores.append(prof)

            timeline.append({
                "session_id": session.id,
                "date": dt_str,
                "display_date": display_dt,
                "title": session.title or session.role_target or "Interview Session",
                "role_target": session.role_target or "Software Engineer",
                "round_type": session.round_type or "Technical",
                "overall_score": overall,
                "communication_score": comm,
                "confidence_score": conf,
                "technical_score": tech,
                "professionalism_score": prof,
                "recommendation": report.recommendation or "Pending"
            })

        latest_overall = overall_scores[-1]
        prev_overall = overall_scores[-2] if total_interviews > 1 else None
        overall_change = round(latest_overall - prev_overall, 1) if prev_overall is not None else 0.0

        avg_overall = round(sum(overall_scores) / len(overall_scores), 1)
        highest_overall = max(overall_scores)
        lowest_overall = min(overall_scores)

        if total_interviews < 2:
            overall_trend = "Insufficient Data"
        elif overall_change > 2.0:
            overall_trend = "Improving"
        elif overall_change < -2.0:
            overall_trend = "Declining"
        else:
            overall_trend = "Stable"

        def build_cat_trend(scores: List[float]) -> Dict[str, Any]:
            lat = scores[-1]
            prev = scores[-2] if len(scores) > 1 else None
            chg = round(lat - prev, 1) if prev is not None else 0.0
            avg = round(sum(scores) / len(scores), 1)
            if len(scores) < 2:
                tr = "Insufficient Data"
            elif chg > 2.0:
                tr = "Improving"
            elif chg < -2.0:
                tr = "Declining"
            else:
                tr = "Stable"
            return {
                "latest_score": lat,
                "previous_score": prev,
                "score_change": chg,
                "average_score": avg,
                "highest_score": max(scores),
                "lowest_score": min(scores),
                "trend": tr
            }

        categories = {
            "communication": build_cat_trend(comm_scores),
            "confidence": build_cat_trend(conf_scores),
            "technical": build_cat_trend(tech_scores),
            "professionalism": build_cat_trend(prof_scores)
        }

        return {
            "candidate_id": candidate_id,
            "total_interviews": total_interviews,
            "overall_trend": overall_trend,
            "summary": {
                "latest_score": latest_overall,
                "previous_score": prev_overall,
                "score_change": overall_change,
                "average_score": avg_overall,
                "highest_score": highest_overall,
                "lowest_score": lowest_overall
            },
            "timeline": timeline,
            "categories": categories,
            "message": (
                "Complete more interviews to see performance trends."
                if total_interviews == 1
                else f"Calculated performance trend across {total_interviews} completed interviews."
            )
        }

    async def get_candidate_ranking(
        self,
        db: AsyncSession,
        recruiter_user_id: str,
        job_id: Optional[str] = None,
        user_role: str = "recruiter"
    ) -> Dict[str, Any]:
        """Deterministic candidate ranking based on authoritative interview evaluation scores.
        Scoped to job requisition and recruiter authorization.
        Deterministic tie-breaking order:
        1. Technical score (DESC)
        2. Communication score (DESC)
        3. Confidence score (DESC)
        4. Professionalism score (DESC)
        5. Applied/Interview timestamp (ASC)
        """
        allowed_job_ids = []
        if user_role == "admin":
            if job_id:
                allowed_job_ids = [job_id]
            else:
                res_j = await db.execute(select(JobPosting.id))
                allowed_job_ids = res_j.scalars().all()
        else:
            res_rec = await db.execute(select(Recruiter).where(Recruiter.user_id == recruiter_user_id))
            recruiter = res_rec.scalar_one_or_none()
            if not recruiter:
                return {
                    "ranking": [],
                    "total_candidates": 0,
                    "ranked_candidates": 0,
                    "pending_candidates": 0,
                    "message": "No recruiter workspace found."
                }
            res_j = await db.execute(select(JobPosting.id).where(JobPosting.recruiter_id == recruiter.id))
            rec_jobs = res_j.scalars().all()
            if job_id:
                if job_id in rec_jobs:
                    allowed_job_ids = [job_id]
                else:
                    return {
                        "ranking": [],
                        "total_candidates": 0,
                        "ranked_candidates": 0,
                        "pending_candidates": 0,
                        "message": "Unauthorized: Specified job requisition does not belong to your workspace."
                    }
            else:
                allowed_job_ids = rec_jobs

        if not allowed_job_ids:
            return {
                "ranking": [],
                "total_candidates": 0,
                "ranked_candidates": 0,
                "pending_candidates": 0,
                "message": "No job requisitions found for ranking scope."
            }

        stmt_apps = (
            select(JobApplication, JobPosting, Candidate, User)
            .join(JobPosting, JobApplication.job_id == JobPosting.id)
            .join(Candidate, JobApplication.candidate_id == Candidate.id)
            .join(User, Candidate.user_id == User.id)
            .where(JobApplication.job_id.in_(allowed_job_ids))
            .order_by(JobApplication.applied_at.desc())
        )
        res_apps = await db.execute(stmt_apps)
        rows = res_apps.all()

        app_ids = [r[0].id for r in rows]

        # Strictly match completed interview sessions specifically tied to this job application
        stmt_sessions = (
            select(InterviewSession, ScoringReport)
            .join(ScoringReport, ScoringReport.session_id == InterviewSession.id)
            .where(
                InterviewSession.job_application_id.in_(app_ids),
                InterviewSession.job_application_id.isnot(None),
                InterviewSession.status.in_(["completed", "Completed"]),
                InterviewSession.interview_type != "CandidatePractice"
            )
        )
        res_sess = await db.execute(stmt_sessions)
        session_map = {}
        for session, report in res_sess.all():
            if session.job_application_id:
                existing = session_map.get(session.job_application_id)
                if not existing or (report and report.overall_score is not None and (existing[1] is None or (existing[1].overall_score or 0) < report.overall_score)):
                    session_map[session.job_application_id] = (session, report)

        ranked_items = []
        pending_items = []

        for app, job, cand, user in rows:
            sess_pair = session_map.get(app.id)
            session = sess_pair[0] if sess_pair else None
            report = sess_pair[1] if sess_pair else None

            applied_dt = app.applied_at or datetime.utcnow()
            dt_str = applied_dt.strftime("%b %d, %Y")

            if report and report.overall_score is not None:
                overall = round(report.overall_score, 1)
                tech = round(report.technical_score, 1) if report.technical_score is not None else 0.0
                comm = round(report.communication_score, 1) if report.communication_score is not None else 0.0
                conf = round(report.confidence_score, 1) if report.confidence_score is not None else 0.0
                prof = round(report.professionalism_score, 1) if report.professionalism_score is not None else 0.0

                ranked_items.append({
                    "candidate_id": cand.id,
                    "candidate_name": user.full_name or "Candidate",
                    "candidate_email": user.email,
                    "profile_image": user.profile_image,
                    "application_id": app.id,
                    "job_id": job.id,
                    "job_title": job.title,
                    "session_id": session.id if session else None,
                    "applied_at": applied_dt.isoformat(),
                    "applied_date": dt_str,
                    "overall_score": overall,
                    "technical_score": tech,
                    "communication_score": comm,
                    "confidence_score": conf,
                    "professionalism_score": prof,
                    "ats_score": round(app.ats_score, 1) if app.ats_score is not None else None,
                    "status": "Evaluation Ready" if app.status in ["Interview Scheduled", "Evaluation Ready"] else app.status,
                    "evaluation_status": "Completed",
                    "recommendation": report.recommendation or "Shortlist",
                    "_sort_key": (
                        -overall,
                        -tech,
                        -comm,
                        -conf,
                        -prof,
                        applied_dt
                    )
                })
            else:
                pending_items.append({
                    "candidate_id": cand.id,
                    "candidate_name": user.full_name or "Candidate",
                    "candidate_email": user.email,
                    "profile_image": user.profile_image,
                    "application_id": app.id,
                    "job_id": job.id,
                    "job_title": job.title,
                    "session_id": session.id if session else None,
                    "applied_at": applied_dt.isoformat(),
                    "applied_date": dt_str,
                    "overall_score": None,
                    "technical_score": None,
                    "communication_score": None,
                    "confidence_score": None,
                    "professionalism_score": None,
                    "ats_score": round(app.ats_score, 1) if app.ats_score is not None else None,
                    "status": app.status,
                    "evaluation_status": "Evaluation Pending",
                    "recommendation": "Pending",
                    "rank": None
                })

        ranked_items.sort(key=lambda x: x["_sort_key"])

        final_ranking = []
        for idx, item in enumerate(ranked_items):
            item_clean = {k: v for k, v in item.items() if k != "_sort_key"}
            item_clean["rank"] = idx + 1
            final_ranking.append(item_clean)

        final_ranking.extend(pending_items)

        return {
            "job_id": job_id,
            "total_candidates": len(final_ranking),
            "ranked_candidates": len(ranked_items),
            "pending_candidates": len(pending_items),
            "tie_breaking_order": [
                "1. Overall Score (DESC)",
                "2. Technical Score (DESC)",
                "3. Communication Score (DESC)",
                "4. Confidence Score (DESC)",
                "5. Professionalism Score (DESC)",
                "6. Application Date (ASC)"
            ],
            "ranking": final_ranking,
            "message": (
                "No candidates with completed evaluations."
                if not ranked_items and pending_items
                else ("No candidates found." if not final_ranking else f"Ranked {len(ranked_items)} candidates with completed evaluations.")
            )
        }

    async def get_candidate_skill_analytics(
        self,
        db: AsyncSession,
        candidate_id: str
    ) -> Dict[str, Any]:
        """Calculates comprehensive skill-wise analytics across all completed interview sessions
        and mock assessments for a candidate. Strictly requires completed evaluations.
        """
        stmt = (
            select(InterviewSession, ScoringReport)
            .join(ScoringReport, ScoringReport.session_id == InterviewSession.id)
            .where(InterviewSession.candidate_id == candidate_id)
            .where(InterviewSession.status.in_(["completed", "Completed"]))
            .order_by(InterviewSession.started_at.asc())
        )
        res = await db.execute(stmt)
        records = res.all()
        scoring_reports = [r[1] for r in records if r[1]]

        stmt_a = select(AssessmentResult).where(AssessmentResult.candidate_id == candidate_id)
        res_a = await db.execute(stmt_a)
        assessment_results = res_a.scalars().all()

        # If no interview and no mock assessment completed, return clear empty state (zero fake scores)
        if not scoring_reports and not assessment_results:
            return {
                "candidate_id": candidate_id,
                "total_interviews": 0,
                "total_skills_tracked": 0,
                "category_averages": {},
                "skills": [],
                "top_strengths": [],
                "focus_areas": [],
                "has_data": False,
                "message": "No interview or mock assessment conducted yet. Complete an interview or assessment to generate skill analytics."
            }

        # Also fetch resume skills for cross-referencing
        res_skills = await db.execute(
            select(ResumeSkill.skill_name)
            .join(Resume, Resume.id == ResumeSkill.resume_id)
            .where(Resume.candidate_id == candidate_id)
        )
        resume_skills_set = {s[0].strip().lower() for s in res_skills.all() if s[0]}

        # Extract technical skills directly from evaluations using our taxonomy
        extracted_skills = extract_skill_scores_from_evaluations(scoring_reports, assessment_results)
        skill_records: Dict[str, Dict[str, Any]] = dict(extracted_skills)

        def record_skill_score(raw_name: str, score: float, category_override: Optional[str] = None):
            if not raw_name or score is None:
                return
            canon, cat = normalize_skill_name(raw_name)
            used_cat = category_override or cat
            if canon not in skill_records:
                skill_records[canon] = {"category": used_cat, "scores": []}
            skill_records[canon]["scores"].append(float(score))

        # Extract communication & behavioral submetrics from reports
        for report in scoring_reports:
            if report.communication_score is not None:
                record_skill_score("Communication Core", report.communication_score, "Communication")
            if report.confidence_score is not None:
                record_skill_score("Confidence & Engagement", report.confidence_score, "Behavior")
            if report.professionalism_score is not None:
                record_skill_score("Professionalism Core", report.professionalism_score, "Professionalism")

            comm_metrics = report.communication_metrics or {}
            if isinstance(comm_metrics, dict):
                if comm_metrics.get("grammar") is not None:
                    record_skill_score("Grammar & Syntax", float(comm_metrics["grammar"]), "Communication")
                if comm_metrics.get("clarity") is not None:
                    record_skill_score("Verbal Clarity", float(comm_metrics["clarity"]), "Communication")
                if comm_metrics.get("vocabulary") is not None:
                    record_skill_score("Vocabulary Richness", float(comm_metrics["vocabulary"]), "Communication")
                if comm_metrics.get("pronunciation") is not None:
                    record_skill_score("Pronunciation", float(comm_metrics["pronunciation"]), "Communication")
                if comm_metrics.get("speaking_pace_wpm") is not None:
                    wpm_f = float(comm_metrics["speaking_pace_wpm"])
                    wpm_score = max(30.0, 100.0 - min(60.0, abs(140.0 - wpm_f) * 1.5))
                    record_skill_score("Speaking Pace", round(wpm_score, 1), "Communication")

            conf_metrics = report.confidence_metrics or {}
            if isinstance(conf_metrics, dict):
                if conf_metrics.get("eye_contact") is not None:
                    record_skill_score("Eye Contact Consistency", float(conf_metrics["eye_contact"]), "Behavior")
                if conf_metrics.get("attention") is not None:
                    record_skill_score("Attention & Focus", float(conf_metrics["attention"]), "Behavior")
                if conf_metrics.get("facial_engagement") is not None:
                    record_skill_score("Facial Engagement", float(conf_metrics["facial_engagement"]), "Behavior")
                if conf_metrics.get("hesitation_control") is not None:
                    record_skill_score("Hesitation Control", float(conf_metrics["hesitation_control"]), "Behavior")

        skills_list = []
        category_breakdown: Dict[str, List[float]] = {
            "Technical": [],
            "Communication": [],
            "Behavior": [],
            "Professionalism": []
        }

        for name, data in skill_records.items():
            scores = data["scores"]
            if not scores:
                continue
            avg_score = round(sum(scores) / len(scores), 1)
            latest_score = round(scores[-1], 1)
            prev_score = round(scores[-2], 1) if len(scores) > 1 else latest_score

            if avg_score >= 85.0:
                proficiency = "Expert"
            elif avg_score >= 70.0:
                proficiency = "Proficient"
            elif avg_score >= 55.0:
                proficiency = "Intermediate"
            else:
                proficiency = "Needs Practice"

            if len(scores) < 2:
                trend = "stable"
            elif latest_score > prev_score + 2.0:
                trend = "improving"
            elif latest_score < prev_score - 2.0:
                trend = "declining"
            else:
                trend = "stable"

            cat = data["category"]
            c_key = "Technical" if "tech" in cat.lower() or "frontend" in cat.lower() or "backend" in cat.lower() or "data" in cat.lower() or "arch" in cat.lower() or "cloud" in cat.lower() or "core" in cat.lower() else cat
            if c_key not in category_breakdown:
                category_breakdown[c_key] = []
            category_breakdown[c_key].append(avg_score)

            name_lower = name.lower()
            in_res = any(r_sk in name_lower or name_lower in r_sk for r_sk in resume_skills_set)

            skills_list.append({
                "skill": name,
                "category": cat,
                "score": avg_score,
                "latest_score": latest_score,
                "proficiency": proficiency,
                "trend": trend,
                "observations_count": len(scores),
                "in_resume": in_res,
                "evaluated": True
            })

        # Sort by score descending
        skills_list.sort(key=lambda x: x["score"], reverse=True)

        cat_averages = {}
        for cat, scs in category_breakdown.items():
            cat_averages[cat] = round(sum(scs) / len(scs), 1) if scs else 0.0

        return {
            "candidate_id": candidate_id,
            "total_interviews": len(records),
            "total_skills_tracked": len(skills_list),
            "category_averages": cat_averages,
            "skills": skills_list,
            "top_strengths": [s for s in skills_list if s["score"] >= 75.0][:5],
            "focus_areas": [s for s in skills_list if s["score"] < 65.0][:5],
            "has_data": len(skills_list) > 0
        }

    async def get_candidate_improvement_progress(
        self,
        db: AsyncSession,
        candidate_id: str
    ) -> Dict[str, Any]:
        """Calculates performance improvement trajectory, milestone badges,
        coaching summary, and velocity across completed interviews.
        """
        stmt = (
            select(InterviewSession, ScoringReport)
            .join(ScoringReport, ScoringReport.session_id == InterviewSession.id)
            .where(InterviewSession.candidate_id == candidate_id)
            .where(InterviewSession.status.in_(["completed", "Completed"]))
            .order_by(InterviewSession.started_at.asc())
        )
        res = await db.execute(stmt)
        records = res.all()

        total_interviews = len(records)
        if total_interviews == 0:
            return {
                "candidate_id": candidate_id,
                "total_interviews": 0,
                "has_data": False,
                "improvement_velocity": 0.0,
                "overall_change": 0.0,
                "milestones": [],
                "coaching_summary": "Complete your first AI interview simulation or mock assessment to start tracking your skill improvement velocity and achievements.",
                "action_items": [],
                "timeline": []
            }

        scores_timeline = []
        for session, report in records:
            dt = session.started_at or report.created_at or datetime.utcnow()
            scores_timeline.append({
                "session_id": session.id,
                "title": session.title or session.role_target or "Interview Session",
                "date": dt.strftime("%b %d, %Y"),
                "overall": round(report.overall_score or 0.0, 1),
                "technical": round(report.technical_score or 0.0, 1),
                "communication": round(report.communication_score or 0.0, 1),
                "confidence": round(report.confidence_score or 0.0, 1),
                "professionalism": round(report.professionalism_score or 0.0, 1)
            })

        first_overall = scores_timeline[0]["overall"]
        latest_overall = scores_timeline[-1]["overall"]
        overall_change = round(latest_overall - first_overall, 1)

        # Velocity: change per interview
        velocity = round(overall_change / max(1, total_interviews - 1), 1) if total_interviews > 1 else 0.0

        # Milestones
        milestones = [
            {
                "id": "first_completed",
                "title": "Initial Simulation Completed",
                "description": "Established baseline telemetry across communication and technical competencies.",
                "unlocked": True,
                "badge": "🎯",
                "date": scores_timeline[0]["date"]
            }
        ]

        max_overall = max(s["overall"] for s in scores_timeline)
        max_tech = max(s["technical"] for s in scores_timeline)
        max_comm = max(s["communication"] for s in scores_timeline)
        max_conf = max(s["confidence"] for s in scores_timeline)

        if max_overall >= 80.0:
            milestones.append({
                "id": "top_tier",
                "title": "Enterprise Ready (80%+ Overall)",
                "description": "Achieved top-tier evaluation readiness score exceeding enterprise baseline.",
                "unlocked": True,
                "badge": "🏆",
                "date": scores_timeline[-1]["date"]
            })

        if max_tech >= 85.0:
            milestones.append({
                "id": "tech_master",
                "title": "Technical Depth Master (85%+)",
                "description": "Demonstrated high technical precision and code clarity.",
                "unlocked": True,
                "badge": "⚡",
                "date": scores_timeline[-1]["date"]
            })

        if max_comm >= 80.0:
            milestones.append({
                "id": "articulate_speaker",
                "title": "Articulate Communicator (80%+)",
                "description": "Delivered structured, fluent explanations with minimal filler words.",
                "unlocked": True,
                "badge": "💬",
                "date": scores_timeline[-1]["date"]
            })

        if overall_change >= 5.0:
            milestones.append({
                "id": "growth_champion",
                "title": "Continuous Growth Champion (+5% Gain)",
                "description": f"Boosted overall performance by +{overall_change}% over consecutive simulations.",
                "unlocked": True,
                "badge": "📈",
                "date": scores_timeline[-1]["date"]
            })

        # Generate contextual coaching summary
        if overall_change > 3.0:
            coaching_summary = f"Exceptional upward momentum! Your overall score has increased by +{overall_change}% across {total_interviews} simulations. Your consistency is placing you in the top candidate percentile."
        elif overall_change < -3.0:
            coaching_summary = f"Recent sessions show slight variability ({overall_change}% delta). Focus on stabilizing response latency and review missing technical topics to return to your peak performance."
        else:
            coaching_summary = f"Stable performance baseline established across {total_interviews} interviews. Refine targeted weak areas to push past the 85% top-tier threshold."

        # Action items
        action_items = []
        if max_tech < 75.0:
            action_items.append("Practice technical problem formulation with explicit complexity and edge-case discussion.")
        if max_comm < 75.0:
            action_items.append("Incorporate deliberate 1-second pauses rather than verbal fillers (um, like) before complex answers.")
        if max_conf < 70.0:
            action_items.append("Position webcam at eye level to boost visual gaze stability and facial engagement ratings.")
        if len(action_items) < 3:
            action_items.append("Engage in a multi-round technical mock interview to maintain your competitive standing.")

        return {
            "candidate_id": candidate_id,
            "total_interviews": total_interviews,
            "first_score": first_overall,
            "latest_score": latest_overall,
            "overall_change": overall_change,
            "improvement_velocity": velocity,
            "milestones": milestones,
            "coaching_summary": coaching_summary,
            "action_items": action_items,
            "timeline": scores_timeline
        }

    async def get_candidate_comparison(
        self,
        db: AsyncSession,
        candidate_ids: List[str],
        recruiter_user_id: str,
        job_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Provides side-by-side comparative analysis of 2 to 4 candidates
        for recruiter evaluation and shortlisting decision support.
        """
        if not candidate_ids or len(candidate_ids) < 2:
            return {
                "candidates": [],
                "radar_metrics": [],
                "verdict": "Select at least 2 candidates to generate a side-by-side comparative analysis.",
                "recommendation": None
            }

    async def get_candidate_comparison(
        self,
        db: AsyncSession,
        candidate_ids: List[str],
        recruiter_user_id: str,
        job_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Provides side-by-side comparative analysis of 2 to 4 candidates or applications
        for recruiter evaluation and shortlisting decision support. Supports comparing multiple
        applications from the same candidate across different job requisitions.
        """
        if not candidate_ids or len(candidate_ids) < 2:
            return {
                "candidates": [],
                "radar_metrics": [],
                "verdict": "Select at least 2 candidates to generate a side-by-side comparative analysis.",
                "recommendation": None
            }

        target_ids = candidate_ids[:4]

        # 1. Attempt to resolve by JobApplication first (to support comparing distinct applications/roles)
        stmt_apps = (
            select(JobApplication, JobPosting, Candidate, User)
            .join(JobPosting, JobApplication.job_id == JobPosting.id)
            .join(Candidate, JobApplication.candidate_id == Candidate.id)
            .join(User, Candidate.user_id == User.id)
            .where(or_(
                JobApplication.id.in_(target_ids),
                JobApplication.candidate_id.in_(target_ids)
            ))
        )
        res_apps = await db.execute(stmt_apps)
        matched_apps = res_apps.all()

        app_map = {a.id: (a, j, c, u) for a, j, c, u in matched_apps}
        cand_to_apps: Dict[str, list] = {}
        for a, j, c, u in matched_apps:
            cand_to_apps.setdefault(c.id, []).append((a, j, c, u))

        selected_entities = []
        for tid in target_ids:
            if tid in app_map:
                selected_entities.append(app_map[tid])
            elif tid in cand_to_apps and cand_to_apps[tid]:
                used_app_ids = {e[0].id for e in selected_entities}
                avail = [ent for ent in cand_to_apps[tid] if ent[0].id not in used_app_ids]
                if avail:
                    selected_entities.append(avail[0])
                else:
                    selected_entities.append(cand_to_apps[tid][0])

        comparison_list = []

        if selected_entities:
            app_ids = [e[0].id for e in selected_entities]
            cand_ids = [e[2].id for e in selected_entities]

            stmt_sess = (
                select(InterviewSession, ScoringReport)
                .join(ScoringReport, ScoringReport.session_id == InterviewSession.id)
                .where(
                    or_(
                        InterviewSession.job_application_id.in_(app_ids),
                        InterviewSession.candidate_id.in_(cand_ids)
                    ),
                    InterviewSession.status.in_(["completed", "Completed"])
                )
                .order_by(InterviewSession.started_at.desc(), ScoringReport.created_at.desc())
            )
            res_sess = await db.execute(stmt_sess)
            sess_rows = res_sess.all()

            app_reports_map = {}
            for s, r in sess_rows:
                if s.job_application_id and s.job_application_id not in app_reports_map and r and r.overall_score is not None:
                    app_reports_map[s.job_application_id] = (s, r)

            for app, job, c, u in selected_entities:
                pair = app_reports_map.get(app.id)
                sess = pair[0] if pair else None
                rep = pair[1] if pair else None

                role_title = job.title if job else (c.target_role or "Software Engineer")
                display_name = f"{u.full_name or 'Candidate'} ({role_title})"
                ats = round(app.ats_score, 1) if app and app.ats_score is not None else 0.0

                if rep and rep.overall_score is not None:
                    overall = round(rep.overall_score, 1)
                    tech = round(rep.technical_score, 1) if rep.technical_score is not None else 0.0
                    comm = round(rep.communication_score, 1) if rep.communication_score is not None else 0.0
                    conf = round(rep.confidence_score, 1) if rep.confidence_score is not None else 0.0
                    prof = round(rep.professionalism_score, 1) if rep.professionalism_score is not None else 0.0
                    has_completed_interview = True

                    competency_pairs = [
                        ("Technical Depth", tech),
                        ("Verbal Communication", comm),
                        ("Confidence & Poise", conf),
                        ("Professionalism", prof),
                        ("ATS Alignment", ats)
                    ]
                    competency_pairs.sort(key=lambda x: x[1], reverse=True)
                    strengths = [f"{cp[0]} ({cp[1]}%)" for cp in competency_pairs[:2]]
                    concerns = [f"{cp[0]} ({cp[1]}%)" for cp in competency_pairs[-2:] if cp[1] < 75.0]
                    if not concerns:
                        concerns = ["No critical concerns identified"]

                    recommendation = (
                        "Strong Hire" if overall >= 85.0 and tech >= 80.0 else
                        "Hire / Advance" if overall >= 75.0 else
                        "Borderline / Additional Evaluation" if overall >= 65.0 else "Decline"
                    )
                else:
                    overall = ats if ats > 0 else 0.0
                    tech = 0.0
                    comm = 0.0
                    conf = 0.0
                    prof = 0.0
                    has_completed_interview = False
                    strengths = [f"ATS Resume Match ({ats}%)"] if ats > 0 else ["Application Submitted"]
                    concerns = ["Interview session pending completion"]
                    recommendation = "Pending Interview"

                comparison_list.append({
                    "id": app.id,
                    "application_id": app.id,
                    "candidate_id": c.id,
                    "user_id": u.id,
                    "name": display_name,
                    "raw_name": u.full_name or "Candidate",
                    "email": u.email,
                    "profile_image": u.profile_image,
                    "target_role": role_title,
                    "job_title": role_title,
                    "overall_score": overall,
                    "technical_score": tech,
                    "communication_score": comm,
                    "confidence_score": conf,
                    "professionalism_score": prof,
                    "ats_score": ats,
                    "has_completed_interview": has_completed_interview,
                    "session_id": sess.id if sess else None,
                    "strengths": strengths,
                    "concerns": concerns,
                    "recommendation": recommendation,
                    "status": app.status if app else "Active Candidate"
                })
        else:
            # Fallback to direct candidate querying if no applications matched
            stmt_c = (
                select(Candidate, User)
                .join(User, Candidate.user_id == User.id)
                .where(Candidate.id.in_(target_ids))
            )
            res_c = await db.execute(stmt_c)
            cand_rows = res_c.all()
            cand_map = {c.id: (c, u) for c, u in cand_rows}

            stmt_sess = (
                select(InterviewSession, ScoringReport)
                .join(ScoringReport, ScoringReport.session_id == InterviewSession.id)
                .where(
                    InterviewSession.candidate_id.in_(target_ids),
                    InterviewSession.status.in_(["completed", "Completed"])
                )
                .order_by(InterviewSession.started_at.desc(), ScoringReport.created_at.desc())
            )
            res_sess = await db.execute(stmt_sess)
            sess_rows = res_sess.all()

            reports_map = {}
            for s, r in sess_rows:
                if s.candidate_id not in reports_map and r and r.overall_score is not None:
                    reports_map[s.candidate_id] = (s, r)

            for cid in target_ids:
                if cid not in cand_map:
                    continue
                c, u = cand_map[cid]
                pair = reports_map.get(cid)
                sess = pair[0] if pair else None
                rep = pair[1] if pair else None

                overall = round(rep.overall_score, 1) if rep and rep.overall_score is not None else (round(c.readiness_score, 1) if c.readiness_score else 75.0)
                tech = round(rep.technical_score, 1) if rep and rep.technical_score is not None else 72.0
                comm = round(rep.communication_score, 1) if rep and rep.communication_score is not None else 75.0
                conf = round(rep.confidence_score, 1) if rep and rep.confidence_score is not None else 74.0
                prof = round(rep.professionalism_score, 1) if rep and rep.professionalism_score is not None else 80.0
                ats = 82.0

                competency_pairs = [
                    ("Technical Depth", tech),
                    ("Verbal Communication", comm),
                    ("Confidence & Poise", conf),
                    ("Professionalism", prof),
                    ("ATS Alignment", ats)
                ]
                competency_pairs.sort(key=lambda x: x[1], reverse=True)
                strengths = [f"{cp[0]} ({cp[1]}%)" for cp in competency_pairs[:2]]
                concerns = [f"{cp[0]} ({cp[1]}%)" for cp in competency_pairs[-2:] if cp[1] < 75.0]
                if not concerns:
                    concerns = ["No critical concerns identified"]

                recommendation = (
                    "Strong Hire" if overall >= 85.0 and tech >= 80.0 else
                    "Hire / Advance" if overall >= 75.0 else
                    "Borderline / Additional Evaluation" if overall >= 65.0 else "Decline"
                )

                comparison_list.append({
                    "application_id": None,
                    "candidate_id": c.id,
                    "user_id": u.id,
                    "name": u.full_name or "Candidate",
                    "raw_name": u.full_name or "Candidate",
                    "email": u.email,
                    "profile_image": u.profile_image,
                    "target_role": c.target_role or "Software Engineer",
                    "job_title": c.target_role or "Software Engineer",
                    "overall_score": overall,
                    "technical_score": tech,
                    "communication_score": comm,
                    "confidence_score": conf,
                    "professionalism_score": prof,
                    "ats_score": ats,
                    "has_completed_interview": rep is not None,
                    "session_id": sess.id if sess else None,
                    "strengths": strengths,
                    "concerns": concerns,
                    "recommendation": recommendation,
                    "status": "Active Candidate"
                })

        # Build radar chart metrics for Recharts
        radar_metrics = [
            {"metric": "Overall Score"},
            {"metric": "Technical"},
            {"metric": "Communication"},
            {"metric": "Confidence"},
            {"metric": "Professionalism"},
            {"metric": "ATS Match"}
        ]
        key_map = [
            ("Overall Score", "overall_score"),
            ("Technical", "technical_score"),
            ("Communication", "communication_score"),
            ("Confidence", "confidence_score"),
            ("Professionalism", "professionalism_score"),
            ("ATS Match", "ats_score")
        ]

        for item in radar_metrics:
            m_label = item["metric"]
            sc_key = next((k for lbl, k in key_map if lbl == m_label), "overall_score")
            for idx, cand in enumerate(comparison_list):
                item[f"candidate_{idx + 1}"] = cand[sc_key]
                item[f"name_{idx + 1}"] = cand["name"]

        # Formulate comparative AI verdict
        if len(comparison_list) >= 2:
            sorted_by_overall = sorted(comparison_list, key=lambda x: (x["overall_score"], x["technical_score"]), reverse=True)
            leader = sorted_by_overall[0]
            runner_up = sorted_by_overall[1]
            diff = round(leader["overall_score"] - runner_up["overall_score"], 1)

            if diff >= 5.0:
                verdict = f"{leader['name']} demonstrates clear overall advantage (+{diff}% overall, {leader['technical_score']}% Technical) with superior interview fluency and competency alignment."
                top_pick = leader.get("application_id") or leader.get("candidate_id")
            else:
                verdict = f"Close competition between {leader['name']} ({leader['overall_score']}%) and {runner_up['name']} ({runner_up['overall_score']}%). {leader['name']} edges out in {leader['strengths'][0]}, while {runner_up['name']} offers strong balance."
                top_pick = leader.get("application_id") or leader.get("candidate_id")
        else:
            verdict = "Comparison metrics compiled successfully."
            top_pick = (comparison_list[0].get("application_id") or comparison_list[0].get("candidate_id")) if comparison_list else None

        return {
            "candidates": comparison_list,
            "radar_metrics": radar_metrics,
            "verdict": verdict,
            "top_pick_candidate_id": top_pick,
            "comparison_count": len(comparison_list)
        }

    async def get_recruiter_skill_analytics(
        self,
        db: AsyncSession,
        recruiter_user_id: str,
        job_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Calculates aggregate applicant pool skill competencies, demand vs supply,
        and per-candidate granular skill breakdowns for recruiter's job requisitions directly from PostgreSQL.
        Strictly requires completed evaluations (no fake scores).
        """
        res_rec = await db.execute(select(Recruiter).where(Recruiter.user_id == recruiter_user_id))
        recruiter = res_rec.scalar_one_or_none()

        job_filter = [JobPosting.recruiter_id == recruiter.id] if recruiter else []
        if job_id:
            job_filter.append(JobPosting.id == job_id)

        res_j = await db.execute(select(JobPosting.id, JobPosting.title, JobPosting.required_skills).where(*job_filter))
        jobs = res_j.all()
        job_ids = [j[0] for j in jobs]

        if not job_ids:
            return {
                "total_skills_evaluated": 0,
                "pool_size": 0,
                "skill_benchmarks": [],
                "skills": [],
                "candidate_skills": [],
                "talent_gaps": [],
                "top_strengths": [],
                "expert_ratio": "0.0%",
                "has_data": False,
                "message": "No active job requisitions found."
            }

        # Fetch applications and candidate info
        stmt_apps = (
            select(JobApplication, Candidate, User, JobPosting)
            .join(Candidate, JobApplication.candidate_id == Candidate.id)
            .join(User, Candidate.user_id == User.id)
            .join(JobPosting, JobApplication.job_id == JobPosting.id)
            .where(JobApplication.job_id.in_(job_ids))
            .order_by(JobApplication.applied_at.desc())
        )
        res_apps = await db.execute(stmt_apps)
        app_rows = res_apps.all()
        app_ids = [r[0].id for r in app_rows]
        candidate_ids = list(set([r[1].id for r in app_rows]))

        if not candidate_ids:
            return {
                "total_skills_evaluated": 0,
                "pool_size": 0,
                "skill_benchmarks": [],
                "skills": [],
                "candidate_skills": [],
                "talent_gaps": [],
                "top_strengths": [],
                "expert_ratio": "0.0%",
                "has_data": False,
                "message": "No candidate applications received yet."
            }

        # Fetch completed scoring reports for these candidates
        stmt_rep = (
            select(ScoringReport, InterviewSession)
            .join(InterviewSession, ScoringReport.session_id == InterviewSession.id)
            .where(
                or_(
                    InterviewSession.candidate_id.in_(candidate_ids),
                    InterviewSession.job_application_id.in_(app_ids)
                ),
                InterviewSession.status.in_(["completed", "Completed"])
            )
        )
        res_rep = await db.execute(stmt_rep)
        rep_rows = res_rep.all()

        # Fetch completed assessment results joined with AssessmentSession
        stmt_assess = (
            select(AssessmentResult, AssessmentSession)
            .join(AssessmentSession, AssessmentResult.session_id == AssessmentSession.id)
            .where(
                or_(
                    AssessmentSession.job_application_id.in_(app_ids),
                    AssessmentResult.candidate_id.in_(candidate_ids)
                )
            )
        )
        res_assess = await db.execute(stmt_assess)
        assess_rows = res_assess.all()

        # Map evaluations strictly to job_application_id to prevent cross-job data pollution
        app_reps_map: Dict[str, List[ScoringReport]] = {}
        for report, session in rep_rows:
            if session.job_application_id:
                app_reps_map.setdefault(session.job_application_id, []).append(report)

        app_assess_map: Dict[str, List[AssessmentResult]] = {}
        raw_assess_list: List[AssessmentResult] = []
        for a_res, a_sess in assess_rows:
            raw_assess_list.append(a_res)
            if a_sess.job_application_id:
                app_assess_map.setdefault(a_sess.job_application_id, []).append(a_res)

        # Fetch scheduled interviews to determine pending interview status
        stmt_sch = select(ScheduledInterview).where(ScheduledInterview.job_application_id.in_(app_ids))
        res_sch = await db.execute(stmt_sch)
        sch_rows = res_sch.scalars().all()
        app_sch_map: Dict[str, List[ScheduledInterview]] = {}
        for s in sch_rows:
            if s.job_application_id:
                app_sch_map.setdefault(s.job_application_id, []).append(s)

        # Build candidate-specific skill analytics (JavaScript, React, DSA, Python, SQL, etc.)
        candidate_skill_profiles = []
        seen_app_ids = set()

        for app, cand, user, job in app_rows:
            if app.id in seen_app_ids:
                continue
            seen_app_ids.add(app.id)

            cand_reps = app_reps_map.get(app.id, [])
            cand_ass = app_assess_map.get(app.id, [])
            has_eval = len(cand_reps) > 0 or len(cand_ass) > 0

            cand_skill_entries = []

            if has_eval:
                cand_extracted = extract_skill_scores_from_evaluations(cand_reps, cand_ass)
                # Primary skills from taxonomy
                for tax in TECHNICAL_SKILLS_TAXONOMY:
                    s_name = tax["name"]
                    cat = tax["category"]
                    if s_name in cand_extracted:
                        scs = [s for s in cand_extracted[s_name]["scores"] if s > 0]
                        if scs:
                            avg_sc = round(sum(scs) / len(scs), 1)
                            prof = "Expert" if avg_sc >= 80.0 else ("Proficient" if avg_sc >= 70.0 else ("Intermediate" if avg_sc >= 55.0 else "Needs Practice"))
                            cand_skill_entries.append({
                                "skill": s_name,
                                "score": avg_sc,
                                "category": cat,
                                "proficiency": prof,
                                "evaluated": True
                            })
                        else:
                            cand_skill_entries.append({
                                "skill": s_name,
                                "score": None,
                                "category": cat,
                                "proficiency": "Not Evaluated",
                                "evaluated": False
                            })
                    else:
                        # Core skill not tested
                        cand_skill_entries.append({
                            "skill": s_name,
                            "score": None,
                            "category": cat,
                            "proficiency": "Not Evaluated",
                            "evaluated": False
                        })

                # Also add any non-taxonomy skills that were evaluated
                for s_name, s_info in cand_extracted.items():
                    if not any(entry["skill"] == s_name for entry in cand_skill_entries):
                        scs = [s for s in s_info["scores"] if s > 0]
                        if scs:
                            avg_sc = round(sum(scs) / len(scs), 1)
                            prof = "Expert" if avg_sc >= 80.0 else ("Proficient" if avg_sc >= 70.0 else ("Intermediate" if avg_sc >= 55.0 else "Needs Practice"))
                            cand_skill_entries.append({
                                "skill": s_name,
                                "score": avg_sc,
                                "category": s_info.get("category", "Technical"),
                                "proficiency": prof,
                                "evaluated": True
                            })

                latest_rep = cand_reps[-1] if cand_reps else None
                latest_ass = cand_ass[-1] if cand_ass else None
                tech_rep = next((r for r in reversed(cand_reps) if r.technical_score is not None), None)
                comm_rep = next((r for r in reversed(cand_reps) if r.communication_score is not None), None)

                overall_sc = round(latest_rep.overall_score, 1) if (latest_rep and latest_rep.overall_score is not None) else (round(latest_ass.overall_score, 1) if latest_ass else None)
                tech_sc = round(tech_rep.technical_score, 1) if (tech_rep and tech_rep.technical_score is not None) else (round(latest_ass.overall_score, 1) if latest_ass else None)
                comm_sc = round(comm_rep.communication_score, 1) if (comm_rep and comm_rep.communication_score is not None) else None
                status_str = "Completed" if app.status in ["Hired", "Offer Sent", "Selected", "Interview Completed"] else "Evaluated"
            else:
                for tax in TECHNICAL_SKILLS_TAXONOMY:
                    cand_skill_entries.append({
                        "skill": tax["name"],
                        "score": None,
                        "category": tax["category"],
                        "proficiency": "Pending Evaluation",
                        "evaluated": False
                    })
                overall_sc = None
                tech_sc = None
                comm_sc = None
                status_str = "Pending Evaluation"

            candidate_skill_profiles.append({
                "id": app.id,
                "application_id": app.id,
                "candidate_id": cand.id,
                "candidate_name": user.full_name or "Candidate",
                "candidate_email": user.email,
                "profile_image": user.profile_image,
                "job_title": job.title,
                "job_id": job.id,
                "ats_score": round(app.ats_score, 1) if app.ats_score is not None else None,
                "interview_status": status_str,
                "evaluated": has_eval,
                "overall_score": overall_sc,
                "technical_score": tech_sc,
                "communication_score": comm_sc,
                "skills": cand_skill_entries,
                "evaluated_skills_count": sum(1 for s in cand_skill_entries if s["evaluated"])
            })

        # Calculate talent-pool aggregate benchmarks ONLY from verified evaluations
        all_eval_reports = [r[0] for r in rep_rows]
        pool_skill_data = extract_skill_scores_from_evaluations(all_eval_reports, raw_assess_list)

        benchmarks = []
        all_individual_scores = []

        for skill_name, info in pool_skill_data.items():
            scs = info["scores"]
            if not scs:
                continue
            avg_sc = round(sum(scs) / len(scs), 1)
            all_individual_scores.extend(scs)
            expert_count = sum(1 for s in scs if s >= 80.0)
            proficient_count = sum(1 for s in scs if 70.0 <= s < 80.0)
            intermediate_count = sum(1 for s in scs if 50.0 <= s < 70.0)
            needs_practice_count = sum(1 for s in scs if s < 50.0)
            tot = len(scs)
            dist = {
                "expert": round((expert_count / tot) * 100),
                "proficient": round((proficient_count / tot) * 100),
                "intermediate": round((intermediate_count / tot) * 100),
                "needs_practice": round((needs_practice_count / tot) * 100)
            }
            status = "Strong Supply" if avg_sc >= 80.0 else "Moderate Supply" if avg_sc >= 70.0 else "Talent Deficit"
            benchmarks.append({
                "skill": skill_name,
                "category": info["category"],
                "average_score": avg_sc,
                "evaluations_count": tot,
                "qualified_percentage": round((sum(1 for s in scs if s >= 70.0) / tot) * 100, 1),
                "distribution": dist,
                "status": status
            })

        benchmarks.sort(key=lambda x: x["average_score"], reverse=True)
        talent_gaps = [b for b in benchmarks if b["average_score"] < 75.0]

        expert_ratio = "0.0%"
        if all_individual_scores:
            exp_p = round((sum(1 for s in all_individual_scores if s >= 70.0) / len(all_individual_scores)) * 100, 1)
            expert_ratio = f"{exp_p}%"

        top_strengths = [{"skill": b["skill"], "score": b["average_score"]} for b in benchmarks[:3]]
        has_eval_data = len(benchmarks) > 0

        return {
            "pool_size": len(candidate_ids),
            "total_evaluations": len(rep_rows) + len(assess_rows),
            "total_skills_evaluated": len(benchmarks),
            "skill_benchmarks": benchmarks,
            "skills": benchmarks,
            "candidate_skills": candidate_skill_profiles,
            "talent_gaps": talent_gaps,
            "top_performing_skills": benchmarks[:3],
            "top_strengths": top_strengths,
            "expert_ratio": expert_ratio,
            "has_data": has_eval_data,
            "message": (
                f"Aggregated skill competency across {len(candidate_ids)} candidates."
                if has_eval_data
                else "No candidate interview evaluations recorded yet for this requisition scope."
            )
        }

    async def get_recruiter_performance_trends(
        self,
        db: AsyncSession,
        recruiter_user_id: str,
        job_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Computes cohort performance trend over time for candidates applying to recruiter's jobs directly from PostgreSQL."""
        res_rec = await db.execute(select(Recruiter).where(Recruiter.user_id == recruiter_user_id))
        recruiter = res_rec.scalar_one_or_none()

        job_filter = [JobPosting.recruiter_id == recruiter.id] if recruiter else []
        if job_id:
            job_filter.append(JobPosting.id == job_id)

        res_j = await db.execute(select(JobPosting.id).where(*job_filter))
        job_ids = res_j.scalars().all()

        if not job_ids:
            return {"timeline": [], "trends": [], "overall_trend": "No Data", "average_overall": 0.0, "velocity": "+0.0% / Cycle", "pass_rate": "0.0%"}

        stmt_apps = (
            select(JobApplication.id, JobApplication.candidate_id)
            .where(JobApplication.job_id.in_(job_ids))
        )
        res_apps = await db.execute(stmt_apps)
        app_rows = res_apps.all()
        app_ids = [r[0] for r in app_rows]
        cand_ids = list(set([r[1] for r in app_rows if r[1]]))

        stmt_sess = (
            select(InterviewSession, ScoringReport)
            .join(ScoringReport, ScoringReport.session_id == InterviewSession.id)
            .where(
                or_(
                    InterviewSession.job_application_id.in_(app_ids),
                    InterviewSession.candidate_id.in_(cand_ids)
                ),
                InterviewSession.status.in_(["completed", "Completed"])
            )
            .order_by(InterviewSession.started_at.asc())
        )
        res_sess = await db.execute(stmt_sess)
        rows = res_sess.all()

        timeline = []
        scores = []
        for idx, (session, report) in enumerate(rows):
            dt = session.started_at or report.created_at or datetime.utcnow()
            sc = round(report.overall_score or 0.0, 1)
            tech = round(report.technical_score or 0.0, 1)
            comm = round(report.communication_score or 0.0, 1)
            conf = round(report.confidence_score or 0.0, 1)
            scores.append(sc)
            batch_label = f"Session #{idx + 1} ({dt.strftime('%b %d')})"
            timeline.append({
                "batch": batch_label,
                "date": dt.strftime("%b %d"),
                "session_id": session.id,
                "overall": sc,
                "overall_score": sc,
                "technical": tech,
                "technical_score": tech,
                "communication": comm,
                "communication_score": comm,
                "confidence": conf,
                "confidence_score": conf
            })

        avg_score = round(sum(scores) / len(scores), 1) if scores else 0.0
        trend_status = "Improving" if len(scores) >= 2 and scores[-1] > scores[0] else ("Stable" if scores else "No Data")
        pass_count = sum(1 for s in scores if s >= 70.0)
        pass_rate_str = f"{round((pass_count / len(scores)) * 100, 1)}%" if scores else "0.0%"
        velocity_val = round(((scores[-1] - scores[0]) / max(1, len(scores) - 1)), 1) if len(scores) >= 2 else 0.0
        velocity_str = f"{'+' if velocity_val >= 0 else ''}{velocity_val}% / Cycle"

        return {
            "total_evaluations": len(timeline),
            "average_overall": avg_score,
            "overall_trend": trend_status,
            "velocity": velocity_str,
            "pass_rate": pass_rate_str,
            "timeline": timeline,
            "trends": timeline
        }

    async def get_recruiter_shortlisting_insights(
        self,
        db: AsyncSession,
        recruiter_user_id: str,
        job_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Provides dynamic real-time AI shortlisting insights and candidate recommendations based on PostgreSQL records.
        Strictly requires completed interview evaluations (no premature insights).
        """
        rank_data = await self.get_candidate_ranking(db, recruiter_user_id, job_id)
        # Strictly require completed evaluations!
        ranked = [
            c for c in rank_data.get("ranking", [])
            if c.get("evaluation_status") == "Completed" and c.get("overall_score") is not None
        ]

        all_cids = list(set([c["candidate_id"] for c in ranked if c.get("candidate_id")]))
        skills_map: Dict[str, List[str]] = {}
        if all_cids:
            stmt_sk = (
                select(ResumeSkill.skill_name, Resume.candidate_id)
                .join(Resume, ResumeSkill.resume_id == Resume.id)
                .where(Resume.candidate_id.in_(all_cids))
            )
            res_sk = await db.execute(stmt_sk)
            for skill_name, cand_id in res_sk.all():
                if cand_id not in skills_map:
                    skills_map[cand_id] = []
                if skill_name not in skills_map[cand_id]:
                    skills_map[cand_id].append(skill_name)

        recommended = []
        borderline = []

        # Process strictly evaluated candidates
        for c in ranked:
            cid = c.get("candidate_id")
            overall = c.get("overall_score") or 0.0
            tech = c.get("technical_score") or 0.0
            comm = c.get("communication_score") or 0.0
            cand_skills = skills_map.get(cid, [])
            strengths = cand_skills[:3] if cand_skills else ["Technical Problem Solving", "Verbal Communication", "Role Competency"]
            risk = "None detected" if overall >= 75.0 else ("Technical verification recommended" if tech < 65.0 else "Borderline communication clarity")

            fit_tier = "Top Match" if overall >= 80.0 else ("Strong Contender" if overall >= 70.0 else "Qualified Applicant")
            rec_reason = (
                f"Exceptional performance ({overall}% overall score, {tech}% technical, {comm}% communication). "
                f"Demonstrated strong mastery aligned with {c.get('job_title', 'role')} requirements."
                if overall >= 80.0
                else f"Solid evaluation score ({overall}% overall). Verified baseline across technical and communication competencies."
            )
            item = {
                "id": c.get("application_id") or cid,
                "application_id": c.get("application_id"),
                "candidate_id": cid,
                "session_id": c.get("session_id"),
                "job_id": c.get("job_id"),
                "candidate_name": c.get("candidate_name"),
                "candidate_email": c.get("candidate_email"),
                "profile_image": c.get("profile_image"),
                "job_title": c.get("job_title"),
                "overall_score": overall,
                "ats_score": c.get("ats_score"),
                "technical_score": tech,
                "communication_score": comm,
                "recommendation_reason": rec_reason,
                "match_reason": rec_reason,
                "key_strengths": strengths,
                "risk_flag": risk,
                "fit_tier": fit_tier
            }
            if overall >= 80.0:
                recommended.append(item)
            else:
                borderline.append(item)

        total_evaluated = len(ranked)
        total_candidates = rank_data.get("total_candidates", 0)
        all_recs = (recommended + borderline)[:6]
        top_rate = round((len(recommended) / max(1, total_evaluated)) * 100, 1) if total_evaluated > 0 else 0.0

        insights = []
        if all_recs:
            insights.append(f"{len(recommended)} candidate(s) meet or exceed enterprise top-tier benchmark criteria.")
            insights.append(f"Talent qualification rate across completed interview evaluations is {top_rate}%.")
            insights.append("Algorithmic shortlisting weights combined interview evaluation scores, ATS keywords, and technical depth.")
        else:
            insights.append("No candidate interview evaluations recorded yet for this job requisition.")
            insights.append("AI Shortlisting Insights will activate once candidates complete an interview or mock assessment.")

        return {
            "total_candidates": total_candidates,
            "ranked_candidates": total_evaluated,
            "highly_recommended_count": len(recommended),
            "qualified_count": len(borderline),
            "top_tier_pass_rate": top_rate,
            "recommendations": all_recs,
            "top_recommendations": all_recs,
            "has_data": len(all_recs) > 0,
            "insights": insights
        }


analytics_service = AnalyticsService()

