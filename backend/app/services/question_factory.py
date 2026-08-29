import asyncio
import json
import logging
import random
import time
import uuid
from typing import Any, Dict, List, Optional, Set, Tuple

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.models.domain import MasterQuestionBank, AssessmentQuestionHistory
from app.services.ai_engine import ai_engine
from app.services.ai_provider import ai_provider
from app.services.duplicate_detector import duplicate_detector
from app.services.question_planner import BlueprintSlot

logger = logging.getLogger("smarthire.question_factory")


class AIQuestionFactory:
    """Enterprise AI Question Factory Engine."""

    ENTERPRISE_DOMAINS = [
        "FinTech High-Frequency Trading & Settlement Engine",
        "E-Commerce Microservices & Event-Driven Architecture",
        "Healthcare Distributed Telemetry Analytics",
        "SaaS Cloud Multi-Tenant Distributed Cache",
        "Logistics Real-Time Route & Inventory Optimization",
        "Stream Processing & Low-Latency Messaging Pipeline",
        "Zero-Trust Identity & Auth Gateway",
        "AI/ML High-Throughput Model Inference Pipeline"
    ]
    COMPANY_NAMES = ["Stripe", "Netflix", "Uber", "Datadog", "Cloudflare", "Shopify", "Atlassian", "Snowflake", "Amazon", "Google"]
    MAX_FACTORY_PASSES = 5

    @classmethod
    def _build_factory_prompt(
        cls, slots: List[BlueprintSlot], exclusions: List[str], pass_num: int
    ) -> str:
        excluded_excerpt = "\n".join(f"- {item}" for item in exclusions[-40:]) or "None"
        random_seed = uuid.uuid4().hex[:8]
        random_domain = random.choice(cls.ENTERPRISE_DOMAINS)
        random_company = random.choice(cls.COMPANY_NAMES)

        slots_spec = "\n".join([
            f"Slot #{s.slot_index}: Topic='{s.topic}', Subtopic='{s.subtopic}', Concept='{s.concept}', BloomLevel='{s.bloom_taxonomy}', Type='{s.question_type}', Difficulty='{s.difficulty}'"
            for s in slots
        ])

        target_count = len(slots)
        requested_count = target_count + 2 if target_count >= 3 else target_count + 1

        return f"""
You are a Senior Assessment Specialist authoring enterprise questions for platforms like HackerRank, Mercer Mettl, and SHL.
Generate exactly {requested_count} high-quality, completely unique, targeted MCQs matching the blueprint slots below:

Blueprint Target Slots:
{slots_spec}

Context & Randomization:
- Random Seed: {random_seed}
- Domain Context: {random_domain} (inspired by engineering standards at {random_company})
- Pass: {pass_num}

Guidelines:
- CRITICAL TOPIC STRICTNESS: Every generated question MUST be strictly and exclusively testing the specified Topic of its slot (e.g. if Topic='JavaScript & TypeScript', the question MUST be about JavaScript / TypeScript code, syntax, Promises, DOM, closures, interfaces, async/await, etc. - NEVER generate Python, FastAPI, SQL, or Docker questions for a JavaScript/TypeScript slot).
- CRITICAL DIVERSITY MANDATE: Write completely novel, scenario-driven enterprise questions with unique code scenarios.
- Do NOT generate generic textbook questions like 'What is the primary benefit of multi-stage Dockerfile' or 'What is a context manager'.
- Options must be 4 plausible technical distractors.
- Distribute correct answer indices (0, 1, 2, 3) evenly across options.
- Exclude the following existing questions:
{excluded_excerpt}

OUTPUT MANDATE:
Return ONLY a JSON array of exactly {requested_count} question objects. Each object MUST match this schema:
{{
  "topic": "Assigned Slot Topic",
  "subtopic": "Subtopic",
  "concept": "Concept",
  "difficulty": "Difficulty",
  "bloom_taxonomy": "Bloom Level",
  "question_type": "Question Type",
  "scenario_type": "{random_domain}",
  "technology": "Assigned Slot Topic",
  "question_text": "Clear, detailed question statement strictly on the assigned Topic",
  "code_snippet": null,
  "options": ["Option A", "Option B", "Option C", "Option D"],
  "correct_option": 0,
  "explanation": "Concise technical explanation"
}}
"""

    @classmethod
    def _valid_factory_payload(cls, payload: Any) -> bool:
        if not isinstance(payload, dict):
            return False
        text = payload.get("question_text") or payload.get("question")
        options = payload.get("options") or payload.get("choices")
        answer = payload.get("correct_option")

        if isinstance(text, str):
            payload["question_text"] = text.strip()
        if isinstance(options, list):
            payload["options"] = [str(opt).strip() for opt in options]

        if isinstance(answer, str):
            mapping = {"a": 0, "b": 1, "c": 2, "d": 3, "0": 0, "1": 1, "2": 2, "3": 3}
            for k, v in mapping.items():
                if k in answer.strip().lower():
                    answer = v
                    break

        if isinstance(answer, int) and 0 <= answer < 4:
            payload["correct_option"] = answer

        text_final = payload.get("question_text")
        opts_final = payload.get("options")
        ans_final = payload.get("correct_option")

        return (
            isinstance(text_final, str) and len(text_final.strip()) >= 15
            and isinstance(opts_final, list) and len(opts_final) == 4
            and all(isinstance(opt, str) and opt.strip() for opt in opts_final)
            and isinstance(ans_final, int) and 0 <= ans_final < 4
        )

    @classmethod
    async def generate_and_store_questions(
        cls,
        db: AsyncSession,
        blueprint_slots: List[BlueprintSlot],
        candidate_id: Optional[str] = None,
        scoped_normalized_texts: Optional[List[str]] = None,
        created_by: str = "ai_factory"
    ) -> List[MasterQuestionBank]:
        """Generates targeted questions in small batches, validates, deduplicates, and stores in Master Question Bank."""
        if not blueprint_slots:
            return []

        # Tier 1: Global Exact Fingerprints across entire MasterQuestionBank
        existing_rows = (await db.execute(select(MasterQuestionBank.question_fingerprint))).scalars().all()
        global_fingerprints = set(existing_rows)

        # Tier 2: Candidate History Texts (if candidate_id present)
        candidate_history_texts: List[str] = []
        if candidate_id:
            cand_rows = (await db.execute(
                select(AssessmentQuestionHistory.normalized_question)
                .where(AssessmentQuestionHistory.candidate_id == candidate_id)
            )).scalars().all()
            candidate_history_texts = [r for r in cand_rows if r]

        # Combine candidate history + current session paper texts
        effective_scoped_texts: List[str] = list(set((scoped_normalized_texts or []) + candidate_history_texts))

        logger.info("==========================================")
        logger.info(
            "QUESTION FACTORY CALLED | Requested Slots: %d | Candidate ID: %s | Scoped Texts Count: %d",
            len(blueprint_slots), candidate_id or "N/A", len(effective_scoped_texts)
        )
        logger.info("==========================================")

        raw_ai_returned_count = 0
        parsed_count = 0
        schema_valid_count = 0
        duplicate_rejected_count = 0
        similarity_rejected_count = 0
        replacement_generation_count = 0
        master_insert_count = 0
        question_counter = 0

        stored_records: List[MasterQuestionBank] = []

        # Batch generation: max 10 items per LLM call to maximize throughput
        batch_size = 10
        slot_batches = [blueprint_slots[i:i + batch_size] for i in range(0, len(blueprint_slots), batch_size)]

        async def _process_single_batch(batch_idx: int, slot_batch: List[BlueprintSlot]) -> List[MasterQuestionBank]:
            nonlocal raw_ai_returned_count, parsed_count, schema_valid_count
            nonlocal duplicate_rejected_count, similarity_rejected_count, replacement_generation_count
            nonlocal master_insert_count, question_counter

            batch_accepted: List[MasterQuestionBank] = []
            pass_num = 0

            while len(batch_accepted) < len(slot_batch) and pass_num < cls.MAX_FACTORY_PASSES:
                pass_num += 1
                if pass_num > 1:
                    replacement_generation_count += 1
                unfilled_slots = slot_batch[len(batch_accepted):]

                prompt = cls._build_factory_prompt(
                    slots=unfilled_slots,
                    exclusions=effective_scoped_texts,
                    pass_num=pass_num
                )

                t_ai_start = time.perf_counter()
                raw = await ai_engine._call_gemini_with_fallback(prompt, json_mode=True, task="assessment")
                ai_latency_ms = round((time.perf_counter() - t_ai_start) * 1000, 1)

                logger.info(
                    "[PROFILING TIMING] Stage: AI Provider Call | Latency: %.1f ms | Batch: %d/%d | Pass: %d | Status: %s",
                    ai_latency_ms, batch_idx, len(slot_batches), pass_num, "Success" if raw else "Failed"
                )

                if not raw:
                    continue

                t_parse_start = time.perf_counter()
                try:
                    cleaned = ai_engine._clean_json_str(raw)
                    parsed = json.loads(cleaned)
                    candidates = parsed if isinstance(parsed, list) else parsed.get("questions", [])
                except (TypeError, ValueError, json.JSONDecodeError) as parse_err:
                    logger.warning("AI Question Factory: Invalid JSON returned on batch %d pass %d: %s", batch_idx, pass_num, parse_err)
                    continue
                parse_ms = round((time.perf_counter() - t_parse_start) * 1000, 2)
                logger.info("[PROFILING TIMING] Stage: JSON Parsing | Duration: %.2f ms | Items: %d", parse_ms, len(candidates))

                raw_ai_returned_count += len(candidates)

                for idx, q_payload in enumerate(candidates):
                    question_counter += 1
                    if len(batch_accepted) >= len(slot_batch):
                        break

                    t_val_start = time.perf_counter()
                    is_schema_valid = cls._valid_factory_payload(q_payload)
                    val_ms = round((time.perf_counter() - t_val_start) * 1000, 2)

                    if not is_schema_valid:
                        logger.error(
                            "REJECTED QUESTION | Question #%d | Stage: Question Validator (%.2f ms) | Reason: Schema Validation Failed",
                            question_counter, val_ms
                        )
                        continue

                    schema_valid_count += 1
                    parsed_count += 1

                    target_slot = unfilled_slots[min(idx, len(unfilled_slots) - 1)]
                    topic = q_payload.get("topic") or target_slot.topic
                    subtopic = q_payload.get("subtopic") or target_slot.subtopic
                    concept = q_payload.get("concept") or target_slot.concept
                    bloom = q_payload.get("bloom_taxonomy") or target_slot.bloom_taxonomy
                    q_text = q_payload["question_text"]

                    t_dup_start = time.perf_counter()
                    is_unique, reason = duplicate_detector.evaluate_uniqueness(
                        question_text=q_text,
                        topic=topic,
                        subtopic=subtopic,
                        concept=concept,
                        bloom_taxonomy=bloom,
                        global_fingerprints=global_fingerprints,
                        scoped_normalized_texts=effective_scoped_texts,
                    )
                    dup_ms = round((time.perf_counter() - t_dup_start) * 1000, 2)

                    if not is_unique:
                        if "text_similarity" in reason:
                            similarity_rejected_count += 1
                            logger.error(
                                "REJECTED QUESTION | Question #%d | Stage: Duplicate Detector (%.2f ms) | Reason: %s",
                                question_counter, dup_ms, reason
                            )
                        else:
                            duplicate_rejected_count += 1
                            logger.error(
                                "REJECTED QUESTION | Question #%d | Stage: Duplicate Detector (%.2f ms) | Reason: %s",
                                question_counter, dup_ms, reason
                            )
                        continue

                    fp = duplicate_detector.compute_fingerprint(q_text)
                    ch = duplicate_detector.compute_concept_hash(topic, subtopic, concept, bloom)

                    # Post-Processing: Shuffle options randomly to eliminate "always A" bias while preserving answer text integrity
                    raw_options = list(q_payload["options"])
                    raw_correct_idx = q_payload["correct_option"]

                    if isinstance(raw_correct_idx, int) and 0 <= raw_correct_idx < len(raw_options):
                        correct_text = raw_options[raw_correct_idx]
                        shuffled_options = list(raw_options)
                        random.shuffle(shuffled_options)
                        new_correct_idx = shuffled_options.index(correct_text)
                    else:
                        shuffled_options = raw_options
                        new_correct_idx = 0
                        correct_text = shuffled_options[0]

                    logger.info(
                        "[CORRECT OPTION PIPELINE TRACE]\n"
                        "  1. Raw AI returned correct_option  : %s\n"
                        "  2. Before DB insert correct_option : %s (Option %s: '%s')\n"
                        "  3. Stored in DB correct_option    : %s\n"
                        "  4. Options Array                   : %s",
                        raw_correct_idx,
                        new_correct_idx, chr(65 + new_correct_idx), correct_text,
                        new_correct_idx,
                        shuffled_options
                    )

                    record = MasterQuestionBank(
                        topic=topic,
                        subtopic=subtopic,
                        concept=concept,
                        difficulty=target_slot.difficulty,
                        bloom_taxonomy=bloom,
                        question_type=target_slot.question_type,
                        scenario_type=q_payload.get("scenario_type") or "General Enterprise",
                        technology=topic,
                        tags=[topic, subtopic, concept],
                        question_text=q_text,
                        options=shuffled_options,
                        correct_option=new_correct_idx,
                        explanation=q_payload.get("explanation") or "Enterprise technical explanation.",
                        code_snippet=q_payload.get("code_snippet"),
                        passage_text=q_payload.get("passage_text"),
                        dataset_json=q_payload.get("dataset_json"),
                        test_cases=q_payload.get("test_cases"),
                        language=q_payload.get("language"),
                        created_by=created_by,
                        question_fingerprint=fp,
                        concept_hash=ch,
                    )

                    batch_accepted.append(record)
                    global_fingerprints.add(fp)
                    effective_scoped_texts.append(duplicate_detector.normalize_text(q_text))

            return batch_accepted

        # Run batch generation in parallel using asyncio.gather if multiple batches exist
        if len(slot_batches) > 1:
            logger.info("Executing %d batch AI requests in parallel via asyncio.gather...", len(slot_batches))
            batch_results = await asyncio.gather(*[
                _process_single_batch(idx, batch) for idx, batch in enumerate(slot_batches, start=1)
            ])
            for res in batch_results:
                stored_records.extend(res)
        else:
            single_res = await _process_single_batch(1, slot_batches[0])
            stored_records.extend(single_res)

        # Bulk insert into Master Question Bank in a single batch call
        t_db_start = time.perf_counter()
        if stored_records:
            db.add_all(stored_records)
            await db.flush()
            master_insert_count = len(stored_records)
        db_write_ms = round((time.perf_counter() - t_db_start) * 1000, 1)

        logger.info("[PROFILING TIMING] Stage: DB Batch Write (Master Question Bank) | Duration: %.1f ms | Inserted: %d", db_write_ms, master_insert_count)

        logger.info("==========================================")
        logger.info("QUESTION FACTORY EXECUTION TRACE SUMMARY")
        logger.info("  Requested Slots               : %d", len(blueprint_slots))
        logger.info("  AI Provider Returned          : %d", raw_ai_returned_count)
        logger.info("  Parsed Count                  : %d", parsed_count)
        logger.info("  Validated Count               : %d", schema_valid_count)
        logger.info("  Duplicate Rejected (Global FP): %d", duplicate_rejected_count)
        logger.info("  Similarity Rejected (Scoped)  : %d", similarity_rejected_count)
        logger.info("  Replacement Pass Count        : %d", replacement_generation_count)
        logger.info("  Stored in Master Question Bank: %d", master_insert_count)
        logger.info("==========================================")

        return stored_records


question_factory = AIQuestionFactory()
