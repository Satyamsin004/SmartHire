import React, { useEffect, useState } from 'react';
import { AlertTriangle, Users, Smartphone, EyeOff, ShieldAlert } from 'lucide-react';
import { ActiveIncident } from '../../services/IntegrityEngine';

interface IntegrityWarningOverlayProps {
  incident: ActiveIncident | null;
}

export const IntegrityWarningOverlay: React.FC<IntegrityWarningOverlayProps> = ({ incident }) => {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!incident) {
      setElapsed(0);
      return;
    }
    const timer = setInterval(() => {
      setElapsed(Math.round((Date.now() - incident.startedAt) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [incident]);

  if (!incident) return null;

  const getIcon = () => {
    switch (incident.type) {
      case 'MULTIPLE_PERSON':
        return <Users className="w-6 h-6 text-rose-400 shrink-0 animate-pulse" />;
      case 'MOBILE_PHONE':
        return <Smartphone className="w-6 h-6 text-amber-400 shrink-0 animate-bounce" />;
      case 'FACE_NOT_VISIBLE':
        return <EyeOff className="w-6 h-6 text-amber-300 shrink-0 animate-pulse" />;
      default:
        return <ShieldAlert className="w-6 h-6 text-rose-400 shrink-0" />;
    }
  };

  const getBorderColor = () => {
    switch (incident.type) {
      case 'MULTIPLE_PERSON':
        return 'border-rose-500/80 bg-rose-950/80 shadow-rose-950/50';
      case 'MOBILE_PHONE':
        return 'border-amber-500/80 bg-amber-950/80 shadow-amber-950/50';
      default:
        return 'border-yellow-500/80 bg-yellow-950/80 shadow-yellow-950/50';
    }
  };

  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 max-w-lg w-[92%] animate-fade-in pointer-events-none">
      <div className={`p-4 sm:p-5 rounded-2xl border backdrop-blur-xl shadow-2xl flex items-start gap-4 transition-all duration-300 ${getBorderColor()}`}>
        <div className="p-2.5 rounded-xl bg-slate-950/60 border border-white/10">
          {getIcon()}
        </div>
        
        <div className="flex-1 space-y-1">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-black text-white tracking-wide flex items-center gap-2">
              <span>{incident.title}</span>
              <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 text-[10px] font-extrabold uppercase tracking-wider border border-rose-500/30">
                Integrity Warning
              </span>
            </h4>
            <span className="text-[11px] font-mono font-bold text-slate-300 bg-black/40 px-2 py-0.5 rounded-md">
              Active: {elapsed}s
            </span>
          </div>

          <p className="text-xs text-slate-200 font-medium leading-relaxed">
            {incident.message}
          </p>

          <p className="text-[10px] text-slate-400 font-semibold pt-0.5">
            This incident is being logged in your interview integrity audit report.
          </p>
        </div>
      </div>
    </div>
  );
};
