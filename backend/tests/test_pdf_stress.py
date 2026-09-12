import pytest
from app.services.pdf_service import PDFReportGenerator

def test_pdf_generation_extreme_stress():
    """
    Stress-test PDF generation with:
    1. Empty answer
    2. Very long answer
    3. Very long transcript
    4. Multiple pages
    5. HTML-like content (<script>, <b>, etc.)
    6. XML-like content (<root><child>...)
    7. <vector>
    8. <div>
    9. & (ampersands)
    10. Quotes ("double", 'single', “smart”)
    11. Code snippets
    12. Unicode (emojis, Cyrillic, CJK)
    13. Newlines (\r\n\n\n)
    14. Overall score = 0
    15. Overall score = 100
    16. Missing optional metrics (None)
    17. Missing feedback (None)
    18. Large number of questions (20 questions)
    """
    session_info = {
        'id': 'sess-stress-12345',
        'candidate_name': 'Dr. Alan Turing <special & sensitive>',
        'role_target': 'Principal Architect & <System Designer>',
        'round_type': 'Technical & Architecture',
        'duration_minutes': 60,
        'date': '2026-09-10'
    }

    # Case 1: Overall score = 0
    report_data_zero = {
        'overall_score': 0.0,
        'recommendation': 'Reject',
        'communication_score': 0.0,
        'confidence_score': 0.0,
        'technical_score': 0.0,
        'professionalism_score': 0.0,
        'feedback': None,
        'summary': '<div>Testing summary with <vector>, <span>, and & ampersands</div>'
    }

    questions = []
    # 20 diverse questions testing all conditions
    for i in range(20):
        if i == 0:
            ans = "" # Empty answer
        elif i == 1:
            ans = "   \n\n\r\n   " # Whitespace & newlines only
        elif i == 2:
            ans = "Standard short answer with & and <vector<std::string>>."
        elif i == 3:
            ans = "<script>alert('xss');</script><b>Bold statement</b> <img src='x' onerror='alert(1)'>"
        elif i == 4:
            ans = 'Quotes test: "double quotes", \'single quotes\', “smart quotes”, ‘apostrophes’'
        elif i == 5:
            ans = "Unicode test: 🚀 🤖 💻 日本語 (Japanese) Привет (Russian) العربية (Arabic) €£¥₹"
        elif i == 6:
            ans = """Code snippet:
```cpp
#include <iostream>
#include <vector>

int main() {
    std::vector<int> nums = {1, 2, 3};
    for (size_t i = 0; i < nums.size() && true; ++i) {
        std::cout << nums[i] << " & " << std::endl;
    }
    return 0;
}
```
"""
        else:
            # Very long multi-paragraph answer that spans across multiple pages
            ans = (
                f"Paragraph for Question {i}:\n"
                "We architect distributed systems with microservices, gRPC, and Kafka. "
                "The key considerations are high availability, fault tolerance, and partition tolerance (CAP theorem). "
                "For data consistency, we implement the Saga pattern with compensating transactions. "
                "Technical tokens: <vector<std::shared_ptr<Node>>>, <div id='app'>, &amp;, &&, ||, <iostream>. "
                "Here is continuous evaluation of candidate rationale across scale... "
            ) * 15

        questions.append({
            'question_id': f'q_{i+1}',
            'order_index': i + 1,
            'question_text': f'Question {i+1}: How would you optimize <vector> memory allocation in C++ & manage <div> rendering?',
            'candidate_answer': ans,
            'technical_score': 85.5 if i % 2 == 0 else 0.0,
            'feedback': None if i % 3 == 0 else f'Feedback for question {i+1}: Validated explanation with & symbols.'
        })

    # Test with overall_score = 0.0
    pdf_bytes_zero = PDFReportGenerator.generate_interview_pdf(
        session_info=session_info,
        report_data=report_data_zero,
        transcript_data=questions,
        integrity_summary={'tab_switch_count': 0, 'multiple_person_count': 0}
    )
    assert isinstance(pdf_bytes_zero, bytes)
    assert len(pdf_bytes_zero) > 10000
    assert pdf_bytes_zero.startswith(b'%PDF')

    # Test with overall_score = 100.0 and missing optional metrics
    report_data_100 = {
        'overall_score': 100.0,
        'recommendation': 'Strong Hire',
        'communication_score': 100.0,
        'confidence_score': 100.0,
        'technical_score': 100.0,
        'professionalism_score': 100.0,
        'feedback': 'Flawless technical performance.',
        'summary': None
    }
    pdf_bytes_100 = PDFReportGenerator.generate_interview_pdf(
        session_info=session_info,
        report_data=report_data_100,
        transcript_data=questions[:5],
        integrity_summary=None # Missing integrity summary
    )
    assert isinstance(pdf_bytes_100, bytes)
    assert len(pdf_bytes_100) > 1000
    assert pdf_bytes_100.startswith(b'%PDF')
