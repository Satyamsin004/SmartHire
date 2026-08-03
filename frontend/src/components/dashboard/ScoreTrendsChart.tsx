import React, { useState } from 'react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { MoreHorizontal } from 'lucide-react';

const weeklyData = [
  { day: 'Mon', score: 72 },
  { day: 'Tue', score: 78 },
  { day: 'Wed', score: 81 },
  { day: 'Thu', score: 85 },
  { day: 'Fri', score: 89 },
  { day: 'Sat', score: 92 },
  { day: 'Sun', score: 88 },
];

export const ScoreTrendsChart: React.FC = () => {
  const [filter, setFilter] = useState<'weekly' | 'monthly'>('weekly');

  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm flex flex-col justify-between">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-slate-800">Score Trends</h3>
          <p className="text-xs text-slate-400">Weekly readiness and interview performance.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="bg-slate-100 p-1 rounded-xl flex gap-1">
            <button
              onClick={() => setFilter('weekly')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                filter === 'weekly' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Weekly
            </button>
            <button
              onClick={() => setFilter('monthly')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                filter === 'monthly' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Monthly
            </button>
          </div>
          <button className="text-slate-400 hover:text-slate-600">
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="h-44 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={weeklyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
            <Tooltip
              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }}
              cursor={{ fill: '#f1f5f9' }}
            />
            <Bar dataKey="score" radius={[8, 8, 0, 0]}>
              {weeklyData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={index === 5 ? '#6366f1' : '#818cf8'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
