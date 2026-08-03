import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FileUp, Play, UserCheck, Code, Users, BrainCircuit, ChevronRight } from 'lucide-react';

export const QuickActions: React.FC = () => {
  const navigate = useNavigate();

  const cards = [
    { title: 'Upload Resume', icon: FileUp, path: '/resume', bg: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
    { title: 'Start Interview', icon: Play, path: '/interview', bg: 'bg-indigo-50 text-indigo-600 border-indigo-100' },
    { title: 'HR Round', icon: UserCheck, path: '/interview?round=HR', bg: 'bg-blue-50 text-blue-600 border-blue-100' },
    { title: 'Technical Round', icon: Code, path: '/interview?round=Technical', bg: 'bg-purple-50 text-purple-600 border-purple-100' },
    { title: 'Behavioural Round', icon: Users, path: '/interview?round=Behavioral', bg: 'bg-amber-50 text-amber-600 border-amber-100' },
    { title: 'Aptitude Round', icon: BrainCircuit, path: '/aptitude', bg: 'bg-rose-50 text-rose-600 border-rose-100' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
      {cards.map((card, idx) => {
        const Icon = card.icon;
        return (
          <button
            key={idx}
            onClick={() => navigate(card.path)}
            className="bg-white p-4 rounded-2xl border border-slate-200/80 hover:border-indigo-300 hover:shadow-md transition-all flex flex-col items-center text-center group"
          >
            <div className={`w-12 h-12 rounded-2xl ${card.bg} border flex items-center justify-center mb-3 group-hover:scale-105 transition-transform`}>
              <Icon className="w-6 h-6" />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs font-bold text-slate-800">{card.title}</span>
              <ChevronRight className="w-3 h-3 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </button>
        );
      })}
    </div>
  );
};
