import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Zap, Video, Gift, X, ExternalLink, Bell, CheckCircle2, Award } from 'lucide-react';
import { useWebSocket } from '../../context/WebSocketContext';

export const NotificationToast: React.FC = () => {
  const { activeToast, dismissToast } = useWebSocket();
  const navigate = useNavigate();
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    if (!activeToast) {
      setProgress(100);
      return;
    }

    setProgress(100);
    const duration = 8000; // 8 seconds visible
    const interval = 50;
    const step = (interval / duration) * 100;

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev <= step) {
          clearInterval(timer);
          dismissToast();
          return 0;
        }
        return prev - step;
      });
    }, interval);

    return () => clearInterval(timer);
  }, [activeToast, dismissToast]);

  if (!activeToast) return null;

  const isEvaluationReady = activeToast.eventType === 'INTERVIEW_COMPLETED' ||
    activeToast.eventType?.includes('EVALUATION') || 
    activeToast.title?.toLowerCase().includes('evaluation ready') ||
    activeToast.message?.toLowerCase().includes('evaluation ready') ||
    activeToast.title?.toLowerCase().includes('completed');

  const isShortlist = activeToast.eventType?.includes('SHORTLIST') || activeToast.title?.toLowerCase().includes('shortlist');
  const isAssessment = activeToast.eventType?.includes('ASSESSMENT') || activeToast.title?.toLowerCase().includes('assessment');
  const isInterview = !isEvaluationReady && (activeToast.eventType?.includes('INTERVIEW') || activeToast.title?.toLowerCase().includes('interview'));
  const isOffer = activeToast.eventType?.includes('OFFER') || activeToast.title?.toLowerCase().includes('offer');

  const getAccent = () => {
    if (isEvaluationReady) {
      return {
        bg: 'from-purple-600/20 via-slate-900 to-slate-900',
        border: 'border-purple-500/50',
        glow: 'shadow-purple-500/20',
        iconBg: 'bg-purple-500/20 text-purple-300 border border-purple-500/30',
        bar: 'bg-gradient-to-r from-purple-500 to-indigo-400',
        icon: Award,
        ctaText: 'View Evaluation Report'
      };
    }
    if (isShortlist) {
      return {
        bg: 'from-amber-500/10 via-slate-900 to-slate-900',
        border: 'border-amber-500/40',
        glow: 'shadow-amber-500/15',
        iconBg: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
        bar: 'bg-gradient-to-r from-amber-500 to-emerald-400',
        icon: Sparkles,
        ctaText: 'View Shortlisted Applications'
      };
    }
    if (isAssessment) {
      return {
        bg: 'from-blue-500/10 via-slate-900 to-slate-900',
        border: 'border-blue-500/40',
        glow: 'shadow-blue-500/15',
        iconBg: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
        bar: 'bg-gradient-to-r from-blue-500 to-indigo-500',
        icon: Zap,
        ctaText: 'Open Online Assessment'
      };
    }
    if (isInterview) {
      return {
        bg: 'from-purple-500/10 via-slate-900 to-slate-900',
        border: 'border-purple-500/40',
        glow: 'shadow-purple-500/15',
        iconBg: 'bg-purple-500/20 text-purple-400 border border-purple-500/30',
        bar: 'bg-gradient-to-r from-purple-500 to-pink-500',
        icon: Video,
        ctaText: 'Enter Interview Lobby'
      };
    }
    if (isOffer) {
      return {
        bg: 'from-emerald-500/10 via-slate-900 to-slate-900',
        border: 'border-emerald-500/40',
        glow: 'shadow-emerald-500/15',
        iconBg: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
        bar: 'bg-gradient-to-r from-emerald-500 to-teal-400',
        icon: Gift,
        ctaText: 'Review Offer Letter'
      };
    }
    return {
      bg: 'from-indigo-500/10 via-slate-900 to-slate-900',
      border: 'border-indigo-500/40',
      glow: 'shadow-indigo-500/15',
      iconBg: 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30',
      bar: 'bg-indigo-500',
      icon: Bell,
      ctaText: 'View Applications'
    };
  };

  const accent = getAccent();
  const IconComponent = accent.icon;

  const handleAction = () => {
    dismissToast();
    if (isEvaluationReady) {
      const sessId = activeToast.data?.session_id || activeToast.data?.interview_id || activeToast.data?.application_id;
      if (sessId) {
        window.dispatchEvent(new CustomEvent('OPEN_EVALUATION_MODAL', { detail: { evaluationId: sessId } }));
      }
      navigate('/recruiter/dashboard');
    } else if (isOffer) {
      navigate('/offers');
    } else if (isAssessment) {
      const sessId = activeToast.data?.session_id || activeToast.data?.assessment_id || activeToast.data?.id;
      if (sessId) {
        navigate(`/assessment/exam?session=${sessId}`);
      } else {
        navigate('/dashboard');
      }
    } else if (isInterview) {
      const schedId = activeToast.data?.interview_id || activeToast.data?.schedule_id || activeToast.data?.id;
      if (schedId) {
        navigate(`/interview/lobby?schedule=${schedId}`);
      } else {
        navigate('/dashboard');
      }
    } else {
      navigate('/dashboard');
    }
  };

  return (
    <div className="fixed top-5 right-5 z-50 max-w-md w-[calc(100vw-2.5rem)] sm:w-96 animate-in slide-in-from-top-4 fade-in duration-300">
      <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${accent.bg} border ${accent.border} shadow-2xl ${accent.glow} p-4 backdrop-blur-xl text-white`}>
        {/* Progress bar at top */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-slate-800">
          <div
            className={`h-full ${accent.bar} transition-all duration-75`}
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="flex items-start gap-3 mt-1">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${accent.iconBg}`}>
            <IconComponent className="w-5 h-5 animate-pulse" />
          </div>

          <div className="flex-1 min-w-0 pr-1">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-xs font-black tracking-tight text-white line-clamp-1">
                {activeToast.title}
              </h4>
              <span className="text-[10px] text-slate-400 font-semibold shrink-0">
                {activeToast.timestamp}
              </span>
            </div>

            <p className="text-xs text-slate-300 font-medium mt-1 leading-relaxed line-clamp-3">
              {activeToast.message}
            </p>

            {/* Action CTAs */}
            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={handleAction}
                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
              >
                <span>{accent.ctaText}</span>
                <ExternalLink className="w-3 h-3" />
              </button>
              <button
                onClick={dismissToast}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-all cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          </div>

          <button
            onClick={dismissToast}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
