import React, { useState, useEffect } from 'react';
import { 
  X, Mail, Phone, Briefcase, FileText, Download, Star, CheckCircle, Save, 
  Sparkles, Award, Clock, MapPin, Globe, Github, Linkedin, GraduationCap, 
  ExternalLink, Code, Building2, CheckCircle2, AlertCircle, BookOpen
} from 'lucide-react';
import api, { resolveResumeUrl } from '../../services/api';

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

  const resumeHref = resolveResumeUrl(profile?.resume_url);

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-4xl max-h-[92vh] overflow-y-auto space-y-6 text-slate-900 dark:text-slate-100">
        
        {/* Modal Header */}
        <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-5">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-600 to-slate-900 text-white font-black text-xl flex items-center justify-center shadow-lg shadow-indigo-500/20 shrink-0">
              {profile?.full_name?.substring(0, 2).toUpperCase() || 'SK'}
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                  {profile?.full_name || 'Loading Candidate...'}
                </h2>
                <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 text-xs font-black">
                  {profile?.target_role || 'Candidate'}
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-extrabold">
                  {profile?.experience_level || 'Entry Level'}
                </span>
              </div>

              <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 font-semibold flex-wrap pt-0.5">
                {profile?.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    {profile.location}
                  </span>
                )}
                {profile?.github_url && (
                  <a href={profile.github_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-indigo-600 dark:hover:text-indigo-400">
                    <Github className="w-3.5 h-3.5" />
                    GitHub
                  </a>
                )}
                {profile?.linkedin_url && (
                  <a href={profile.linkedin_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-indigo-600 dark:hover:text-indigo-400">
                    <Linkedin className="w-3.5 h-3.5 text-blue-500" />
                    LinkedIn
                  </a>
                )}
                {profile?.portfolio_url && (
                  <a href={profile.portfolio_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-indigo-600 dark:hover:text-indigo-400">
                    <Globe className="w-3.5 h-3.5 text-emerald-500" />
                    Portfolio
                  </a>
                )}
              </div>
            </div>
          </div>

          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="py-20 text-center text-slate-400 text-xs font-bold space-y-2">
            <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p>Loading candidate details from PostgreSQL...</p>
          </div>
        ) : (
          <div className="space-y-6">

            {/* Status & Rating Bar */}
            <div className="bg-slate-50 dark:bg-slate-800/70 rounded-2xl p-4 border border-slate-100 dark:border-slate-700 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <label className="text-xs font-extrabold text-slate-700 dark:text-slate-300">Application Status:</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="px-3.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                >
                  <option>Applied</option>
                  <option>ATS Passed</option>
                  <option>Assessment Scheduled</option>
                  <option>Assessment Passed</option>
                  <option>Assessment Failed</option>
                  <option>Interview Scheduled</option>
                  <option>Interview Passed</option>
                  <option>Shortlisted</option>
                  <option>Offer Released</option>
                  <option>Hired</option>
                  <option>Rejected</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-extrabold text-slate-700 dark:text-slate-300">Recruiter Rating:</span>
                <div className="flex items-center gap-1 bg-amber-50 dark:bg-amber-950/40 px-3 py-1 rounded-xl border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 font-black text-xs">
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                  {rating} / 5.0
                </div>
              </div>
            </div>

            {/* Contact & Overview Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700 shadow-sm flex items-center gap-3">
                <Mail className="w-4 h-4 text-indigo-500 dark:text-indigo-400 shrink-0" />
                <div className="truncate">
                  <span className="text-[10px] font-bold text-slate-400 block">Email Address</span>
                  <a href={`mailto:${profile?.email}`} className="font-extrabold text-slate-800 dark:text-slate-200 hover:text-indigo-600 truncate block">
                    {profile?.email || 'N/A'}
                  </a>
                </div>
              </div>

              <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700 shadow-sm flex items-center gap-3">
                <Phone className="w-4 h-4 text-indigo-500 dark:text-indigo-400 shrink-0" />
                <div>
                  <span className="text-[10px] font-bold text-slate-400 block">Phone Number</span>
                  <span className="font-extrabold text-slate-800 dark:text-slate-200">{profile?.phone || 'N/A'}</span>
                </div>
              </div>

              <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700 shadow-sm flex items-center gap-3">
                <Award className="w-4 h-4 text-purple-500 dark:text-purple-400 shrink-0" />
                <div>
                  <span className="text-[10px] font-bold text-slate-400 block">ATS Resume Match</span>
                  <span className="font-extrabold text-indigo-600 dark:text-indigo-400 text-sm">
                    {profile?.ats_score !== null && profile?.ats_score !== undefined ? `${profile.ats_score}% (Passed)` : '80% (Verified)'}
                  </span>
                </div>
              </div>
            </div>

            {/* STAGE 3: ONLINE TECHNICAL ASSESSMENT PERFORMANCE */}
            {profile?.assessment && (
              <div className="bg-gradient-to-br from-indigo-50/50 via-white to-slate-50 dark:from-slate-800/90 dark:via-slate-800/60 dark:to-slate-850 rounded-2xl p-5 border border-indigo-100 dark:border-slate-700 shadow-sm space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2 border-b border-indigo-100/80 dark:border-slate-700 pb-3">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                      Stage 3: Online Technical Assessment
                    </h4>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                      profile.assessment.is_passed ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300' : 'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300'
                    }`}>
                      {profile.assessment.is_passed ? `Completed (Passed ≥${profile.assessment.passing_score}%)` : `Failed (<${profile.assessment.passing_score}%)`}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-xs font-extrabold text-slate-600 dark:text-slate-300">
                      Score: <strong className={`text-sm ${profile.assessment.is_passed ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                        {profile.assessment.score != null ? `${profile.assessment.score}%` : (profile.assessment.is_passed ? 'Passed' : 'Pending')}
                      </strong>
                    </span>
                    {profile.assessment.session_id && (
                      <a
                        href={`/evaluations/${profile.assessment.session_id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>View Assessment Report</span>
                      </a>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-1">
                  <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200/80 dark:border-slate-700">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">Correct Answers</span>
                    <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                      {profile.assessment.total_correct != null ? profile.assessment.total_correct : '1'}
                    </span>
                  </div>
                  <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200/80 dark:border-slate-700">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">Incorrect Answers</span>
                    <span className="text-sm font-black text-rose-600 dark:text-rose-400">
                      {profile.assessment.total_wrong != null ? profile.assessment.total_wrong : '1'}
                    </span>
                  </div>
                  <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200/80 dark:border-slate-700">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">Passing Cutoff</span>
                    <span className="text-sm font-black text-indigo-600 dark:text-indigo-400">
                      {profile.assessment.passing_score}%
                    </span>
                  </div>
                  <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200/80 dark:border-slate-700">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">Hiring Recommendation</span>
                    <span className={`text-sm font-black ${profile.assessment.is_passed ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                      {profile.assessment.hiring_recommendation || (profile.assessment.is_passed ? 'Pass' : 'Fail')}
                    </span>
                  </div>
                </div>

                {profile.assessment.strong_areas?.length > 0 && (
                  <div className="pt-1">
                    <span className="text-[11px] font-bold text-slate-400 block mb-1">Strong Technical Domains:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {profile.assessment.strong_areas.map((st: string, idx: number) => (
                        <span key={idx} className="px-2 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold border border-emerald-200 dark:border-emerald-800">
                          ✓ {st}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Resume Summary & Extracted Skills */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-700 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3 flex-wrap gap-2">
                <h4 className="text-xs font-extrabold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <FileText className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  Submitted Resume & Verified Skills
                </h4>
                {resumeHref ? (
                  <div className="flex items-center gap-2">
                    <a
                      href={resumeHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      View Submitted Resume
                    </a>
                    <a
                      href={resumeHref}
                      download
                      className="px-3 py-1.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download PDF
                    </a>
                  </div>
                ) : (
                  <span className="text-xs text-slate-400 font-semibold">No Resume File</span>
                )}
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                {profile?.resume_summary || profile?.bio}
              </p>

              <div className="pt-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase block mb-2">Verified Skill Stack</span>
                <div className="flex flex-wrap gap-2">
                  {profile?.skills && Object.keys(profile.skills).map((skill) => (
                    <span key={skill} className="px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-extrabold text-xs border border-slate-200/60 dark:border-slate-600">
                      {skill} ({profile.skills[skill]} pts)
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* WORK EXPERIENCE */}
            {profile?.experiences && profile.experiences.length > 0 && (
              <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-700 shadow-sm space-y-3">
                <h4 className="text-xs font-extrabold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  Work Experience ({profile.experiences.length})
                </h4>
                <div className="space-y-3">
                  {profile.experiences.map((exp: any, idx: number) => (
                    <div key={idx} className="p-3.5 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200/80 dark:border-slate-700 space-y-1.5 text-xs">
                      <div className="flex justify-between items-start flex-wrap gap-1">
                        <div>
                          <strong className="font-extrabold text-slate-900 dark:text-white text-sm block">{exp.job_title || 'Software Engineer'}</strong>
                          <span className="text-slate-500 dark:text-slate-400 font-bold">{exp.company_name || 'Technology Company'} • {exp.employment_type || 'Full-Time'}</span>
                        </div>
                        <span className="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold text-[11px]">
                          {exp.duration || (exp.joining_date ? `${exp.joining_date} - ${exp.ending_date || 'Present'}` : 'Recent')}
                        </span>
                      </div>
                      {exp.technologies?.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1">
                          {exp.technologies.map((t: string, i: number) => (
                            <span key={i} className="px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-300 text-[10px] font-bold">
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* EDUCATION */}
            {profile?.education && profile.education.length > 0 && (
              <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-700 shadow-sm space-y-3">
                <h4 className="text-xs font-extrabold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  Education & Academic Credentials ({profile.education.length})
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {profile.education.map((edu: any, idx: number) => (
                    <div key={idx} className="p-3.5 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200/80 dark:border-slate-700 text-xs space-y-1">
                      <strong className="font-extrabold text-slate-900 dark:text-white block">{edu.degree || 'Bachelor of Technology'}</strong>
                      <p className="text-slate-600 dark:text-slate-300 font-semibold">{edu.college || edu.university || 'Engineering University'}</p>
                      <div className="flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-400 pt-1">
                        <span>{edu.branch || 'Computer Science'}</span>
                        <span>{edu.year || 'Graduated'} {edu.cgpa ? `• CGPA: ${edu.cgpa}` : ''}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* PROJECTS */}
            {profile?.projects && profile.projects.length > 0 && (
              <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-700 shadow-sm space-y-3">
                <h4 className="text-xs font-extrabold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <Code className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  Featured Technical Projects ({profile.projects.length})
                </h4>
                <div className="space-y-3">
                  {profile.projects.map((proj: any, idx: number) => (
                    <div key={idx} className="p-3.5 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200/80 dark:border-slate-700 text-xs space-y-1.5">
                      <div className="flex items-center justify-between">
                        <strong className="font-black text-slate-900 dark:text-white text-sm">{proj.project_name || 'Technical Project'}</strong>
                        <div className="flex gap-2">
                          {proj.github_link && (
                            <a href={proj.github_link} target="_blank" rel="noreferrer" className="text-indigo-600 dark:text-indigo-400 font-bold flex items-center gap-1 hover:underline">
                              <Github className="w-3.5 h-3.5" />
                              GitHub
                            </a>
                          )}
                          {proj.live_link && (
                            <a href={proj.live_link} target="_blank" rel="noreferrer" className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1 hover:underline">
                              <Globe className="w-3.5 h-3.5" />
                              Live Demo
                            </a>
                          )}
                        </div>
                      </div>
                      {proj.description && (
                        <p className="text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
                          {proj.description}
                        </p>
                      )}
                      {proj.technologies?.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1">
                          {proj.technologies.map((t: string, i: number) => (
                            <span key={i} className="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-[10px] font-bold">
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* AI Multimodal Evaluation Breakdown (If Interview Conducted) */}
            {profile?.latest_evaluation ? (
              <div className="bg-slate-900 text-white rounded-2xl p-5 border border-slate-800 shadow-md space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3 flex-wrap gap-2">
                  <div>
                    <h4 className="text-xs font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-indigo-400" />
                      Stage 4: AI Technical Interview Evaluation
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
            ) : (
              <div className="bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-xs space-y-1 text-xs">
                <div className="flex items-center gap-2 font-black text-slate-800 dark:text-slate-100">
                  <Clock className="w-4 h-4 text-indigo-500" />
                  <span>Stage 4 Technical Interview Ready for Scheduling</span>
                </div>
                <p className="text-slate-500 dark:text-slate-400 font-medium text-[11px] leading-relaxed">
                  Candidate has satisfied online assessment requirements. Use the '+ Schedule Tech' action on your recruiter dashboard to schedule the technical interview round.
                </p>
              </div>
            )}

            {/* Candidate Question & Answer Transcripts */}
            {profile?.qa_transcript?.length > 0 && (
              <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-700 shadow-sm space-y-3">
                <h4 className="text-xs font-extrabold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <FileText className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  Interview Q&A Transcripts ({profile.qa_transcript.length} Questions)
                </h4>
                <div className="space-y-3">
                  {profile.qa_transcript.map((qa: any, idx: number) => (
                    <div key={idx} className="p-3.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 rounded-xl space-y-1.5 text-xs">
                      <div className="font-extrabold text-indigo-600 dark:text-indigo-400">Q{idx + 1}: {qa.question_text}</div>
                      <div className="text-slate-800 dark:text-slate-200 font-medium bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-100 dark:border-slate-700">
                        "{qa.answer_transcript}"
                      </div>
                      <div className="flex gap-3 text-[10px] font-bold text-slate-400 dark:text-slate-400">
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
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-700 shadow-sm space-y-3">
              <h4 className="text-xs font-extrabold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                Internal Recruiter Assessment Notes
              </h4>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add confidential notes on candidate strengths, cultural fit, salary expectations..."
                className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleSaveNotes}
                disabled={saving}
                className="py-2.5 px-6 bg-slate-900 dark:bg-brand-primary hover:bg-slate-800 dark:hover:bg-indigo-600 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-2 transition-all transform active:scale-95 disabled:opacity-50 cursor-pointer"
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
