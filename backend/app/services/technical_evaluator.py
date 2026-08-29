import re
import logging
from typing import Dict, Any, List, Optional

logger = logging.getLogger("smarthire.technical_evaluator")

class TechnicalEvaluator:
    """Evaluates question-by-question candidate responses against expected concepts,
    keywords, and domain criteria with transparent concept coverage evidence.
    """

    def _is_concept_covered(self, concept: str, text: str) -> bool:
        """Determines whether a technical concept or keyword was discussed in the candidate answer,
        with support for acronyms, root word stems, and punctuation variations.
        """
        if not concept or not text:
            return False
        
        clean_text = text.lower()
        clean_concept = str(concept).lower().strip()
        
        # 1. Direct substring match
        if clean_concept in clean_text:
            return True
            
        # 2. Punctuation-stripped match (e.g. "async/await" -> "async await")
        norm_concept = re.sub(r"[^\w\s]", " ", clean_concept).strip()
        norm_text = re.sub(r"[^\w\s]", " ", clean_text)
        if norm_concept and norm_concept in norm_text:
            return True
            
        # 3. Domain Acronym & Equivalent Map
        ACRONYMS = {
            "react testing library": ["rtl", "react testing", "testing library"],
            "mock service worker": ["msw", "mock worker", "service worker", "mocking", "mock api", "mock server"],
            "typescript": ["ts", "type system", "type safe", "typed"],
            "javascript": ["js", "ecmascript"],
            "snapshot testing": ["snapshot", "snapshots", "snapshot test"],
            "async/await": ["async", "await", "asynchronous", "promise", "promises"],
            "props validation": ["props", "prop types", "proptypes", "interfaces", "validation"],
            "rendering": ["render", "renders", "rendered", "rerender", "re-rendering"],
            "state management": ["state", "redux", "zustand", "context", "store"],
            "microservices": ["microservice", "services", "distributed"],
            "query optimization": ["optimization", "query plan", "explain plan", "index", "indexing"],
            "postgresql": ["postgres", "pgsql", "sql"]
        }
        
        for canon, aliases in ACRONYMS.items():
            if canon in clean_concept or clean_concept in canon:
                for alias in aliases:
                    if alias in norm_text:
                        return True

        # 4. Token-level & stem-level matching for multi-word phrases
        tokens = [t for t in norm_concept.split() if len(t) >= 3 and t not in ("the", "and", "for", "with", "using")]
        if not tokens:
            return False

        matched_tokens = 0
        for tok in tokens:
            stem = tok
            if tok.endswith("ing") and len(tok) > 5:
                stem = tok[:-3]
            elif tok.endswith("ed") and len(tok) > 4:
                stem = tok[:-2]
            elif tok.endswith("s") and len(tok) > 4:
                stem = tok[:-1]
                
            if tok in norm_text or (len(stem) >= 3 and stem in norm_text):
                matched_tokens += 1
                
        threshold = max(1, len(tokens) // 2)
        return matched_tokens >= threshold

    def evaluate_answers(
        self,
        questions: List[Dict[str, Any]],
        answers: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Evaluates all questions and answers, returning granular question-by-question evidence
        and aggregated technical scores.
        """
        question_evaluations = []
        all_missing_topics = []
        all_covered_topics = []

        for idx, q in enumerate(questions):
            q_id = q.get("id") or str(idx + 1)
            q_text = q.get("question_text") or q.get("question") or f"Question {idx + 1}"
            category = q.get("category") or "Technical System Design"
            difficulty = q.get("difficulty") or "Medium"
            raw_keywords = q.get("expected_keywords") or ["Architecture", "State Management", "Performance", "Optimization"]
            expected_keywords = [k.get("skill_name", str(k)) if isinstance(k, dict) else str(k) for k in raw_keywords]
            
            # Find matching answer by question_id or index
            matching_ans = next((a for a in answers if a.get("question_id") == q_id), None)
            if not matching_ans and idx < len(answers):
                matching_ans = answers[idx]

            ans_text = ""
            direct_tech = 0.0
            if matching_ans:
                ans_text = matching_ans.get("transcript_text") or matching_ans.get("answer") or matching_ans.get("candidate_answer") or matching_ans.get("text") or ""
                direct_tech = float(matching_ans.get("technical_score", 0.0))

            words = re.findall(r"\b[a-zA-Z0-9_-]+\b", ans_text.lower())
            ans_word_count = len(words)

            if ans_word_count == 0:
                if direct_tech > 0:
                    accuracy = direct_tech
                    concept_score = direct_tech
                    prob_solving = direct_tech
                    domain_score = direct_tech
                    completeness = min(100.0, direct_tech + 5.0)
                    q_tech_score = direct_tech
                    q_eval = {
                        "order_index": idx + 1,
                        "question_id": q_id,
                        "question_text": q_text,
                        "category": category,
                        "difficulty": difficulty,
                        "candidate_answer": ans_text or "[Evaluated directly from technical assessment telemetry]",
                        "technical_score": q_tech_score,
                        "accuracy_score": accuracy,
                        "concept_coverage_score": concept_score,
                        "problem_solving_score": prob_solving,
                        "completeness_score": completeness,
                        "domain_score": domain_score,
                        "covered_concepts": expected_keywords,
                        "missing_concepts": [],
                        "strengths": ["Demonstrated competency on core technical concepts"],
                        "weaknesses": ["Continue practicing advanced edge cases"],
                        "recommendation": "Maintain consistent depth across complex topics"
                    }
                    question_evaluations.append(q_eval)
                    all_covered_topics.extend(expected_keywords)
                    continue
                else:
                    # No answer provided
                    q_eval = {
                        "order_index": idx + 1,
                        "question_id": q_id,
                        "question_text": q_text,
                        "category": category,
                        "difficulty": difficulty,
                        "candidate_answer": "[No verbal or written answer recorded]",
                        "technical_score": 0.0,
                        "accuracy_score": 0.0,
                        "concept_coverage_score": 0.0,
                        "problem_solving_score": 0.0,
                        "completeness_score": 0.0,
                        "domain_score": 0.0,
                        "covered_concepts": [],
                        "missing_concepts": expected_keywords,
                        "strengths": [],
                        "weaknesses": ["No response was provided for this question."],
                        "recommendation": "Review fundamental concepts for " + category
                    }
                    question_evaluations.append(q_eval)
                    all_missing_topics.extend(expected_keywords)
                    continue

            # Concept / Keyword matching using smart matcher
            covered = []
            missing = []

            for kw in expected_keywords:
                if self._is_concept_covered(kw, ans_text):
                    covered.append(kw)
                else:
                    missing.append(kw)

            all_covered_topics.extend(covered)
            all_missing_topics.extend(missing)

            coverage_ratio = len(covered) / max(1, len(expected_keywords))
            concept_score = round(coverage_ratio * 100.0, 1)

            # Completeness based on depth and length
            if ans_word_count >= 80:
                completeness = 95.0
            elif ans_word_count >= 40:
                completeness = 85.0
            elif ans_word_count >= 20:
                completeness = 70.0
            elif ans_word_count >= 5:
                completeness = 45.0
            else:
                completeness = 20.0

            # Problem-solving based on structured reasoning phrases
            lower_ans = ans_text.lower()
            has_reasoning = any(term in lower_ans for term in ["because", "therefore", "trade-off", "for example", "approach", "architecture", "scalability", "complexity", "handle", "manage", "optimize", "implement"])
            prob_solving = min(100.0, (concept_score * 0.5) + (completeness * 0.3) + (20.0 if has_reasoning else 5.0))

            # Accuracy score
            accuracy = round(min(100.0, max(25.0, (concept_score * 0.60) + (completeness * 0.25) + (prob_solving * 0.15))), 1)
            domain_score = round(min(100.0, max(30.0, (concept_score * 0.70) + (accuracy * 0.30))), 1)

            # If direct_tech was pre-evaluated and higher, balance it
            if direct_tech > 0:
                accuracy = round((accuracy * 0.6) + (direct_tech * 0.4), 1)

            # Individual question technical score
            q_tech_score = round(
                (accuracy * 0.35) + (concept_score * 0.25) + (prob_solving * 0.25) + (completeness * 0.15),
                1
            )

            # Strengths & Weaknesses
            q_strengths = []
            q_weaknesses = []

            if covered:
                q_strengths.append(f"Successfully addressed core concepts: {', '.join(covered[:3])}")
            if has_reasoning:
                q_strengths.append("Structured technical reasoning with cause-and-effect explanations")
            if ans_word_count >= 50:
                q_strengths.append("Provided detailed, elaborative response")

            if missing:
                q_weaknesses.append(f"Omitted key expected architectural topics: {', '.join(missing[:3])}")
            if ans_word_count < 25:
                q_weaknesses.append("Brief response with limited technical elaboration")

            q_eval = {
                "order_index": idx + 1,
                "question_id": q_id,
                "question_text": q_text,
                "category": category,
                "difficulty": difficulty,
                "candidate_answer": ans_text,
                "technical_score": q_tech_score,
                "accuracy_score": accuracy,
                "concept_coverage_score": concept_score,
                "problem_solving_score": round(prob_solving, 1),
                "completeness_score": completeness,
                "domain_score": domain_score,
                "covered_concepts": covered,
                "missing_concepts": missing,
                "strengths": q_strengths if q_strengths else ["Provided basic direct response"],
                "weaknesses": q_weaknesses if q_weaknesses else ["Could detail edge-case handling further"],
                "recommendation": f"Practice structuring answers around {missing[0]}" if missing else "Include quantitative performance benchmarks"
            }

            question_evaluations.append(q_eval)

        # Aggregate Metrics across answered questions (or all if none answered)
        answered_evals = [e for e in question_evaluations if e["technical_score"] > 0 or e["candidate_answer"] != "[No verbal or written answer recorded]"]
        eval_subset = answered_evals if answered_evals else question_evaluations

        n = max(1, len(eval_subset))
        avg_accuracy = round(sum(e["accuracy_score"] for e in eval_subset) / n, 1)
        avg_concept = round(sum(e["concept_coverage_score"] for e in eval_subset) / n, 1)
        avg_prob_solving = round(sum(e["problem_solving_score"] for e in eval_subset) / n, 1)
        avg_domain = round(sum(e.get("domain_score", e["accuracy_score"]) for e in eval_subset) / n, 1)
        avg_completeness = round(sum(e["completeness_score"] for e in eval_subset) / n, 1)

        overall_tech_score = round(
            (avg_accuracy * 0.30) + (avg_prob_solving * 0.25) + (avg_concept * 0.15) + (avg_domain * 0.15) + (avg_completeness * 0.15),
            1
        )

        return {
            "technical_score": overall_tech_score,
            "accuracy": avg_accuracy,
            "concept_relevance": avg_concept,
            "problem_solving": avg_prob_solving,
            "domain_knowledge": avg_domain,
            "completeness": avg_completeness,
            "question_evaluations": question_evaluations,
            "covered_topics": list(set(all_covered_topics)),
            "missing_topics": list(set(all_missing_topics))
        }

technical_evaluator = TechnicalEvaluator()
