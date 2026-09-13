import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  CheckCircle2, XCircle, MinusCircle, ArrowLeft, BarChart2, Award,
  BookOpen, AlertTriangle, Loader2, ChevronDown, ChevronUp
} from 'lucide-react';
import api from '../../services/api';

interface QuestionReview {
  question_id: string;
  order_index: number;
  category: string;
  topic: string;
  question_text: string;
  code_snippet?: string;
  options: string[];
  correct_option: number;
  selected_option: number | null;
  is_correct: boolean;
  points_earned: number;
  explanation?: string;
}

interface AssessmentResult {
  session_id: string;
  title: string;
  difficulty: string;
  overall_score: number;
  total_correct: number;
  total_wrong: number;
  total_skipped: number;
  section_scores: Record<string, number>;
  weak_areas: string[];
  strong_areas: string[];
  improvement_suggestions: string[];
  hiring_recommendation: string;
  proctoring_violations: number;
  question_review: QuestionReview[];
}

export const AssessmentReviewPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session');
  const navigate = useNavigate();

  const [result, setResult] = useState<AssessmentResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedQ, setExpandedQ] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!sessionId) {
      setError('Missing session ID.');
      setLoading(false);
      return;
    }
    api.get(`/aptitude/session/${sessionId}/result`)
      .then((res) => {
        setResult(res.data);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        const msg = err?.response?.data?.detail || 'Failed to load assessment result.';
        setError(msg);
        setLoading(false);
      });
  }, [sessionId]);

  const toggleQ = (id: string) => setExpandedQ(prev => ({ ...prev, [id]: !prev[id] }));

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center gap-4 text-slate-300">
          <Loader2 className="w-10 h-10 animate-spin text-indigo-400" />
          <p className="text-sm font-bold">Loading your answer sheet...</p>
        </div>
      </div>
    );
  }

  if (error || !result) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-6">
        <div className="bg-rose-950/40 border border-rose-800 rounded-2xl p-8 max-w-md text-center space-y-4">
          <AlertTriangle className="w-10 h-10 text-rose-400 mx-auto" />
          <p className="text-rose-300 font-bold text-sm">{error || 'Result not available yet.'}</p>
          <button
            onClick={() => navigate('/practice')}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-extrabold rounded-xl transition-all"
          >
            Back to Practice Hub
          </button>
        </div>
      </div>
    );
  }

  const passed = result.hiring_recommendation === 'Pass';

  return (
    <main className="min-h-screen bg-slate-950 text-white pb-16">
      <header className="bg-slate-900/90 border-b border-slate-800 px-6 py-4 flex items-center justify-between backdrop-blur-md sticky top-0 z-20">
        <button
          onClick={() => navigate('/practice')}
          className="flex items-center gap-2 text-xs font-extrabold text-slate-300 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Practice Hub
        </button>
        <span className="text-xs font-black text-slate-400 uppercase tracking-widest">
          Answer Sheet Review
        </span>
        <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase ${
          passed
            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-700'
            : 'bg-rose-500/20 text-rose-300 border border-rose-700'
        }`}>
          {passed ? 'PASSED' : 'FAILED'}
        </span>
      </header>

      <div className="max-w-5xl mx-auto px-4 pt-8 space-y-8">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-slate-800 pb-6">
            <div>
              <h1 className="text-2xl font-black text-white">{result.title}</h1>
              <p className="text-xs text-slate-400 font-semibold mt-1 uppercase tracking-wider">
                {result.difficulty} · Assessment Report
              </p>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Overall Score</span>
              <span className={`text-5xl font-black ${passed ? 'text-emerald-400' : 'text-rose-400'}`}>
                {result.overall_score}%
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-6">
            {[
              { label: 'Correct', value: result.total_correct, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-700/40' },
              { label: 'Wrong', value: result.total_wrong, color: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-700/40' },
              { label: 'Skipped', value: result.total_skipped, color: 'text-slate-400', bg: 'bg-slate-700/30 border-slate-600/40' },
              { label: 'Violations', value: result.proctoring_violations, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-700/40' },
            ].map(({ label, value, color, bg }) => (
              <div key={label} className={`rounded-2xl p-4 border ${bg}`}>
                <span className="text-[10px] text-slate-400 font-bold uppercase block">{label}</span>
                <span className={`text-2xl font-black ${color}`}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        {result.section_scores && Object.keys(result.section_scores).length > 0 && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
            <h2 className="text-sm font-extrabold text-white flex items-center gap-2 mb-5">
              <BarChart2 className="w-4 h-4 text-indigo-400" /> Section Breakdown
            </h2>
            <div className="space-y-3">
              {Object.entries(result.section_scores).map(([section, score]) => (
                <div key={section}>
                  <div className="flex justify-between text-xs font-bold mb-1.5">
                    <span className="text-slate-300">{section}</span>
                    <span className={score >= 70 ? 'text-emerald-400' : 'text-rose-400'}>{score}%</span>
                  </div>
                  <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-2 rounded-full transition-all duration-700 ${score >= 70 ? 'bg-emerald-500' : 'bg-rose-500'}`}
                      style={{ width: `${score}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {(result.weak_areas?.length > 0 || result.strong_areas?.length > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {result.strong_areas?.length > 0 && (
              <div className="bg-emerald-950/30 border border-emerald-800/50 rounded-2xl p-5 space-y-2">
                <h3 className="text-xs font-extrabold text-emerald-300 flex items-center gap-2">
                  <Award className="w-4 h-4" /> Strong Areas
                </h3>
                <ul className="space-y-1">
                  {result.strong_areas.map(area => (
                    <li key={area} className="text-xs text-emerald-200 font-semibold flex items-center gap-2">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" /> {area}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {result.weak_areas?.length > 0 && (
              <div className="bg-rose-950/30 border border-rose-800/50 rounded-2xl p-5 space-y-2">
                <h3 className="text-xs font-extrabold text-rose-300 flex items-center gap-2">
                  <BookOpen className="w-4 h-4" /> Areas to Improve
                </h3>
                <ul className="space-y-1">
                  {result.weak_areas.map(area => (
                    <li key={area} className="text-xs text-rose-200 font-semibold flex items-center gap-2">
                      <XCircle className="w-3 h-3 text-rose-400 shrink-0" /> {area}
                    </li>
                  ))}
                </ul>
                {result.improvement_suggestions?.length > 0 && (
                  <div className="pt-2 border-t border-rose-800/30 space-y-1">
                    {result.improvement_suggestions.map((s, i) => (
                      <p key={i} className="text-[11px] text-slate-400 font-semibold">{s}</p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="space-y-3">
          <h2 className="text-sm font-extrabold text-white flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-indigo-400" />
            Question &amp; Explanation Review ({result.question_review?.length || 0} Questions)
          </h2>

          {result.question_review?.map((q) => {
            const isExpanded = expandedQ[q.question_id];
            const statusColor = q.is_correct
              ? 'border-emerald-700/60 bg-emerald-950/20'
              : q.selected_option === null
              ? 'border-slate-700/60 bg-slate-800/20'
              : 'border-rose-700/60 bg-rose-950/20';

            return (
              <div key={q.question_id} className={`rounded-2xl border ${statusColor} overflow-hidden`}>
                <button
                  className="w-full flex items-start justify-between gap-4 p-5 text-left"
                  onClick={() => toggleQ(q.question_id)}
                >
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <span className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black mt-0.5 ${
                      q.is_correct ? 'bg-emerald-500 text-white' : q.selected_option === null ? 'bg-slate-700 text-slate-300' : 'bg-rose-500 text-white'
                    }`}>
                      {q.order_index}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-extrabold text-slate-400 uppercase mb-1">{q.category} · {q.topic}</p>
                      <p className="text-sm font-bold text-white leading-relaxed">{q.question_text}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`text-xs font-black ${
                      q.is_correct ? 'text-emerald-400' : q.selected_option === null ? 'text-slate-400' : 'text-rose-400'
                    }`}>
                      {q.is_correct ? '+1.0 pt' : q.selected_option === null ? 'Skipped' : '-0.25 pt'}
                    </span>
                    {isExpanded
                      ? <ChevronUp className="w-4 h-4 text-slate-400" />
                      : <ChevronDown className="w-4 h-4 text-slate-400" />}
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-5 pb-5 space-y-4 border-t border-slate-700/40 pt-4">
                    {q.code_snippet && (
                      <pre className="p-3 bg-slate-900 text-indigo-300 font-mono text-xs rounded-xl overflow-x-auto border border-slate-800">
                        <code>{q.code_snippet}</code>
                      </pre>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {q.options?.map((op, idx) => {
                        const isCorrect = idx === q.correct_option;
                        const isSelected = idx === q.selected_option;
                        let cls = 'bg-slate-800 text-slate-300 border-slate-700';
                        if (isCorrect) cls = 'bg-emerald-600 text-white border-emerald-500 font-extrabold';
                        else if (isSelected && !isCorrect) cls = 'bg-rose-600 text-white border-rose-500 font-extrabold';
                        return (
                          <div key={idx} className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${cls}`}>
                            <span className="w-5 h-5 rounded-md bg-white/20 flex items-center justify-center text-[10px] font-black shrink-0">
                              {String.fromCharCode(65 + idx)}
                            </span>
                            <span className="flex-1">{op}</span>
                            {isCorrect && <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />}
                            {isSelected && !isCorrect && <XCircle className="w-3.5 h-3.5 shrink-0" />}
                          </div>
                        );
                      })}
                    </div>

                    {q.explanation && (
                      <div className="p-3 bg-indigo-950/40 border border-indigo-800/40 rounded-xl text-xs text-slate-200 font-semibold leading-relaxed">
                        <span className="font-extrabold text-indigo-300">Explanation: </span>
                        {q.explanation}
                      </div>
                    )}

                    {q.selected_option === null && (
                      <p className="text-xs font-bold text-slate-500 italic">You skipped this question.</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <button
          onClick={() => navigate('/practice')}
          className="w-full py-4 bg-slate-800 hover:bg-slate-700 text-white font-extrabold text-xs rounded-2xl transition-all border border-slate-700"
        >
          Back to Practice Hub
        </button>
      </div>
    </main>
  );
};
