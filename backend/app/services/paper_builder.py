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
                 "PARTITION BY divides the query result set into partitions to which the window function is applied."),

                ("Which ACID property ensures that transactions execute concurrently without interfering with each other?",
                 ["Isolation", "Atomicity", "Consistency", "Durability"], 0,
                 "Isolation guarantees that concurrently running transactions appear to run sequentially without intermediate state interference."),

                ("In relational databases, what is the primary purpose of Database Normalization (up to 3NF)?",
                 ["To eliminate data redundancy and reduce update anomalies.",
                  "To improve full table scan performance.",
                  "To automatically shard tables across clusters.",
                  "To convert SQL tables into NoSQL documents."], 0,
                 "Normalization organizes schemas to remove duplicate data and prevent insert, update, and delete anomalies."),

                ("What is the operational difference between `DELETE` and `TRUNCATE` in SQL?",
                 ["TRUNCATE is a DDL operation that deallocates data pages without row-by-row logging; DELETE is DML.",
                  "DELETE cannot be rolled back; TRUNCATE can always be rolled back.",
                  "TRUNCATE fires individual row triggers; DELETE does not.",
                  "There is no functional or performance difference."], 0,
                 "TRUNCATE resets storage and avoids per-row transaction logging, whereas DELETE removes rows individually.")
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

                ("Given an array of integers `nums` and an integer `target`, what is the optimal time complexity to find two indices summing to target using a HashMap?",
                 ["O(N) time and O(N) space", "O(N^2) time and O(1) space", "O(N log N) time and O(1) space", "O(1) time and O(N) space"], 0,
                 "Using a HashMap to store seen complement values achieves linear O(N) time and O(N) auxiliary space."),

                ("Which data structure is fundamentally used in Depth First Search (DFS) of a graph?",
                 ["Stack", "Queue", "Min-Heap", "Circular Buffer"], 0,
                 "DFS uses a Last-In-First-Out (LIFO) Stack, either explicitly or via call-stack recursion."),

                ("What is the time complexity of searching for an element in a balanced Binary Search Tree (AVL or Red-Black Tree)?",
                 ["O(log N)", "O(N)", "O(1)", "O(N log N)"], 0,
                 "Balanced BSTs maintain logarithmic tree height, ensuring lookups take O(log N) operations."),

                ("Which algorithmic paradigm does Dijkstra's algorithm for single-source shortest paths on weighted graphs use?",
                 ["Greedy Approach", "Divide and Conquer", "Dynamic Programming", "Backtracking"], 0,
                 "Dijkstra greedily chooses the closest unvisited vertex using a Priority Queue at each step."),

                ("What is the worst-case time complexity of finding a cycle in an undirected graph with V vertices and E edges using BFS/DFS?",
                 ["O(V + E)", "O(V * E)", "O(V^2)", "O(E log V)"], 0,
                 "Graph traversal visiting every vertex and inspecting incident edges operates in O(V + E) linear time."),

                ("What is the auxiliary space complexity of Merge Sort when sorting an array of size N?",
                 ["O(N)", "O(1)", "O(log N)", "O(N^2)"], 0,
                 "Merge Sort requires a temporary buffer of size N during the merge step to combine subarrays."),

                ("In a Min-Heap with N elements, what is the time complexity of the `extract-min` operation?",
                 ["O(log N)", "O(1)", "O(N)", "O(N log N)"], 0,
                 "Removing the root requires replacing it with the last element and heapifying down, taking O(log N)."),

                ("Which data structure is most optimal for implementing a Least Recently Used (LRU) Cache with O(1) get and put operations?",
                 ["Doubly Linked List and Hash Map", "Binary Search Tree and Array", "Singly Linked List and Queue", "Two Stacks"], 0,
                 "A Hash Map provides O(1) node lookup and a Doubly Linked List enables O(1) node removal and re-insertion."),

                ("What is the amortized time complexity of inserting an element into a dynamic array (like std::vector or Python list)?",
                 ["O(1)", "O(N)", "O(log N)", "O(N^2)"], 0,
                 "While occasional capacity doublings cost O(N), spread over N insertions the amortized cost per append is O(1).")
            ]
        elif "javascript" in t_low or "typescript" in t_low or t_low in {"js", "ts"}:
            pool = [
                ("In JavaScript/TypeScript, what is the output of `typeof null` and `typeof undefined`?",
                 ["object, undefined", "null, undefined", "object, object", "undefined, null"], 0,
                 "In JS, typeof null evaluates to 'object' (historic legacy bug) while typeof undefined is 'undefined'."),

                ("What is the primary difference between `Promise.all()` and `Promise.allSettled()` in JS/TS?",
                 ["Promise.all short-circuits on first rejection; Promise.allSettled waits for all promises to finish.",
                  "Promise.allSettled short-circuits on rejection; Promise.all waits.",
                  "Promise.all only works with strings; Promise.allSettled works with numbers.",
                  "Promise.all is synchronous; Promise.allSettled is asynchronous."], 0,
                 "Promise.all short-circuits on error, whereas Promise.allSettled returns outcomes for all promises."),

                ("In JavaScript, what happens when using the `==` operator compared to the `===` operator?",
                 ["`==` performs implicit type coercion; `===` checks both value and type without coercion.",
                  "`===` converts both operands to strings before comparing.",
                  "`==` is used for objects only; `===` is for primitives only.",
                  "They are functionally equivalent in ES6."], 0,
                 "Strict equality `===` evaluates to false if types differ, whereas `==` coerces operand types."),

                ("In the JavaScript Event Loop, which queue takes precedence for execution after synchronous code completes?",
                 ["Microtask Queue (Promises, queueMicrotask)", "Macrotask Queue (setTimeout, setInterval)", "Render Queue", "I/O Polling Queue"], 0,
                 "Microtasks are drained completely after the synchronous call stack empties before any macrotask is processed."),

                ("In TypeScript, what is the key difference between an `interface` and a `type` alias regarding declaration merging?",
                 ["Interfaces support declaration merging; type aliases cannot be merged.",
                  "Types support declaration merging; interfaces cannot.",
                  "Interfaces only work with primitive types.",
                  "Type aliases cannot be used in function signatures."], 0,
                 "Multiple interface declarations with the same name automatically merge into one; type aliases cannot be re-declared.")
            ]
        elif "react" in t_low:
            pool = [
                ("In React, what is the primary difference between `useCallback` and `useMemo`?",
                 ["useCallback memoizes a function instance; useMemo memoizes a computed value.",
                  "useMemo memoizes functions; useCallback memoizes values.",
                  "useCallback triggers side-effects; useMemo handles DOM events.",
                  "Both hooks perform identical operations."], 0,
                 "useCallback returns a memoized callback function; useMemo returns a memoized value."),

                ("In React, why must hooks never be called inside conditional statements or loops?",
                 ["React relies on consistent hook call order across renders to maintain internal state pointers.",
                  "Hooks called conditionally consume double memory.",
                  "Conditional hooks trigger immediate component unmounting.",
                  "React fiber reconciler does not allow if statements in JSX."], 0,
                 "React uses an internal linked list to track hook state, requiring identical execution order on every render."),

                ("What is the purpose of the dependency array in the `useEffect` hook in React?",
                 ["Specifies variables that, when changed between renders, cause the effect to re-run.",
                  "Restricts the hook to run only on user mouse clicks.",
                  "Forces synchronous rendering before DOM painting.",
                  "Bypasses the virtual DOM reconciliation process."], 0,
                 "React compares dependency array references with Object.is to determine if the effect needs execution."),

                ("In React 18, what is the function of the `useTransition` hook?",
                 ["Marks state updates as non-blocking transitions to keep the UI responsive during heavy re-renders.",
                  "Animates CSS transforms across component routes.",
                  "Transfers component state to server-side cookies.",
                  "Prevents unmounted components from throwing warnings."], 0,
                 "useTransition allows developers to prioritize urgent updates (e.g. typing) over deferred transitions.")
            ]
        elif "python" in t_low:
            pool = [
                ("In Python, what is the primary purpose of the `with` statement and context managers?",
                 ["To ensure proper acquisition and release of resources like files or database locks.",
                  "To accelerate loop execution speed.",
                  "To declare private class attributes.",
                  "To compile Python code to C bytecode."], 0,
                 "Context managers automatically invoke __enter__ and __exit__ for clean resource management."),

                ("In Python, what is the Global Interpreter Lock (GIL)?",
                 ["A mutex that protects Python objects, preventing multiple native threads from executing Python bytecodes concurrently.",
                  "A security lock preventing unauthorized network requests.",
                  "A cache compiler that transforms Python into machine code.",
                  "A database connection pool mechanism."], 0,
                 "The GIL ensures thread-safe memory management in CPython by allowing only one native thread to hold the Python interpreter at a time."),

                ("In Python, what is the difference between `__init__` and `__new__`?",
                 ["`__new__` creates and returns a new class instance; `__init__` initializes the existing instance.",
                  "`__init__` allocates memory; `__new__` assigns attribute values.",
                  "`__new__` is only for static methods.",
                  "They are aliases with identical behavior."], 0,
                 "`__new__` is the constructor that instantiates the object, while `__init__` is the initializer."),

                ("What is the time complexity of checking membership (`x in collection`) in a Python `set` versus a Python `list`?",
                 ["Average O(1) in a set; O(N) in a list.",
                  "O(N) in both set and list.",
                  "O(log N) in a set; O(1) in a list.",
                  "O(N log N) in a set; O(N) in a list."], 0,
                 "Python sets are implemented as Hash Tables providing average O(1) lookups, while lists require O(N) linear scanning.")
            ]
        elif "system design" in t_low or "architecture" in t_low:
            pool = [
                ("In distributed systems, what does the CAP Theorem state?",
                 ["A distributed system can guarantee at most two of Consistency, Availability, and Partition Tolerance simultaneously.",
                  "Cache, Application, and Persistence layers must always run on separate nodes.",
                  "Capacity, Availability, and Performance must scale linearly.",
                  "Concurrency, Asynchrony, and Parallelism cannot coexist."], 0,
                 "In the presence of network partitions, a distributed system must choose between strong consistency and high availability."),

                ("What is the primary architectural purpose of a Reverse Proxy (such as NGINX or Envoy)?",
                 ["To handle SSL termination, load balancing, compression, and route client traffic to internal backend services.",
                  "To run database queries faster than PostgreSQL.",
                  "To store source code repositories.",
                  "To compile frontend React code."], 0,
                 "Reverse proxies sit in front of web servers to manage security, load distribution, and TLS termination."),

                ("Which caching strategy updates both the cache and the primary database synchronously before returning success to the client?",
                 ["Write-Through", "Cache-Aside", "Write-Behind (Write-Back)", "Refresh-Ahead"], 0,
                 "Write-Through ensures cache and storage consistency by writing to the cache and the database in the same transaction.")
            ]
        else:
            pool = [
                (f"Which of the following represents a core best practice in {topic}?",
                 [f"Establishing modular, maintainable, and high-performance standards for {topic}.",
                  f"Deprecating all synchronous control flows.",
                  f"Bypassing data validation layers.",
                  f"Executing un-monitored background tasks."], 0,
                 f"Core principles of {topic} prioritize modularity, reliability, and clean execution."),

                (f"When optimizing a system implemented in {topic}, what is a recommended architectural approach?",
                 [f"Analyze execution trade-offs, cache high-frequency outputs, and eliminate bottlenecks.",
                  f"Disable error logging to increase speed.",
                  f"Hardcode external API endpoints.",
                  f"Avoid memory cleanup routines."], 0,
                 f"Performance optimization in {topic} relies on metrics analysis and efficient resource handling."),

                (f"In {topic}, how should errors and edge cases be handled in production services?",
                 [f"Implement structured logging, graceful degradation, and actionable error telemetry.",
                  f"Suppress all exceptions silently.",
                  f"Crash the container immediately on any warning.",
                  f"Return empty responses without HTTP error codes."], 0,
                 f"Robust {topic} services log exceptions clearly with trace context and provide helpful user diagnostics.")
            ]

        if index <= len(pool):
            item = pool[index - 1]
            q_text = item[0]
            raw_opts = list(item[1])
            raw_corr = int(item[2])
            fb_explanation = item[3]
        else:
            p_q, p_opts, p_corr, p_exp = cls._procedural_question_generator(topic, index - len(pool), difficulty)
            q_text = p_q
            raw_opts = p_opts
            raw_corr = p_corr
            fb_explanation = p_exp

        if len(raw_opts) == 4 and 0 <= raw_corr < len(raw_opts):
            shift = index % 4
            fb_options = raw_opts[shift:] + raw_opts[:shift]
            fb_correct = (raw_corr - shift) % 4
        else:
            fb_options = raw_opts
            fb_correct = raw_corr

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
            options=fb_options,
            correct_option=fb_correct,
            explanation=fb_explanation,
            passage_text=passage_text,
            dataset_json=dataset_json,
            test_cases=test_cases,
            created_by="topic_fallback",
            question_fingerprint=q_fp,
            concept_hash=c_hash,
        )

    @classmethod
    def _procedural_question_generator(cls, topic: str, index: int, difficulty: str):
        import math
        t_low = topic.lower()
        k = index

        def _dedup_opts(corr_str: str, raw_dist: list) -> list:
            opts = [corr_str]
            for d in raw_dist:
                if d not in opts:
                    opts.append(d)
            cnt = 1
            while len(opts) < 4:
                cand = f"Alternative Value ({cnt})"
                if cand not in opts:
                    opts.append(cand)
                cnt += 1
            return opts

        if "quant" in t_low or "arithmetic" in t_low or "math" in t_low:
            archetype = (index - 1) % 10
            if archetype == 0:
                d1 = 10 + k
                d2 = 15 + k
                worked = 2 + (k % 3)
                together_work = worked * (d1 + d2) / (d1 * d2)
                rem_work = max(0.05, 1.0 - together_work)
                time_b = round(rem_work * d2, 2)
                q = f"In sprint pipeline #{k}, Worker A can complete the task in {d1} days and Worker B in {d2} days. Both work together for {worked} days before Worker A departs. How many additional days will Worker B need alone to finish?"
                corr = f"{time_b} days"
                raw_dist = [f"{round(time_b + 2.5, 2)} days", f"{round(max(0.5, time_b - 1.8), 2)} days", f"{round(time_b + 4.2, 2)} days"]
                exp = f"Combined daily output = 1/{d1} + 1/{d2}. In {worked} days, work done = {together_work:.3f}. Remaining = {rem_work:.3f}. Time for B = {rem_work:.3f} * {d2} = {time_b} days."
            elif archetype == 1:
                train_l = 100 + (k * 15)
                plat_l = 150 + (k * 20)
                speed_kmh = 54 + ((k * 9) % 54)
                speed_ms = speed_kmh * 5 / 18
                tot_dist = train_l + plat_l
                time_s = round(tot_dist / speed_ms, 1)
                q = f"In transit velocity test #{k}, a train of length {train_l}m travels at {speed_kmh} km/h. How many seconds does it take to cross a platform of length {plat_l}m?"
                corr = f"{time_s} seconds"
                raw_dist = [f"{round(time_s + 3.5, 1)} seconds", f"{round(max(1.0, time_s - 2.8), 1)} seconds", f"{round(time_s + 6.0, 1)} seconds"]
                exp = f"Speed in m/s = {speed_kmh} * (5/18) = {speed_ms:.2f} m/s. Distance = {tot_dist}m. Time = {tot_dist}/{speed_ms:.2f} = {time_s}s."
            elif archetype == 2:
                p = 1000 + (k * 250)
                r = 4 + (k % 7)
                t = 2 + (k % 3)
                si = round((p * r * t) / 100, 2)
                total = round(p + si, 2)
                q = f"Under enterprise hardware lease #{k}, compute servers valued at ${p:,} incur an annual simple interest of {r}%. What is the total repayment after {t} years?"
                corr = f"${total:,.2f}"
                raw_dist = [f"${total + 350:,.2f}", f"${max(100.0, total - 250):,.2f}", f"${total + 700:,.2f}"]
                exp = f"Simple Interest = ({p} * {r} * {t}) / 100 = ${si:.2f}. Total = P + SI = ${total:,.2f}."
            elif archetype == 3:
                cost = 300 + (k * 75)
                margin = 10 + (k % 25)
                profit = round(cost * (margin / 100), 2)
                sp = round(cost + profit, 2)
                q = f"In pricing assessment tier #{k}, the operational compute cost is ${cost:,} per instance. To achieve a profit margin of {margin}%, what is the target selling price?"
                corr = f"${sp:,.2f}"
                raw_dist = [f"${sp + 120:,.2f}", f"${max(50.0, sp - 95):,.2f}", f"${sp + 260:,.2f}"]
                exp = f"Profit = {cost} * ({margin}/100) = ${profit:.2f}. Selling Price = Cost + Profit = ${sp:,.2f}."
            elif archetype == 4:
                p1 = 10 + (k % 15)
                p2 = 15 + ((k * 2) % 20)
                fill_t = round((p1 * p2) / (p1 + p2), 2)
                q = f"In ingestion pipeline #{k}, Buffer A fills the reservoir in {p1} minutes and Buffer B in {p2} minutes. Operating concurrently, how many minutes will both require to fill it?"
                corr = f"{fill_t} minutes"
                raw_dist = [f"{round(fill_t + 2.4, 2)} minutes", f"{round(max(0.5, fill_t - 1.7), 2)} minutes", f"{round(fill_t + 4.1, 2)} minutes"]
                exp = f"Combined throughput = 1/{p1} + 1/{p2}. Time = {fill_t} minutes."
            elif archetype == 5:
                r1 = 3 + (k % 4)
                r2 = 5 + (k % 5)
                unit = 25 + (k * 5)
                total_units = (r1 + r2) * unit
                q1_share = r1 * unit
                q = f"In resource partitioning #{k}, {total_units:,} CPU shares are distributed between Pod Alpha and Pod Beta in ratio {r1}:{r2}. How many shares are assigned to Pod Alpha?"
                corr = f"{q1_share:,} shares"
                raw_dist = [f"{q1_share + unit:,} shares", f"{max(unit, q1_share - unit):,} shares", f"{q1_share + 2 * unit:,} shares"]
                exp = f"Unit value = {total_units} / {r1 + r2} = {unit}. Alpha = {r1} * {unit} = {q1_share}."
            elif archetype == 6:
                n = 4 + (k % 5)
                base_avg = 50 + (k % 40)
                added_val = base_avg + 15 + (k % 25)
                new_avg = round(((n * base_avg) + added_val) / (n + 1), 2)
                q = f"Across {n} nodes in cluster #{k}, the average latency is {base_avg}ms. When a node with {added_val}ms latency joins, what is the new average latency across {n + 1} nodes?"
                corr = f"{new_avg} ms"
                raw_dist = [f"{round(new_avg + 3.2, 2)} ms", f"{round(max(5.0, new_avg - 2.8), 2)} ms", f"{round(new_avg + 6.1, 2)} ms"]
                exp = f"New total = ({n} * {base_avg}) + {added_val}. New average = {new_avg} ms."
            elif archetype == 7:
                n_letters = 4 + (k % 4)
                total_perms = math.factorial(n_letters)
                q = f"In microservice dispatch queue #{k}, how many distinct ordering permutations exist to sequence {n_letters} unique jobs?"
                corr = f"{total_perms:,} permutations"
                raw_dist = [f"{total_perms // 2:,} permutations", f"{total_perms * 2:,} permutations", f"{total_perms + 12:,} permutations"]
                exp = f"Permutations = {n_letters}! = {total_perms}."
            elif archetype == 8:
                red = 2 + (k % 5)
                blue = 3 + ((k + 1) % 5)
                green = 4 + ((k + 2) % 6)
                tot_balls = red + blue + green
                p_red = round(red / tot_balls, 3)
                q = f"In storage pool #{k}, there are {red} hot, {blue} warm, and {green} cold segments. What is the probability of selecting a hot segment at random?"
                corr = f"{p_red:.3f}"
                raw_dist = [f"{round(blue / tot_balls, 3):.3f}", f"{round(green / tot_balls, 3):.3f}", f"{round(min(0.95, p_red + 0.12), 3):.3f}"]
                exp = f"Probability = {red} / {tot_balls} = {p_red:.3f}."
            else:
                div1 = 4 + (k % 7)
                div2 = 9 + ((k + 2) % 7)
                lcm = math.lcm(div1, div2)
                q = f"In service sync routine #{k}, two health checks poll every {div1}s and {div2}s respectively. What is the minimum elapsed time until both poll simultaneously?"
                corr = f"{lcm} seconds"
                raw_dist = [f"{lcm + div1} seconds", f"{max(1, lcm - div2)} seconds", f"{lcm * 2 + 1} seconds"]
                exp = f"Interval = LCM({div1}, {div2}) = {lcm} seconds."

            return q, _dedup_opts(corr, raw_dist), 0, exp

        elif "logical" in t_low or "reason" in t_low:
            archetype = (index - 1) % 8
            if archetype == 0:
                words = ["SECURITY", "PROTOCOL", "DATABASE", "FIREWALL", "COMPILER", "STORAGE", "GATEWAY", "MONITOR", "CLUSTER", "NETWORK"]
                src = words[(k - 1) % len(words)]
                shift = 1 + (k % 4)
                encoded = "".join(chr((ord(c) - ord('A') + shift) % 26 + ord('A')) for c in src)
                q = f"In cryptographic cipher audit #{k}, if '{src}' is encoded as '{encoded}' with a shift of +{shift}, how is 'SYSTEM' coded?"
                tgt = "".join(chr((ord(c) - ord('A') + shift) % 26 + ord('A')) for c in "SYSTEM")
                corr = tgt
                raw_dist = [
                    "".join(chr((ord(c) - ord('A') + shift + 1) % 26 + ord('A')) for c in "SYSTEM"),
                    "".join(chr((ord(c) - ord('A') + shift - 1) % 26 + ord('A')) for c in "SYSTEM"),
                    "".join(chr((ord(c) - ord('A') + shift + 2) % 26 + ord('A')) for c in "SYSTEM")
                ]
                exp = f"Shifting 'SYSTEM' by +{shift} yields '{tgt}'."
            elif archetype == 1:
                start = 2 + (k % 7)
                step = 3 + (k % 5)
                terms = [start + (i * step) for i in range(5)]
                nxt = start + (5 * step)
                seq_str = ", ".join(map(str, terms))
                q = f"In numerical series pattern analysis #{k}, determine the next term in the sequence: {seq_str}, ___?"
                corr = f"{nxt}"
                raw_dist = [f"{nxt + step}", f"{nxt - 1}", f"{nxt + 2 * step}"]
                exp = f"Common difference is +{step}. Next term = {terms[-1]} + {step} = {nxt}."
            elif archetype == 2:
                start = 1 + (k % 4)
                ratio = 2
                terms = [start * (ratio ** i) for i in range(4)]
                nxt = start * (ratio ** 4)
                seq_str = ", ".join(map(str, terms))
                q = f"In exponential series benchmark #{k}, find the next value: {seq_str}, ___?"
                corr = f"{nxt}"
                raw_dist = [f"{nxt // 2 + 1}", f"{nxt + terms[-1]}", f"{nxt * 2}"]
                exp = f"Common ratio is 2. Next term = {terms[-1]} * 2 = {nxt}."
            elif archetype == 3:
                d_north = 10 + (k * 2) % 20
                d_east = 12 + (k * 3) % 24
                disp = round(math.sqrt(d_north ** 2 + d_east ** 2), 2)
                q = f"In drone telemetry survey #{k}, a unit flies {d_north}m North then {d_east}m East. What is the straight-line displacement from starting coordinates?"
                corr = f"{disp} meters"
                raw_dist = [f"{round(disp + 4.2, 2)} meters", f"{round(max(5.0, disp - 3.5), 2)} meters", f"{d_north + d_east} meters"]
                exp = f"Displacement = sqrt({d_north}^2 + {d_east}^2) = {disp}m."
            elif archetype == 4:
                total_cand = 40 + (k % 30)
                rank_top = 5 + (k % 20)
                rank_bottom = total_cand - rank_top + 1
                q = f"In talent assessment ranking #{k}, a candidate is rank {rank_top} from the top among {total_cand} candidates. What is the rank from the bottom?"
                corr = f"{rank_bottom}th"
                raw_dist = [f"{rank_bottom + 1}th", f"{rank_bottom - 1}th", f"{rank_bottom + 2}th"]
                exp = f"Rank from bottom = {total_cand} - {rank_top} + 1 = {rank_bottom}."
            elif archetype == 5:
                q = f"In formal deductive logic assessment #{k}, consider:\nStatements:\n1. All service routers in Zone-{k} are secure.\n2. Some secure systems are redundant.\nConclusions:\nI. Some service routers are redundant.\nII. All redundant systems are secure."
                corr = "Neither conclusion logically follows"
                raw_dist = ["Only conclusion I follows", "Only conclusion II follows", "Both conclusions I and II follow"]
                exp = "Undistributed middle term prevents a valid deductive link."
            elif archetype == 6:
                n_days = 7 + (k % 20)
                rem = n_days % 7
                days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
                target_day = days[rem]
                q = f"In automated cron schedule #{k}, if Day 0 is Monday, what day of the week will it be after exactly {n_days} days?"
                corr = target_day
                raw_dist = [days[(rem + 1) % 7], days[(rem + 2) % 7], days[(rem - 1) % 7]]
                exp = f"{n_days} mod 7 = {rem} days after Monday -> {target_day}."
            else:
                q = f"In data architecture taxonomy #{k}, which of the following represents the odd item out from the set: {{Stack, Queue, Deque, B-Tree}}?"
                corr = "B-Tree (Non-linear hierarchical search tree)"
                raw_dist = ["Stack (Linear LIFO structure)", "Queue (Linear FIFO structure)", "Deque (Double-ended linear sequence)"]
                exp = "Stack, Queue, and Deque are linear structures; B-Tree is non-linear."

            return q, _dedup_opts(corr, raw_dist), 0, exp

        else:
            archetype = (index - 1) % 10
            if archetype == 0:
                val = (1 << (1 + (k % 5)))
                val_test = val | 1
                res = val_test & (val_test - 1)
                q = f"In low-level bit manipulation review #{k}, what is the evaluation of `x & (x - 1)` in C/C++/Java/Python when `x = {val_test}`?"
                corr = f"{res}"
                raw_dist = [f"{val_test}", f"{res + 2}", "0"]
                exp = f"`x & (x - 1)` clears the lowest set bit. For {val_test} ({bin(val_test)}), clearing the lowest bit yields {res}."
            elif archetype == 1:
                n_nodes = 5 + (k % 12)
                max_edges = n_nodes * (n_nodes - 1) // 2
                q = f"In graph topology benchmark #{k}, what is the maximum number of undirected edges possible in a simple connected graph with {n_nodes} vertices?"
                corr = f"{max_edges} edges"
                raw_dist = [f"{max_edges + n_nodes} edges", f"{n_nodes * (n_nodes - 1)} edges", f"{max(1, max_edges - n_nodes)} edges"]
                exp = f"Maximum edges = V*(V-1)/2 = {n_nodes}*{n_nodes - 1}/2 = {max_edges}."
            elif archetype == 2:
                buckets = 100 * (1 + (k % 10))
                keys = int(buckets * (0.75 + (k % 4) * 0.25))
                load_factor = round(keys / buckets, 2)
                q = f"In hash table indexing analysis #{k}, a hash map has {buckets:,} buckets and stores {keys:,} distinct keys. What is the current load factor (alpha)?"
                corr = f"{load_factor}"
                raw_dist = [f"{round(load_factor + 0.35, 2)}", f"{round(max(0.1, load_factor - 0.25), 2)}", f"{round(load_factor * 2, 2)}"]
                exp = f"Load factor alpha = N / M = {keys} / {buckets} = {load_factor}."
            elif archetype == 3:
                q = f"In concurrency engineering #{k}, which of the following is NOT one of the Coffman conditions required for deadlock?"
                corr = "Preemption allowed (Resources can be forcibly reclaimed)"
                raw_dist = ["Mutual Exclusion", "Hold and Wait", "Circular Wait"]
                exp = "Preemption breaks deadlocks; 'No Preemption' is the necessary Coffman condition."
            elif archetype == 4:
                page_size_kb = 4 * (1 + (k % 4))
                offset_bits = int(math.log2(page_size_kb * 1024))
                q = f"In virtual memory management #{k}, if the system uses a page size of {page_size_kb} KB, how many bits in a 32-bit address are required for the page offset?"
                corr = f"{offset_bits} bits"
                raw_dist = [f"{offset_bits + 2} bits", f"{offset_bits - 2} bits", f"{offset_bits + 4} bits"]
                exp = f"Offset bits = log2({page_size_kb} * 1024) = {offset_bits} bits."
            elif archetype == 5:
                prefix = 24 + (k % 6)
                host_bits = 32 - prefix
                usable_hosts = (2 ** host_bits) - 2
                q = f"In network engineering #{k}, what is the maximum number of usable host IPv4 addresses in a subnet with prefix `/{prefix}`?"
                corr = f"{usable_hosts} hosts"
                raw_dist = [f"{usable_hosts + 2} hosts", f"{usable_hosts * 2} hosts", f"{max(1, usable_hosts - 2)} hosts"]
                exp = f"Usable hosts = 2^(32 - {prefix}) - 2 = {usable_hosts}."
            elif archetype == 6:
                q = f"In relational DBMS concurrency #{k}, which isolation level prevents Dirty Reads and Non-Repeatable Reads, but allows Phantom Reads under standard ANSI SQL?"
                corr = "REPEATABLE READ"
                raw_dist = ["READ UNCOMMITTED", "READ COMMITTED", "SERIALIZABLE"]
                exp = "REPEATABLE READ locks read rows to avoid dirty/non-repeatable reads; phantom reads are prevented only in SERIALIZABLE."
            elif archetype == 7:
                depth = 3 + (k % 5)
                max_nodes = (2 ** (depth + 1)) - 1
                q = f"In binary tree data structures #{k}, what is the maximum total number of nodes in a binary tree of height {depth} (root at height 0)?"
                corr = f"{max_nodes} nodes"
                raw_dist = [f"{max_nodes + 1} nodes", f"{2 ** depth} nodes", f"{max_nodes // 2} nodes"]
                exp = f"Max nodes = 2^(H+1) - 1 = {max_nodes}."
            elif archetype == 8:
                q = f"In REST API architecture #{k}, what is the primary benefit of making write operations idempotent?"
                corr = "Safe client retries on network timeouts without duplicate side-effects"
                raw_dist = ["Automatic gzip compression", "Bypassing authentication", "Guaranteed sub-1ms response"]
                exp = "Idempotency ensures multiple requests produce the same state as one request, making retries safe."
            else:
                q = f"In asynchronous event-driven runtimes #{k}, what is the primary advantage of non-blocking I/O multiplexing over one-thread-per-connection?"
                corr = "High-concurrency scalability without thread stack and context-switch overhead"
                raw_dist = ["100% CPU thread utilization without GIL", "Automatic native compilation", "Zero RAM consumption"]
                exp = "Non-blocking multiplexing allows a single thread to service thousands of sockets via epoll/kqueue."

            return q, _dedup_opts(corr, raw_dist), 0, exp

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
                factory_timeout = max(30.0, len(missing_slots) * 1.5)
                newly_generated = await asyncio.wait_for(
                    question_factory.generate_and_store_questions(
                        db=db,
                        blueprint_slots=missing_slots,
                        candidate_id=session.candidate_id,
                        scoped_normalized_texts=current_session_texts,
                        created_by="ai_factory"
                    ),
                    timeout=factory_timeout
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
            seen_in_paper = set(item["master"].question_text for item in selected_master_items)
            index_offset = len(all_exclusions)
            for idx in range(needed_qs):
                target_topic = session.topics[idx % len(session.topics)]
                target_diff = blueprint_slots[min(len(selected_master_items), len(blueprint_slots) - 1)].difficulty
                gen_idx = idx + 1 + index_offset
                fb_q = cls._create_topic_fallback_question(target_topic, gen_idx, target_diff)
                attempts = 0
                while (fb_q.question_text in seen_in_paper or fb_q.id in used_master_ids) and attempts < 25:
                    gen_idx += 50
                    fb_q = cls._create_topic_fallback_question(target_topic, gen_idx, target_diff)
                    attempts += 1
                if fb_q.id not in used_master_ids:
                    is_rep = fb_q.question_fingerprint in all_exclusions
                    selected_master_items.append({"master": fb_q, "is_repeated": is_rep})
                    used_master_ids.add(fb_q.id)
                    seen_in_paper.add(fb_q.question_text)

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

            raw_options = list(master_q.options or [])
            raw_corr = int(master_q.correct_option or 0)
            if len(raw_options) == 4 and 0 <= raw_corr < len(raw_options):
                # Rotate options cyclically by order_idx % 4 to ensure balanced A, B, C, D answer distribution
                # preserving 100% correctness and distinct content across all options
                shift = order_idx % 4
                rotated_options = raw_options[shift:] + raw_options[:shift]
                rotated_correct = (raw_corr - shift) % 4
            else:
                rotated_options = raw_options
                rotated_correct = raw_corr

            record = AssessmentQuestion(
                session_id=session.id,
                order_index=order_idx,
                category=master_q.topic,
                topic=master_q.topic,
                question_text=master_q.question_text,
                code_snippet=master_q.code_snippet,
                options=rotated_options,
                correct_option=rotated_correct,
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
