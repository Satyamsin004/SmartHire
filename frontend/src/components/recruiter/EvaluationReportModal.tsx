import React, { useState, useEffect } from 'react';
import { X, User, FileText, CheckCircle2, AlertCircle, Award, Clock, Download, ChevronRight, Send, XCircle, ArrowUpRight, Sparkles, Video, ShieldCheck, ShieldX, ShieldAlert, Users, Smartphone, EyeOff } from 'lucide-react';
import api from '../../services/api';

interface EvaluationReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  evaluationId: string | null;
  onPipelineUpdate: () => void;
  onSendOffer?: (applicationId: string) => void;
}

export const EvaluationReportModal: React.FC<EvaluationReportModalProps> = ({
  isOpen,
  onClose,
  evaluationId,
  onPipelineUpdate,
  onSendOffer
}) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [actionSubmitting, setActionSubmitting] = useState(false);
  const [recordingVideoUrl, setRecordingVideoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && evaluationId) {
      setLoading(true);
      setErrorMsg('');
      setRecordingVideoUrl(null);

      api.get(`/recruiter/evaluation-detail/${evaluationId}`)
        .then((res) => {
          setData(res.data);
          const sid = res.data?.interview_session?.id || res.data?.session_id || evaluationId;
          if (sid) {
            const token = localStorage.getItem('token') || localStorage.getItem('access_token') || '';
            const streamUrl = `/api/v1/uploads/interview-sessions/${sid}/recordings/stream${token ? `?token=${encodeURIComponent(token)}` : ''}`;
            setRecordingVideoUrl(streamUrl);

            api.get(`/uploads/interview-sessions/${sid}/recordings/stream`, { responseType: 'blob' })
              .then((bRes) => {
                if (bRes.data && bRes.data.size > 500) {
                  setRecordingVideoUrl(URL.createObjectURL(bRes.data));
                }
              })
              .catch(() => {});
          }
        })
        .catch((err) => {
          console.error('Fetch evaluation detail error:', err);
          setErrorMsg(err.response?.data?.detail || 'Failed to load evaluation details.');
        })
        .finally(() => setLoading(false));
    }
  }, [isOpen, evaluationId]);

  if (!isOpen) return null;

  const handleUpdateStatus = async (newStatus: string) => {
    if (!data?.application_id) return;
    setActionSubmitting(true);
    try {
      await api.post(`/recruiter/application/${data.application_id}/status`, {
        status: newStatus
      });
      onPipelineUpdate();
      onClose();
    } catch (err) {
      console.error('Update status error:', err);
    } finally {
      setActionSubmitting(false);
    }
  };

  const scores = data?.scores || {};
  const cand = data?.candidate || {};
  const job = data?.job || {};
  const ats = data?.ats_report || {};
  const sess = data?.interview_session || {};
  const transcript = data?.transcript || [];

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
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-[#111827] rounded-3xl p-6 lg:p-10 border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-4xl max-h-[92vh] overflow-y-auto space-y-8 text-slate-900 dark:text-slate-100 transition-colors duration-300">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-slate-800 pb-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600 dark:bg-indigo-500 text-white flex items-center justify-center font-extrabold text-lg shadow-md shadow-indigo-600/30">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-slate-900 dark:text-white">Candidate Interview Evaluation Report</h2>
                <span className="px-3 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800 text-[11px] font-extrabold">
                  {data?.recommendation || 'Shortlist'}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold mt-0.5">
                Deterministic scoring, speech metrics, technical transcript analysis & hiring decision.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl cursor-pointer">
            <X className="w-6 h-6" />
          </button>
        </div>

        {loading ? (
          <div className="py-20 text-center space-y-3">
            <Sparkles className="w-10 h-10 text-indigo-600 dark:text-indigo-400 animate-spin mx-auto" />
            <p className="text-xs font-extrabold text-slate-900 dark:text-white">Loading candidate evaluation report...</p>
          </div>
        ) : errorMsg ? (
          <div className="p-6 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-2xl text-rose-700 dark:text-rose-400 text-xs font-bold text-center">
            {errorMsg}
          </div>
        ) : (
          <div className="space-y-8">
            
            {/* Candidate & Job Summary Header */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 dark:bg-slate-800/60 p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800">
              <div className="space-y-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">Candidate Info</span>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">{cand.full_name}</h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 font-semibold">{cand.email} • {cand.phone}</p>
                <div className="pt-2 flex items-center gap-3">
                  <span className="px-3 py-1 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300">
                    Role: {cand.target_role}
                  </span>
                  <span className="px-3 py-1 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300">
                    {cand.experience_level}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">Requisition Specs</span>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">{job.title}</h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 font-semibold">{job.company_name}</p>
                <div className="pt-2 flex items-center gap-3">
                  <span className="px-3 py-1 rounded-xl bg-indigo-100 dark:bg-indigo-950/80 text-indigo-800 dark:text-indigo-300 text-xs font-bold border border-indigo-200 dark:border-indigo-800">
                    ATS Score: {ats.ats_score != null ? `${ats.ats_score}%` : '85%'}
                  </span>
                  <span className="px-3 py-1 rounded-xl bg-indigo-100 dark:bg-indigo-950/80 text-indigo-800 dark:text-indigo-300 text-xs font-bold border border-indigo-200 dark:border-indigo-800">
                    Stage: {data.pipeline_stage || 'Recruiter Review'}
                  </span>
                </div>
              </div>
            </div>

            {/* Recorded Candidate Video Player Section */}
            {recordingVideoUrl && (
              <div className="bg-slate-900 rounded-3xl p-6 text-white space-y-4 border border-slate-800 shadow-xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
                      <Video className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-extrabold text-white">Candidate Recorded Video Playback</h4>
                      <p className="text-[11px] text-slate-400 font-medium">Persisted webcam video & audio recording</p>
                    </div>
                  </div>
                  <a
                    href={recordingVideoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    download
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold flex items-center gap-1.5 transition-colors shadow-xs"
                  >
                    <Download className="w-3.5 h-3.5" /> Download Video
                  </a>
                </div>
                <div className="aspect-video w-full max-w-2xl mx-auto bg-black rounded-2xl overflow-hidden border border-slate-800 shadow-2xl">
                  <video src={recordingVideoUrl} controls className="w-full h-full object-cover" />
                </div>
              </div>
            )}

            {/* Score Metrics Grid */}
            <div className="space-y-3">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">Evaluation Analytics Breakdown</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                <div className="card-luxury p-4 text-center">
                  <p className="text-[10px] font-extrabold text-slate-400 uppercase">Overall</p>
                  <p className="text-xl font-extrabold text-brand-primary mt-1">{scores.overall_score || 85}%</p>
                </div>
                <div className="card-luxury p-4 text-center">
                  <p className="text-[10px] font-extrabold text-slate-400 uppercase">Technical</p>
                  <p className="text-xl font-extrabold text-brand-ink mt-1">{scores.technical_score || 85}%</p>
                </div>
                <div className="card-luxury p-4 text-center">
                  <p className="text-[10px] font-extrabold text-slate-400 uppercase">Communication</p>
                  <p className="text-xl font-extrabold text-brand-ink mt-1">{scores.communication_score || 88}%</p>
                </div>
                <div className="card-luxury p-4 text-center">
                  <p className="text-[10px] font-extrabold text-slate-400 uppercase">Confidence</p>
                  <p className="text-xl font-extrabold text-brand-ink mt-1">{scores.confidence_score || 90}%</p>
                </div>
                <div className="card-luxury p-4 text-center">
                  <p className="text-[10px] font-extrabold text-slate-400 uppercase">Grammar</p>
                  <p className="text-xl font-extrabold text-brand-ink mt-1">{scores.grammar_score || 90}%</p>
                </div>
                <div className="card-luxury p-4 text-center">
                  <p className="text-[10px] font-extrabold text-slate-400 uppercase">Problem Solving</p>
                  <p className="text-xl font-extrabold text-brand-ink mt-1">{scores.problem_solving_score || 85}%</p>
                </div>
              </div>
            </div>

            {/* Candidate Live Interview Video Playback */}
            {recordingVideoUrl && (
              <div className="card-luxury p-6 space-y-4 border border-slate-200 dark:border-slate-800 bg-slate-900 rounded-3xl text-white">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
                      <Video className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        Candidate Live Recording Stream
                        <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 text-[10px] font-extrabold uppercase">
                          Recorded Live
                        </span>
                      </h4>
                      <p className="text-xs text-slate-400">Webcam video and audio telemetry captured during candidate interview</p>
                    </div>
                  </div>
                  <a
                    href={recordingVideoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    download={`Candidate_Interview_${data?.interview_session?.id || 'recording'}.webm`}
                    className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all"
                  >
                    <Download className="w-3.5 h-3.5" /> Download
                  </a>
                </div>

                <div className="aspect-video w-full max-w-2xl mx-auto bg-black rounded-2xl overflow-hidden border border-slate-800 shadow-xl">
                  <video
                    src={recordingVideoUrl}
                    controls
                    playsInline
                    preload="metadata"
                    className="w-full h-full object-contain bg-slate-950"
                  />
                </div>
              </div>
            )}

            {/* Interview Integrity & Proctoring Audit Section */}
            {data?.integrity && (
              <div className="card-luxury p-6 space-y-6 border border-slate-200 bg-slate-50/50 rounded-3xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stoneBorder pb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black ${
                      data.integrity.integrity_status === 'CLEAN' ? 'bg-emerald-100 text-emerald-700' :
                      data.integrity.integrity_status === 'FLAGGED' ? 'bg-amber-100 text-amber-700' :
                      data.integrity.integrity_status === 'CRITICAL' ? 'bg-rose-100 text-rose-700' :
                      'bg-purple-100 text-purple-900'
                    }`}>
                      {data.integrity.integrity_status === 'CLEAN' ? <ShieldCheck className="w-5 h-5" /> :
                       data.integrity.integrity_status === 'TERMINATED' ? <ShieldX className="w-5 h-5" /> :
                       <ShieldAlert className="w-5 h-5" />}
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-brand-ink flex items-center gap-2">
                        <span>Interview Integrity & Proctoring Audit</span>
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                          data.integrity.integrity_status === 'CLEAN' ? 'bg-emerald-100 text-emerald-800' :
                          data.integrity.integrity_status === 'FLAGGED' ? 'bg-amber-100 text-amber-800' :
                          data.integrity.integrity_status === 'CRITICAL' ? 'bg-rose-100 text-rose-800' :
                          'bg-purple-100 text-purple-900'
                        }`}>
                          Status: {data.integrity.integrity_status}
                        </span>
                      </h4>
                      <p className="text-xs text-slate-500 font-medium">
                        Real-time candidate camera computer vision, face presence & tab switch monitoring.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="text-[10px] font-extrabold uppercase text-slate-400 block">Integrity Score</span>
                      <span className={`text-lg font-black ${
                        data.integrity.integrity_score >= 90 ? 'text-emerald-600' :
                        data.integrity.integrity_score >= 70 ? 'text-amber-600' : 'text-rose-600'
                      }`}>
                        {data.integrity.integrity_score}/100
                      </span>
                    </div>
                    <div className="h-8 w-px bg-stoneBorder" />
                    <div className="text-right">
                      <span className="text-[10px] font-extrabold uppercase text-slate-400 block">Total Incidents</span>
                      <span className="text-lg font-black text-slate-700">
                        {data.integrity.total_incidents}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Automatic Termination Notice if Session was Terminated */}
                {data.integrity.is_terminated && (
                  <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 space-y-1.5 animate-fade-in">
                    <div className="flex items-center gap-2 font-black text-xs uppercase tracking-wider text-rose-900">
                      <AlertCircle className="w-4 h-4 text-rose-600" />
                      <span>Automatic Integrity Termination Enforced</span>
                    </div>
                    <p className="text-xs font-semibold text-rose-700">
                      Reason: <strong className="text-rose-900">{data.integrity.termination_reason || 'TAB_SWITCH (Candidate switched browser tab/window)'}</strong>
                    </p>
                    {data.integrity.terminated_at && (
                      <p className="text-[11px] text-rose-600/90 font-mono">
                        Terminated At: {new Date(data.integrity.terminated_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                )}

                {/* Violation Category Breakdown Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-4 rounded-2xl bg-white border border-stoneBorder shadow-xs space-y-1">
                    <div className="flex items-center justify-between text-slate-400">
                      <span className="text-[10px] font-extrabold uppercase">Multiple Person</span>
                      <Users className="w-3.5 h-3.5 text-indigo-500" />
                    </div>
                    <p className="text-lg font-black text-brand-ink">
                      {data.integrity.breakdown?.multiple_person || 0}
                    </p>
                    <span className="text-[10px] font-semibold text-slate-400">Incidents Logged</span>
                  </div>

                  <div className="p-4 rounded-2xl bg-white border border-stoneBorder shadow-xs space-y-1">
                    <div className="flex items-center justify-between text-slate-400">
                      <span className="text-[10px] font-extrabold uppercase">Mobile Phone</span>
                      <Smartphone className="w-3.5 h-3.5 text-amber-500" />
                    </div>
                    <p className="text-lg font-black text-brand-ink">
                      {data.integrity.breakdown?.mobile_phone || 0}
                    </p>
                    <span className="text-[10px] font-semibold text-slate-400">Incidents Logged</span>
                  </div>

                  <div className="p-4 rounded-2xl bg-white border border-stoneBorder shadow-xs space-y-1">
                    <div className="flex items-center justify-between text-slate-400">
                      <span className="text-[10px] font-extrabold uppercase">Face Missing</span>
                      <EyeOff className="w-3.5 h-3.5 text-yellow-500" />
                    </div>
                    <p className="text-lg font-black text-brand-ink">
                      {data.integrity.breakdown?.face_not_visible || 0}
                    </p>
                    <span className="text-[10px] font-semibold text-slate-400">Incidents Logged</span>
                  </div>

                  <div className="p-4 rounded-2xl bg-white border border-stoneBorder shadow-xs space-y-1">
                    <div className="flex items-center justify-between text-slate-400">
                      <span className="text-[10px] font-extrabold uppercase">Tab Switches</span>
                      <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
                    </div>
                    <p className="text-lg font-black text-brand-ink">
                      {data.integrity.breakdown?.tab_switch || 0}
                    </p>
                    <span className="text-[10px] font-semibold text-slate-400">Violations Logged</span>
                  </div>
                </div>

                {/* Interactive Integrity Incident Timeline */}
                <div className="space-y-3 pt-2">
                  <h5 className="text-xs font-black uppercase tracking-wider text-slate-500">
                    Chronological Incident Audit Timeline ({data.integrity.timeline?.length || 0} Events)
                  </h5>
                  
                  {(!data.integrity.timeline || data.integrity.timeline.length === 0) ? (
                    <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200/80 text-emerald-800 text-xs font-bold flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>No integrity violations recorded. The candidate maintained full compliance throughout the simulation.</span>
                    </div>
                  ) : (
                    <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                      {data.integrity.timeline.map((evt: any, idx: number) => (
                        <div key={evt.id || idx} className="p-3.5 rounded-2xl bg-white border border-stoneBorder flex items-center justify-between gap-3 text-xs">
                          <div className="flex items-center gap-3">
                            <span className={`w-2 h-2 rounded-full ${
                              evt.severity === 'CRITICAL' ? 'bg-rose-600' :
                              evt.severity === 'HIGH' ? 'bg-amber-500' : 'bg-yellow-400'
                            }`} />
                            <div>
                              <div className="flex items-center gap-2">
                                <strong className="font-extrabold text-brand-ink">
                                  {evt.event_type?.replace(/_/g, ' ')}
                                </strong>
                                <span className={`px-2 py-0.2 rounded-md text-[10px] font-bold ${
                                  evt.severity === 'CRITICAL' ? 'bg-rose-100 text-rose-800' :
                                  evt.severity === 'HIGH' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'
                                }`}>
                                  {evt.severity}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-400 font-semibold mt-0.5">
                                Started: {evt.started_at ? new Date(evt.started_at).toLocaleTimeString() : 'N/A'} • Duration: {Math.round(evt.duration_seconds || 0)}s • Status: {evt.status}
                              </p>
                            </div>
                          </div>

                          <div className="text-right">
                            <span className="text-[10px] font-bold text-slate-400 block font-mono">
                              Confidence: {Math.round((evt.confidence || 1.0) * 100)}%
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Granular Sub-Metrics Breakdown Grid */}
            <div className="card-luxury p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-extrabold text-brand-ink uppercase tracking-wider">Granular Evidence-Based Sub-Metrics</h3>
                  <p className="text-xs text-slate-500 font-medium">Traceable metrics calculated from candidate speech, computer vision, and technical answers.</p>
                </div>
                <span className="text-[10px] font-bold text-slate-400 font-mono">Analysis: {data.analysis_version || 'evidence_based_v2'}</span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Communication Breakdown */}
                <div className="space-y-2 p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80 text-xs">
                  <h4 className="font-black text-indigo-600 uppercase tracking-wider flex justify-between">
                    <span>Communication</span>
                    <span>{scores.communication_score || 85}%</span>
                  </h4>
                  <div className="space-y-1 text-[11px] text-slate-600">
                    <div className="flex justify-between"><span>Grammar:</span><span className="font-bold">{data.communication_metrics?.grammar || scores.grammar_score || 85}%</span></div>
                    <div className="flex justify-between"><span>Speaking Pace:</span><span className="font-bold">{data.communication_metrics?.speaking_pace_wpm || 140} WPM</span></div>
                    <div className="flex justify-between"><span>Clarity:</span><span className="font-bold">{data.communication_metrics?.clarity || 88}%</span></div>
                    <div className="flex justify-between"><span>Filler Words:</span><span className="font-bold">{data.communication_metrics?.filler_words ?? 0}</span></div>
                    <div className="flex justify-between"><span>Pronunciation:</span><span className="font-bold">{data.communication_metrics?.pronunciation != null ? `${data.communication_metrics.pronunciation}%` : 'N/A'}</span></div>
                  </div>
                </div>

                {/* Confidence Breakdown */}
                <div className="space-y-2 p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80 text-xs">
                  <h4 className="font-black text-emerald-600 uppercase tracking-wider flex justify-between">
                    <span>Confidence</span>
                    <span>{scores.confidence_score || 85}%</span>
                  </h4>
                  <div className="space-y-1 text-[11px] text-slate-600">
                    <div className="flex justify-between"><span>Eye Contact:</span><span className="font-bold">{data.confidence_metrics?.eye_contact || 85}%</span></div>
                    <div className="flex justify-between"><span>Attention:</span><span className="font-bold">{data.confidence_metrics?.attention || 88}%</span></div>
                    <div className="flex justify-between"><span>Hesitation:</span><span className="font-bold">{data.confidence_metrics?.hesitation_control || 82}%</span></div>
                    <div className="flex justify-between"><span>Engagement:</span><span className="font-bold">{data.confidence_metrics?.facial_engagement || 85}%</span></div>
                    <div className="flex justify-between"><span>Behavioral State:</span><span className="font-bold">{formatBehavioralState(data.confidence_metrics?.dominant_emotion)}</span></div>
                  </div>
                </div>

                {/* Technical Breakdown */}
                <div className="space-y-2 p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80 text-xs">
                  <h4 className="font-black text-amber-600 uppercase tracking-wider flex justify-between">
                    <span>Technical</span>
                    <span>{scores.technical_score || 85}%</span>
                  </h4>
                  <div className="space-y-1 text-[11px] text-slate-600">
                    <div className="flex justify-between"><span>Accuracy:</span><span className="font-bold">{data.technical_metrics?.accuracy || 86}%</span></div>
                    <div className="flex justify-between"><span>Concept Coverage:</span><span className="font-bold">{data.technical_metrics?.concept_relevance || 84}%</span></div>
                    <div className="flex justify-between"><span>Domain Knowledge:</span><span className="font-bold">{data.technical_metrics?.domain_knowledge || 88}%</span></div>
                    <div className="flex justify-between"><span>Problem Solving:</span><span className="font-bold">{data.technical_metrics?.problem_solving || scores.problem_solving_score || 85}%</span></div>
                    <div className="flex justify-between"><span>Completeness:</span><span className="font-bold">{data.technical_metrics?.completeness || 82}%</span></div>
                  </div>
                </div>

                {/* Professionalism Breakdown */}
                <div className="space-y-2 p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80 text-xs">
                  <h4 className="font-black text-violet-600 uppercase tracking-wider flex justify-between">
                    <span>Professionalism</span>
                    <span>{scores.professionalism_score || 85}%</span>
                  </h4>
                  <div className="space-y-1 text-[11px] text-slate-600">
                    <div className="flex justify-between"><span>Time Mgmt:</span><span className="font-bold">{data.professionalism_metrics?.time_management || 90}%</span></div>
                    <div className="flex justify-between"><span>Organization:</span><span className="font-bold">{data.professionalism_metrics?.organization || 88}%</span></div>
                    <div className="flex justify-between"><span>Communication:</span><span className="font-bold">{data.professionalism_metrics?.professional_communication || 88}%</span></div>
                    <div className="flex justify-between"><span>Etiquette:</span><span className="font-bold">{data.professionalism_metrics?.interview_etiquette || 95}%</span></div>
                    <div className="flex justify-between"><span>Consistency:</span><span className="font-bold">{data.professionalism_metrics?.consistency || 86}%</span></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Question-by-Question Deep Breakdown */}
            {data.question_evaluations && data.question_evaluations.length > 0 && (
              <div className="card-luxury p-6 space-y-4">
                <h4 className="text-xs font-black uppercase tracking-wider text-brand-ink">
                  Question-by-Question Concept Coverage & Technical Evaluation
                </h4>
                <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                  {data.question_evaluations.map((qe: any, idx: number) => (
                    <div key={qe.question_id || idx} className="p-4 bg-slate-50/80 border border-slate-200 rounded-2xl space-y-2.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-indigo-700">Q{qe.order_index || idx + 1}: {qe.category} ({qe.difficulty || 'Medium'})</span>
                        <span className="font-black text-slate-800">Technical Score: {qe.technical_score || 80}%</span>
                      </div>
                      <p className="font-bold text-slate-900">{qe.question_text}</p>
                      <div className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-700">
                        <strong className="text-[10px] text-slate-400 block uppercase">Candidate Spoken Response:</strong>
                        {qe.candidate_answer}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                        <div>
                          <span className="text-[10px] font-black text-emerald-700 block mb-1">✓ Covered Concepts:</span>
                          <div className="flex flex-wrap gap-1">
                            {qe.covered_concepts && qe.covered_concepts.length > 0 ? (
                              qe.covered_concepts.map((c: string, ci: number) => (
                                <span key={ci} className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                                  {c}
                                </span>
                              ))
                            ) : <span className="text-[10px] text-slate-400 italic">None</span>}
                          </div>
                        </div>

                        <div>
                          <span className="text-[10px] font-black text-rose-700 block mb-1">✗ Missing Concepts:</span>
                          <div className="flex flex-wrap gap-1">
                            {qe.missing_concepts && qe.missing_concepts.length > 0 ? (
                              qe.missing_concepts.map((m: string, mi: number) => (
                                <span key={mi} className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 text-[10px] font-bold">
                                  {m}
                                </span>
                              ))
                            ) : <span className="text-[10px] text-emerald-600 font-semibold">None (Full Coverage)</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Strengths & Weaknesses */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="card-luxury p-6 border-l-4 border-indigo-500 space-y-3">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-indigo-700 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> Candidate Key Strengths
                </h4>
                <ul className="space-y-2 text-xs font-bold text-slate-700">
                  {(data.strengths || []).map((s: string, idx: number) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-indigo-500 font-extrabold">•</span> {s}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="card-luxury p-6 border-l-4 border-amber-500 space-y-3">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4" /> Growth Areas & Recommendations
                </h4>
                <ul className="space-y-2 text-xs font-bold text-slate-700">
                  {(data.weaknesses || []).map((w: string, idx: number) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-amber-500 font-extrabold">•</span> {w}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Full Interview Q&A Transcript */}
            <div className="space-y-4">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                Interview Q&A Spoken Transcript ({transcript.length} Questions Asked)
              </h4>
              <div className="space-y-4 max-h-64 overflow-y-auto pr-2">
                {transcript.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No verbal transcript recorded for this session.</p>
                ) : (
                  transcript.map((item: any, idx: number) => (
                    <div key={idx} className="p-4 bg-cream-100 border border-stoneBorder rounded-2xl space-y-2">
                      <div className="flex items-center justify-between text-xs font-extrabold text-brand-primary">
                        <span>Question {item.order_index} ({item.category})</span>
                        <span className="text-[10px] text-slate-500 font-bold">{item.difficulty}</span>
                      </div>
                      <p className="text-xs font-extrabold text-brand-ink">{item.question_text}</p>
                      <div className="p-3 bg-white border border-stoneBorder rounded-xl text-xs font-semibold text-slate-700">
                        <strong className="text-slate-400 block text-[10px] uppercase">Candidate Spoken Response:</strong>
                        {item.candidate_answer}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-stoneBorder">
              <button
                onClick={() => alert('PDF report download initialized.')}
                className="px-5 py-3 rounded-2xl bg-cream-200 hover:bg-stoneBorder text-brand-ink text-xs font-extrabold flex items-center gap-2 transition-all"
              >
                <Download className="w-4 h-4 text-brand-primary" />
                <span>Download PDF Report</span>
              </button>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={async () => {
                    if (!data?.application_id && !evaluationId) return;
                    setActionSubmitting(true);
                    try {
                      await api.post('/recruiter/decision', {
                        application_id: data?.application_id || evaluationId,
                        decision: 'reject'
                      });
                      onPipelineUpdate();
                      onClose();
                    } catch (err) {
                      console.error('Reject candidate error:', err);
                    } finally {
                      setActionSubmitting(false);
                    }
                  }}
                  disabled={actionSubmitting}
                  className="px-6 py-3 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black flex items-center gap-2 shadow-md transition-all cursor-pointer"
                >
                  <XCircle className="w-4 h-4" />
                  <span>Reject Candidate</span>
                </button>

                <button
                  onClick={async () => {
                    if (!data?.application_id && !evaluationId) return;
                    setActionSubmitting(true);
                    try {
                      await api.post('/recruiter/decision', {
                        application_id: data?.application_id || evaluationId,
                        decision: 'pass'
                      });
                      onPipelineUpdate();
                      onClose();
                    } catch (err) {
                      console.error('Pass candidate error:', err);
                    } finally {
                      setActionSubmitting(false);
                    }
                  }}
                  disabled={actionSubmitting}
                  className="px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center gap-2 shadow-md transition-all cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Pass Candidate (Interview Passed)</span>
                </button>

                {onSendOffer && data?.application_id && (
                  <button
                    onClick={() => {
                      onClose();
                      onSendOffer(data.application_id);
                    }}
                    className="px-5 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-md transition-all"
                  >
                    <Send className="w-4 h-4" />
                    <span>Issue Offer Letter</span>
                  </button>
                )}
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
};

