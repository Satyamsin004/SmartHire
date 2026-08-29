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
        "Quantitative Aptitude": [
            {"subtopic": "Percentage & Profit/Loss", "concept": "Percentage Calculations, Profit, Loss & Discount"},
            {"subtopic": "Interest Calculations", "concept": "Simple Interest & Compound Interest Formulas"},
            {"subtopic": "Time & Work", "concept": "Efficiency, Work Done, Pipes & Cisterns"},
            {"subtopic": "Speed, Distance & Time", "concept": "Relative Speed, Trains, Boats & Streams"},
            {"subtopic": "Ratios & Averages", "concept": "Ratio & Proportion, Partnership, Averages, Ages"},
            {"subtopic": "Mixtures & Allegations", "concept": "Alligation Rule, Mean Value & Mixture Ratios"},
            {"subtopic": "Number System & Divisibility", "concept": "HCF, LCM, Divisibility Rules & Prime Factors"},
            {"subtopic": "Permutation, Combination & Probability", "concept": "P&C Formulas, Sample Space & Event Probability"},
            {"subtopic": "Data Interpretation", "concept": "Tables, Pie Charts, Line Graphs, Bar Graphs & Caselet DI"},
            {"subtopic": "Algebra & Geometry", "concept": "Quadratic Equations, Mensuration, Geometry & Logarithms"},
            {"subtopic": "Simplification & Approximation", "concept": "BODMAS Rule, Surds, Indices & Approximation"},
        ],
        "Logical Reasoning": [
            {"subtopic": "Blood Relations & Family Trees", "concept": "Relationship Identification & Family Tree Diagrams"},
            {"subtopic": "Coding & Decoding", "concept": "Letter Shift, Number Coding & Symbol Substitutions"},
            {"subtopic": "Series & Analogies", "concept": "Number Series, Letter Series, Word Analogy & Classification"},
            {"subtopic": "Arrangements & Puzzles", "concept": "Linear Seating, Circular Seating & Floor Puzzles"},
            {"subtopic": "Syllogisms & Verbal Logic", "concept": "Venn Diagram Deduction, Statements & Conclusions"},
            {"subtopic": "Assumptions & Deductions", "concept": "Statement Assumptions, Logical Deduction & Arguments"},
            {"subtopic": "Directions & Order", "concept": "Direction Sense, Clock Angle, Calendar & Ranking"},
            {"subtopic": "Data Sufficiency & Input-Output", "concept": "Data Sufficiency Evaluation & Machine Input-Output"},
        ],
        "Verbal Ability": [
            {"subtopic": "Reading Comprehension", "concept": "Passage Analysis, Main Idea, Inference & Vocabulary"},
            {"subtopic": "Vocabulary & Word Power", "concept": "Synonyms, Antonyms, Analogies & One-Word Substitution"},
            {"subtopic": "Grammar & Error Spotting", "concept": "Error Detection, Sentence Improvement & Subject-Verb Agreement"},
            {"subtopic": "Para Jumbles & Sentence Ordering", "concept": "Sentence Rearrangement & Coherent Paragraph Formation"},
            {"subtopic": "Cloze Test & Sentence Completion", "concept": "Fill in the Blanks, Cloze Passage & Contextual Fit"},
            {"subtopic": "Voice & Speech Transformation", "concept": "Active/Passive Voice & Direct/Indirect Speech"},
        ],
        "Programming MCQs": [
            {"subtopic": "C / C++ Fundamentals", "concept": "Pointers, Memory Allocation, References & Preprocessor"},
            {"subtopic": "Java Core Mechanics", "concept": "JVM, Collections Framework, Multithreading & GC"},
            {"subtopic": "Python Advanced Features", "concept": "Decorators, Context Managers, Generators & Asyncio"},
            {"subtopic": "JavaScript & Web Fundamentals", "concept": "Event Loop, Promises, Closures & ES6+ Features"},
            {"subtopic": "Operating Systems", "concept": "Process Scheduling, Memory Management, Deadlocks & Threads"},
            {"subtopic": "Computer Networks", "concept": "OSI Layers, TCP/IP, HTTP/HTTPS, DNS & Socket API"},
            {"subtopic": "Object Oriented Programming", "concept": "Encapsulation, Inheritance, Polymorphism & SOLID Principles"},
            {"subtopic": "Software Engineering & Git", "concept": "Version Control, REST APIs, Design Patterns & CI/CD"},
        ],
        "SQL Section": [
            {"subtopic": "Data Querying & Joins", "concept": "SELECT, INNER JOIN, LEFT JOIN, RIGHT JOIN & FULL JOIN"},
            {"subtopic": "Aggregation & Grouping", "concept": "GROUP BY, HAVING, COUNT, SUM, AVG, MIN, MAX"},
            {"subtopic": "Advanced Window Functions", "concept": "ROW_NUMBER, RANK, DENSE_RANK, LEAD, LAG, PARTITION BY"},
            {"subtopic": "Subqueries & CTEs", "concept": "Nested Queries, Correlated Subqueries & WITH Clause"},
            {"subtopic": "Constraints & Database Design", "concept": "Primary/Foreign Keys, Normalization (1NF-3NF) & B-Tree Indexing"},
        ],
        "Data Structures & Algorithms": [
            {"subtopic": "Arrays & Strings", "concept": "Two Pointer, Sliding Window, Prefix Sum & Subarrays"},
            {"subtopic": "Linked Lists, Stacks & Queues", "concept": "Reversal, Monotonic Stack & Circular Queue"},
            {"subtopic": "Trees & Binary Search Trees", "concept": "Traversals, Lowest Common Ancestor & BST Operations"},
            {"subtopic": "Heaps & HashMaps", "concept": "Top K Elements, Priority Queue & Hash Collisions"},
            {"subtopic": "Graphs & Disjoint Sets", "concept": "BFS, DFS, Dijkstra Algorithm & Union Find"},
            {"subtopic": "Recursion & Dynamic Programming", "concept": "Memoization, Tabulation, Knapsack & Subsequences"},
            {"subtopic": "Searching & Sorting", "concept": "Binary Search, QuickSort, MergeSort & Segment Tree"},
        ],
        "Coding Challenges": [
            {"subtopic": "Array & String Manipulation", "concept": "Optimal In-Place Algorithms & Substring Search"},
            {"subtopic": "Tree & Graph Algorithms", "concept": "Shortest Path, Cycle Detection & Tree Traversals"},
            {"subtopic": "Dynamic Programming & Greedy", "concept": "Optimal Substructure & State Transition Planning"},
        ],
        "DBMS & SQL": [
            {"subtopic": "Relational Data Modeling", "concept": "Normalization & Entity Relationships"},
            {"subtopic": "SQL Queries & Joins", "concept": "Inner, Outer & Self Joins"},
            {"subtopic": "Transaction Management", "concept": "ACID Properties & Concurrency Control"},
        ],
        "Operating Systems": [
            {"subtopic": "Process Management", "concept": "CPU Scheduling Algorithms & Threads"},
            {"subtopic": "Memory & Storage", "concept": "Paging, Virtual Memory & Deadlock Prevention"},
        ],
        "Computer Networks": [
            {"subtopic": "Network Architecture", "concept": "OSI Layer Model & TCP/IP Protocol Suite"},
            {"subtopic": "Web Protocols & Routing", "concept": "HTTP/HTTPS, DNS & Routing Algorithms"},
        ],
        "OOP & Design Patterns": [
            {"subtopic": "Core OOP Principles", "concept": "Encapsulation, Polymorphism & Abstraction"},
            {"subtopic": "Software Design Patterns", "concept": "Factory, Singleton, Observer & Strategy"},
        ],
        "Java": [
            {"subtopic": "Core Java Mechanics", "concept": "JVM Memory, Garbage Collection & Collections"},
            {"subtopic": "Concurrency & OOP", "concept": "Multithreading, Executorship & Interfaces"},
        ],
        "Python": [
            {"subtopic": "Memory & Resources", "concept": "Context Managers & With Statement"},
            {"subtopic": "Object Oriented Programming", "concept": "Metaclasses & Dunder Methods"},
            {"subtopic": "Concurrency & Async", "concept": "Asyncio Coroutines & Event Loops"},
        ],
        "JavaScript & TypeScript": [
            {"subtopic": "JS Async & Event Loop", "concept": "Promises, Async/Await & Microtask Queue"},
            {"subtopic": "TS Type System", "concept": "Generics, Interfaces & Union/Intersection Types"},
        ],
        "React": [
            {"subtopic": "Hooks & State", "concept": "useCallback vs useMemo Memoization"},
            {"subtopic": "Component Lifecycle", "concept": "useEffect Cleanup & Mounting Logic"},
        ],
    }

    @classmethod
    def get_concept_pool(cls, topic: str) -> List[Dict[str, str]]:
        t_clean = topic.strip()
        if t_clean in cls.SUBTOPIC_CONCEPT_MAP:
            return cls.SUBTOPIC_CONCEPT_MAP[t_clean]

        for key, val in cls.SUBTOPIC_CONCEPT_MAP.items():
            if key.lower() in t_clean.lower() or t_clean.lower() in key.lower():
                return val

        return [{"subtopic": f"{t_clean} Core", "concept": f"{t_clean} Fundamentals"}]

    @classmethod
    def create_blueprint(
        cls, topics: List[str], difficulty: str, total_questions: int
    ) -> List[BlueprintSlot]:
        """
        Creates a balanced assessment blueprint mapped across topics, subtopics, concepts,
        and enforces strict 30% Easy, 50% Medium, 20% Hard difficulty distribution.
        """
        cleaned_topics = [t.strip() for t in topics if t and t.strip()]
        if not cleaned_topics:
            cleaned_topics = ["Quantitative Aptitude", "Logical Reasoning", "Verbal Ability", "Programming MCQs"]

        # Enforce exact 30% Easy, 50% Medium, 20% Hard distribution
        easy_count = round(total_questions * 0.30)
        hard_count = round(total_questions * 0.20)
        medium_count = max(0, total_questions - easy_count - hard_count)

        difficulty_sequence: List[str] = (
            ["Easy"] * easy_count +
            ["Medium"] * medium_count +
            ["Hard"] * hard_count
        )
        # Ensure length matches total_questions
        while len(difficulty_sequence) < total_questions:
            difficulty_sequence.append("Medium")
        difficulty_sequence = difficulty_sequence[:total_questions]

        base_count, remainder = divmod(total_questions, len(cleaned_topics))
        topic_quotas = {topic: base_count + (1 if idx < remainder else 0) for idx, topic in enumerate(cleaned_topics)}

        slots: List[BlueprintSlot] = []
        global_index = 1

        for topic, quota in topic_quotas.items():
            concept_pool = cls.get_concept_pool(topic)

            for item_idx in range(quota):
                slot_difficulty = difficulty_sequence[global_index - 1]
                concept_entry = concept_pool[item_idx % len(concept_pool)]
                bloom = cls.BLOOM_TAXONOMY_LEVELS[item_idx % len(cls.BLOOM_TAXONOMY_LEVELS)]
                q_type = cls.QUESTION_TYPES[item_idx % len(cls.QUESTION_TYPES)]

                slots.append(BlueprintSlot(
                    slot_index=global_index,
                    topic=topic,
                    subtopic=concept_entry["subtopic"],
                    concept=concept_entry["concept"],
                    difficulty=slot_difficulty,
                    bloom_taxonomy=bloom,
                    question_type=q_type,
                ))
                global_index += 1

        return slots


question_planner = QuestionPlanner()

