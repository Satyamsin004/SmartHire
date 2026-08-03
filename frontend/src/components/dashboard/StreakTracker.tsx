import React from 'react';
import { CheckCircle2, Calendar, FileText, MoreHorizontal } from 'lucide-react';

export interface StreakTrackerProps {
  days?: number;
}

export const StreakTracker: React.FC<StreakTrackerProps> = ({ days = 6 }) => {
  const streakDays = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  return (
    <div className="space-y-4">
      {/* Streak Card */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-800">Interview streak</h3>
            <p className="text-xs text-slate-400">Keep the momentum going.</p>
          </div>
          <button className="text-slate-400 hover:text-slate-600">
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-baseline gap-2 mb-4">
          <span className="text-2xl font-extrabold text-slate-900">6 days</span>
          <span className="text-xs text-slate-400">Longest streak: 14 days</span>
        </div>

        <div className="flex justify-between items-center">
          {streakDays.map((day, idx) => (
            <div key={idx} className="flex flex-col items-center gap-1.5">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                idx < 6 ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200' : 'bg-slate-100 text-slate-400'
              }`}>
                {idx < 6 ? <CheckCircle2 className="w-4 h-4" /> : day}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Upcoming Tasks Card */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-800">Upcoming tasks</h3>
            <p className="text-xs text-slate-400">What to do next.</p>
          </div>
          <button className="text-slate-400 hover:text-slate-600">
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3">
          <div className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-50 border border-slate-100">
            <Calendar className="w-4 h-4 text-indigo-600 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-slate-800">HR interview practice</h4>
              <p className="text-[11px] text-slate-400">Tomorrow · 4:00 PM</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-50 border border-slate-100">
            <FileText className="w-4 h-4 text-purple-600 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-slate-800">Review resume feedback</h4>
              <p className="text-[11px] text-slate-400">2 recommendations pending</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
