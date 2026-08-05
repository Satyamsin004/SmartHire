import random
from dataclasses import dataclass
from typing import Dict, List, Any


@dataclass
class BlueprintSlot:
    slot_index: int
    topic: str
    subtopic: str
    concept: str
    difficulty: str
    bloom_taxonomy: str
    question_type: str


class QuestionPlanner:
    """Enterprise Assessment Blueprint & Question Planner Engine."""

    BLOOM_TAXONOMY_LEVELS = ["Remember", "Understand", "Apply", "Analyze", "Evaluate", "Create"]
    QUESTION_TYPES = [
        "Conceptual", "Scenario Based", "Debugging", "Output Prediction",
        "Code Completion", "Architecture", "Performance", "Security", "Best Practices"
    ]

    SUBTOPIC_CONCEPT_MAP: Dict[str, List[Dict[str, str]]] = {
        "Python": [
            {"subtopic": "Memory & Resources", "concept": "Context Managers & With Statement"},
            {"subtopic": "Object Oriented Programming", "concept": "Metaclasses & Singleton Pattern"},
            {"subtopic": "Concurrency & Async", "concept": "Asyncio Coroutines & Event Loops"},
            {"subtopic": "Decorators & Generators", "concept": "Function Wrappers & Yield Generators"},
            {"subtopic": "Data Structures", "concept": "List Comprehensions & Generative Expressions"},
            {"subtopic": "Type Hints & Annotations", "concept": "Pydantic Models & Type Checks"},
        ],
        "FastAPI": [
            {"subtopic": "Dependency Injection", "concept": "Depends Utility & Lifetime Scopes"},
            {"subtopic": "Routing & Endpoint Handling", "concept": "Path & Query Parameter Parsing"},
            {"subtopic": "Authentication & Security", "concept": "OAuth2 Bearer Tokens & JWT Validation"},
            {"subtopic": "Middleware & Event Handlers", "concept": "HTTP Request Middleware & CORS"},
            {"subtopic": "Database & ORM", "concept": "Async SQLAlchemy Sessions"},
        ],
        "SQL": [
            {"subtopic": "Joins & Set Operations", "concept": "Inner vs Left Outer Join Semantics"},
            {"subtopic": "Indexing & Performance", "concept": "B-Tree Indexing & Query Execution Plans"},
            {"subtopic": "Transactions & Isolation", "concept": "ACID Properties & Concurrency Control"},
            {"subtopic": "Aggregation & Window Functions", "concept": "Group By & OVER Partitioning"},
            {"subtopic": "Schema & DDL", "concept": "Foreign Key Constraints & Triggers"},
        ],
        "React": [
            {"subtopic": "Hooks & State", "concept": "useCallback vs useMemo Memoization"},
            {"subtopic": "Component Lifecycle", "concept": "useEffect Cleanup & Mounting"},
            {"subtopic": "Context & Global State", "concept": "Context Provider & Redux Toolkit"},
            {"subtopic": "Virtual DOM & Rendering", "concept": "Reconciliation & Fiber Architecture"},
        ],
        "Docker": [
            {"subtopic": "Containerization", "concept": "Multi-Stage Dockerfile Builds"},
            {"subtopic": "Networking & Volumes", "concept": "Bridge Networks & Persistent Volume Mounts"},
        ],
        "System Design": [
            {"subtopic": "Caching", "concept": "Redis Distributed Caching & Eviction Policies"},
            {"subtopic": "Load Balancing", "concept": "Round Robin & Consistent Hashing"},
        ],
        "Aptitude": [
            {"subtopic": "Quantitative Reasoning", "concept": "Percentages, Ratios & Time-Distance"},
            {"subtopic": "Logical Deduction", "concept": "Syllogisms & Pattern Sequences"},
            {"subtopic": "Verbal Ability", "concept": "Reading Comprehension & Critical Reasoning"},
        ]
    }

    @classmethod
    def create_blueprint(
        cls, topics: List[str], difficulty: str, total_questions: int
    ) -> List[BlueprintSlot]:
        """Creates a balanced assessment blueprint mapped across topics, subtopics, concepts, and Bloom taxonomy."""
        cleaned_topics = [t.strip() for t in topics if t and t.strip()]
        if not cleaned_topics:
            cleaned_topics = ["Python", "System Design", "SQL"]

        base_count, remainder = divmod(total_questions, len(cleaned_topics))
        topic_quotas = {topic: base_count + (1 if idx < remainder else 0) for idx, topic in enumerate(cleaned_topics)}

        slots: List[BlueprintSlot] = []
        global_index = 1

        for topic, quota in topic_quotas.items():
            concept_pool = cls.SUBTOPIC_CONCEPT_MAP.get(
                topic,
                [{"subtopic": f"{topic} Core", "concept": f"{topic} Fundamentals"}]
            )

            for item_idx in range(quota):
                concept_entry = concept_pool[item_idx % len(concept_pool)]
                bloom = cls.BLOOM_TAXONOMY_LEVELS[item_idx % len(cls.BLOOM_TAXONOMY_LEVELS)]
                q_type = cls.QUESTION_TYPES[item_idx % len(cls.QUESTION_TYPES)]

                slots.append(BlueprintSlot(
                    slot_index=global_index,
                    topic=topic,
                    subtopic=concept_entry["subtopic"],
                    concept=concept_entry["concept"],
                    difficulty=difficulty,
                    bloom_taxonomy=bloom,
                    question_type=q_type,
                ))
                global_index += 1

        return slots


question_planner = QuestionPlanner()
