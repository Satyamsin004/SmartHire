import logging
from typing import Dict, Any, List, Optional
from app.services.ai_engine import ai_engine

logger = logging.getLogger("smarthire.feedback_generator")

CURATED_RESOURCE_TAXONOMY = {
    "Java": [
        {"title": "Oracle Official Java Documentation & Tutorials", "provider": "Oracle", "url": "https://docs.oracle.com/en/java/", "type": "Documentation", "difficulty": "Beginner-Advanced"},
        {"title": "Baeldung Core Java & JVM Architecture Guides", "provider": "Baeldung", "url": "https://www.baeldung.com/category/java/", "type": "Article Series", "difficulty": "Intermediate"},
        {"title": "Java Memory Model & Concurrency in Practice", "provider": "Java Community", "url": "https://docs.oracle.com/javase/tutorial/essential/concurrency/", "type": "Guide", "difficulty": "Advanced"}
    ],
    "React": [
        {"title": "Official React Documentation (react.dev)", "provider": "React Core Team", "url": "https://react.dev/", "type": "Documentation", "difficulty": "All Levels"},
        {"title": "React Re-renders and Performance Optimization Guide", "provider": "Kent C. Dodds", "url": "https://kentcdodds.com/blog/usememo-and-usecallback", "type": "Article", "difficulty": "Intermediate"},
        {"title": "Redux Toolkit & Modern State Management", "provider": "Redux Team", "url": "https://redux-toolkit.js.org/introduction/getting-started", "type": "Documentation", "difficulty": "Intermediate"}
    ],
    "System Design": [
        {"title": "The System Design Primer", "provider": "Donne Martin (GitHub)", "url": "https://github.com/donnemartin/system-design-primer", "type": "Open Source Course", "difficulty": "Comprehensive"},
        {"title": "Designing Data-Intensive Applications Core Concepts", "provider": "O'Reilly / Martin Kleppmann", "url": "https://dataintensive.net/", "type": "Book Reference", "difficulty": "Advanced"},
        {"title": "AWS Architecture Center & Well-Architected Framework", "provider": "Amazon Web Services", "url": "https://aws.amazon.com/architecture/", "type": "Reference Architecture", "difficulty": "Advanced"}
    ],
    "Data Structures & Algorithms": [
        {"title": "NeetCode 150 Structured Coding Roadmaps", "provider": "NeetCode", "url": "https://neetcode.io/roadmap", "type": "Interactive Roadmap", "difficulty": "All Levels"},
        {"title": "Tech Interview Handbook: Algorithms Study Guide", "provider": "Yangshun Tay", "url": "https://www.techinterviewhandbook.org/algorithms/algorithms-cheatsheet/", "type": "Cheat Sheet", "difficulty": "Intermediate"},
        {"title": "Visualgo: Visualising Data Structures & Algorithms", "provider": "National University of Singapore", "url": "https://visualgo.net/en", "type": "Interactive Visualization", "difficulty": "Beginner-Intermediate"}
    ],
    "Communication": [
        {"title": "Toastmasters Public Speaking & Filler Control Techniques", "provider": "Toastmasters International", "url": "https://www.toastmasters.org/resources/public-speaking-tips", "type": "Guide", "difficulty": "All Levels"},
        {"title": "Harvard Business Review: How to Speak With Confidence in Interviews", "provider": "Harvard Business Review", "url": "https://hbr.org/topic/public-speaking", "type": "Article", "difficulty": "Professional"},
        {"title": "Purdue Online Writing Lab (OWL) - Sentence Structure & Fluency", "provider": "Purdue University", "url": "https://owl.purdue.edu/", "type": "Academic Reference", "difficulty": "Foundational"}
    ],
    "General Technical": [
        {"title": "Clean Code & Refactoring Patterns", "provider": "Refactoring Guru", "url": "https://refactoring.guru/", "type": "Design Patterns", "difficulty": "Intermediate"},
        {"title": "Mozilla Developer Network (MDN) Web Docs", "provider": "Mozilla", "url": "https://developer.mozilla.org/", "type": "Documentation", "difficulty": "Foundational-Advanced"},
        {"title": "SQL Indexing and Query Performance Tuning", "provider": "Use The Index, Luke", "url": "https://use-the-index-luke.com/", "type": "Guide", "difficulty": "Intermediate-Advanced"}
    ]
}

class FeedbackGenerator:
    """Generates evidence-backed strengths, weaknesses, practice recommendations,
    and curated learning resources without hallucination.
    """

    def generate_feedback(
        self,
        speech_metrics: Dict[str, Any],
        visual_metrics: Dict[str, Any],
        technical_metrics: Dict[str, Any],
        overall_score: float,
        role_target: str = "Software Engineer"
    ) -> Dict[str, Any]:
        """Generates evidence-backed structured feedback referencing concrete metrics."""
        strengths = []
        weaknesses = []
        practice_recommendations = []
        matched_resources = []

        # 1. Evaluate Speech Evidence
        wpm = speech_metrics.get("average_wpm", 140.0)
        filler_rate = speech_metrics.get("filler_rate", 0.0)
        filler_count = speech_metrics.get("filler_count", 0)
        grammar_score = speech_metrics.get("grammar_score", 85.0)
        clarity_score = speech_metrics.get("clarity_score", 85.0)

        if 120 <= wpm <= 165:
            strengths.append(f"Maintained an optimal speaking pace of {wpm} WPM (ideal comfortable range: 120-165 WPM).")
        elif wpm > 175:
            weaknesses.append(f"Speaking pace was elevated at {wpm} WPM, which may reduce clarity during complex technical explanations.")
            practice_recommendations.append("Practice technical explanations with a metronome or timer at approximately 140 WPM, incorporating 1-second deliberate pauses between architectural concepts.")
            matched_resources.extend(CURATED_RESOURCE_TAXONOMY["Communication"][:2])

        if filler_count <= 4:
            strengths.append(f"Demonstrated strong verbal fluency with low filler word frequency ({filler_count} fillers across entire session).")
        else:
            top_fillers = list(speech_metrics.get("filler_breakdown", {}).keys())[:3]
            fillers_str = f" ('{', '.join(top_fillers)}')" if top_fillers else ""
            weaknesses.append(f"High filler-word frequency detected with {filler_count} filler words recorded ({filler_rate}% filler rate){fillers_str}.")
            practice_recommendations.append("Perform 60-second timed speaking drills: whenever you feel the impulse to use filler words like 'um' or 'basically', replace them with silent pauses.")
            matched_resources.extend(CURATED_RESOURCE_TAXONOMY["Communication"][:2])

        if grammar_score >= 85.0:
            strengths.append(f"Clear sentence construction with high grammatical precision ({grammar_score}% grammar quality).")
        else:
            samples = speech_metrics.get("grammar_errors_sample", [])
            err_example = f" (e.g. '{samples[0]['matched_text']}')" if samples else ""
            weaknesses.append(f"Detected grammatical inconsistencies across technical answers{err_example} ({speech_metrics.get('grammar_error_count', 0)} issues detected).")
            practice_recommendations.append("Review complex verb tense agreements and passive voice structures before technical interviews.")

        # 2. Evaluate Visual & Gaze Evidence
        eye_contact = visual_metrics.get("eye_contact_ratio", 85.0)
        attention = visual_metrics.get("attention_score", 85.0)

        if eye_contact >= 75.0:
            strengths.append(f"Consistently maintained camera eye contact for {eye_contact}% of active speaking duration.")
        else:
            weaknesses.append(f"Eye contact dropped to {eye_contact}% (below the 75% target threshold), indicating frequent gaze departures.")
            practice_recommendations.append("Position your interview window directly underneath your webcam lens to maintain natural line-of-sight during remote simulation.")

        # 3. Evaluate Technical Evidence
        tech_score = technical_metrics.get("technical_score", 80.0)
        accuracy = technical_metrics.get("accuracy", 80.0)
        missing_topics = technical_metrics.get("missing_topics", [])
        covered_topics = technical_metrics.get("covered_topics", [])

        if tech_score >= 80.0:
            strengths.append(f"Demonstrated strong technical accuracy ({accuracy}%) in key required competencies for {role_target}.")
        if covered_topics:
            strengths.append(f"Effectively addressed foundational technical concepts: {', '.join(covered_topics[:3])}.")

        if missing_topics:
            weaknesses.append(f"Omitted key expected architectural topics during responses: {', '.join(missing_topics[:3])}.")
            practice_recommendations.append(f"Deepen architectural knowledge on {missing_topics[0]} by building hands-on reference implementations.")

        # Match Resources based on role & topics
        role_lower = role_target.lower()
        if "java" in role_lower or "spring" in role_lower:
            matched_resources.extend(CURATED_RESOURCE_TAXONOMY["Java"])
        elif "react" in role_lower or "frontend" in role_lower:
            matched_resources.extend(CURATED_RESOURCE_TAXONOMY["React"])
        elif "design" in role_lower or "backend" in role_lower:
            matched_resources.extend(CURATED_RESOURCE_TAXONOMY["System Design"])
        else:
            matched_resources.extend(CURATED_RESOURCE_TAXONOMY["Data Structures & Algorithms"])
            matched_resources.extend(CURATED_RESOURCE_TAXONOMY["System Design"])

        # Fallback defaults if list is too small
        if not strengths:
            strengths = [f"Successfully completed structured interview simulation for {role_target}", "Demonstrated consistent engagement throughout questions"]
        if not weaknesses:
            weaknesses = ["No critical weaknesses detected; continue refining technical depth on complex edge-case architectures."]
        if not practice_recommendations:
            practice_recommendations = ["Practice answering system design questions using the STAR framework with quantifiable benchmarks."]

        # Deduplicate resources by URL
        seen_urls = set()
        unique_resources = []
        for r in matched_resources:
            if r["url"] not in seen_urls:
                seen_urls.add(r["url"])
                unique_resources.append(r)

        return {
            "strengths": strengths[:5],
            "weaknesses": weaknesses[:4],
            "improvement_plan": [
                f"Review missing architectural topics: {', '.join(missing_topics[:3])}" if missing_topics else "Practice advanced distributed caching and fault-tolerance patterns",
                "Apply structured 1-2 second pauses before answering complex questions to eliminate verbal hesitation",
                "Structure technical answers with clear Problem -> Architecture -> Trade-offs -> Benchmarks flow"
            ],
            "practice_recommendations": practice_recommendations[:4],
            "learning_resources": unique_resources[:6]
        }

feedback_generator = FeedbackGenerator()
