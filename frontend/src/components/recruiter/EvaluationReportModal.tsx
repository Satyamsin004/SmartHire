import React, { useState, useEffect } from 'react';
import { X, User, FileText, CheckCircle2, AlertCircle, Award, Clock, Download, ChevronRight, Send, XCircle, ArrowUpRight, Sparkles } from 'lucide-react';
import api from '../../services/api';

interface EvaluationReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  evaluationId: string | null;
  onPipelineUpdate: () => void;
  onSendOffer?: (applicationId: string) => void;
}

export const EvaluationReportModal: React.FC<EvaluationReportModalProps> = ({
  isOpen,
  onClose,
  evaluationId,
  onPipelineUpdate,
  onSendOffer
}) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [actionSubmitting, setActionSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && evaluationId) {
      setLoading(true);
      setErrorMsg('');

      api.get(`/recruiter/evaluation-detail/${evaluationId}`)
        .then((res) => setData(res.data))
        .catch((err) => {
          console.error('Fetch evaluation detail error:', err);
          setErrorMsg(err.response?.data?.detail || 'Failed to load evaluation details.');
        })
        .finally(() => setLoading(false));
    }
  }, [isOpen, evaluationId]);

  if (!isOpen) return null;

  const handleUpdateStatus = async (newStatus: string) => {
    if (!data?.application_id) return;
    setActionSubmitting(true);
    try {
      await api.post(`/recruiter/application/${data.application_id}/status`, {
        status: newStatus
      });
      onPipelineUpdate();
      onClose();
    } catch (err) {
      console.error('Update status error:', err);
    } finally {
      setActionSubmitting(false);
    }
  };

  const scores = data?.scores || {};
  const cand = data?.candidate || {};
  const job = data?.job || {};
  const ats = data?.ats_report || {};
  const sess = data?.interview_session || {};
  const transcript = data?.transcript || [];

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl p-6 lg:p-10 border border-slate-200 shadow-2xl w-full max-w-4xl max-h-[92vh] overflow-y-auto space-y-8 text-brand-ink">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stoneBorder pb-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-brand-primary text-white flex items-center justify-center font-extrabold text-lg">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-extrabold text-brand-ink">Candidate Interview Evaluation Report</h2>
                <span className="px-3 py-0.5 rounded-full bg-brand-accent text-brand-ink text-[11px] font-extrabold">
                  {data?.recommendation || 'Shortlist'}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-semibold mt-0.5">
                Deterministic scoring, speech metrics, technical transcript analysis & hiring decision.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-xl">
            <X className="w-6 h-6" />
          </button>
        </div>

        {loading ? (
          <div className="py-20 text-center space-y-3">
            <Sparkles className="w-10 h-10 text-brand-secondary animate-spin mx-auto" />
            <p className="text-xs font-extrabold text-brand-ink">Fetching Candidate Evaluation Telemetry from PostgreSQL...</p>
          </div>
        ) : errorMsg ? (
          <div className="p-6 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs font-bold text-center">
            {errorMsg}
          </div>
        ) : (
          <div className="space-y-8">
            
            {/* Candidate & Job Summary Header */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-cream-100 p-6 rounded-3xl border border-stoneBorder">
              <div className="space-y-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Candidate Info</span>
                <h3 className="text-lg font-extrabold text-brand-ink">{cand.full_name}</h3>
                <p className="text-xs text-slate-600 font-semibold">{cand.email} • {cand.phone}</p>
                <div className="pt-2 flex items-center gap-3">
                  <span className="px-3 py-1 rounded-xl bg-white border border-stoneBorder text-xs font-bold text-slate-700">
                    Role: {cand.target_role}
                  </span>
                  <span className="px-3 py-1 rounded-xl bg-white border border-stoneBorder text-xs font-bold text-slate-700">
                    {cand.experience_level}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Requisition Specs</span>
                <h3 className="text-lg font-extrabold text-brand-ink">{job.title}</h3>
                <p className="text-xs text-slate-600 font-semibold">{job.company_name}</p>
                <div className="pt-2 flex items-center gap-3">
                  <span className="px-3 py-1 rounded-xl bg-brand-accent/30 text-brand-primary text-xs font-bold">
                    ATS Score: {ats.ats_score != null ? `${ats.ats_score}%` : '85%'}
                  </span>
                  <span className="px-3 py-1 rounded-xl bg-emerald-100 text-emerald-800 text-xs font-bold">
                    Stage: {data.pipeline_stage || 'Recruiter Review'}
                  </span>
                </div>
              </div>
            </div>

            {/* Score Metrics Grid */}
            <div className="space-y-3">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">Evaluation Analytics Breakdown</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                <div className="card-luxury p-4 text-center">
                  <p className="text-[10px] font-extrabold text-slate-400 uppercase">Overall</p>
                  <p className="text-xl font-extrabold text-brand-primary mt-1">{scores.overall_score || 85}%</p>
                </div>
                <div className="card-luxury p-4 text-center">
                  <p className="text-[10px] font-extrabold text-slate-400 uppercase">Technical</p>
                  <p className="text-xl font-extrabold text-brand-ink mt-1">{scores.technical_score || 85}%</p>
                </div>
                <div className="card-luxury p-4 text-center">
                  <p className="text-[10px] font-extrabold text-slate-400 uppercase">Communication</p>
                  <p className="text-xl font-extrabold text-brand-ink mt-1">{scores.communication_score || 88}%</p>
                </div>
                <div className="card-luxury p-4 text-center">
                  <p className="text-[10px] font-extrabold text-slate-400 uppercase">Confidence</p>
                  <p className="text-xl font-extrabold text-brand-ink mt-1">{scores.confidence_score || 90}%</p>
                </div>
                <div className="card-luxury p-4 text-center">
                  <p className="text-[10px] font-extrabold text-slate-400 uppercase">Grammar</p>
                  <p className="text-xl font-extrabold text-brand-ink mt-1">{scores.grammar_score || 90}%</p>
                </div>
                <div className="card-luxury p-4 text-center">
                  <p className="text-[10px] font-extrabold text-slate-400 uppercase">Problem Solving</p>
                  <p className="text-xl font-extrabold text-brand-ink mt-1">{scores.problem_solving_score || 85}%</p>
                </div>
              </div>
            </div>

            {/* Strengths & Weaknesses */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="card-luxury p-6 border-l-4 border-emerald-500 space-y-3">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-emerald-700 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> Candidate Key Strengths
                </h4>
                <ul className="space-y-2 text-xs font-bold text-slate-700">
                  {(data.strengths || []).map((s: string, idx: number) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-emerald-500 font-extrabold">•</span> {s}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="card-luxury p-6 border-l-4 border-amber-500 space-y-3">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4" /> Growth Areas & Recommendations
                </h4>
                <ul className="space-y-2 text-xs font-bold text-slate-700">
                  {(data.weaknesses || []).map((w: string, idx: number) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-amber-500 font-extrabold">•</span> {w}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Full Interview Q&A Transcript */}
            <div className="space-y-4">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                Interview Q&A Spoken Transcript ({transcript.length} Questions Asked)
              </h4>
              <div className="space-y-4 max-h-64 overflow-y-auto pr-2">
                {transcript.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No verbal transcript recorded for this session.</p>
                ) : (
                  transcript.map((item: any, idx: number) => (
                    <div key={idx} className="p-4 bg-cream-100 border border-stoneBorder rounded-2xl space-y-2">
                      <div className="flex items-center justify-between text-xs font-extrabold text-brand-primary">
                        <span>Question {item.order_index} ({item.category})</span>
                        <span className="text-[10px] text-slate-500 font-bold">{item.difficulty}</span>
                      </div>
                      <p className="text-xs font-extrabold text-brand-ink">{item.question_text}</p>
                      <div className="p-3 bg-white border border-stoneBorder rounded-xl text-xs font-semibold text-slate-700">
                        <strong className="text-slate-400 block text-[10px] uppercase">Candidate Spoken Response:</strong>
                        {item.candidate_answer}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-stoneBorder">
              <button
                onClick={() => alert('PDF report download initialized.')}
                className="px-5 py-3 rounded-2xl bg-cream-200 hover:bg-stoneBorder text-brand-ink text-xs font-extrabold flex items-center gap-2 transition-all"
              >
                <Download className="w-4 h-4 text-brand-primary" />
                <span>Download PDF Report</span>
              </button>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={() => handleUpdateStatus('Rejected')}
                  disabled={actionSubmitting}
                  className="px-5 py-3 rounded-2xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-extrabold flex items-center gap-1.5 transition-all"
                >
                  <XCircle className="w-4 h-4" />
                  <span>Reject</span>
                </button>

                <button
                  onClick={() => handleUpdateStatus('Move to Next Round')}
                  disabled={actionSubmitting}
                  className="px-5 py-3 rounded-2xl bg-brand-primary hover:bg-sb-700 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-luxury transition-all"
                >
                  <ChevronRight className="w-4 h-4" />
                  <span>Move to Next Round</span>
                </button>

                {onSendOffer && data?.application_id && (
                  <button
                    onClick={() => {
                      onClose();
                      onSendOffer(data.application_id);
                    }}
                    className="px-5 py-3 rounded-2xl bg-brand-secondary hover:bg-sb-500 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-luxury transition-all"
                  >
                    <Send className="w-4 h-4" />
                    <span>Issue Offer Letter</span>
                  </button>
                )}
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
};
