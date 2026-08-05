import time
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime

logger = logging.getLogger("interview_pipeline")

class InterviewPipelineLogger:
    """Structured 15-Step Debug Logger for the SmartHire AI Interview Pipeline."""

    def __init__(self, session_id: str, candidate: str, role: str, interview_type: str, duration: int, question_count: int):
        self.session_id = session_id
        self.candidate = candidate
        self.role = role
        self.interview_type = interview_type
        self.duration = duration
        self.question_count = question_count
        self.start_time = time.time()
        self.timestamp = datetime.utcnow().isoformat() + "Z"
        
        # Telemetry metrics
        self.gemini_calls = 0
        self.db_queries = 0
        self.questions_asked = 0
        self.followup_questions = 0
        self.resume_topics_covered = set()
        self.interview_topics_covered = set()
        self.overall_status = "PASS"

    def print_session_start(self):
        banner = f"""
--------------------------------------------------
Interview Session Started
Session ID      : {self.session_id}
Candidate       : {self.candidate}
Role            : {self.role}
Interview Type  : {self.interview_type}
Duration        : {self.duration} mins
Question Count  : {self.question_count}
Timestamp       : {self.timestamp}
--------------------------------------------------"""
        print(banner)
        logger.info(banner)

    def log_step(
        self,
        step_num: int,
        step_name: str,
        status: str,
        details: Dict[str, Any],
        time_taken_ms: float = 0.0
    ) -> bool:
        is_pass = (status.upper() == "PASS")
        status_str = "PASS" if is_pass else "FAIL"
        
        step_banner = f"STEP {step_num}\n{step_name}\nStatus          : {status_str}"
        for key, val in details.items():
            if isinstance(val, (list, set)):
                val_str = ", ".join([str(x) for x in val]) if val else "None"
            else:
                val_str = str(val)
            step_banner += f"\n{key:<16}: {val_str}"
        
        if time_taken_ms > 0:
            step_banner += f"\nTime Taken      : {time_taken_ms:.2f} ms"
            
        formatted_step = f"""--------------------------------------------------\n{step_banner}\n--------------------------------------------------"""
        print(formatted_step)
        logger.info(formatted_step)

        if not is_pass:
            self.overall_status = "FAIL"
            return False
        return True

    def log_failure_root_cause(
        self,
        step_num: int,
        step_name: str,
        file_path: str,
        func_name: str,
        line_num: int,
        expected: str,
        actual: str,
        fix_applied: str,
        verification_result: str
    ):
        failure_box = f"""
=====================================================
STEP {step_num} FAILED: {step_name}
=====================================================
ROOT CAUSE
File                : {file_path}
Function            : {func_name}
Line Number         : {line_num}
Expected Result     : {expected}
Actual Result       : {actual}
Fix Applied         : {fix_applied}
Verification Result : {verification_result}
====================================================="""
        print(failure_box)
        logger.error(failure_box)

    def print_final_summary(self):
        total_time_sec = time.time() - self.start_time
        summary = f"""
=====================================================
FINAL SUMMARY
=====================================================
Total Time                : {total_time_sec:.2f} s
Gemini Calls              : {self.gemini_calls}
Database Queries          : {self.db_queries}
Questions Asked           : {self.questions_asked}
Follow-up Questions       : {self.followup_questions}
Resume Topics Covered     : {", ".join(list(self.resume_topics_covered)) if self.resume_topics_covered else "None"}
Interview Topics Covered  : {", ".join(list(self.interview_topics_covered)) if self.interview_topics_covered else "None"}
Overall Status            : {self.overall_status}
====================================================="""
        print(summary)
        logger.info(summary)
