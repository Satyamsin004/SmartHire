import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Trophy, TrendingUp, AlertCircle, FileText, ArrowRight, Shield, Brain, MessageSquare } from 'lucide-react';
import api from '../../services/api';

export const ResultsScreen: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const sessionId = params.get('session');

  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<any>(null);

  useEffect(() => {
    if (!sessionId) {
      navigate('/dashboard');
      return;
    }

    api.get(`/interview/report/${sessionId}`)
      .then((res) => {
        setReport(res.data);
      })
      .catch((err) => {
        console.error("Failed to fetch report:", err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [sessionId, navigate]);

  if (loading) {
    return (
      <>
        <main className="flex-1 flex items-center justify-center">
          <span className="text-sm font-bold text-slate-500">Loading your results...</span>
        </main>
      </>
    );
  }

  if (!report) {
    return (
      <>
        <main className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
          <h1 className="text-xl font-extrabold text-brand-ink">Report Generation Pending</h1>
          <p className="text-sm font-medium text-slate-500 max-w-md mx-auto">
            Your interview telemetry is still being processed by the AI engine. You can check back later in your Reports dashboard.
          </p>
          <button 
            onClick={() => navigate('/reports')}
            className="px-6 py-3 rounded-xl bg-brand-primary text-white text-xs font-extrabold mt-4"
          >
            Go to Reports
          </button>
        </main>
      </>
    );
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-500';
    if (score >= 60) return 'text-amber-500';
    return 'text-rose-500';
  };

  return (
    <>
        <main className="p-6 lg:p-10 max-w-5xl mx-auto w-full space-y-8">
          
          <div className="text-center space-y-3">
            <div className="w-16 h-16 rounded-3xl bg-brand-accent/20 flex items-center justify-center mx-auto mb-4">
              <Trophy className="w-8 h-8 text-brand-accent" />
            </div>
            <h1 className="text-3xl font-extrabold text-brand-ink">Interview Completed!</h1>
            <p className="text-sm font-medium text-slate-500">
              Great job! The AI engine has analyzed your responses and compiled your evaluation.
            </p>
            {report.rating_rubric && (
              <span className={`inline-block px-4 py-1.5 rounded-full text-xs font-extrabold ${
                report.overall_score >= 80 ? 'bg-emerald-100 text-emerald-700' : 
                report.overall_score >= 60 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'
              }`}>
                {report.rating_rubric}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="rounded-3xl p-5 flex flex-col items-center justify-center text-center space-y-1.5 bg-gradient-to-br from-indigo-950 via-indigo-900 to-slate-900 text-white shadow-xl border border-indigo-500/30">
              <span className="text-[9px] font-extrabold uppercase tracking-wider text-indigo-200">Overall Score</span>
              <span className="text-3xl font-black text-white drop-shadow-md">{report.overall_score}%</span>
            </div>
            <div className="card-luxury p-5 flex flex-col items-center justify-center text-center space-y-1.5">
              <Brain className="w-4 h-4 text-slate-400 mb-0.5" />
              <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400">Technical</span>
              <span className={`text-2xl font-black ${getScoreColor(report.technical_score)}`}>{report.technical_score}%</span>
            </div>
            <div className="card-luxury p-5 flex flex-col items-center justify-center text-center space-y-1.5">
              <MessageSquare className="w-4 h-4 text-slate-400 mb-0.5" />
              <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400">Communication</span>
              <span className={`text-2xl font-black ${getScoreColor(report.communication_score)}`}>{report.communication_score}%</span>
            </div>
            <div className="card-luxury p-5 flex flex-col items-center justify-center text-center space-y-1.5">
              <Shield className="w-4 h-4 text-slate-400 mb-0.5" />
              <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400">Confidence</span>
              <span className={`text-2xl font-black ${getScoreColor(report.confidence_score)}`}>{report.confidence_score}%</span>
            </div>
            <div className="card-luxury p-5 flex flex-col items-center justify-center text-center space-y-1.5">
              <Trophy className="w-4 h-4 text-slate-400 mb-0.5" />
              <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400">Professionalism</span>
              <span className={`text-2xl font-black ${getScoreColor(report.professionalism_score)}`}>{report.professionalism_score}%</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="card-luxury p-6 space-y-4">
              <div className="flex items-center gap-2 border-b border-stoneBorder pb-4">
                <TrendingUp className="w-5 h-5 text-emerald-500" />
                <h3 className="text-sm font-extrabold text-brand-ink uppercase tracking-wider">Key Strengths</h3>
              </div>
              <ul className="space-y-3">
                {report.strengths?.map((str: string, i: number) => (
                  <li key={i} className="flex items-start gap-2 text-sm font-medium text-slate-600">
                    <span className="text-emerald-500 mt-0.5">•</span> {str}
                  </li>
                ))}
              </ul>
            </div>

            <div className="card-luxury p-6 space-y-4">
              <div className="flex items-center gap-2 border-b border-stoneBorder pb-4">
                <AlertCircle className="w-5 h-5 text-rose-500" />
                <h3 className="text-sm font-extrabold text-brand-ink uppercase tracking-wider">Areas for Improvement</h3>
              </div>
              <ul className="space-y-3">
                {report.weaknesses?.map((wk: string, i: number) => (
                  <li key={i} className="flex items-start gap-2 text-sm font-medium text-slate-600">
                    <span className="text-rose-500 mt-0.5">•</span> {wk}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {report.improvement_plan && report.improvement_plan.length > 0 && (
            <div className="card-luxury p-6 space-y-4 border-l-4 border-indigo-500">
              <h3 className="text-sm font-extrabold text-brand-ink uppercase tracking-wider flex items-center gap-2">
                <Brain className="w-5 h-5 text-indigo-500" /> AI Improvement Recommendations
              </h3>
              <ul className="space-y-2">
                {report.improvement_plan.map((item: string, i: number) => (
                  <li key={i} className="flex items-start gap-2 text-sm font-medium text-slate-600">
                    <span className="text-indigo-500 mt-0.5 font-bold">{i + 1}.</span> {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8">
            <button 
              onClick={() => navigate('/dashboard')}
              className="px-8 py-4 rounded-2xl bg-cream-200 hover:bg-cream-300 text-brand-ink font-extrabold text-sm transition-all"
            >
              Return to Dashboard
            </button>
            <button 
              onClick={() => navigate(`/reports?session=${sessionId}`)}
              className="px-8 py-4 rounded-2xl bg-brand-primary hover:bg-sb-700 text-white font-extrabold text-sm flex items-center justify-center gap-2 transition-all shadow-luxury"
            >
              <span>View Full Technical Report</span>
              <FileText className="w-4 h-4" />
            </button>
          </div>

        </main>
      </>
  );
};
