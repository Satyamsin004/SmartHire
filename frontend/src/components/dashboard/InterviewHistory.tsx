import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Video, ChevronRight, MoreHorizontal } from 'lucide-react';
import api from '../../services/api';

export const InterviewHistory: React.FC = () => {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<any[]>([]);

  useEffect(() => {
    api.get('/interview/history')
      .then((res) => {
        setSessions(res.data || []);
      })
      .catch((err) => console.warn('Fetch history error:', err));
  }, []);

  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm flex flex-col justify-between">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-slate-800">Interview history</h3>
          <p className="text-xs text-slate-400">Recent AI scored mock sessions.</p>
        </div>
        <button className="text-slate-400 hover:text-slate-600">
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-3">
        {sessions.length === 0 ? (
          <div className="py-8 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
            <p className="text-xs font-semibold text-slate-500">No mock interview sessions recorded yet.</p>
            <p className="text-[11px] text-slate-400 mt-1">Start a practice session to see live AI scores here.</p>
          </div>
        ) : (
          sessions.map((item) => (
            <div
              key={item.id}
              onClick={() => navigate(`/reports?session=${item.id}`)}
              className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-200/60 cursor-pointer transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Video className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">{item.title}</h4>
                  <p className="text-[11px] text-slate-400">{item.started_at ? new Date(item.started_at).toLocaleDateString() : (item.time || 'Recent Session')}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                  {item.round_type || item.category || 'Technical'}
                </span>
                <span className="text-xs font-extrabold text-slate-900">{item.score}</span>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
