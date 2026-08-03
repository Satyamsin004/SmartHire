import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, User, Shield, FileText, Send, Sparkles, CheckSquare, Square } from 'lucide-react';
import api from '../../services/api';

interface ScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  candidates?: any[];
}

export const ScheduleInterviewModal: React.FC<ScheduleModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [candidates, setCandidates] = useState<any[]>([]);
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<string[]>([]);
  const [roundType, setRoundType] = useState<string>('Technical');
  const [scheduledDate, setScheduledDate] = useState<string>('');
  const [scheduledTime, setScheduledTime] = useState<string>('10:30');
  const [durationMinutes, setDurationMinutes] = useState<number>(30);
  const [difficulty, setDifficulty] = useState<string>('Medium');
  const [instructions, setInstructions] = useState<string>('Please join 5 minutes before the scheduled time in a quiet, well-lit room with your camera enabled.');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      setErrorMsg('');
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      setScheduledDate(tomorrow.toISOString().split('T')[0]);

      api.get('/scheduling/candidates-list')
        .then((res) => {
          setCandidates(res.data);
          if (res.data.length > 0) {
            setSelectedCandidateIds(res.data.map((c: any) => c.candidate_id));
          }
        })
        .catch((err) => console.warn('Candidate list fetch error:', err));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const toggleCandidateSelect = (candId: string) => {
    if (selectedCandidateIds.includes(candId)) {
      setSelectedCandidateIds(selectedCandidateIds.filter(id => id !== candId));
    } else {
      setSelectedCandidateIds([...selectedCandidateIds, candId]);
    }
  };

  const toggleSelectAll = () => {
    if (selectedCandidateIds.length === candidates.length) {
      setSelectedCandidateIds([]);
    } else {
      setSelectedCandidateIds(candidates.map(c => c.candidate_id));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedCandidateIds.length === 0) {
      setErrorMsg('Please select at least one candidate for this interview invitation.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const fullIsoDate = new Date(`${scheduledDate}T${scheduledTime}:00`).toISOString();
      await api.post('/scheduling/create', {
        candidate_ids: selectedCandidateIds,
        round_type: roundType,
        scheduled_date: fullIsoDate,
        duration_minutes: durationMinutes,
        difficulty: difficulty,
        instructions: instructions
      });

      setIsSubmitting(false);
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Schedule interview error:', err);
      setErrorMsg(err.response?.data?.detail || 'Failed to schedule interview. Ensure candidate is registered.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-7 border border-slate-200 shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-slate-900">Schedule Interview Invitation</h3>
              <p className="text-xs text-slate-400 font-semibold">Select candidate(s), role round, and dispatch live invitation</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-semibold">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          
          {/* Multi-Candidate Selection Box */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-700">Select Candidates ({selectedCandidateIds.length} selected)</label>
              {candidates.length > 0 && (
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-700"
                >
                  {selectedCandidateIds.length === candidates.length ? 'Deselect All' : 'Select All'}
                </button>
              )}
            </div>

            <div className="border border-slate-200 rounded-2xl p-3 max-h-40 overflow-y-auto space-y-2 bg-slate-50/50">
              {candidates.length === 0 ? (
                <p className="text-xs text-slate-400 py-3 text-center">
                  No candidates registered in database. Register candidate users first.
                </p>
              ) : (
                candidates.map((c) => {
                  const isSelected = selectedCandidateIds.includes(c.candidate_id);
                  return (
                    <div
                      key={c.candidate_id}
                      onClick={() => toggleCandidateSelect(c.candidate_id)}
                      className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all border ${
                        isSelected 
                          ? 'bg-indigo-50/80 border-indigo-200 text-indigo-950 font-bold' 
                          : 'bg-white border-slate-200/80 text-slate-700 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-indigo-600" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-400" />
                        )}
                        <div>
                          <p className="text-xs font-bold text-slate-900">{c.full_name}</p>
                          <p className="text-[11px] text-slate-500 font-medium">{c.target_role} · {c.email}</p>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">
                        {c.experience_level}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Round Type & Difficulty */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">Round Type</label>
              <select
                value={roundType}
                onChange={(e) => setRoundType(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                <option>Technical</option>
                <option>HR</option>
                <option>Behavioral</option>
                <option>Aptitude</option>
                <option>Coding</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">Difficulty Level</label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                <option>Easy</option>
                <option>Medium</option>
                <option>Hard</option>
              </select>
            </div>
          </div>

          {/* Date, Time & Duration */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">Date</label>
              <input
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                required
                className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">Time</label>
              <input
                type="time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                required
                className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">Duration</label>
              <select
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                <option value={15}>15 Mins</option>
                <option value={30}>30 Mins</option>
                <option value={45}>45 Mins</option>
                <option value={60}>60 Mins</option>
              </select>
            </div>
          </div>

          {/* Interview Instructions */}
          <div>
            <label className="text-xs font-bold text-slate-500 block mb-1">Interview Instructions for Candidate</label>
            <textarea
              rows={3}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              className="w-full p-3 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-900"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || candidates.length === 0}
              className="py-2.5 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-2 transition-all transform active:scale-95 disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              {isSubmitting ? 'Scheduling...' : `Send Invitation (${selectedCandidateIds.length})`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
