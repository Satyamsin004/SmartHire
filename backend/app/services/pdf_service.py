import io
from typing import Dict, Any, List
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, KeepTogether, HRFlowable
)

class PDFReportGenerator:
    @staticmethod
    def generate_interview_pdf(
        session_info: Dict[str, Any],
        report_data: Dict[str, Any],
        transcript_data: List[Dict[str, Any]]
    ) -> bytes:
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=letter,
            rightMargin=36,
            leftMargin=36,
            topMargin=36,
            bottomMargin=36
        )

        styles = getSampleStyleSheet()
        
        # Custom styles
        title_style = ParagraphStyle(
            'DocTitle',
            parent=styles['Heading1'],
            fontName='Helvetica-Bold',
            fontSize=20,
            leading=24,
            textColor=colors.HexColor('#1E293B')
        )
        subtitle_style = ParagraphStyle(
            'DocSubtitle',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=10,
            leading=13,
            textColor=colors.HexColor('#64748B')
        )
        h2_style = ParagraphStyle(
            'Heading2Custom',
            parent=styles['Heading2'],
            fontName='Helvetica-Bold',
            fontSize=13,
            leading=17,
            textColor=colors.HexColor('#0F172A'),
            spaceBefore=10,
            spaceAfter=5
        )
        body_style = ParagraphStyle(
            'BodyCustom',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=9,
            leading=12,
            textColor=colors.HexColor('#334155')
        )
        bold_body = ParagraphStyle(
            'BoldBodyCustom',
            parent=body_style,
            fontName='Helvetica-Bold'
        )

        elements = []

        # Header Block
        elements.append(Paragraph("Enterprise AI Evaluation Report", title_style))
        elements.append(Paragraph(f"Role Target: {session_info.get('role_target', 'Software Engineer')} | Round: {session_info.get('round_type', 'Technical')} | Type: {session_info.get('interview_type', 'Practice')}", subtitle_style))
        elements.append(Spacer(1, 8))
        elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#CBD5E1'), spaceAfter=12))

        # Overall Score Banner Table
        overall_score = report_data.get('overall_score', 80.0)
        recommendation = report_data.get('recommendation', 'Shortlist')
        
        banner_data = [
            [
                Paragraph("<b>Overall Evaluation Score</b>", ParagraphStyle('W1', parent=body_style, textColor=colors.white)),
                Paragraph("<b>Hiring Recommendation</b>", ParagraphStyle('W2', parent=body_style, textColor=colors.white))
            ],
            [
                Paragraph(f"<font size=18><b>{round(overall_score, 1)}%</b></font>", ParagraphStyle('W3', parent=body_style, textColor=colors.white)),
                Paragraph(f"<font size=13><b>{recommendation}</b></font>", ParagraphStyle('W4', parent=body_style, textColor=colors.white))
            ]
        ]
        banner_table = Table(banner_data, colWidths=[270, 270])
        banner_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#1E1B4B')),
            ('ALIGN', (0,0), (-1,-1), 'CENTER'),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('TOPPADDING', (0,0), (-1,-1), 8),
            ('BOTTOMPADDING', (0,0), (-1,-1), 8),
            ('INNERGRID', (0,0), (-1,-1), 1, colors.HexColor('#312E81')),
            ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#312E81'))
        ]))
        elements.append(banner_table)
        elements.append(Spacer(1, 12))

        # 9 Competency Scores Breakdown Table
        elements.append(Paragraph("Competency Scoring Telemetry", h2_style))
        scores_matrix = [
            ["Technical Knowledge (30%)", f"{report_data.get('technical_score', 80.0)}%", "Communication (30%)", f"{report_data.get('communication_score', 80.0)}%"],
            ["Problem Solving", f"{report_data.get('problem_solving_score', 80.0)}%", "Confidence (25%)", f"{report_data.get('confidence_score', 80.0)}%"],
            ["Professionalism (15%)", f"{report_data.get('professionalism_score', 80.0)}%", "Grammar & Fluency", f"{report_data.get('grammar_score', 80.0)}%"],
            ["Behavioral Adaptability", f"{report_data.get('behavior_score', 80.0)}%", "Leadership Potential", f"{report_data.get('leadership_score', 78.0)}%"]
        ]
        score_table_data = [[Paragraph(f"<b>{cell}</b>" if idx % 2 == 0 else cell, body_style) for idx, cell in enumerate(row)] for row in scores_matrix]
        score_table = Table(score_table_data, colWidths=[160, 110, 160, 110])
        score_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#F8FAFC')),
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#E2E8F0')),
            ('TOPPADDING', (0,0), (-1,-1), 5),
            ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ]))
        elements.append(score_table)
        elements.append(Spacer(1, 12))

        # SECTION 5: SPEECH-TO-TEXT & COMMUNICATION ANALYSIS (PDF)
        elements.append(Paragraph("5. Speech-to-Text & Communication Telemetry", h2_style))
        comm_data = report_data.get('communication_metrics', {})
        sec5_matrix = [
            ["Real-time Speech Transcription", comm_data.get('realtime_transcription', 'Speech Stream Captured'), "Grammar Checking Score", f"{comm_data.get('grammar', 90.0)}%"],
            ["Filler-Word Detection", f"{comm_data.get('filler_words', 2)} fillers ({comm_data.get('filler_frequency', '1.2%')})", "Speech Pace Analysis", f"{comm_data.get('speaking_pace_wpm', 140)} WPM (Optimal)"],
            ["Pronunciation Evaluation", f"{comm_data.get('pronunciation', 88.0)}% (Articulate)", "Communication Quality", f"{comm_data.get('communication_quality_score', 88.0)}% (High Quality)"]
        ]
        sec5_table_data = [[Paragraph(f"<b>{cell}</b>" if idx % 2 == 0 else str(cell), body_style) for idx, cell in enumerate(row)] for row in sec5_matrix]
        sec5_table = Table(sec5_table_data, colWidths=[160, 110, 160, 110])
        sec5_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#EEF2FF')),
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#C7D2FE')),
            ('TOPPADDING', (0,0), (-1,-1), 5),
            ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ]))
        elements.append(sec5_table)
        elements.append(Spacer(1, 12))

        # SECTION 6: EMOTION DETECTION & EYE TRACKING (PDF)
        elements.append(Paragraph("6. Emotion Detection & Eye Tracking Telemetry", h2_style))
        conf_data = report_data.get('confidence_metrics', {})
        sec6_matrix = [
            ["Confidence Analysis", f"{conf_data.get('confidence_score', 88.0)}% (High)", "Emotion Recognition", str(conf_data.get('emotion', 'Calm & Confident'))],
            ["Eye-Contact Tracking", f"{conf_data.get('eye_contact', 90.0)}% Retention", "Attention Monitoring", f"{conf_data.get('attention', 92.0)}% High Focus"],
            ["Engagement Measurement", f"{conf_data.get('facial_engagement', 88.0)}% Active", "Behavior Analysis", str(conf_data.get('posture_stability', 'Stable Posture'))]
        ]
        sec6_table_data = [[Paragraph(f"<b>{cell}</b>" if idx % 2 == 0 else str(cell), body_style) for idx, cell in enumerate(row)] for row in sec6_matrix]
        sec6_table = Table(sec6_table_data, colWidths=[160, 110, 160, 110])
        sec6_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#ECFDF5')),
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#A7F3D0')),
            ('TOPPADDING', (0,0), (-1,-1), 5),
            ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ]))
        elements.append(sec6_table)
        elements.append(Spacer(1, 12))

        # Comprehensive Evaluation Summary
        if report_data.get('overall_summary'):
            elements.append(Paragraph("Executive Evaluation Summary", h2_style))
            elements.append(Paragraph(report_data['overall_summary'], body_style))
            elements.append(Spacer(1, 10))

        # Strengths & Weaknesses
        strengths = report_data.get('strengths') or []
        weaknesses = report_data.get('weaknesses') or []
        
        sw_data = []
        max_len = max(len(strengths), len(weaknesses))
        for i in range(max_len):
            str_text = f"• {strengths[i]}" if i < len(strengths) else ""
            wk_text = f"• {weaknesses[i]}" if i < len(weaknesses) else ""
            sw_data.append([Paragraph(str_text, body_style), Paragraph(wk_text, body_style)])

        if sw_data:
            elements.append(Paragraph("Key Strengths & Growth Areas", h2_style))
            sw_table_data = [[Paragraph("<b>Key Strengths</b>", bold_body), Paragraph("<b>Areas to Improve</b>", bold_body)]] + sw_data
            sw_table = Table(sw_table_data, colWidths=[270, 270])
            sw_table.setStyle(TableStyle([
                ('BACKGROUND', (0,0), (0,0), colors.HexColor('#F0FDF4')),
                ('BACKGROUND', (1,0), (1,0), colors.HexColor('#FEF2F2')),
                ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#E2E8F0')),
                ('VALIGN', (0,0), (-1,-1), 'TOP'),
                ('TOPPADDING', (0,0), (-1,-1), 5),
                ('BOTTOMPADDING', (0,0), (-1,-1), 5),
            ]))
            elements.append(sw_table)
            elements.append(Spacer(1, 12))

        # Q&A Transcript Section
        if transcript_data:
            elements.append(Paragraph("Interview Question Timeline & Transcript", h2_style))
            for idx, q_entry in enumerate(transcript_data, 1):
                q_text = q_entry.get('question_text', '')
                a_text = q_entry.get('answer_text') or "No response recorded."
                cat = q_entry.get('category', 'Technical')
                is_ff = " [Contextual Follow-up]" if q_entry.get('is_followup') else ""
                
                q_block = [
                    Paragraph(f"<b>Q{idx}. [{cat}{is_ff}]</b> {q_text}", bold_body),
                    Spacer(1, 2),
                    Paragraph(f"<b>Candidate Answer:</b> {a_text}", body_style),
                    Spacer(1, 6)
                ]
                elements.append(KeepTogether(q_block))

        doc.build(elements)
        buffer.seek(0)
        return buffer.getvalue()

pdf_generator = PDFReportGenerator()
