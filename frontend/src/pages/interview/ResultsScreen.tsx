import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Check, ArrowRight, Compass, Sparkles, ShieldCheck, Star } from 'lucide-react';
import api from '../../services/api';

export const ResultsScreen: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const sessionId = params.get('session');

  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<any>(null);
  const [feedbackRating, setFeedbackRating] = useState<number>(5);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState<boolean>(false);
  const [feedbackText, setFeedbackText] = useState<string>('');

  useEffect(() => {
    if (!sessionId) {
      navigate('/dashboard');
      return;
    }

    let isMounted = true;
    let attempts = 0;
    const maxAttempts = 4;

    const fetchReportData = () => {
      api.get(`/interview/report/${sessionId}`)
        .then((res) => {
          if (isMounted && res.data) {
            setReport(res.data);
            setLoading(false);
          }
        })
        .catch((err) => {
          console.warn(`Report fetch attempt ${attempts + 1} notice:`, err);
          attempts += 1;
          if (isMounted) {
            if (attempts < maxAttempts) {
              setTimeout(fetchReportData, 2000);
            } else {
              setLoading(false);
            }
          }
        });
    };

    fetchReportData();

    return () => {
      isMounted = false;
    };
  }, [sessionId, navigate]);

  const handleFeedbackSubmit = () => {
    setFeedbackSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between relative overflow-hidden select-none">
      
      {/* Background Ambient Radial Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full h-80 bg-gradient-to-t from-indigo-950/40 via-purple-950/20 to-transparent pointer-events-none" />

      {/* TOP HEADER */}
      <header className="relative z-10 flex items-center justify-between px-8 py-6 max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Sparkles className="w-4 h-4 text-slate-950 font-bold" />
            </div>
            <span className="text-lg font-black tracking-tight text-white">SmartHire <span className="text-emerald-400">AI</span></span>
          </div>
          <span className="text-slate-600 font-bold">|</span>
          <span className="text-sm font-extrabold text-slate-300">Interview</span>
        </div>

        {/* Connectivity Bars Indicator */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/80 border border-slate-800 text-xs font-bold text-emerald-400 shadow-inner">
          <div className="flex items-end gap-0.5 h-3">
            <span className="w-1 h-1.5 bg-emerald-400 rounded-xs"></span>
            <span className="w-1 h-2 bg-emerald-400 rounded-xs"></span>
            <span className="w-1 h-2.5 bg-emerald-400 rounded-xs"></span>
            <span className="w-1 h-3 bg-emerald-400 rounded-xs"></span>
          </div>
          <span className="text-[11px] font-semibold text-slate-300">Connected</span>
        </div>
      </header>

      {/* CENTER HERO SECTION (Imitating Unstop Pattern) */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-6 max-w-2xl mx-auto my-6 space-y-6">
        
        {/* Large Glowing Emerald Checkmark Circle */}
        <div className="relative flex items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-emerald-500/20 blur-xl animate-pulse" />
          <div className="w-24 h-24 rounded-full border-2 border-emerald-400/80 bg-emerald-950/40 backdrop-blur-md flex items-center justify-center shadow-[0_0_40px_rgba(16,185,129,0.35)] relative">
            <Check className="w-12 h-12 text-emerald-400 stroke-[3]" />
          </div>
        </div>

        {/* Title & Copy */}
        <div className="space-y-3">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Thank you for taking the interview!
          </h1>
          <p className="text-sm sm:text-base font-medium text-slate-400 max-w-lg mx-auto leading-relaxed">
            We appreciate your time and effort. Your responses have been recorded successfully.
          </p>
          <p className="text-xs text-slate-400">
            You can now close this window or go back to SmartHire.
          </p>
        </div>

        {/* Candidate Experience Feedback Rating Widget */}
        <div className="p-4 bg-slate-900/80 rounded-2xl border border-slate-800/80 max-w-md w-full space-y-3 shadow-lg">
          <span className="text-xs font-extrabold text-slate-300">Rate your AI Interview Experience</span>
          
          <div className="flex items-center justify-center gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setFeedbackRating(star)}
                className="p-1 transition-transform hover:scale-125 cursor-pointer"
              >
                <Star
                  className={`w-6 h-6 ${
                    star <= feedbackRating
                      ? 'text-amber-400 fill-amber-400'
                      : 'text-slate-600'
                  }`}
                />
              </button>
            ))}
          </div>

          {!feedbackSubmitted ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                placeholder="Optional feedback comment..."
                className="flex-1 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              />
              <button
                onClick={handleFeedbackSubmit}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-extrabold text-white border border-slate-700 cursor-pointer"
              >
                Submit
              </button>
            </div>
          ) : (
            <p className="text-[11px] font-bold text-emerald-400">Thank you for your feedback!</p>
          )}
        </div>

        {/* Action Buttons (Unstop Pill Style) */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2 w-full max-w-md">
          <button
            onClick={() => navigate('/practice?tab=interview')}
            className="w-full sm:w-auto px-7 py-3 rounded-full bg-slate-800/90 hover:bg-slate-700/90 text-white text-xs font-extrabold flex items-center justify-center gap-2 border border-slate-700 shadow-lg transition-all hover:scale-[1.02] cursor-pointer"
          >
            <div className="w-5 h-5 rounded-full bg-slate-900 flex items-center justify-center border border-slate-700">
              <Compass className="w-3 h-3 text-slate-300" />
            </div>
            <span>Explore Practice Hub</span>
          </button>

          <button
            onClick={() => navigate(`/reports?session=${sessionId}`)}
            className="w-full sm:w-auto px-8 py-3 rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black flex items-center justify-center gap-2 shadow-[0_0_25px_rgba(16,185,129,0.4)] transition-all hover:scale-[1.02] cursor-pointer"
          >
            <span>View your report</span>
            <ArrowRight className="w-4 h-4 text-slate-950 stroke-[2.5]" />
          </button>
        </div>

        {/* Quick evaluation preview badge if report is ready */}
        {report && (
          <div className="pt-2 flex items-center gap-4 text-xs font-bold text-slate-400">
            <span className="flex items-center gap-1 text-emerald-400">
              <ShieldCheck className="w-3.5 h-3.5" /> AI Evaluation Compiled
            </span>
            <span>•</span>
            <span className="text-slate-300">{report.role_target || 'Technical Round'}</span>
            {report.overall_score != null && (
              <>
                <span>•</span>
                <span className="text-amber-400 font-extrabold">{report.overall_score}% Score</span>
              </>
            )}
          </div>
        )}
      </main>

      {/* FOOTER BAR */}
      <footer className="relative z-10 py-6 text-center text-xs font-medium text-slate-600 border-t border-slate-900/60">
        SmartHire AI Automated Telemetry & Mock Assessment Engine
      </footer>
    </div>
  );
};
