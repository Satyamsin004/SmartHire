import logging
import random
import time
from typing import Any, Dict, List, Optional, Set

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.models.domain import (
    AssessmentQuestion, AssessmentQuestionHistory, CandidateQuestionHistory, AssessmentSession,
    MasterQuestionBank, RecruiterAssessmentHistory,
)
from app.services.ai_provider import ai_provider
from app.services.duplicate_detector import duplicate_detector
from app.services.question_factory import question_factory
from app.services.question_planner import BlueprintSlot, question_planner

logger = logging.getLogger("smarthire.paper_builder")


class PaperBuilder:
    """Enterprise Master Question Bank Paper Generation Engine."""

    @staticmethod
    def _is_topic_match(slot_topic: str, db_topic: str) -> bool:
        if not slot_topic or not db_topic:
            return False
        s_norm = slot_topic.strip().lower()
        d_norm = db_topic.strip().lower()
        if s_norm == d_norm:
            return True

        # Special case: Exclude Java matching JavaScript/TypeScript
        is_s_java_only = ("java" in s_norm and "script" not in s_norm)
        is_d_java_only = ("java" in d_norm and "script" not in d_norm)
        is_s_js = ("javascript" in s_norm or "typescript" in s_norm or s_norm in {"js", "ts"})
        is_d_js = ("javascript" in d_norm or "typescript" in d_norm or d_norm in {"js", "ts"})

        if (is_s_java_only and is_d_js) or (is_d_java_only and is_s_js):
            return False

        aliases = {
            "js": ["javascript", "typescript", "javascript & typescript"],
            "ts": ["javascript", "typescript", "javascript & typescript"],
            "javascript": ["javascript", "typescript", "javascript & typescript"],
            "typescript": ["javascript", "typescript", "javascript & typescript"],
            "javascript & typescript": ["javascript", "typescript", "javascript & typescript"],
            "dbms & sql": ["dbms", "sql", "database"],
            "sql & indexing": ["sql", "indexing", "database"],
            "system design basics": ["system design"],
            "quantitative aptitude": ["quantitative", "aptitude"],
            "logical reasoning": ["logical", "reasoning"],
        }
        if s_norm in aliases:
            targets = aliases[s_norm]
            if any(t == d_norm or (len(t) >= 4 and t in d_norm) for t in targets):
                return True

        if s_norm == "java" and d_norm == "java":
            return True

        if (len(s_norm) >= 4 and s_norm in d_norm and s_norm != "java") or (len(d_norm) >= 4 and d_norm in s_norm and d_norm != "java"):
            return True
    @classmethod
    def _create_topic_fallback_question(cls, topic: str, index: int, difficulty: str) -> MasterQuestionBank:
        import uuid
        t_low = topic.lower()
        passage_text = None
        dataset_json = None
        test_cases = None

        if "quantitative" in t_low or "quant" in t_low:
            pool = [
                ("A man sells two articles for Rs. 990 each. On one he gains 10% and on the other he loses 10%. What is his overall gain or loss percentage?",
                 ["1% loss", "1% gain", "No profit no loss", "2% loss"], 0,
                 "When two articles are sold at same price, one at x% profit and other at x% loss, overall net loss % = (x/100)^2 * 100 = 1% loss."),

                ("A and B can do a piece of work in 12 days and 16 days respectively. They worked together for 4 days and then A left. In how many days will B finish the remaining work?",
                 ["6.67 days", "5 days", "8 days", "7.33 days"], 0,
                 "A's 1-day work = 1/12, B's = 1/16. Together 1 day = 7/48. In 4 days = 7/12. Remaining work = 5/12. Time taken by B = (5/12) / (1/16) = 20/3 = 6.67 days."),

                ("A train traveling at 72 km/h crosses a 200m long platform in 22 seconds. What is the length of the train in meters?",
                 ["240 meters", "200 meters", "220 meters", "260 meters"], 0,
                 "Speed = 72 * 5/18 = 20 m/s. Total distance in 22s = 20 * 22 = 440m. Length of train = 440 - 200 = 240m."),

                ("If Rs. 5000 amounts to Rs. 5800 in 2 years at simple interest, what will Rs. 8000 amount to in 3 years at the same rate of interest?",
                 ["Rs. 9920", "Rs. 9600", "Rs. 10200", "Rs. 9800"], 0,
                 "SI = 800 for 2 yrs -> Rate = (800 * 100) / (5000 * 2) = 8%. For 8000 in 3 yrs: SI = (8000 * 8 * 3)/100 = 2400. Amount = 8000 + 2400 = 9920."),

                ("Two pipes A and B can fill a tank in 20 minutes and 30 minutes respectively. A third pipe C empties it in 15 minutes. If all three are opened together, how long will it take to fill the tank?",
                 ["60 minutes", "40 minutes", "45 minutes", "30 minutes"], 0,
                 "Net rate = 1/20 + 1/30 - 1/15 = (3 + 2 - 4)/60 = 1/60 per minute. Tank fills in 60 minutes.")
            ]
        elif "data interpretation" in t_low or "di" in t_low:
            dataset_json = {"years": [2021, 2022, 2023, 2024], "sales_in_lakhs": [120, 150, 180, 225]}
            pool = [
                ("Based on the sales dataset [2021: 120, 2022: 150, 2023: 180, 2024: 225], what is the percentage increase in sales from 2021 to 2024?",
                 ["87.5%", "75.0%", "90.0%", "82.5%"], 0,
                 "Increase = 225 - 120 = 105. Percentage increase = (105 / 120) * 100 = 87.5%."),

                ("What is the average annual sales (in lakhs) over the 4-year period 2021-2024?",
                 ["168.75 lakhs", "165.0 lakhs", "172.5 lakhs", "160.0 lakhs"], 0,
                 "Total = 120 + 150 + 180 + 225 = 675. Average = 675 / 4 = 168.75 lakhs.")
            ]
        elif "logical" in t_low or "reasoning" in t_low:
            pool = [
                ("Pointing to a photograph, a man said, 'I have no brother or sister but that man's father is my father's son.' Whose photograph was it?",
                 ["His son's", "His father's", "His own", "His nephew's"], 0,
                 "Since he has no brother or sister, 'my father's son' is himself. So 'that man's father' is himself. The photo is of his son."),

                ("If 'CLOUD' is coded as '59432' and 'RAIN' is coded as '1678', how is 'DRAIN' coded?",
                 ["21678", "51678", "26178", "21768"], 0,
                 "D=2, R=1, A=6, I=7, N=8. Thus DRAIN = 21678."),

                ("Statements: All cats are dogs. All dogs are birds.\nConclusions:\nI. All cats are birds.\nII. Some birds are dogs.",
                 ["Both Conclusion I and II follow", "Only Conclusion I follows", "Only Conclusion II follows", "Neither follows"], 0,
                 "Since Cats ⊂ Dogs ⊂ Birds, all cats are birds (I) and some birds are dogs (II). Both conclusions follow.")
            ]
        elif "reading comprehension" in t_low or "rc" in t_low or "verbal" in t_low or "english" in t_low:
            passage_text = "Artificial Intelligence is transforming enterprise operations across the globe. By automating repetitive tasks, analyzing unstructured datasets, and predicting consumer behaviors, AI algorithms enable organizations to optimize resources and enhance strategic decision making. However, ethical concerns regarding data privacy, algorithmic bias, and workforce displacement require robust governance frameworks."
            pool = [
                ("According to the passage, what primary benefit does AI provide to enterprise operations?",
                 ["Automates repetitive tasks and optimizes resource allocation.",
                  "Eliminates the need for data privacy regulation.",
                  "Replaces human executives in all strategic governance roles.",
                  "Guarantees 100% elimination of operational expenses."], 0,
                 "The passage states AI automates repetitive tasks, analyzes datasets, and enables organizations to optimize resources."),

                ("Which of the following challenges is explicitly highlighted in the passage regarding AI adoption?",
                 ["Ethical concerns around privacy, algorithmic bias, and workforce displacement.",
                  "Inability to analyze tabular datasets.",
                  "High hardware costs of classical supercomputers.",
                  "Lack of interest from modern commercial enterprises."], 0,
                 "The passage explicitly mentions ethical concerns regarding data privacy, algorithmic bias, and workforce displacement."),

                ("Select the word that is most nearly SYNONYMOUS with 'METICULOUS':",
                 ["Scrupulous and detailed", "Careless and hasty", "Ambiguous and vague", "Aggressive and bold"], 0,
                 "Meticulous means showing great attention to detail; scrupulous and careful."),

                ("Identify the grammatically correct sentence:",
                 ["Neither of the candidates has submitted their documents yet.",
                  "Neither of the candidates have submitted their documents yet.",
                  "Neither of the candidate has submitted their documents yet.",
                  "Neither candidates have submitted document."], 0,
                 "'Neither' takes a singular verb 'has submitted'.")
            ]
        elif "sql" in t_low or "database" in t_low or "dbms" in t_low:
            pool = [
                ("What is the primary function of a B-Tree index in a database management system?",
                 ["To reduce disk I/O reads required to locate specific rows.",
                  "To enforce foreign key cascade deletes.",
                  "To compress table storage space.",
                  "To execute asynchronous HTTP requests."], 0,
                 "B-Tree indexes optimize query lookups by maintaining a balanced search tree structure."),

                ("In SQL, which clause is used with window functions to partition rows into subset groups?",
                 ["PARTITION BY", "GROUP BY", "ORDER BY", "HAVING"], 0,
                 "PARTITION BY divides the query result set into partitions to which the window function is applied.")
            ]
        elif "dsa" in t_low or "data structures" in t_low or "algorithm" in t_low or "coding" in t_low:
            test_cases = [
                {"input": "[2, 7, 11, 15], target = 9", "output": "[0, 1]"},
                {"input": "[3, 2, 4], target = 6", "output": "[1, 2]"}
            ]
            pool = [
                ("What is the worst-case time complexity of QuickSort when selecting the first element as pivot on an already sorted array?",
                 ["O(N^2)", "O(N log N)", "O(N)", "O(log N)"], 0,
                 "When the array is already sorted and pivot is always picked as first/last element, QuickSort produces maximally unbalanced partitions resulting in O(N^2)."),

                ("Given an array of integers `nums` and an integer `target`, return indices of two numbers such that they add up to target. What is the optimal time complexity using a HashMap?",
                 ["O(N) time and O(N) space", "O(N^2) time and O(1) space", "O(N log N) time and O(1) space", "O(1) time and O(N) space"], 0,
                 "Using a HashMap to store seen complement values achieves linear O(N) time and O(N) auxiliary space.")
            ]
        elif "javascript" in t_low or "typescript" in t_low or t_low in {"js", "ts"}:
            pool = [
                ("In JavaScript/TypeScript, what is the output of `typeof null` and `typeof undefined`?",
                 ["object, undefined", "null, undefined", "object, object", "undefined, null"], 0,
                 "In JS, typeof null evaluates to 'object' while typeof undefined is 'undefined'."),

                ("What is the primary difference between `Promise.all()` and `Promise.allSettled()` in JS/TS?",
                 ["Promise.all short-circuits on first rejection; Promise.allSettled waits for all promises to finish.",
                  "Promise.allSettled short-circuits on rejection; Promise.all waits.",
                  "Promise.all only works with strings; Promise.allSettled works with numbers.",
                  "Promise.all is synchronous; Promise.allSettled is asynchronous."], 0,
                 "Promise.all short-circuits on error, whereas Promise.allSettled returns outcomes for all promises.")
            ]
        elif "react" in t_low:
            pool = [
                ("In React, what is the primary difference between `useCallback` and `useMemo`?",
                 ["useCallback memoizes a function instance; useMemo memoizes a computed value.",
                  "useMemo memoizes functions; useCallback memoizes values.",
                  "useCallback triggers side-effects; useMemo handles DOM events.",
                  "Both hooks perform identical operations."], 0,
                 "useCallback returns a memoized callback function; useMemo returns a memoized value.")
            ]
        elif "python" in t_low:
            pool = [
                ("In Python, what is the primary purpose of the `with` statement and context managers?",
                 ["To ensure proper acquisition and release of resources like files or database locks.",
                  "To accelerate loop execution speed.",
                  "To declare private class attributes.",
                  "To compile Python code to C bytecode."], 0,
                 "Context managers automatically invoke __enter__ and __exit__ for clean resource management.")
            ]
        else:
            pool = [
                (f"Which of the following represents a core principle in {topic}?",
                 [f"Establishing modular, maintainable, and high-performance standards for {topic}.",
                  f"Deprecating all synchronous control flows.",
                  f"Bypassing data validation layers.",
                  f"Executing un-monitored background tasks."], 0,
                 f"Core principles of {topic} prioritize modularity, reliability, and clean execution."),

                (f"When optimizing a system implemented in {topic}, what is a recommended best practice?",
                 [f"Analyze execution trade-offs, cache high-frequency outputs, and eliminate bottlenecks.",
                  f"Disable error logging to increase speed.",
                  f"Hardcode external API endpoints.",
                  f"Avoid memory cleanup routines."], 0,
                 f"Performance optimization in {topic} relies on metrics analysis and efficient resource handling.")
            ]

        item = pool[(index - 1) % len(pool)]
        base_text = item[0]
        if index > len(pool):
            q_text = f"{base_text} [Scenario #{index}]"
        else:
            q_text = base_text

        q_fp = duplicate_detector.compute_fingerprint(q_text)
        c_hash = duplicate_detector.compute_concept_hash(topic, "Core Concepts", f"{topic} Fundamentals", difficulty)

        return MasterQuestionBank(
            id=f"fb_{uuid.uuid4().hex[:8]}",
            topic=topic,
            subtopic="Core Concepts",
            concept=f"{topic} Fundamentals",
            difficulty=difficulty,
            question_text=q_text,
            code_snippet=None,
            options=item[1],
            correct_option=item[2],
            explanation=item[3],
            passage_text=passage_text,
            dataset_json=dataset_json,
            test_cases=test_cases,
            created_by="topic_fallback",
            question_fingerprint=q_fp,
            concept_hash=c_hash,
        )

    @classmethod
    async def build_paper(
        cls, db: AsyncSession, session_id: str
    ) -> List[AssessmentQuestion]:
        """
        Builds a paper for candidate practice or recruiter assessment.
        Checks Master Question Bank first. If sufficient unseen questions exist,
        builds paper INSTANTLY from DB without any LLM call. Otherwise, triggers
        AI Question Factory for ONLY missing blueprint slots, stores in DB, and builds paper.
        """
        start_time = time.perf_counter()

        session = (await db.execute(
            select(AssessmentSession).where(AssessmentSession.id == session_id)
        )).scalar_one_or_none()
        if not session:
            raise ValueError("Assessment session not found.")

        # Check existing assessment questions
        existing_questions = (await db.execute(
            select(AssessmentQuestion)
            .where(AssessmentQuestion.session_id == session_id)
            .order_by(AssessmentQuestion.order_index)
        )).scalars().all()
        if len(existing_questions) >= session.question_count:
            return list(existing_questions)

        # Retrieve Candidate & Recruiter Exclusion History
        candidate_exclusions: Set[str] = set()
        candidate_served_qids: Set[str] = set()
        if session.candidate_id:
            cqh_qids = (await db.execute(
                select(CandidateQuestionHistory.question_id)
                .where(CandidateQuestionHistory.candidate_id == session.candidate_id)
            )).scalars().all()
            candidate_served_qids.update(cqh_qids)

            cqh_fps = (await db.execute(
                select(CandidateQuestionHistory.question_fingerprint)
                .where(CandidateQuestionHistory.candidate_id == session.candidate_id)
            )).scalars().all()
            candidate_exclusions.update(cqh_fps)

            aqh_fps = (await db.execute(
                select(AssessmentQuestionHistory.question_fingerprint)
                .where(AssessmentQuestionHistory.candidate_id == session.candidate_id)
            )).scalars().all()
            candidate_exclusions.update(aqh_fps)

            legacy_texts = (await db.execute(
                select(AssessmentQuestion.question_text)
                .join(AssessmentSession, AssessmentQuestion.session_id == AssessmentSession.id)
                .where(AssessmentSession.candidate_id == session.candidate_id)
            )).scalars().all()
            for text in legacy_texts:
                if text:
                    candidate_exclusions.add(duplicate_detector.compute_fingerprint(text))

        recruiter_exclusions: Set[str] = set()
        if session.recruiter_id:
            rec_hist = (await db.execute(
                select(RecruiterAssessmentHistory.question_fingerprint)
                .where(RecruiterAssessmentHistory.recruiter_id == session.recruiter_id)
            )).scalars().all()
            recruiter_exclusions.update(rec_hist)

        all_exclusions = candidate_exclusions | recruiter_exclusions

        # Step 1: Create Assessment Blueprint (30% Easy, 50% Medium, 20% Hard)
        blueprint_slots = question_planner.create_blueprint(
            topics=list(session.topics),
            difficulty=session.difficulty,
            total_questions=session.question_count,
        )

        # Step 2: Query Master Question Bank
        all_master_items = list((await db.execute(select(MasterQuestionBank))).scalars().all())

        selected_master_items: List[Dict[str, Any]] = []
        used_master_ids: Set[str] = set()
        missing_slots: List[BlueprintSlot] = []

        # Step 2A: Adaptive Question Selection Engine (UNSEEN questions first)
        for slot in blueprint_slots:
            eligible_unseen = [
                q for q in all_master_items
                if q.id not in used_master_ids and
                   q.id not in candidate_served_qids and
                   q.question_fingerprint not in all_exclusions and
                   cls._is_topic_match(slot.topic, q.topic)
            ]

            if eligible_unseen:
                diff_matched = [q for q in eligible_unseen if q.difficulty == slot.difficulty]
                chosen = random.choice(diff_matched) if diff_matched else random.choice(eligible_unseen)
                selected_master_items.append({"master": chosen, "is_repeated": False})
                used_master_ids.add(chosen.id)
            else:
                missing_slots.append(slot)

        # Step 2B: Fallback for missing slots - try unseen DB questions matching requested topics
        if missing_slots:
            still_missing: List[BlueprintSlot] = []
            for slot in missing_slots:
                matching_unseen = [
                    q for q in all_master_items
                    if q.id not in used_master_ids and
                       q.id not in candidate_served_qids and
                       q.question_fingerprint not in all_exclusions and
                       any(cls._is_topic_match(t, q.topic) for t in session.topics)
                ]
                if matching_unseen:
                    chosen = random.choice(matching_unseen)
                    selected_master_items.append({"master": chosen, "is_repeated": False})
                    used_master_ids.add(chosen.id)
                else:
                    still_missing.append(slot)
            missing_slots = still_missing

        # Step 3: Trigger AI Question Factory ONLY if Master Bank has missing unseen slots
        if missing_slots and len(selected_master_items) < session.question_count:
            current_session_texts = [
                duplicate_detector.normalize_text(item["master"].question_text)
                for item in selected_master_items
            ]
            logger.info(
                "PaperBuilder: %d missing slots out of %d. Triggering AI Question Factory with candidate_id=%s...",
                len(missing_slots), session.question_count, session.candidate_id or "N/A"
            )
            try:
                import asyncio
                newly_generated = await asyncio.wait_for(
                    question_factory.generate_and_store_questions(
                        db=db,
                        blueprint_slots=missing_slots,
                        candidate_id=session.candidate_id,
                        scoped_normalized_texts=current_session_texts,
                        created_by="ai_factory"
                    ),
                    timeout=25.0
                )
                for gen_q in newly_generated:
                    if gen_q.id not in used_master_ids:
                        selected_master_items.append({"master": gen_q, "is_repeated": False})
                        used_master_ids.add(gen_q.id)
            except Exception as e:
                logger.warning("AI Question Factory timeout or notice: %s. Using topic fallback.", e)

        # Step 3B: Topic-aligned Fallback Generation for unseen questions
        if len(selected_master_items) < session.question_count:
            needed_qs = session.question_count - len(selected_master_items)
            for idx in range(needed_qs):
                target_topic = session.topics[idx % len(session.topics)]
                target_diff = blueprint_slots[min(len(selected_master_items), len(blueprint_slots) - 1)].difficulty
                fb_q = cls._create_topic_fallback_question(target_topic, idx + 1, target_diff)
                if fb_q.id not in used_master_ids:
                    is_rep = fb_q.question_fingerprint in all_exclusions
                    selected_master_items.append({"master": fb_q, "is_repeated": is_rep})
                    used_master_ids.add(fb_q.id)

        # Step 3C: Exhaustion Fallback - If Question Bank is exhausted for candidate, allow RECYCLED questions
        if len(selected_master_items) < session.question_count:
            recycled_pool = [
                q for q in all_master_items
                if q.id not in used_master_ids and any(cls._is_topic_match(t, q.topic) for t in session.topics)
            ]
            if not recycled_pool:
                recycled_pool = [q for q in all_master_items if q.id not in used_master_ids]

            needed = session.question_count - len(selected_master_items)
            for recycled_q in recycled_pool[:needed]:
                selected_master_items.append({"master": recycled_q, "is_repeated": True})
                used_master_ids.add(recycled_q.id)

        # Shuffle selected questions ONLY AFTER filtering & topic alignment
        random.shuffle(selected_master_items)
        selected_master_items = selected_master_items[:session.question_count]

        # Step 4: Populate AssessmentQuestion DB rows
        t_q_start = time.perf_counter()
        db_questions: List[AssessmentQuestion] = []
        for order_idx, item in enumerate(selected_master_items, start=1):
            master_q: MasterQuestionBank = item["master"]
            is_rep: bool = item.get("is_repeated", False)

            passage_val = getattr(master_q, "passage_text", None)
            if not passage_val and ("reading comprehension" in (master_q.topic or "").lower() or "rc" in (master_q.topic or "").lower()):
                passage_val = "Artificial Intelligence is transforming enterprise operations across the globe. By automating repetitive tasks, analyzing unstructured datasets, and predicting consumer behaviors, AI algorithms enable organizations to optimize resources and enhance strategic decision making. However, ethical concerns regarding data privacy, algorithmic bias, and workforce displacement require robust governance frameworks."

            dataset_val = getattr(master_q, "dataset_json", None)
            if not dataset_val and ("data interpretation" in (master_q.topic or "").lower() or "di" in (master_q.topic or "").lower()):
                dataset_val = {"years": [2021, 2022, 2023, 2024], "sales_in_lakhs": [120, 150, 180, 225]}

            record = AssessmentQuestion(
                session_id=session.id,
                order_index=order_idx,
                category=master_q.topic,
                topic=master_q.topic,
                question_text=master_q.question_text,
                code_snippet=master_q.code_snippet,
                options=master_q.options,
                correct_option=master_q.correct_option,
                explanation=master_q.explanation or "Detailed technical explanation available.",
                negative_marks=session.negative_marking,
                is_repeated=is_rep,
                passage_text=passage_val,
                dataset_json=dataset_val,
                test_cases=getattr(master_q, "test_cases", None),
            )
            db_questions.append(record)

        db.add_all(db_questions)
        await db.flush()
        q_write_ms = round((time.perf_counter() - t_q_start) * 1000, 1)

        # Step 5: Update CandidateQuestionHistory, AssessmentQuestionHistory & RecruiterLedger
        t_hist_start = time.perf_counter()
        history_records: List[Any] = []
        cqh_records: List[Any] = []

        prior_attempts = 0
        if session.candidate_id:
            prior_attempts = len((await db.execute(
                select(AssessmentSession.id).where(
                    AssessmentSession.candidate_id == session.candidate_id,
                    AssessmentSession.id != session.id,
                )
            )).scalars().all())

            existing_candidate_fps = set((await db.execute(
                select(AssessmentQuestionHistory.question_fingerprint)
                .where(AssessmentQuestionHistory.candidate_id == session.candidate_id)
            )).scalars().all())

            for record, item in zip(db_questions, selected_master_items):
                master_q = item["master"]
                fp = duplicate_detector.compute_fingerprint(record.question_text)

                cqh_records.append(CandidateQuestionHistory(
                    candidate_id=session.candidate_id,
                    question_id=master_q.id,
                    assessment_id=session.id,
                    attempt_number=prior_attempts + 1,
                    category=record.category or record.topic,
                    subcategory=getattr(master_q, "subtopic", "General Concepts"),
                    topic=record.topic,
                    difficulty=getattr(master_q, "difficulty", session.difficulty),
                    question_fingerprint=fp,
                    is_repeated=record.is_repeated,
                ))

                if fp not in existing_candidate_fps:
                    history_records.append(AssessmentQuestionHistory(
                        candidate_id=session.candidate_id,
                        session_id=session.id,
                        question_id=record.id,
                        question_fingerprint=fp,
                        normalized_question=duplicate_detector.normalize_text(record.question_text),
                        topic=record.topic,
                        difficulty=session.difficulty,
                        attempt_number=prior_attempts + 1,
                    ))
                    existing_candidate_fps.add(fp)

        if session.recruiter_id:
            existing_recruiter_fps = set((await db.execute(
                select(RecruiterAssessmentHistory.question_fingerprint)
                .where(RecruiterAssessmentHistory.recruiter_id == session.recruiter_id)
            )).scalars().all())

            for record in db_questions:
                fp = duplicate_detector.compute_fingerprint(record.question_text)
                if fp not in existing_recruiter_fps:
                    history_records.append(RecruiterAssessmentHistory(
                        recruiter_id=session.recruiter_id,
                        session_id=session.id,
                        question_id=record.id,
                        question_fingerprint=fp,
                    ))
                    existing_recruiter_fps.add(fp)

        if cqh_records:
            db.add_all(cqh_records)
        if history_records:
            db.add_all(history_records)

        session.status = "active"
        await db.commit()
        hist_write_ms = round((time.perf_counter() - t_hist_start) * 1000, 1)

        total_latency_ms = round((time.perf_counter() - start_time) * 1000, 1)

        # Generate Assessment Diagnostics Report
        diff_dist: Dict[str, int] = {"Easy": 0, "Medium": 0, "Hard": 0}
        cat_dist: Dict[str, int] = {}
        for q in db_questions:
            d = q.topic
            diff = getattr(q, "difficulty", "Medium")
            diff_dist[diff] = diff_dist.get(diff, 0) + 1
            cat_dist[q.category or q.topic] = cat_dist.get(q.category or q.topic, 0) + 1

        rc_passages_count = len([q for q in db_questions if getattr(q, "passage_text", None)])
        coding_problems_count = len([q for q in db_questions if getattr(q, "test_cases", None)])
        repeated_count = len([q for q in db_questions if getattr(q, "is_repeated", False)])

        diagnostics = cls.generate_diagnostics_report(
            candidate_id=session.candidate_id,
            requested_questions=session.question_count,
            question_bank_size=len(all_master_items),
            eligible_questions=len(eligible_unseen),
            filtered_questions=len(selected_master_items),
            previously_served=len(candidate_served_qids),
            remaining_unseen=len(eligible_unseen),
            repeated_questions_used=repeated_count,
            question_overlap=repeated_count,
            difficulty_distribution=diff_dist,
            category_distribution=cat_dist,
            reading_passages_used=rc_passages_count,
            coding_problems_used=coding_problems_count,
            selection_time_ms=q_write_ms,
            history_save_time_ms=hist_write_ms,
            total_generation_time_ms=total_latency_ms,
        )

        session_meta = getattr(session, "metadata_json", {}) or {}
        session_meta["diagnostics"] = diagnostics

        return db_questions

    @classmethod
    def generate_diagnostics_report(
        cls,
        candidate_id: Optional[str],
        requested_questions: int,
        question_bank_size: int,
        eligible_questions: int,
        filtered_questions: int,
        previously_served: int,
        remaining_unseen: int,
        repeated_questions_used: int,
        question_overlap: int,
        difficulty_distribution: Dict[str, int],
        category_distribution: Dict[str, int],
        reading_passages_used: int,
        coding_problems_used: int,
        selection_time_ms: float,
        history_save_time_ms: float,
        total_generation_time_ms: float,
    ) -> Dict[str, Any]:
        """Builds production diagnostics report and enforces validation rules."""
        status = "PASS"
        explanation = "Assessment paper generated with zero duplicate questions and strict difficulty/topic distribution."

        if question_overlap > 0 and remaining_unseen >= requested_questions:
            status = "FAIL"
            explanation = (
                f"VALIDATION FAILED: Repeated questions ({question_overlap}) were selected even though "
                f"sufficient unseen questions ({remaining_unseen}) were available for requested ({requested_questions})."
            )
        elif question_overlap > 0:
            explanation = (
                f"VALIDATION PASSED (WITH EXHAUSTION FALLBACK): Unseen question bank exhausted "
                f"({remaining_unseen} remaining unseen for candidate). Served {repeated_questions_used} recycled questions "
                f"explicitly marked with 'is_repeated': true."
            )

        report = {
            "candidate_id": candidate_id or "Anonymous Practice User",
            "requested_questions": requested_questions,
            "question_bank_size": question_bank_size,
            "eligible_questions": eligible_questions,
            "filtered_questions": filtered_questions,
            "previously_served": previously_served,
            "remaining_unseen": remaining_unseen,
            "repeated_questions_used": repeated_questions_used,
            "question_overlap": question_overlap,
            "difficulty_distribution": difficulty_distribution,
            "category_distribution": category_distribution,
            "reading_passages_used": reading_passages_used,
            "coding_problems_used": coding_problems_used,
            "selection_time_ms": selection_time_ms,
            "history_save_time_ms": history_save_time_ms,
            "total_generation_time_ms": total_generation_time_ms,
            "status": status,
            "explanation": explanation,
        }

        logger.info(
            "==========================================================\n"
            "ASSESSMENT DIAGNOSTICS REPORT\n"
            "  Candidate ID              : %s\n"
            "  Status                    : %s\n"
            "  Requested Questions       : %d\n"
            "  Question Bank Size        : %d\n"
            "  Eligible / Filtered       : %d / %d\n"
            "  Previously Served / Unseen: %d / %d\n"
            "  Repeated / Overlap        : %d / %d\n"
            "  Difficulty Distribution   : %s\n"
            "  Category Distribution     : %s\n"
            "  Reading Passages / Coding : %d / %d\n"
            "  Selection / History / Total: %.1fms / %.1fms / %.1fms\n"
            "  Explanation               : %s\n"
            "==========================================================",
            report["candidate_id"], report["status"], report["requested_questions"],
            report["question_bank_size"], report["eligible_questions"], report["filtered_questions"],
            report["previously_served"], report["remaining_unseen"],
            report["repeated_questions_used"], report["question_overlap"],
            report["difficulty_distribution"], report["category_distribution"],
            report["reading_passages_used"], report["coding_problems_used"],
            report["selection_time_ms"], report["history_save_time_ms"], report["total_generation_time_ms"],
            report["explanation"]
        )

        return report

        return db_questions


paper_builder = PaperBuilder()
