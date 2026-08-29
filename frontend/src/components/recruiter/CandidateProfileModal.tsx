import React, { useState, useEffect } from 'react';
import { X, User, Mail, Phone, Briefcase, FileText, Download, Star, CheckCircle, Save, Sparkles, Award } from 'lucide-react';
import api from '../../services/api';

interface CandidateProfileModalProps {
  candidateId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate?: () => void;
}

export const CandidateProfileModal: React.FC<CandidateProfileModalProps> = ({
  candidateId,
  isOpen,
  onClose,
  onUpdate
}) => {
  const [profile, setProfile] = useState<any>(null);
  const [status, setStatus] = useState<string>('Applied');
  const [rating, setRating] = useState<number>(4.5);
  const [notes, setNotes] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen && candidateId) {
      setLoading(true);
      api.get(`/recruiter/candidate/${candidateId}/full-profile`)
        .then((res) => {
          setProfile(res.data);
          setStatus(res.data.status || 'Applied');
          setRating(res.data.rating || 4.5);
          setNotes(res.data.recruiter_notes || '');
        })
        .catch((err) => console.warn('Fetch candidate profile error:', err))
        .finally(() => setLoading(false));
    }
  }, [isOpen, candidateId]);

  if (!isOpen || !candidateId) return null;

  const handleSaveNotes = async () => {
    setSaving(true);
    try {
      await api.post(`/recruiter/candidate/${candidateId}/notes`, {
        recruiter_notes: notes,
        rating: rating
      });
      await api.post(`/recruiter/candidate/${candidateId}/status`, {
        status: status
      });
      if (onUpdate) onUpdate();
      setSaving(false);
    } catch (err) {
      console.error('Save notes error:', err);
      setSaving(false);
    }
  };

  const formatBehavioralState = (raw: string | undefined | null) => {
    if (!raw) return 'Neutral';
    const lower = raw.toLowerCase().trim();
    const map: Record<string, string> = {
      'surprise': 'Confused',
      'surprised': 'Confused',
      'happy': 'Confident',
      'sad': 'Unconfident',
      'angry': 'Frustrated',
      'disgust': 'Confused',
      'fear': 'Fear',
      'focused': 'Focused',
      'confident': 'Confident',
      'unconfident': 'Unconfident',
      'confused': 'Confused',
      'frustrated': 'Frustrated',
      'looking away': 'Looking away',
      'neutral': 'Neutral'
    };
    return map[lower] || raw.charAt(0).toUpperCase() + raw.slice(1);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto space-y-6">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white font-black text-lg flex items-center justify-center shadow-md">
              {profile?.full_name?.substring(0, 2).toUpperCase() || 'SK'}
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900">{profile?.full_name || 'Loading Candidate...'}</h2>
              <p className="text-xs text-slate-500 font-semibold">{profile?.target_role} · {profile?.experience_level}</p>
            </div>
          </div>

          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-xl">
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="py-16 text-center text-slate-400 text-xs font-bold">
            Loading candidate details...
          </div>
        ) : (
          <div className="space-y-6">

            {/* Status & Rating Bar */}
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <label className="text-xs font-extrabold text-slate-700">Application Status:</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="px-3.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                >
                  <option>Applied</option>
                  <option>Screened</option>
                  <option>Scheduled</option>
                  <option>Interviewed</option>
                  <option>Shortlisted</option>
                  <option>Selected</option>
                  <option>On Hold</option>
                  <option>Rejected</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-extrabold text-slate-700">Recruiter Rating:</span>
                <div className="flex items-center gap-1 bg-amber-50 px-3 py-1 rounded-xl border border-amber-200 text-amber-700 font-black text-xs">
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                  {rating} / 5.0
                </div>
              </div>
            </div>

            {/* Contact & Overview Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-3">
                <Mail className="w-4 h-4 text-indigo-500" />
                <div>
                  <span className="text-[10px] font-bold text-slate-400 block">Email Address</span>
                  <span className="font-extrabold text-slate-800">{profile?.email || 'N/A'}</span>
                </div>
              </div>

              <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-3">
                <Phone className="w-4 h-4 text-indigo-500" />
                <div>
                  <span className="text-[10px] font-bold text-slate-400 block">Phone Number</span>
                  <span className="font-extrabold text-slate-800">{profile?.phone || 'N/A'}</span>
                </div>
              </div>

              <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-3">
                <Award className="w-4 h-4 text-purple-500" />
                <div>
                  <span className="text-[10px] font-bold text-slate-400 block">ATS Resume Match</span>
                  <span className="font-extrabold text-indigo-600 text-sm">
                    {profile?.ats_score !== null && profile?.ats_score !== undefined ? `${profile.ats_score}%` : 'Pending Match'}
                  </span>
                </div>
              </div>
            </div>

            {/* Resume Summary & Extracted Skills */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <FileText className="w-4 h-4 text-indigo-600" />
                  Resume Analysis & Extracted Skills
                </h4>
                {profile?.resume_url ? (
                  <a
                    href={profile.resume_url}
                    download
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download Resume PDF
                  </a>
                ) : (
                  <span className="text-xs text-slate-400 font-semibold">No Resume File</span>
                )}
              </div>

              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                {profile?.resume_summary}
              </p>

              <div className="pt-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase block mb-2">Verified Skill Stack</span>
                <div className="flex flex-wrap gap-2">
                  {profile?.skills && Object.keys(profile.skills).map((skill) => (
                    <span key={skill} className="px-3 py-1 rounded-lg bg-slate-100 text-slate-700 font-extrabold text-xs border border-slate-200/60">
                      {skill} ({profile.skills[skill]} pts)
                    </span>
                  ))}
                </div>
              </div>
            </div>

             {/* AI Multimodal Evaluation Breakdown (CRITICAL ISSUE 5) */}
            {profile?.latest_evaluation && (
              <div className="bg-slate-900 text-white rounded-2xl p-5 border border-slate-800 shadow-md space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div>
                    <h4 className="text-xs font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-indigo-400" />
                      AI Interview Evaluation & Performance Report
                    </h4>
                    <p className="text-[11px] text-slate-400 font-medium">{profile.latest_evaluation.session_title}</p>
                  </div>
                  <div className="px-3.5 py-1 bg-indigo-600/30 border border-indigo-500/40 rounded-full font-black text-sm text-indigo-300">
                    Overall Score: {profile.latest_evaluation.overall_score}%
                  </div>
                </div>

                {/* Score Breakdown Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">Technical</span>
                    <span className="text-lg font-black text-indigo-400">{profile.latest_evaluation.technical_score}%</span>
                  </div>
                  <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">Communication</span>
                    <span className="text-lg font-black text-indigo-400">{profile.latest_evaluation.communication_score}%</span>
                  </div>
                  <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">Confidence</span>
                    <span className="text-lg font-black text-purple-400">{profile.latest_evaluation.confidence_score}%</span>
                  </div>
                  <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">Professionalism</span>
                    <span className="text-lg font-black text-teal-400">{profile.latest_evaluation.professionalism_score}%</span>
                  </div>
                </div>

                {/* Strengths & Weaknesses */}
                {profile.latest_evaluation.strengths?.length > 0 && (
                  <div>
                    <span className="text-[10px] font-black text-indigo-400 uppercase tracking-wider block mb-1">Key Strengths</span>
                    <ul className="space-y-1 text-xs text-slate-300 list-disc list-inside">
                      {profile.latest_evaluation.strengths.map((str: string, i: number) => (
                        <li key={i}>{str}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Candidate Question & Answer Transcripts */}
            {profile?.qa_transcript?.length > 0 && (
              <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm space-y-3">
                <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <FileText className="w-4 h-4 text-indigo-600" />
                  Interview Q&A Transcripts ({profile.qa_transcript.length} Questions)
                </h4>
                <div className="space-y-3">
                  {profile.qa_transcript.map((qa: any, idx: number) => (
                    <div key={idx} className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1.5 text-xs">
                      <div className="font-extrabold text-indigo-600">Q{idx + 1}: {qa.question_text}</div>
                      <div className="text-slate-800 font-medium bg-white p-2.5 rounded-lg border border-slate-100">
                        "{qa.answer_transcript}"
                      </div>
                      <div className="flex gap-3 text-[10px] font-bold text-slate-400">
                        <span>Pace: {qa.speaking_pace_wpm} WPM</span>
                        <span>Eye Contact: {qa.eye_contact_percentage}%</span>
                        <span>Behavioral State: {formatBehavioralState(qa.dominant_emotion)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Internal Recruiter Notes & Evaluation Comments */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm space-y-3">
              <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-600" />
                Internal Recruiter Assessment Notes
              </h4>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add confidential notes on candidate strengths, cultural fit, salary expectations..."
                className="w-full p-3 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-800"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleSaveNotes}
                disabled={saving}
                className="py-2.5 px-6 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-2 transition-all transform active:scale-95 disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                {saving ? 'Saving...' : 'Save Candidate Assessment'}
              </button>
            </div>

          </div>
        )}

      </div>
    </div>
  );
};

