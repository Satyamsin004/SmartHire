import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldX, AlertOctagon, ArrowLeft, RotateCcw, AlertTriangle, FileText } from 'lucide-react';

interface InterviewTerminatedScreenProps {
  reason: string;
  sessionId: string | null;
}

export const InterviewTerminatedScreen: React.FC<InterviewTerminatedScreenProps> = ({
  reason,
  sessionId
}) => {
  const navigate = useNavigate();

  const getFriendlyReason = () => {
    switch (reason.toUpperCase()) {
      case 'TAB_SWITCH':
        return 'Browser Tab Departure (TAB_SWITCH)';
      case 'MULTIPLE_PERSON':
        return 'Unauthorized Third-Party Presence in Camera View';
      case 'MOBILE_PHONE':
        return 'Prohibited Device Usage (Mobile Phone)';
      default:
        return reason || 'Interview Integrity Violation';
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white font-sans relative overflow-hidden select-none">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/3 w-[600px] h-[600px] bg-rose-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-1/4 w-[400px] h-[400px] bg-red-800/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-xl w-full bg-slate-900/80 backdrop-blur-2xl border border-rose-500/30 rounded-3xl p-8 sm:p-10 shadow-2xl shadow-rose-950/60 text-center space-y-6 relative z-10 animate-fade-in">
        
        {/* Terminated Shield Icon */}
        <div className="w-20 h-20 rounded-3xl bg-rose-500/10 border-2 border-rose-500/40 text-rose-500 flex items-center justify-center mx-auto shadow-lg shadow-rose-500/20">
          <ShieldX className="w-10 h-10 animate-pulse" />
        </div>

        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-black uppercase tracking-wider">
            <AlertOctagon className="w-3.5 h-3.5" />
            <span>Interview Terminated</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Assessment Session Ended
          </h2>

          <p className="text-sm text-slate-300 font-medium">
            Your live interview session was automatically terminated by the SmartHire Interview Integrity Proctor.
          </p>
        </div>

        {/* Reason Box */}
        <div className="p-5 rounded-2xl bg-slate-950/70 border border-rose-500/20 text-left space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Violation Reason</span>
            <span className="px-2.5 py-0.5 rounded-md bg-rose-950 text-rose-400 text-[11px] font-bold font-mono">
              Status: TERMINATED
            </span>
          </div>

          <p className="text-sm font-extrabold text-rose-300">
            {getFriendlyReason()}
          </p>

          <p className="text-xs text-slate-400 font-medium leading-relaxed">
            Leaving the proctored interview window, opening secondary tabs, or failing continuous candidate visibility violates the SmartHire fair-testing policy. The incident has been recorded and submitted with your audit report.
          </p>
        </div>

        {/* Action Button */}
        <div className="pt-2 flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex-1 py-3.5 px-6 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-600/30 cursor-pointer active:scale-95"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Candidate Dashboard</span>
          </button>
          {sessionId && (
            <button
              onClick={() => navigate(`/interview/results?session=${sessionId}`)}
              className="py-3.5 px-6 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-extrabold text-xs flex items-center justify-center gap-2 transition-all border border-slate-700 cursor-pointer"
            >
              <FileText className="w-4 h-4" />
              <span>View Audit Report</span>
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
