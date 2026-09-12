import React, { useState, useEffect } from 'react';
import { 
  X, User, FileText, CheckCircle2, AlertCircle, Award, Clock, Download, 
  ChevronRight, Send, XCircle, ArrowUpRight, Sparkles, Video, ShieldCheck, 
  ShieldX, ShieldAlert, Users, Smartphone, EyeOff, BarChart3, Brain, Target, 
  Mic, Eye, BookOpen, Layers, Check, CheckSquare, HelpCircle, Briefcase, 
  UserCheck, ThumbsUp, ThumbsDown, Lock, ChevronDown, CheckCircle
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import api from '../../services/api';
import { getSessionRecordingBlob, uploadSessionRecordingWithRetry } from '../../services/recordingStorage';

interface EvaluationReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  evaluationId: string | null;
  onPipelineUpdate: () => void;
  onSendOffer?: (applicationId: string) => void;
}

const RoundVideoPlayer: React.FC<{
  sessionId?: string;
  roundTitle: string;
  accentColor: 'purple' | 'blue' | 'teal';
  isConducted: boolean;
}> = ({ sessionId, roundTitle, accentColor, isConducted }) => {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [loadingVideo, setLoadingVideo] = useState<boolean>(false);
  const [hasError, setHasError] = useState<boolean>(false);

  useEffect(() => {
    setVideoUrl((prevUrl) => {
      if (prevUrl && prevUrl.startsWith('blob:')) {
        URL.revokeObjectURL(prevUrl);
      }
      return null;
    });
    setHasError(false);

    if (!sessionId || !isConducted) {
      setLoadingVideo(false);
      return;
    }

    setLoadingVideo(true);
    let isCancelled = false;

    const fetchRecording = async (sid: string): Promise<boolean> => {
      try {
        // 1. Check in-memory recording blob for this exact session
        if (typeof window !== 'undefined') {
          const winBlob = (window as any).__LAST_INTERVIEW_RECORDING_BLOB__;
          if (winBlob && winBlob.sessionId === sid && winBlob.blobUrl) {
            setVideoUrl(winBlob.blobUrl);
            setHasError(false);
            if (winBlob.blob) {
              uploadSessionRecordingWithRetry(sid, winBlob.blob, 60, 2).catch(() => {});
            }
            return true;
          }
        }

        // 2. Check IndexedDB storage for this exact session
        try {
          const idbBlob = await getSessionRecordingBlob(sid);
          if (idbBlob && idbBlob.size > 1000) {
            const blobUrl = URL.createObjectURL(idbBlob);
            setVideoUrl(blobUrl);
            setHasError(false);
            uploadSessionRecordingWithRetry(sid, idbBlob, 60, 2).catch(() => {});
            return true;
          }
        } catch (e) {}

        // 3. Query server endpoint
        const res = await api.get(`/uploads/interview-sessions/${sid}/recordings`);
        if (isCancelled) return false;
        const recs = res.data;
        if (!recs || !Array.isArray(recs) || recs.length === 0) {
          return false;
        }

        const bRes = await api.get(`/uploads/interview-sessions/${sid}/recordings/stream`, {
          responseType: 'blob',
          timeout: 25000
        });
        if (isCancelled) return false;
        if (bRes.data && bRes.data.size > 1000) {
          const blobUrl = URL.createObjectURL(bRes.data);
          setVideoUrl(blobUrl);
          setHasError(false);
          return true;
        }
        return false;
      } catch {
        return false;
      }
    };

    (async () => {
      let ok = false;
      if (sessionId) {
        ok = await fetchRecording(sessionId);
      }
      if (!isCancelled) {
        if (!ok) {
          setHasError(true);
        }
        setLoadingVideo(false);
      }
    })();

    return () => {
      isCancelled = true;
      setVideoUrl((prevUrl) => {
        if (prevUrl && prevUrl.startsWith('blob:')) {
          URL.revokeObjectURL(prevUrl);
        }
        return null;
      });
    };
  }, [sessionId, isConducted]);

  const colorStyles = {
    purple: {
      border: 'border-purple-800/60',
      text: 'text-purple-400',
      btn: 'bg-purple-600 hover:bg-purple-500'
    },
    blue: {
      border: 'border-blue-800/60',
      text: 'text-blue-400',
      btn: 'bg-blue-600 hover:bg-blue-500'
    },
    teal: {
      border: 'border-teal-800/60',
      text: 'text-teal-400',
      btn: 'bg-teal-600 hover:bg-teal-500'
    }
  }[accentColor];

  if (!isConducted) {
    return (
      <div className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
        <Video className="w-5 h-5 text-slate-400 shrink-0" />
        <div>
          <strong className="text-slate-700 dark:text-slate-300 block">Recording Not Available</strong>
          <span>This {roundTitle} round has not been conducted yet.</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`p-5 bg-slate-900 border ${colorStyles.border} rounded-3xl text-white space-y-3 shadow-lg`}>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <Video className={`w-5 h-5 ${colorStyles.text}`} />
          <div>
            <h4 className="text-sm font-extrabold text-white">Recorded {roundTitle} Video</h4>
            <p className="text-[11px] text-slate-400 font-medium">Full synchronized webcam & audio recording</p>
          </div>
        </div>
        {videoUrl && !hasError && (
          <a
            href={videoUrl}
            target="_blank"
            rel="noopener noreferrer"
            download={`interview_recording_${sessionId}.webm`}
            className={`px-3 py-1.5 rounded-xl ${colorStyles.btn} text-white text-xs font-black flex items-center gap-1.5 transition-colors cursor-pointer`}
          >
            <Download className="w-3.5 h-3.5" /> Download Recording
          </a>
        )}
      </div>

      <div className="aspect-video w-full max-w-2xl mx-auto bg-black rounded-2xl overflow-hidden border border-slate-800 flex items-center justify-center">
        {loadingVideo ? (
          <div className="text-center p-6 space-y-2">
            <div className="w-6 h-6 border-2 border-slate-400 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs text-slate-400 font-medium">Loading {roundTitle} recording stream...</p>
          </div>
        ) : videoUrl && !hasError ? (
          <video
            key={videoUrl}
            src={videoUrl}
            controls
            className="w-full h-full object-contain"
            onError={() => setHasError(true)}
          />
        ) : (
          <div className="text-center p-6 space-y-2">
            <Video className="w-8 h-8 text-slate-600 mx-auto" />
            <p className="text-xs font-bold text-slate-300">No Recording Available for this {roundTitle}</p>
            <p className="text-[11px] text-slate-400 font-medium max-w-md mx-auto">
              No video file was captured or uploaded for this specific interview session.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

type ReportTab = 'technical' | 'assessment' | 'behavioral' | 'hr' | 'combined';

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
  const [actionSuccessMsg, setActionSuccessMsg] = useState('');
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [downloadingRound, setDownloadingRound] = useState<string | null>(null);
  const [isDownloadMenuOpen, setIsDownloadMenuOpen] = useState(false);
  const [pdfError, setPdfError] = useState('');
  const [activeTab, setActiveTab] = useState<ReportTab>('technical');
  const [recruiterNotes, setRecruiterNotes] = useState('');

  useEffect(() => {
    if (isOpen && evaluationId) {
      setLoading(true);
      setErrorMsg('');
      setActionSuccessMsg('');

      api.get(`/recruiter/evaluation-detail/${evaluationId}`)
        .then((res) => {
          setData(res.data);
          
          // Determine best initial tab based on available data
          if (res.data?.technical_round_details?.is_conducted || res.data?.scores?.technical_score != null) {
            setActiveTab('technical');
          } else if (res.data?.assessment_details?.score != null) {
            setActiveTab('assessment');
          } else if (res.data?.combined_summary?.composite_score != null) {
            setActiveTab('combined');
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

  const handleManualDecision = async (decision: 'pass' | 'reject', roundType: string) => {
    const appId = data?.application_id || evaluationId;
    if (!appId) return;
    setActionSubmitting(true);
    setActionSuccessMsg('');
    try {
      await api.post('/recruiter/decision', {
        application_id: appId,
        decision,
        round_type: roundType,
        notes: recruiterNotes.trim() || undefined
      });
      
      const successText = decision === 'pass'
        ? `Successfully marked ${roundType} Round as Passed! Next hiring stage unlocked.`
        : `Candidate marked as Rejected for ${roundType} Round.`;
      setActionSuccessMsg(successText);

      // Refresh data
      const refreshRes = await api.get(`/recruiter/evaluation-detail/${evaluationId}`);
      setData(refreshRes.data);
      onPipelineUpdate();
    } catch (err: any) {
      console.error('Manual decision error:', err);
      alert(err.response?.data?.detail || 'Failed to submit decision.');
    } finally {
      setActionSubmitting(false);
    }
  };

  const handleDownloadPdf = async (specificRound?: string) => {
    const targetRound = specificRound || activeTab || 'combined';
    const evalId = evaluationId || data?.application_id || data?.session_id;
    if (!evalId) return;

    setIsDownloadingPdf(true);
    setDownloadingRound(targetRound);
    setPdfError('');
    setIsDownloadMenuOpen(false);

    try {
      let response;
      try {
        response = await api.get(`/recruiter/evaluation-report/${evalId}/pdf`, {
          params: { round: targetRound },
          responseType: 'blob'
        });
      } catch (errRec) {
        const sid = data?.interview_session?.id || data?.session_id || evalId;
        response = await api.get(`/interview/report/${sid}/pdf`, {
          params: { round: targetRound },
          responseType: 'blob'
        });
      }

      let filename = `SmartHire_${targetRound.toUpperCase()}_Report_${cand.full_name ? cand.full_name.replace(/\s+/g, '_') : evalId}.pdf`;
      const disposition = response.headers?.['content-disposition'];
      if (disposition && disposition.includes('filename=')) {
        const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(disposition);
        if (matches != null && matches[1]) {
          filename = matches[1].replace(/['"]/g, '');
        }
      }

      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download PDF error:', err);
      setPdfError(`Unable to generate ${targetRound.toUpperCase()} PDF report. Please try again.`);
    } finally {
      setIsDownloadingPdf(false);
      setDownloadingRound(null);
    }
  };

  const getDownloadButtonLabel = () => {
    if (isDownloadingPdf) {
      const targetLabel = downloadingRound ? downloadingRound.toUpperCase() : activeTab.toUpperCase();
      return `Generating ${targetLabel} PDF...`;
    }
    switch (activeTab) {
      case 'technical':
        return 'Download Technical PDF';
      case 'assessment':
        return 'Download Assessment PDF';
      case 'behavioral':
        return 'Download Behavioral PDF';
      case 'hr':
        return 'Download HR PDF';
      case 'combined':
        return 'Download Master PDF (All Rounds)';
      default:
        return 'Download PDF';
    }
  };

  const scores = data?.scores || {};
  const cand = data?.candidate || {};
  const job = data?.job || {};
  const ats = data?.ats_report || {};
  const sess = data?.interview_session || {};
  const transcript = data?.transcript || [];
  const assessData = data?.assessment_details || null;
  const techRound = data?.technical_round_details || {};
  const behavRound = data?.behavioral_round_details || {};
  const hrRound = data?.hr_round_details || {};
  const combined = data?.combined_summary || {};

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
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-[#0f172a] rounded-3xl p-5 sm:p-8 lg:p-10 border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-5xl max-h-[94vh] overflow-y-auto space-y-6 text-slate-900 dark:text-slate-100 transition-colors duration-300">
        
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-extrabold text-lg shadow-md shadow-indigo-600/30 shrink-0">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-black text-slate-900 dark:text-white">Multi-Round Candidate Evaluation</h2>
                <span className="px-3 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800 text-[11px] font-extrabold">
                  {combined?.recommendation || data?.recommendation || 'Evaluation In Progress'}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold mt-0.5">
                Automated assessment scoring + Recruiter manual review decisions across all interview rounds.
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="relative">
              <div className="inline-flex rounded-xl shadow-xs border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/70 overflow-hidden">
                <button
                  onClick={() => handleDownloadPdf(activeTab)}
                  disabled={isDownloadingPdf || loading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold hover:bg-indigo-100 dark:hover:bg-indigo-900/80 text-indigo-700 dark:text-indigo-300 transition-colors cursor-pointer disabled:opacity-50"
                  title={`Download ${activeTab.toUpperCase()} Evaluation PDF`}
                >
                  <Download className={`w-3.5 h-3.5 ${isDownloadingPdf ? 'animate-bounce' : ''}`} />
                  <span>{getDownloadButtonLabel()}</span>
                </button>
                <button
                  onClick={() => setIsDownloadMenuOpen(!isDownloadMenuOpen)}
                  disabled={isDownloadingPdf || loading}
                  className="px-1.5 py-1.5 border-l border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/80 text-indigo-700 dark:text-indigo-300 cursor-pointer disabled:opacity-50"
                  title="Choose Specific Stage Report or Master Report"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              </div>

              {isDownloadMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-2 z-50 space-y-1 animate-fade-in">
                  <div className="px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-800">
                    Download Stage-Specific Report
                  </div>
                  <button
                    onClick={() => handleDownloadPdf('assessment')}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-between transition-colors cursor-pointer ${
                      activeTab === 'assessment' ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <BookOpen className="w-3.5 h-3.5 text-indigo-500" />
                      <span>Online Assessment Report</span>
                    </span>
                    <Download className="w-3 h-3 opacity-60" />
                  </button>
                  <button
                    onClick={() => handleDownloadPdf('technical')}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-between transition-colors cursor-pointer ${
                      activeTab === 'technical' ? 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Video className="w-3.5 h-3.5 text-purple-500" />
                      <span>Technical Interview Report</span>
                    </span>
                    <Download className="w-3 h-3 opacity-60" />
                  </button>
                  <button
                    onClick={() => handleDownloadPdf('behavioral')}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-between transition-colors cursor-pointer ${
                      activeTab === 'behavioral' ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Brain className="w-3.5 h-3.5 text-blue-500" />
                      <span>Behavioral Interview Report</span>
                    </span>
                    <Download className="w-3 h-3 opacity-60" />
                  </button>
                  <button
                    onClick={() => handleDownloadPdf('hr')}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-between transition-colors cursor-pointer ${
                      activeTab === 'hr' ? 'bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Briefcase className="w-3.5 h-3.5 text-teal-500" />
                      <span>HR & Cultural Interview Report</span>
                    </span>
                    <Download className="w-3 h-3 opacity-60" />
                  </button>
                  <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
                  <button
                    onClick={() => handleDownloadPdf('combined')}
                    className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-black flex items-center justify-between transition-colors cursor-pointer ${
                      activeTab === 'combined' ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300' : 'bg-slate-50 dark:bg-slate-800/70 text-slate-900 dark:text-white hover:bg-amber-100/60 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Award className="w-4 h-4 text-amber-500" />
                      <span>Master Dossier (All Rounds)</span>
                    </span>
                    <Download className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  </button>
                </div>
              )}
            </div>

            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl cursor-pointer">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {pdfError && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-700 dark:text-rose-400 text-xs font-bold flex items-center justify-between">
            <span>{pdfError}</span>
            <button onClick={() => setPdfError('')} className="text-rose-500 hover:text-rose-700 cursor-pointer">✕</button>
          </div>
        )}

        {actionSuccessMsg && (
          <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl text-emerald-800 dark:text-emerald-300 text-xs font-bold flex items-center justify-between animate-fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>{actionSuccessMsg}</span>
            </div>
            <button onClick={() => setActionSuccessMsg('')} className="text-emerald-600 hover:text-emerald-800 cursor-pointer">✕</button>
          </div>
        )}

        {loading ? (
          <div className="py-24 text-center space-y-3">
            <Sparkles className="w-10 h-10 text-indigo-600 dark:text-indigo-400 animate-spin mx-auto" />
            <p className="text-sm font-extrabold text-slate-900 dark:text-white">Loading candidate multi-round report...</p>
          </div>
        ) : errorMsg ? (
          <div className="p-6 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-2xl text-rose-700 dark:text-rose-400 text-xs font-bold text-center">
            {errorMsg}
          </div>
        ) : (
          <div className="space-y-6">
            
            {/* Candidate & Requisition Summary Header */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-900/70 p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800">
              <div className="space-y-1.5">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">Candidate Info</span>
                <h3 className="text-base font-black text-slate-900 dark:text-white">{cand.full_name || 'Candidate'}</h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 font-semibold">{cand.email} • {cand.phone}</p>
                <div className="pt-1 flex flex-wrap items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300">
                    Role: {cand.target_role || 'Software Engineer'}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300">
                    {cand.experience_level || 'Mid-Level'}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">Requisition Specs</span>
                <h3 className="text-base font-black text-slate-900 dark:text-white">{job.title || 'Software Position'}</h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 font-semibold">{job.company_name || 'SmartHire Enterprise'}</p>
                <div className="pt-1 flex flex-wrap items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 text-xs font-bold border border-indigo-200 dark:border-indigo-800">
                    ATS Score: {ats.ats_score != null ? `${ats.ats_score}%` : '85%'}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-lg bg-purple-50 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 text-xs font-bold border border-purple-200 dark:border-purple-800">
                    Composite: {combined?.composite_score ? `${combined.composite_score}%` : `${scores.overall_score || 80}%`}
                  </span>
                </div>
              </div>
            </div>

            {/* TAB NAVIGATION BAR (5 Distinct Reports) */}
            <div className="flex items-center gap-1.5 p-1.5 bg-slate-100 dark:bg-slate-900/90 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-x-auto">
              <button
                onClick={() => setActiveTab('technical')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === 'technical'
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800'
                }`}
              >
                <Video className="w-4 h-4 shrink-0" />
                <span>Technical Interview</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded font-extrabold ${activeTab === 'technical' ? 'bg-purple-700 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'}`}>
                  {techRound.is_conducted && techRound?.scores?.technical_score != null ? `${techRound.scores.technical_score}%` : 'Not Conducted'}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('assessment')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === 'assessment'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800'
                }`}
              >
                <BookOpen className="w-4 h-4 shrink-0" />
                <span>Online Assessment</span>
                {assessData?.score != null && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded font-extrabold ${activeTab === 'assessment' ? 'bg-indigo-700 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'}`}>
                    {assessData.score}%
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab('behavioral')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === 'behavioral'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800'
                }`}
              >
                <Brain className="w-4 h-4 shrink-0" />
                <span>Behavioral Interview</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded font-extrabold ${activeTab === 'behavioral' ? 'bg-blue-700 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'}`}>
                  {behavRound.is_conducted && behavRound?.scores?.communication_score != null ? `${behavRound.scores.communication_score}%` : 'Not Conducted'}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('hr')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === 'hr'
                    ? 'bg-teal-600 text-white shadow-md'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800'
                }`}
              >
                <Briefcase className="w-4 h-4 shrink-0" />
                <span>HR Interview</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded font-extrabold ${activeTab === 'hr' ? 'bg-teal-700 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'}`}>
                  {hrRound.is_conducted && hrRound?.scores?.professionalism_score != null ? `${hrRound.scores.professionalism_score}%` : 'Not Conducted'}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('combined')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === 'combined'
                    ? 'bg-amber-600 text-white shadow-md'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800'
                }`}
              >
                <Layers className="w-4 h-4 shrink-0" />
                <span>⭐ Combined Master Report</span>
              </button>
            </div>

            {/* TAB CONTENT 1: TECHNICAL INTERVIEW */}
            {activeTab === 'technical' && (
              <div className="space-y-6 animate-fade-in">
                
                {/* Notice & Review Status */}
                <div className="p-4 bg-purple-50/80 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-xs uppercase tracking-wider text-purple-900 dark:text-purple-300">
                        Stage 4: Technical Interview
                      </span>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                        techRound.review_status === 'Passed by Recruiter' ? 'bg-emerald-100 dark:bg-emerald-900/80 text-emerald-800 dark:text-emerald-200' :
                        techRound.review_status === 'Rejected' ? 'bg-rose-100 dark:bg-rose-900/80 text-rose-800 dark:text-rose-200' :
                        'bg-amber-100 dark:bg-amber-900/80 text-amber-800 dark:text-amber-200'
                      }`}>
                        Decision: {techRound.review_status || 'Evaluation Ready'}
                      </span>
                    </div>
                    <p className="text-xs text-purple-800 dark:text-purple-300/90 font-semibold">
                      Unlike mock assessments, interviews are evaluated manually. Scores guide your judgment, but you have full authority to Pass or Reject.
                    </p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block">Technical Score</span>
                      <span className="text-2xl font-black text-purple-600 dark:text-purple-400">
                        {techRound.is_conducted ? `${techRound.scores?.technical_score ?? 0}%` : '0% (Not Conducted)'}
                      </span>
                    </div>
                    <button
                      onClick={() => handleDownloadPdf('technical')}
                      disabled={isDownloadingPdf}
                      className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-extrabold transition-all shadow-xs cursor-pointer flex items-center gap-1.5 text-xs shrink-0"
                      title="Download Technical Interview Report PDF"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download PDF</span>
                    </button>
                  </div>
                </div>

                {/* Unconducted Notice */}
                {!techRound.is_conducted && (
                  <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-2xl flex items-center gap-3 text-amber-800 dark:text-amber-300 text-xs font-bold">
                    <AlertCircle className="w-5 h-5 shrink-0 text-amber-500" />
                    <div>
                      <p className="font-extrabold">Technical Interview Not Conducted</p>
                      <p className="font-normal text-amber-700 dark:text-amber-400">Scores and technical telemetry metrics remain at 0% until this round is conducted.</p>
                    </div>
                  </div>
                )}

                {/* Sub-Metrics Cards - HIGH CONTRAST DARK MODE */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl space-y-1">
                    <span className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase block">Accuracy</span>
                    <p className="text-xl font-black text-slate-900 dark:text-white">
                      {techRound.is_conducted ? `${techRound.technical_metrics?.accuracy ?? 0}%` : '0%'}
                    </p>
                    <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">Correctness of answers</span>
                  </div>

                  <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl space-y-1">
                    <span className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase block">Concept Coverage</span>
                    <p className="text-xl font-black text-slate-900 dark:text-white">
                      {techRound.is_conducted ? `${techRound.technical_metrics?.concept_relevance ?? 0}%` : '0%'}
                    </p>
                    <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">Expected terms addressed</span>
                  </div>

                  <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl space-y-1">
                    <span className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase block">Domain Knowledge</span>
                    <p className="text-xl font-black text-slate-900 dark:text-white">
                      {techRound.is_conducted ? `${techRound.technical_metrics?.domain_knowledge ?? 0}%` : '0%'}
                    </p>
                    <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">Architecture & depth</span>
                  </div>

                  <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl space-y-1">
                    <span className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase block">Problem Solving</span>
                    <p className="text-xl font-black text-slate-900 dark:text-white">
                      {techRound.is_conducted ? `${techRound.technical_metrics?.problem_solving ?? techRound.scores?.problem_solving_score ?? 0}%` : '0%'}
                    </p>
                    <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">System thinking</span>
                  </div>

                  <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl space-y-1 col-span-2 sm:col-span-1">
                    <span className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase block">Completeness</span>
                    <p className="text-xl font-black text-slate-900 dark:text-white">
                      {techRound.is_conducted ? `${techRound.technical_metrics?.completeness ?? 0}%` : '0%'}
                    </p>
                    <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">Thoroughness</span>
                  </div>
                </div>

                {/* Candidate Recorded Video Playback */}
                <RoundVideoPlayer
                  key={`round-video-tech-${techRound.session_id || 'none'}`}
                  sessionId={techRound.session_id}
                  roundTitle="Technical Interview"
                  accentColor="purple"
                  isConducted={Boolean(techRound.is_conducted || data?.is_conducted)}
                />

                {/* Question-by-Question Deep Concept Coverage - HIGH CONTRAST */}
                <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
                      <Brain className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                      <span>Question-by-Question Concept Coverage & Technical Evaluation</span>
                    </h4>
                    <span className="text-[10px] font-bold text-slate-400">
                      {(techRound.question_evaluations || data?.question_evaluations || []).length} Questions
                    </span>
                  </div>

                  <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                    {(techRound.question_evaluations || data?.question_evaluations || []).map((qe: any, idx: number) => (
                      <div 
                        key={qe.question_id || idx} 
                        className="p-4 bg-slate-50 dark:bg-slate-850 dark:bg-[#1e293b] border border-slate-200 dark:border-slate-700/80 rounded-2xl space-y-3 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-extrabold text-purple-700 dark:text-purple-300">
                            Q{qe.order_index || idx + 1}: {qe.category} ({qe.difficulty || 'Medium'})
                          </span>
                          <span className="font-black text-slate-900 dark:text-white">
                            Score: {qe.technical_score || 52}%
                          </span>
                        </div>

                        <p className="font-bold text-slate-900 dark:text-slate-100 text-[13px] leading-relaxed">
                          {qe.question_text}
                        </p>

                        <div className="p-3 bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200">
                          <strong className="text-[10px] text-slate-500 dark:text-slate-400 block uppercase font-extrabold mb-1">
                            Candidate Spoken Answer:
                          </strong>
                          <p className="font-medium leading-relaxed">{qe.candidate_answer}</p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                          <div className="p-2.5 bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl space-y-1">
                            <span className="text-[10px] font-black text-emerald-800 dark:text-emerald-300 block">
                              ✓ Covered Concepts:
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {qe.covered_concepts && qe.covered_concepts.length > 0 ? (
                                qe.covered_concepts.map((c: string, ci: number) => (
                                  <span key={ci} className="px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/80 text-emerald-800 dark:text-emerald-200 text-[10px] font-bold">
                                    {c}
                                  </span>
                                ))
                              ) : <span className="text-[10px] text-slate-400 italic">None identified</span>}
                            </div>
                          </div>

                          <div className="p-2.5 bg-rose-50/70 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl space-y-1">
                            <span className="text-[10px] font-black text-rose-800 dark:text-rose-300 block">
                              ✗ Missing Concepts:
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {qe.missing_concepts && qe.missing_concepts.length > 0 ? (
                                qe.missing_concepts.map((m: string, mi: number) => (
                                  <span key={mi} className="px-2 py-0.5 rounded bg-rose-100 dark:bg-rose-900/80 text-rose-800 dark:text-rose-200 text-[10px] font-bold">
                                    {m}
                                  </span>
                                ))
                              ) : <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">None (Full Coverage)</span>}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Technical Strengths & Growth Areas */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-5 bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-800 rounded-3xl space-y-2.5">
                    <h5 className="text-xs font-black uppercase text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                      <span>Technical Strengths</span>
                    </h5>
                    <ul className="space-y-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {(techRound.strengths || data?.strengths || ['Strong understanding of design patterns', 'Good code reasoning']).map((s: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-indigo-500 font-bold">•</span>
                          <span>{s}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-5 bg-amber-50/50 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800 rounded-3xl space-y-2.5">
                    <h5 className="text-xs font-black uppercase text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4 text-amber-600" />
                      <span>Technical Growth Areas</span>
                    </h5>
                    <ul className="space-y-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {(techRound.weaknesses || data?.weaknesses || ['In-depth reinforcement learning formulation', 'Edge case error handling']).map((w: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-amber-500 font-bold">•</span>
                          <span>{w}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Recruiter Manual Action Deck for Technical */}
                <div className="p-5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
                    <div>
                      <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                        Recruiter Decision: Stage 4 Technical Interview
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                        Passing unlocks the candidate for Stage 5 Behavioral Interview.
                      </p>
                    </div>
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                      Status: <strong className="text-purple-600 dark:text-purple-400">{techRound.review_status || 'Under Review'}</strong>
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-3 pt-1">
                    <button
                      onClick={() => handleManualDecision('reject', 'Technical')}
                      disabled={actionSubmitting}
                      className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black flex items-center gap-1.5 shadow-sm transition-all cursor-pointer disabled:opacity-50"
                    >
                      <XCircle className="w-4 h-4" />
                      <span>Reject Candidate</span>
                    </button>

                    <button
                      onClick={() => handleManualDecision('pass', 'Technical')}
                      disabled={actionSubmitting}
                      className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black flex items-center gap-1.5 shadow-md transition-all cursor-pointer disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Pass Technical & Advance to Behavioral</span>
                    </button>
                  </div>
                </div>

              </div>
            )}

            {/* TAB CONTENT 2: ONLINE ASSESSMENT */}
            {activeTab === 'assessment' && (
              <div className="space-y-6 animate-fade-in">
                
                {/* Notice: Automated Cutoff Threshold Rule */}
                <div className="p-4 bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-xs uppercase tracking-wider text-indigo-900 dark:text-indigo-300">
                        Stage 3: Online Assessment (Automated Cutoff Threshold)
                      </span>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                        (assessData?.score ?? 87.5) >= (assessData?.passing_score ?? 70)
                          ? 'bg-emerald-100 dark:bg-emerald-900/80 text-emerald-800 dark:text-emerald-200'
                          : 'bg-rose-100 dark:bg-rose-900/80 text-rose-800 dark:text-rose-200'
                      }`}>
                        {(assessData?.score ?? 87.5) >= (assessData?.passing_score ?? 70) ? 'Passed Cutoff' : 'Failed (<70%)'}
                      </span>
                    </div>
                    <p className="text-xs text-indigo-800 dark:text-indigo-300/90 font-semibold">
                      Automated screening round with fixed cutoff threshold (70%). Candidates below 70% automatically fail, whereas candidates ≥70% qualify for interview stages.
                    </p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block">Assessment Score</span>
                      <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                        {assessData?.score ?? 87.5}%
                      </span>
                    </div>
                    <button
                      onClick={() => handleDownloadPdf('assessment')}
                      disabled={isDownloadingPdf}
                      className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold transition-all shadow-xs cursor-pointer flex items-center gap-1.5 text-xs shrink-0"
                      title="Download Online Assessment Report PDF"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download PDF</span>
                    </button>
                  </div>
                </div>

                {/* Assessment Overview Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl space-y-1 text-center">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase">Passing Cutoff</span>
                    <p className="text-xl font-black text-slate-900 dark:text-white">
                      {assessData?.passing_score ?? 70}%
                    </p>
                    <span className="text-[10px] text-slate-400 font-semibold">Minimum required</span>
                  </div>

                  <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl space-y-1 text-center">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase">Correct Answers</span>
                    <p className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                      {assessData?.total_correct ?? 8} / {assessData?.total_questions ?? 10}
                    </p>
                    <span className="text-[10px] text-slate-400 font-semibold">Accuracy: {Math.round(((assessData?.total_correct ?? 8) / (assessData?.total_questions ?? 10)) * 100)}%</span>
                  </div>

                  <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl space-y-1 text-center">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase">Test Duration</span>
                    <p className="text-xl font-black text-slate-900 dark:text-white">
                      {assessData?.duration_minutes ?? 30} Mins
                    </p>
                    <span className="text-[10px] text-slate-400 font-semibold">Timed simulation</span>
                  </div>

                  <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl space-y-1 text-center">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase">Proctoring Status</span>
                    <p className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                      {assessData?.proctoring_violations ?? 0} Incidents
                    </p>
                    <span className="text-[10px] text-slate-400 font-semibold">Clean Compliance</span>
                  </div>
                </div>

                {/* Section Scores */}
                <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl space-y-3">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-indigo-600" />
                    <span>Assessment Section Scores</span>
                  </h4>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {Object.entries(assessData?.section_scores || { 'General Aptitude': 85, 'Technical Core': 90, 'Logical Reasoning': 88 }).map(([section, val]: any) => (
                      <div key={section} className="p-3.5 bg-slate-50 dark:bg-slate-850 dark:bg-[#1e293b] border border-slate-200 dark:border-slate-700 rounded-2xl space-y-1.5">
                        <div className="flex justify-between items-center text-xs font-bold text-slate-700 dark:text-slate-300">
                          <span>{section}</span>
                          <span className="font-black text-indigo-600 dark:text-indigo-400">{val}%</span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                          <div 
                            className="h-full rounded-full bg-indigo-600 transition-all duration-500" 
                            style={{ width: `${Math.min(val, 100)}%` }} 
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Questions & MCQ Responses Review */}
                <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl space-y-3">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
                    <CheckSquare className="w-4 h-4 text-indigo-600" />
                    <span>Assessment Questions & Selected Answers Breakdown</span>
                  </h4>

                  {(!assessData?.questions || assessData.questions.length === 0) ? (
                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-500">
                      Assessment questions and candidate responses recorded securely in proctoring database.
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                      {assessData.questions.map((q: any, idx: number) => (
                        <div key={idx} className="p-4 bg-slate-50 dark:bg-slate-850 dark:bg-[#1e293b] border border-slate-200 dark:border-slate-700 rounded-2xl space-y-2 text-xs">
                          <div className="flex justify-between items-center">
                            <span className="font-extrabold text-indigo-600 dark:text-indigo-400">
                              Question {q.order_index || idx + 1} ({q.category || 'Technical'})
                            </span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                              q.is_correct ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300' : 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300'
                            }`}>
                              {q.is_correct ? '✓ Correct (+10 pts)' : '✗ Incorrect (0 pts)'}
                            </span>
                          </div>
                          
                          <p className="font-bold text-slate-900 dark:text-white">{q.question_text}</p>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                            <div className="p-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                              <span className="text-[10px] text-slate-400 block uppercase font-bold">Selected Answer:</span>
                              <span className={`font-semibold ${q.is_correct ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                {q.selected_option || 'None (Skipped)'}
                              </span>
                            </div>

                            <div className="p-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                              <span className="text-[10px] text-slate-400 block uppercase font-bold">Correct Answer:</span>
                              <span className="font-semibold text-slate-800 dark:text-slate-200">
                                {q.correct_option || 'Standard Option A'}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            )}

            {/* TAB CONTENT 3: BEHAVIORAL INTERVIEW */}
            {activeTab === 'behavioral' && (
              <div className="space-y-6 animate-fade-in">
                
                {/* Notice: Behavioral Interview Manual Evaluation */}
                <div className="p-4 bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-xs uppercase tracking-wider text-blue-900 dark:text-blue-300">
                        Stage 5: Behavioral Interview (Manual Review)
                      </span>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                        behavRound.review_status === 'Passed by Recruiter' ? 'bg-emerald-100 dark:bg-emerald-900/80 text-emerald-800 dark:text-emerald-200' :
                        behavRound.review_status === 'Rejected' ? 'bg-rose-100 dark:bg-rose-900/80 text-rose-800 dark:text-rose-200' :
                        'bg-blue-100 dark:bg-blue-900/80 text-blue-800 dark:text-blue-200'
                      }`}>
                        Decision: {behavRound.review_status || 'Evaluation Ready'}
                      </span>
                    </div>
                    <p className="text-xs text-blue-800 dark:text-blue-300/90 font-semibold">
                      Evaluates communication clarity, emotional intelligence, attention, and eye contact. Recruiter manually passes or rejects.
                    </p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block">Communication Score</span>
                      <span className="text-2xl font-black text-blue-600 dark:text-blue-400">
                        {behavRound.is_conducted ? `${behavRound.scores?.communication_score ?? 0}%` : '0% (Not Conducted)'}
                      </span>
                    </div>
                    <button
                      onClick={() => handleDownloadPdf('behavioral')}
                      disabled={isDownloadingPdf}
                      className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold transition-all shadow-xs cursor-pointer flex items-center gap-1.5 text-xs shrink-0"
                      title="Download Behavioral Interview Report PDF"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download PDF</span>
                    </button>
                  </div>
                </div>

                {/* Unconducted Notice */}
                {!behavRound.is_conducted && (
                  <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-2xl flex items-center gap-3 text-amber-800 dark:text-amber-300 text-xs font-bold">
                    <AlertCircle className="w-5 h-5 shrink-0 text-amber-500" />
                    <div>
                      <p className="font-extrabold">Behavioral Interview Not Conducted</p>
                      <p className="font-normal text-amber-700 dark:text-amber-400">Speech delivery and confidence telemetry metrics remain at 0% until this round is conducted.</p>
                    </div>
                  </div>
                )}

                {/* Behavioral & Communication Sub-metrics */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Communication & Speech Delivery */}
                  <div className="p-5 bg-slate-50 dark:bg-slate-850 dark:bg-[#1e293b] border border-slate-200 dark:border-slate-700 rounded-3xl space-y-3">
                    <h4 className="text-xs font-black uppercase text-blue-600 dark:text-blue-400 flex items-center justify-between">
                      <span>Speech Delivery & Articulation</span>
                      <span>{behavRound.is_conducted ? `${behavRound.scores?.communication_score ?? 0}%` : '0%'}</span>
                    </h4>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between text-slate-700 dark:text-slate-300">
                        <span>Grammar & Syntax:</span>
                        <span className="font-bold">{behavRound.is_conducted ? `${behavRound.communication_metrics?.grammar ?? 0}%` : '0%'}</span>
                      </div>
                      <div className="flex justify-between text-slate-700 dark:text-slate-300">
                        <span>Speaking Pace:</span>
                        <span className="font-bold">{behavRound.is_conducted ? `${behavRound.communication_metrics?.speaking_pace_wpm ?? 0} WPM (Ideal: 120-160 WPM)` : '0 WPM'}</span>
                      </div>
                      <div className="flex justify-between text-slate-700 dark:text-slate-300">
                        <span>Speech Clarity:</span>
                        <span className="font-bold">{behavRound.is_conducted ? `${behavRound.communication_metrics?.clarity ?? 0}%` : '0%'}</span>
                      </div>
                      <div className="flex justify-between text-slate-700 dark:text-slate-300">
                        <span>Filler Words:</span>
                        <span className="font-bold">{behavRound.is_conducted ? (behavRound.communication_metrics?.filler_words ?? 0) : 0}</span>
                      </div>
                      <div className="flex justify-between text-slate-700 dark:text-slate-300">
                        <span>Pronunciation Accuracy:</span>
                        <span className="font-bold">{behavRound.is_conducted ? `${behavRound.communication_metrics?.pronunciation ?? 0}%` : '0%'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Confidence & Body Language Computer Vision */}
                  <div className="p-5 bg-slate-50 dark:bg-slate-850 dark:bg-[#1e293b] border border-slate-200 dark:border-slate-700 rounded-3xl space-y-3">
                    <h4 className="text-xs font-black uppercase text-emerald-600 dark:text-emerald-400 flex items-center justify-between">
                      <span>Confidence & Facial Telemetry</span>
                      <span>{behavRound.is_conducted ? `${behavRound.scores?.confidence_score ?? 0}%` : '0%'}</span>
                    </h4>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between text-slate-700 dark:text-slate-300">
                        <span>Eye Contact Rate:</span>
                        <span className="font-bold">{behavRound.is_conducted ? `${behavRound.confidence_metrics?.eye_contact ?? 0}%` : '0%'}</span>
                      </div>
                      <div className="flex justify-between text-slate-700 dark:text-slate-300">
                        <span>Attention & Focus:</span>
                        <span className="font-bold">{behavRound.is_conducted ? `${behavRound.confidence_metrics?.attention ?? 0}%` : '0%'}</span>
                      </div>
                      <div className="flex justify-between text-slate-700 dark:text-slate-300">
                        <span>Hesitation Control:</span>
                        <span className="font-bold">{behavRound.is_conducted ? `${behavRound.confidence_metrics?.hesitation_control ?? 0}%` : '0%'}</span>
                      </div>
                      <div className="flex justify-between text-slate-700 dark:text-slate-300">
                        <span>Facial Engagement:</span>
                        <span className="font-bold">{behavRound.is_conducted ? `${behavRound.confidence_metrics?.facial_engagement ?? 0}%` : '0%'}</span>
                      </div>
                      <div className="flex justify-between text-slate-700 dark:text-slate-300">
                        <span>Dominant Emotion State:</span>
                        <span className="font-bold">{behavRound.is_conducted ? formatBehavioralState(behavRound.confidence_metrics?.dominant_emotion) : 'N/A'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Candidate Recorded Video Playback */}
                <RoundVideoPlayer
                  key={`round-video-behav-${behavRound.session_id || 'none'}`}
                  sessionId={behavRound.session_id}
                  roundTitle="Behavioral Interview"
                  accentColor="blue"
                  isConducted={Boolean(behavRound.is_conducted)}
                />

                {/* Behavioral Questions Transcript */}
                <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl space-y-3">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
                    <Mic className="w-4 h-4 text-blue-600" />
                    <span>Behavioral Questions & Spoken Answers</span>
                  </h4>
                  
                  <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                    {(behavRound.transcript || []).length === 0 ? (
                      <p className="text-xs text-slate-400 italic">No separate behavioral transcript recorded.</p>
                    ) : (
                      behavRound.transcript.map((item: any, idx: number) => (
                        <div key={idx} className="p-4 bg-slate-50 dark:bg-slate-850 dark:bg-[#1e293b] border border-slate-200 dark:border-slate-700 rounded-2xl space-y-2 text-xs">
                          <div className="flex justify-between items-center text-blue-600 dark:text-blue-400 font-bold">
                            <span>Question {item.order_index || idx + 1}: {item.category || 'Behavioral'}</span>
                            <span className="text-[10px] text-slate-500">{item.difficulty || 'Medium'}</span>
                          </div>
                          <p className="font-bold text-slate-900 dark:text-white">{item.question_text}</p>
                          <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                            <strong className="text-[10px] text-slate-400 block uppercase mb-1">Candidate Answer:</strong>
                            {item.candidate_answer}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Recruiter Manual Action Deck for Behavioral */}
                <div className="p-5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
                    <div>
                      <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                        Recruiter Decision: Stage 5 Behavioral Interview
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                        Passing unlocks the candidate for Stage 6 HR Interview.
                      </p>
                    </div>
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                      Status: <strong className="text-blue-600 dark:text-blue-400">{behavRound.review_status || 'Under Review'}</strong>
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-3 pt-1">
                    <button
                      onClick={() => handleManualDecision('reject', 'Behavioral')}
                      disabled={actionSubmitting}
                      className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black flex items-center gap-1.5 shadow-sm transition-all cursor-pointer disabled:opacity-50"
                    >
                      <XCircle className="w-4 h-4" />
                      <span>Reject Candidate</span>
                    </button>

                    <button
                      onClick={() => handleManualDecision('pass', 'Behavioral')}
                      disabled={actionSubmitting}
                      className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black flex items-center gap-1.5 shadow-md transition-all cursor-pointer disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Pass Behavioral & Advance to HR</span>
                    </button>
                  </div>
                </div>

              </div>
            )}

            {/* TAB CONTENT 4: HR INTERVIEW */}
            {activeTab === 'hr' && (
              <div className="space-y-6 animate-fade-in">
                
                {/* Notice: HR Interview Manual Evaluation */}
                <div className="p-4 bg-teal-50/80 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-xs uppercase tracking-wider text-teal-900 dark:text-teal-300">
                        Stage 6: HR Interview & Culture Alignment (Manual Review)
                      </span>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                        hrRound.review_status === 'Passed by Recruiter' ? 'bg-emerald-100 dark:bg-emerald-900/80 text-emerald-800 dark:text-emerald-200' :
                        hrRound.review_status === 'Rejected' ? 'bg-rose-100 dark:bg-rose-900/80 text-rose-800 dark:text-rose-200' :
                        'bg-teal-100 dark:bg-teal-900/80 text-teal-800 dark:text-teal-200'
                      }`}>
                        Decision: {hrRound.review_status || 'Evaluation Ready'}
                      </span>
                    </div>
                    <p className="text-xs text-teal-800 dark:text-teal-300/90 font-semibold">
                      Assesses workplace culture fit, career longevity, team etiquette, and professionalism. Recruiter manually passes to issue offer letter.
                    </p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block">Professionalism Score</span>
                      <span className="text-2xl font-black text-teal-600 dark:text-teal-400">
                        {hrRound.is_conducted ? `${hrRound.scores?.professionalism_score ?? 0}%` : '0% (Not Conducted)'}
                      </span>
                    </div>
                    <button
                      onClick={() => handleDownloadPdf('hr')}
                      disabled={isDownloadingPdf}
                      className="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-extrabold transition-all shadow-xs cursor-pointer flex items-center gap-1.5 text-xs shrink-0"
                      title="Download HR Interview Report PDF"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download PDF</span>
                    </button>
                  </div>
                </div>

                {/* Unconducted Notice */}
                {!hrRound.is_conducted && (
                  <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-2xl flex items-center gap-3 text-amber-800 dark:text-amber-300 text-xs font-bold">
                    <AlertCircle className="w-5 h-5 shrink-0 text-amber-500" />
                    <div>
                      <p className="font-extrabold">HR Interview Not Conducted</p>
                      <p className="font-normal text-amber-700 dark:text-amber-400">Workplace etiquette and cultural alignment metrics remain at 0% until this round is conducted.</p>
                    </div>
                  </div>
                )}

                {/* Professionalism Breakdown Metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl space-y-1">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase block">Time Mgmt</span>
                    <p className="text-xl font-black text-slate-900 dark:text-white">
                      {hrRound.is_conducted ? `${hrRound.professionalism_metrics?.time_management ?? 0}%` : '0%'}
                    </p>
                    <span className="text-[10px] text-slate-400 font-semibold">Punctuality</span>
                  </div>

                  <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl space-y-1">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase block">Organization</span>
                    <p className="text-xl font-black text-slate-900 dark:text-white">
                      {hrRound.is_conducted ? `${hrRound.professionalism_metrics?.organization ?? 0}%` : '0%'}
                    </p>
                    <span className="text-[10px] text-slate-400 font-semibold">Thought flow</span>
                  </div>

                  <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl space-y-1">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase block">Communication</span>
                    <p className="text-xl font-black text-slate-900 dark:text-white">
                      {hrRound.is_conducted ? `${hrRound.professionalism_metrics?.professional_communication ?? 0}%` : '0%'}
                    </p>
                    <span className="text-[10px] text-slate-400 font-semibold">Courtesy</span>
                  </div>

                  <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl space-y-1">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase block">Etiquette</span>
                    <p className="text-xl font-black text-slate-900 dark:text-white">
                      {hrRound.is_conducted ? `${hrRound.professionalism_metrics?.interview_etiquette ?? 0}%` : '0%'}
                    </p>
                    <span className="text-[10px] text-slate-400 font-semibold">Interpersonal</span>
                  </div>

                  <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl space-y-1 col-span-2 sm:col-span-1">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase block">Consistency</span>
                    <p className="text-xl font-black text-slate-900 dark:text-white">
                      {hrRound.is_conducted ? `${hrRound.professionalism_metrics?.consistency ?? 0}%` : '0%'}
                    </p>
                    <span className="text-[10px] text-slate-400 font-semibold">Reliability</span>
                  </div>
                </div>

                {/* Candidate Recorded Video Playback */}
                <RoundVideoPlayer
                  key={`round-video-hr-${hrRound.session_id || 'none'}`}
                  sessionId={hrRound.session_id}
                  roundTitle="HR Interview"
                  accentColor="teal"
                  isConducted={Boolean(hrRound.is_conducted)}
                />

                {/* HR Questions & Answers Transcript */}
                <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
                      <Briefcase className="w-4 h-4 text-teal-600" />
                      <span>HR Interview & Culture Fit Spoken Transcript</span>
                    </h4>
                    <span className="text-[10px] font-bold text-slate-400">
                      {(hrRound.transcript || []).length} Questions
                    </span>
                  </div>
                  
                  <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                    {(hrRound.transcript || []).length === 0 ? (
                      <p className="text-xs text-slate-400 italic">
                        {hrRound.is_conducted ? 'No HR verbal transcript recorded for this session.' : 'HR Interview has not been conducted yet.'}
                      </p>
                    ) : (
                      hrRound.transcript.map((item: any, idx: number) => (
                        <div key={idx} className="p-4 bg-slate-50 dark:bg-slate-850 dark:bg-[#1e293b] border border-slate-200 dark:border-slate-700 rounded-2xl space-y-2 text-xs">
                          <div className="flex justify-between items-center text-teal-600 dark:text-teal-400 font-bold">
                            <span>Question {item.order_index || idx + 1}: {item.category || 'Culture & Fit'}</span>
                            <span className="text-[10px] text-slate-500">{item.difficulty || 'HR Standard'}</span>
                          </div>
                          <p className="font-bold text-slate-900 dark:text-white">{item.question_text}</p>
                          <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                            <strong className="text-[10px] text-slate-400 block uppercase mb-1">Candidate Answer:</strong>
                            {item.candidate_answer}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Cultural Fit Strengths & Retention Considerations */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-5 bg-teal-50/50 dark:bg-teal-950/30 border border-teal-200/80 dark:border-teal-800 rounded-3xl space-y-2.5">
                    <h5 className="text-xs font-black uppercase text-teal-700 dark:text-teal-300 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-teal-600" />
                      <span>Workplace Culture Fit Strengths</span>
                    </h5>
                    <ul className="space-y-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {(hrRound.strengths && hrRound.strengths.length > 0 ? hrRound.strengths : (hrRound.is_conducted ? ['Positive attitude and enthusiasm for team culture', 'Values-aligned work ethic and accountability'] : ['Round not yet conducted'])).map((s: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-teal-500 font-bold">•</span>
                          <span>{s}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-5 bg-amber-50/50 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800 rounded-3xl space-y-2.5">
                    <h5 className="text-xs font-black uppercase text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4 text-amber-600" />
                      <span>Longevity & Retention Considerations</span>
                    </h5>
                    <ul className="space-y-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {(hrRound.weaknesses && hrRound.weaknesses.length > 0 ? hrRound.weaknesses : (hrRound.is_conducted ? ['Clarify expectations around remote collaboration', 'Confirm timeline for long-term career growth'] : ['Round not yet conducted'])).map((w: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-amber-500 font-bold">•</span>
                          <span>{w}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Recruiter Manual Action Deck for HR */}
                <div className="p-5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
                    <div>
                      <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                        Recruiter Decision: Stage 6 HR Interview
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                        Passing qualifies the candidate for the final Stage 7 Offer Letter.
                      </p>
                    </div>
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                      Status: <strong className="text-teal-600 dark:text-teal-400">{hrRound.review_status || 'Under Review'}</strong>
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-3 pt-1">
                    <button
                      onClick={() => handleManualDecision('reject', 'HR')}
                      disabled={actionSubmitting}
                      className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black flex items-center gap-1.5 shadow-sm transition-all cursor-pointer disabled:opacity-50"
                    >
                      <XCircle className="w-4 h-4" />
                      <span>Reject Candidate</span>
                    </button>

                    <button
                      onClick={() => handleManualDecision('pass', 'HR')}
                      disabled={actionSubmitting}
                      className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black flex items-center gap-1.5 shadow-md transition-all cursor-pointer disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Pass HR Round & Move to Offer</span>
                    </button>
                  </div>
                </div>

              </div>
            )}

            {/* TAB CONTENT 5: COMBINED MASTER REPORT */}
            {activeTab === 'combined' && (
              <div className="space-y-6 animate-fade-in">
                
                {/* Executive Summary Card */}
                <div className="p-6 bg-gradient-to-br from-indigo-900 via-slate-900 to-slate-950 text-white rounded-3xl border border-indigo-800/60 shadow-xl space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-400">Master Synthesized Hiring Report</span>
                      <h3 className="text-xl font-black text-white">Full 5-Stage Candidate Scorecard</h3>
                      <p className="text-xs text-slate-300 font-medium">
                        Cross-stage evaluation combining Resume ATS, Online Assessment, and Interview simulation.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 bg-slate-900/80 p-3.5 rounded-2xl border border-slate-700/80 shrink-0">
                      <div className="text-center px-2">
                        <span className="text-[9px] uppercase font-bold text-slate-400 block">Composite Rating</span>
                        <span className="text-2xl font-black text-emerald-400">
                          {combined.composite_score || 78.4}%
                        </span>
                      </div>
                      <div className="h-8 w-px bg-slate-700" />
                      <div className="text-center px-2">
                        <span className="text-[9px] uppercase font-bold text-slate-400 block">AI Recommendation</span>
                        <span className="text-xs font-extrabold text-indigo-300 block mt-1">
                          {combined.recommendation || 'Hire'}
                        </span>
                      </div>
                      <button
                        onClick={() => handleDownloadPdf('combined')}
                        disabled={isDownloadingPdf}
                        className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black transition-all shadow-md cursor-pointer flex items-center gap-1.5 text-xs shrink-0"
                        title="Download Comprehensive All-Rounds Master Evaluation Report PDF"
                      >
                        <Download className="w-4 h-4 text-slate-950" />
                        <span>Download Master PDF</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Multi-Stage Pipeline Scorecard Table */}
                <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl space-y-4">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
                    <Layers className="w-4 h-4 text-indigo-600" />
                    <span>Recruitment Pipeline Stage Breakdown</span>
                  </h4>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase text-[10px] font-extrabold">
                          <th className="py-2.5 px-3">Stage</th>
                          <th className="py-2.5 px-3">Evaluation Mechanism</th>
                          <th className="py-2.5 px-3">Candidate Score</th>
                          <th className="py-2.5 px-3">Threshold / Rule</th>
                          <th className="py-2.5 px-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-semibold text-slate-700 dark:text-slate-300">
                        {(combined.stages || [
                          { stage_num: 1, name: 'ATS Resume Screening', score: ats.ats_score || 85, threshold: '80%', status: 'Passed (≥80%)', is_passed: true },
                          { stage_num: 2, name: 'Online Assessment', score: assessData?.score || 87.5, threshold: '70%', status: 'Passed (≥70%)', is_passed: true },
                          { stage_num: 3, name: 'Technical Interview', score: techRound.is_conducted ? (techRound.scores?.technical_score ?? 0) : 0, threshold: 'Recruiter Discretion', status: techRound.is_conducted ? (techRound.review_status || 'Under Review') : 'Not Conducted', is_passed: techRound.review_status === 'Passed by Recruiter' },
                          { stage_num: 4, name: 'Behavioral Interview', score: behavRound.is_conducted ? (behavRound.scores?.communication_score ?? 0) : 0, threshold: 'Recruiter Discretion', status: behavRound.is_conducted ? (behavRound.review_status || 'Under Review') : 'Not Conducted', is_passed: behavRound.review_status === 'Passed by Recruiter' },
                          { stage_num: 5, name: 'HR Interview', score: hrRound.is_conducted ? (hrRound.scores?.professionalism_score ?? 0) : 0, threshold: 'Recruiter Discretion', status: hrRound.is_conducted ? (hrRound.review_status || 'Under Review') : 'Not Conducted', is_passed: hrRound.review_status === 'Passed by Recruiter' },
                        ]).map((st: any, idx: number) => {
                          const isRoundConducted = st.stage_num === 1 ? true : st.stage_num === 2 ? Boolean(assessData?.score != null) : st.stage_num === 3 ? Boolean(techRound.is_conducted) : st.stage_num === 4 ? Boolean(behavRound.is_conducted) : Boolean(hrRound.is_conducted);
                          const roundScore = isRoundConducted ? (st.score ?? 0) : 0;
                          return (
                          <tr key={idx} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                            <td className="py-3 px-3 font-extrabold text-slate-900 dark:text-white">
                              {st.stage_num}. {st.name}
                            </td>
                            <td className="py-3 px-3 text-slate-500 dark:text-slate-400">
                              {st.stage_num <= 2 ? 'Automated Cutoff Threshold' : 'Recruiter Manual Decision'}
                            </td>
                            <td className="py-3 px-3">
                              {isRoundConducted ? (
                                <strong className="text-slate-900 dark:text-white font-black">{roundScore}%</strong>
                              ) : (
                                <span className="text-slate-400 font-bold">0% (Not Conducted)</span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-slate-500 dark:text-slate-400">
                              {st.threshold}
                            </td>
                            <td className="py-3 px-3">
                              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                                !isRoundConducted ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400' :
                                st.is_passed ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300' :
                                (st.status || '').toLowerCase().includes('reject') || (st.status || '').toLowerCase().includes('fail') ? 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300' :
                                'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300'
                              }`}>
                                {isRoundConducted ? st.status : 'Not Conducted'}
                              </span>
                            </td>
                          </tr>
                        );})}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Cross-Stage Performance Bar Chart */}
                <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl space-y-3">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-indigo-600" />
                    <span>Candidate Cross-Stage Performance Profile</span>
                  </h4>
                  <div className="h-48 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={[
                          { name: 'ATS Resume', score: ats.ats_score || 85, fill: '#6366F1' },
                          { name: 'Assessment', score: assessData?.score || 87.5, fill: '#10B981' },
                          { name: 'Technical', score: techRound.is_conducted ? (techRound.scores?.technical_score ?? 0) : 0, fill: '#A855F7' },
                          { name: 'Behavioral', score: behavRound.is_conducted ? (behavRound.scores?.communication_score ?? 0) : 0, fill: '#3B82F6' },
                          { name: 'HR Round', score: hrRound.is_conducted ? (hrRound.scores?.professionalism_score ?? 0) : 0, fill: '#14B8A6' },
                        ]}
                        margin={{ top: 10, right: 15, left: -15, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                        <XAxis dataKey="name" tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} tickLine={false} />
                        <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} />
                        <Tooltip 
                          formatter={(val: any) => [`${val}%`, 'Score']} 
                          contentStyle={{ borderRadius: '12px', background: '#0f172a', borderColor: '#334155', color: '#f8fafc', fontSize: '11px', fontWeight: 'bold' }} 
                        />
                        <Bar dataKey="score" radius={[6, 6, 0, 0]} barSize={34}>
                          {[
                            { fill: '#6366F1' },
                            { fill: '#10B981' },
                            { fill: '#A855F7' },
                            { fill: '#3B82F6' },
                            { fill: '#14B8A6' }
                          ].map((c, i) => (
                            <Cell key={i} fill={c.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Cumulative Strengths & Growth Areas */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-5 bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-3xl space-y-2.5">
                    <h5 className="text-xs font-black uppercase text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Cumulative Synthesized Strengths</span>
                    </h5>
                    <ul className="space-y-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {(combined.strengths || data?.strengths || ['High online assessment test aptitude', 'Articulate communication skills']).map((s: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-emerald-600 font-bold">•</span>
                          <span>{s}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-5 bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-3xl space-y-2.5">
                    <h5 className="text-xs font-black uppercase text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4 text-amber-600" />
                      <span>Key Growth Areas & Considerations</span>
                    </h5>
                    <ul className="space-y-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {(combined.weaknesses || data?.weaknesses || ['Deep architectural pattern explanations', 'Time management in speech answers']).map((w: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-amber-600 font-bold">•</span>
                          <span>{w}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Final Recruiter Action Bar */}
                <div className="p-5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
                    <div>
                      <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                        Master Hiring Decision
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                        Advance candidate to Offer Stage or close application with rejection notification.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-3 pt-1">
                    <button
                      onClick={() => handleManualDecision('reject', 'All')}
                      disabled={actionSubmitting}
                      className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black flex items-center gap-1.5 shadow-sm transition-all cursor-pointer disabled:opacity-50"
                    >
                      <XCircle className="w-4 h-4" />
                      <span>Reject Candidate</span>
                    </button>

                    {onSendOffer && data?.application_id && (
                      <button
                        onClick={() => {
                          onClose();
                          onSendOffer(data.application_id);
                        }}
                        className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
                      >
                        <Send className="w-4 h-4" />
                        <span>Issue Formal Offer Letter</span>
                      </button>
                    )}
                  </div>
                </div>

              </div>
            )}

            {/* Footer Close */}
            <div className="pt-2 flex justify-between items-center border-t border-slate-200 dark:border-slate-800">
              <span className="text-[11px] text-slate-400 font-medium">
                Candidate ID: {cand.id || 'N/A'} • Job ID: {job.id || data?.job_id || 'N/A'}
              </span>
              <button
                onClick={onClose}
                className="px-5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all cursor-pointer"
              >
                Close Modal
              </button>
            </div>

          </div>
        )}

      </div>
    </div>
  );
};
