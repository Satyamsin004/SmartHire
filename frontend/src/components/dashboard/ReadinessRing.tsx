import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { Sparkles, MoreHorizontal } from 'lucide-react';

export const ReadinessRing: React.FC<{ score?: number }> = ({ score = 85 }) => {
  const data = [
    { name: 'Score', value: score },
    { name: 'Remaining', value: 100 - score },
  ];

  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm flex flex-col justify-between h-full">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-800">Circular readiness score</h3>
          <p className="text-xs text-slate-400">Based on the last 12 sessions.</p>
        </div>
        <button className="text-slate-400 hover:text-slate-600">
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </div>

      <div className="relative h-44 my-2 flex items-center justify-center">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={75}
              startAngle={90}
              endAngle={-270}
              dataKey="value"
              stroke="none"
            >
              <Cell key="cell-0" fill="#6366f1" />
              <Cell key="cell-1" fill="#e2e8f0" />
            </Pie>
          </PieChart>
        </ResponsiveContainer>

        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-3xl font-extrabold text-slate-900 tracking-tight">{score}</span>
          <span className="text-xs font-semibold text-slate-400">/100</span>
        </div>
      </div>

      <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 flex items-start gap-2.5">
        <Sparkles className="w-4 h-4 text-indigo-600 mt-0.5 shrink-0" />
        <div>
          <span className="text-xs font-bold text-slate-800 block">Current readiness</span>
          <p className="text-[11px] text-slate-500 font-medium leading-tight">
            You are in the top 18% of active candidates this week.
          </p>
        </div>
      </div>
    </div>
  );
};
