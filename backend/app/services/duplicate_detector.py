import hashlib
import logging
import re
from difflib import SequenceMatcher
from typing import Any, Dict, List, Optional, Set, Tuple

logger = logging.getLogger("smarthire.duplicate_detector")


class DuplicateDetector:
    """Multi-Tier Enterprise Duplicate & Concept Detection Engine."""

    # Updated threshold: Reject only near-identical questions (90%+ text / semantic similarity)
    SIMILARITY_THRESHOLD = 0.90
    EMBEDDING_SIMILARITY_THRESHOLD = 0.90

    @staticmethod
    def normalize_text(text: str) -> str:
        return " ".join(re.findall(r"[a-z0-9+#.]+", (text or "").lower()))

    @classmethod
    def compute_fingerprint(cls, text: str) -> str:
        return hashlib.sha256(cls.normalize_text(text).encode("utf-8")).hexdigest()

    @classmethod
    def compute_concept_hash(cls, topic: str, subtopic: str, concept: str, bloom_taxonomy: str) -> str:
        raw = f"{(topic or '').strip().lower()}:{(subtopic or '').strip().lower()}:{(concept or '').strip().lower()}:{(bloom_taxonomy or '').strip().lower()}"
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()

    @classmethod
    def calculate_text_similarity(cls, s1: str, s2: str) -> float:
        norm1 = cls.normalize_text(s1)
        norm2 = cls.normalize_text(s2)
        if not norm1 or not norm2:
            return 0.0
        tokens1, tokens2 = set(norm1.split()), set(norm2.split())
        jaccard = len(tokens1 & tokens2) / len(tokens1 | tokens2)
        sequence = SequenceMatcher(None, norm1, norm2).ratio()
        return max(jaccard, sequence)

    @staticmethod
    def calculate_cosine_similarity(vec1: List[float], vec2: List[float]) -> float:
        if not vec1 or not vec2 or len(vec1) != len(vec2):
            return 0.0
        dot = sum(a * b for a, b in zip(vec1, vec2))
        norm1 = sum(a * a for a in vec1) ** 0.5
        norm2 = sum(b * b for b in vec2) ** 0.5
        if norm1 == 0 or norm2 == 0:
            return 0.0
        return dot / (norm1 * norm2)

    @classmethod
    def evaluate_uniqueness(
        cls,
        *,
        question_text: str,
        topic: str,
        subtopic: str,
        concept: str,
        bloom_taxonomy: str,
        global_fingerprints: Set[str],
        scoped_normalized_texts: List[str],
        existing_concept_hashes: Optional[Set[str]] = None,
        existing_normalized_texts: Optional[List[str]] = None,
        existing_fingerprints: Optional[Set[str]] = None,
        embedding: Optional[List[float]] = None,
        scoped_embeddings: Optional[List[List[float]]] = None,
    ) -> Tuple[bool, str]:
        """
        Evaluates a candidate question for uniqueness:
        1. Exact Fingerprint Matching: Global across MasterQuestionBank.
        2. Text & Semantic Similarity: Scoped ONLY to current session paper & candidate history.
        """
        # Backward compatibility for positional or legacy parameter callers
        effective_global_fps = global_fingerprints or existing_fingerprints or set()
        effective_scoped_texts = scoped_normalized_texts if scoped_normalized_texts is not None else (existing_normalized_texts or [])

        # Tier 1: Global Exact Fingerprint Matching (prevents 100% identical questions anywhere in DB)
        text_fp = cls.compute_fingerprint(question_text)
        if text_fp in effective_global_fps:
            logger.warning(
                "[DUPLICATE DETECTOR LOG] REJECTED (exact_fingerprint_duplicate) | Fingerprint: %s | Candidate: '%s...'",
                text_fp[:12], question_text[:60]
            )
            return False, "exact_fingerprint_duplicate"

        # Tier 2: Scoped Text Similarity (evaluated ONLY against current session & candidate history)
        norm_text = cls.normalize_text(question_text)
        for target_idx, prior_norm in enumerate(effective_scoped_texts, start=1):
            sim = cls.calculate_text_similarity(norm_text, prior_norm)
            is_rejected = sim >= cls.SIMILARITY_THRESHOLD
            status_str = "REJECTED" if is_rejected else "ACCEPTED"

            logger.info(
                "[DUPLICATE DETECTOR LOG] Comparison Target #%d | Candidate: '%s...' vs Scoped Target: '%s...' | Similarity: %.1f%% | Threshold: %.1f%% | Result: %s",
                target_idx, question_text[:40], prior_norm[:40], sim * 100, cls.SIMILARITY_THRESHOLD * 100, status_str
            )

            if is_rejected:
                return False, f"text_similarity_exceeded ({sim*100:.1f}%)"

        # Tier 3: Scoped Embedding / Semantic Similarity
        if embedding and scoped_embeddings:
            for target_idx, prior_emb in enumerate(scoped_embeddings, start=1):
                emb_sim = cls.calculate_cosine_similarity(embedding, prior_emb)
                is_rejected = emb_sim >= cls.EMBEDDING_SIMILARITY_THRESHOLD
                status_str = "REJECTED" if is_rejected else "ACCEPTED"

                logger.info(
                    "[DUPLICATE DETECTOR LOG] Embedding Target #%d | Cosine Sim: %.1f%% | Threshold: %.1f%% | Result: %s",
                    target_idx, emb_sim * 100, cls.EMBEDDING_SIMILARITY_THRESHOLD * 100, status_str
                )

                if is_rejected:
                    return False, f"embedding_similarity_exceeded ({emb_sim*100:.1f}%)"

        return True, "unique"


duplicate_detector = DuplicateDetector()
