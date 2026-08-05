import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { BrainCircuit, Loader2 } from 'lucide-react';
import api from '../../services/api';

export const ProcessingScreen: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const sessionId = params.get('session');

  useEffect(() => {
    if (!sessionId) {
      navigate('/dashboard');
      return;
    }

    // Call backend finish endpoint to complete session and compile PostgreSQL scoring report
    api.post(`/interview/finish/${sessionId}`)
      .catch((err) => console.warn('Finish session error:', err))
      .finally(() => {
        navigate(`/interview/results?session=${sessionId}`);
      });
  }, [sessionId, navigate]);

  return (
    <>
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-md w-full flex flex-col items-center justify-center space-y-8">
            <div className="relative">
              <div className="absolute inset-0 bg-brand-primary/20 blur-xl rounded-full animate-pulse"></div>
              <div className="w-24 h-24 rounded-3xl bg-cream-100 border border-stoneBorder shadow-luxury flex items-center justify-center relative z-10">
                <BrainCircuit className="w-10 h-10 text-brand-primary animate-pulse" />
              </div>
            </div>

            <div className="text-center space-y-3">
              <h1 className="text-2xl font-extrabold text-brand-ink">Processing Interview Telemetry</h1>
              <p className="text-sm font-medium text-slate-500">
                Aggregating speech tempo, eye-tracking metrics, and compiling the generative AI scoring report...
              </p>
            </div>

            <div className="w-full space-y-4">
              <div className="flex items-center gap-4 text-xs font-bold text-slate-500">
                <Loader2 className="w-4 h-4 animate-spin text-brand-primary" />
                <span>Finalizing Transcript...</span>
              </div>
              <div className="flex items-center gap-4 text-xs font-bold text-slate-500">
                <Loader2 className="w-4 h-4 animate-spin text-brand-primary" />
                <span>Evaluating Technical Accuracy...</span>
              </div>
              <div className="flex items-center gap-4 text-xs font-bold text-slate-500">
                <Loader2 className="w-4 h-4 animate-spin text-brand-primary" />
                <span>Compiling Hiring Recommendation...</span>
              </div>
            </div>

          </div>
        </main>
      </>
  );
};
