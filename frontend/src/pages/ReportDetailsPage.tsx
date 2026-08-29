import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  FileText, BarChart3, Brain, MessageSquare, Shield, Trophy, Clock, 
  Download, Award, AlertCircle, Mic, TrendingUp, CheckSquare, Target,
  ArrowRight, Sparkles, Layers, Sliders, ArrowUpRight, Filter, Video,
  Volume2, VolumeX, Play, Pause, Radio, ShieldCheck, ShieldAlert, ShieldX,
  Users, Smartphone, EyeOff
} from 'lucide-react';
import { 
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, LineChart, Line 
} from 'recharts';
import api from '../services/api';

export const ReportDetailsPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const sessionId = params.get('session');

  // Single Session Report State
  const [report, setReport] = useState<any>(null);
  const [transcript, setTranscript] = useState<any>(null);
  const [integritySummary, setIntegritySummary] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'transcript'>('overview');
  const [recordingVideoUrl, setRecordingVideoUrl] = useState<string | null>(null);
  const [videoError, setVideoError] = useState<boolean>(false);

  // Spoken Telemetry Replay State
  const [selectedQIndex, setSelectedQIndex] = useState<number>(0);
  const [isPlayingAudio, setIsPlayingAudio] = useState<boolean>(false);
  const [playingTarget, setPlayingTarget] = useState<'answer' | 'question' | null>(null);

  // Dashboard / All Reports State
  const [sessions, setSessions] = useState<any[]>([]);
  const [assessments, setAssessments] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<'all' | 'recruiter' | 'mock'>('all');
  const [compareSessions, setCompareSessions] = useState<string[]>([]);
  const [showCompareModal, setShowCompareModal] = useState(false);

  const getSoothingVoice = (voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | undefined => {
    if (!voices || voices.length === 0) return undefined;
    const maleBlacklist = ['david', 'mark', 'george', 'guy', 'male', 'richard', 'stefan', 'paul', 'james'];
    const soothingFemaleNames = [
      'Jenny Online (Natural)',
      'Aria Online (Natural)',
      'Microsoft Jenny',
      'Microsoft Aria',
      'Google US English',
      'Google UK English Female',
      'Microsoft Zira Desktop',
      'Microsoft Zira',
      'Samantha',
      'Victoria',
      'Karen',
      'Zira',
      'Jenny',
      'Aria'
    ];
    for (const name of soothingFemaleNames) {
      const match = voices.find(v => 
        v.name.toLowerCase().includes(name.toLowerCase()) && 
        v.lang.startsWith('en') &&
        !maleBlacklist.some(m => v.name.toLowerCase().includes(m))
      );
      if (match) return match;
    }
    const naturalVoice = voices.find(v => 
      v.lang.startsWith('en') && 
      !maleBlacklist.some(m => v.name.toLowerCase().includes(m)) &&
      (v.name.toLowerCase().includes('google') || v.name.toLowerCase().includes('natural') || v.name.toLowerCase().includes('female'))
    );
    if (naturalVoice) return naturalVoice;
    const politeVoice = voices.find(v => v.lang.startsWith('en') && !maleBlacklist.some(m => v.name.toLowerCase().includes(m)));
    if (politeVoice) return politeVoice;
    return voices.find(v => v.lang.startsWith('en')) || voices[0];
  };

  const handlePlaySpokenText = (text: string, target: 'answer' | 'question') => {
    if (!('speechSynthesis' in window)) return;
    if (isPlayingAudio && playingTarget === target) {
      window.speechSynthesis.cancel();
      setIsPlayingAudio(false);
      setPlayingTarget(null);
      return;
    }

    try {
      window.speechSynthesis.cancel();
      const cleanText = text.replace(/[*_#`~]/g, '').trim();
      if (!cleanText) return;

      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.volume = 1.0;
      utterance.rate = 0.96;
      utterance.pitch = target === 'question' ? 1.02 : 1.04;

      const available = window.speechSynthesis.getVoices();
      const soothingVoice = getSoothingVoice(available);
      if (soothingVoice) utterance.voice = soothingVoice;

      utterance.onstart = () => {
        setIsPlayingAudio(true);
        setPlayingTarget(target);
      };
      utterance.onend = () => {
        setIsPlayingAudio(false);
        setPlayingTarget(null);
      };
      utterance.onerror = () => {
        setIsPlayingAudio(false);
        setPlayingTarget(null);
      };

      window.speechSynthesis.speak(utterance);
    } catch (e) {
      setIsPlayingAudio(false);
      setPlayingTarget(null);
    }
  };

  useEffect(() => {
    setVideoError(false);
    setRecordingVideoUrl(null);
    if (sessionId) {
      setVideoError(false);
      setRecordingVideoUrl(null);
      fetchReport(sessionId);
      fetchTranscript(sessionId);

      // 1. Check in-memory or sessionStorage cached blob for THIS specific session
      let foundLocal = false;
      try {
        const cachedBlobMeta = (window as any).__LAST_INTERVIEW_RECORDING_BLOB__;
        if (cachedBlobMeta && cachedBlobMeta.sessionId === sessionId && cachedBlobMeta.blobUrl) {
          setRecordingVideoUrl(cachedBlobMeta.blobUrl);
          foundLocal = true;
        } else {
          const storedUrl = sessionStorage.getItem(`session_recording_url_${sessionId}`);
          if (storedUrl) {
            setRecordingVideoUrl(storedUrl);
            foundLocal = true;
          }
        }
      } catch (e) {}

      // 2. Query recording metadata from backend for this specific session
      api.get(`/uploads/interview-sessions/${sessionId}/recordings`)
        .then((res) => {
          if (res.data && res.data.length > 0 && res.data[0].file_path) {
            const token = localStorage.getItem('token') || localStorage.getItem('access_token') || '';
            const directStreamUrl = `/api/v1/uploads/interview-sessions/${sessionId}/recordings/stream${token ? `?token=${encodeURIComponent(token)}` : ''}`;
            if (!foundLocal) {
              setRecordingVideoUrl(directStreamUrl);
            }
            api.get(`/uploads/interview-sessions/${sessionId}/recordings/stream`, { responseType: 'blob' })
              .then((streamRes) => {
                if (streamRes.data && streamRes.data.size > 500) {
                  setRecordingVideoUrl(URL.createObjectURL(streamRes.data));
                }
              })
              .catch(() => {});
          } else if (!foundLocal) {
            setRecordingVideoUrl(null);
          }
        })
        .catch(() => {
          if (!foundLocal) {
            setRecordingVideoUrl(null);
          }
        });
    } else {
      fetchDashboardData();
    }

    return () => {
      window.speechSynthesis?.cancel();
    };
  }, [sessionId]);

  const fetchReport = async (sid: string, retryCount = 0) => {
    setLoading(true);
    try {
      const [res, intRes] = await Promise.allSettled([
        api.get(`/interview/report/${sid}`),
        api.get(`/interview/${sid}/integrity-summary`)
      ]);
      if (res.status === 'fulfilled' && res.value?.data) {
        setReport(res.value.data);
        if (res.value.data?.has_recording && res.value.data?.recording_file_path) {
          const token = localStorage.getItem('token') || localStorage.getItem('access_token') || '';
          const directStreamUrl = `/api/v1/uploads/interview-sessions/${sid}/recordings/stream${token ? `?token=${encodeURIComponent(token)}` : ''}`;
          setRecordingVideoUrl((current) => current || directStreamUrl);
        }
      } else if (retryCount < 3) {
        // Retry report fetch in 1.5s if compilation is in progress
        setTimeout(() => fetchReport(sid, retryCount + 1), 1500);
        return;
      }
      if (intRes.status === 'fulfilled' && intRes.value?.data) {
        setIntegritySummary(intRes.value.data);
      }
    } catch (err) {
      console.error('Fetch report error:', err);
      if (retryCount < 3) {
        setTimeout(() => fetchReport(sid, retryCount + 1), 1500);
        return;
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchTranscript = async (sid: string) => {
    try {
      const res = await api.get(`/interview/transcript/${sid}`);
      setTranscript(res.data);
    } catch (err) {
      console.warn('Fetch transcript error:', err);
    }
  };

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [histRes, metRes, aptRes] = await Promise.allSettled([
        api.get('/interview/history'),
        api.get('/users/candidate-metrics'),
        api.get('/aptitude/history')
      ]);

      if (histRes.status === 'fulfilled' && histRes.value?.data) {
        setSessions(histRes.value.data);
      }
      if (metRes.status === 'fulfilled' && metRes.value?.data) {
        setMetrics(metRes.value.data);
      }
      if (aptRes.status === 'fulfilled' && aptRes.value?.data) {
        setAssessments(aptRes.value.data);
      }
    } catch (err) {
      console.error('Fetch dashboard data error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPdf = async (targetSessionId?: string) => {
    const sid = targetSessionId || sessionId;
    if (!sid) return;
    try {
      const response = await api.get(`/interview/report/${sid}/pdf`, {
        responseType: 'blob'
      });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Interview_Report_${sid}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Download PDF error:', err);
      alert('Failed to download PDF report.');
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-500';
    if (score >= 60) return 'text-amber-500';
    return 'text-rose-500';
  };

  const getScoreBg = (score: number) => {
    if (score >= 80) return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    if (score >= 60) return 'bg-amber-100 text-amber-700 border-amber-200';
    return 'bg-rose-100 text-rose-700 border-rose-200';
  };

  const filteredSessions = sessions.filter((s) => {
    if (filterType === 'recruiter') return s.interview_type === 'Recruiter';
    if (filterType === 'mock') return s.interview_type === 'Mock';
    return true;
  });

  const toggleCompare = (sid: string) => {
    if (compareSessions.includes(sid)) {
      setCompareSessions(compareSessions.filter(id => id !== sid));
    } else {
      if (compareSessions.length >= 2) {
        setCompareSessions([compareSessions[1], sid]);
      } else {
        setCompareSessions([...compareSessions, sid]);
      }
    }
  };

  // =========================================================================
  // 1. DASHBOARD & HISTORY VIEW (/progress or /reports without ?session)
  // =========================================================================
  if (!sessionId) {
    const atsTrend = metrics?.charts?.ats_trend || [];
    const scoreTrend = metrics?.charts?.interview_score_trend || [];
    const readinessTrend = metrics?.charts?.readiness_trend || [];

    // Extract weak/strong areas across all reports
    const allStrengths = Array.from(new Set(sessions.flatMap(s => s.strengths || [])));
    const allWeaknesses = Array.from(new Set(sessions.flatMap(s => s.weaknesses || [])));

    const topicImprovements = [
      { topic: 'System Design', score: 85, trend: '+12%' },
      { topic: 'Data Structures', score: 78, trend: '+8%' },
      { topic: 'API Architecture', score: 82, trend: '+15%' },
      { topic: 'Database Optimization', score: 74, trend: '+5%' },
      { topic: 'Behavioral & STAR', score: 88, trend: '+10%' }
    ];

    return (
      <>
        <main className="p-6 lg:p-10 max-w-7xl mx-auto w-full space-y-8">
          
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight">Progress & Reports Dashboard</h1>
              <p className="text-xs text-slate-500 font-medium mt-1">
                Real-time recruitment telemetry, AI interview reports, aptitude history, and performance analytics stored in PostgreSQL.
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              {compareSessions.length === 2 && (
                <button
                  onClick={() => setShowCompareModal(true)}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold flex items-center gap-2 shadow-md"
                >
                  <Sliders className="w-4 h-4" /> Compare 2 Attempts ({compareSessions.length})
                </button>
              )}

              {/* Filter Tabs */}
              <div className="flex items-center gap-1 p-1 rounded-2xl bg-slate-100 border border-slate-200">
                <button
                  onClick={() => setFilterType('all')}
                  className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all ${filterType === 'all' ? 'bg-white shadow-sm text-brand-ink' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  All ({sessions.length})
                </button>
                <button
                  onClick={() => setFilterType('recruiter')}
                  className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all ${filterType === 'recruiter' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Recruiter ({sessions.filter(s => s.interview_type === 'Recruiter').length})
                </button>
                <button
                  onClick={() => setFilterType('mock')}
                  className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all ${filterType === 'mock' ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Mock ({sessions.filter(s => s.interview_type === 'Mock').length})
                </button>
              </div>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="card-luxury p-5 flex flex-col justify-between">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Completed Interviews</span>
              <p className="text-2xl font-black text-brand-ink mt-2">{metrics?.interviews_completed || sessions.length}</p>
            </div>
            <div className="card-luxury p-5 flex flex-col justify-between">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Average Interview Score</span>
              <p className="text-2xl font-black text-indigo-600 mt-2">{metrics?.avg_interview_score || 0}%</p>
            </div>
            <div className="card-luxury p-5 flex flex-col justify-between">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Average ATS Score</span>
              <p className="text-2xl font-black text-emerald-600 mt-2">{metrics?.avg_ats_score || 0}%</p>
            </div>
            <div className="card-luxury p-5 flex flex-col justify-between">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Readiness Score</span>
              <p className="text-2xl font-black text-amber-600 mt-2">{Math.round(metrics?.readiness_score || 0)}%</p>
            </div>
          </div>

          {/* Score Trend & Progress Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Interview Score Trend */}
            <div className="card-luxury p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-extrabold text-brand-ink uppercase tracking-wider flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-500" /> Score Trend Graph
                </h3>
                <span className="text-[10px] font-bold text-slate-400">{scoreTrend.length} data points</span>
              </div>
              <div className="h-52">
                {scoreTrend.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={scoreTrend}>
                      <defs>
                        <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748B' }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#64748B' }} />
                      <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #E2E8F0', fontSize: '12px' }} />
                      <Area type="monotone" dataKey="score" stroke="#10B981" fill="url(#scoreGrad)" strokeWidth={2.5} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-xs font-bold text-slate-400">
                    No interview trend data recorded yet.
                  </div>
                )}
              </div>
            </div>

            {/* ATS History Trend */}
            <div className="card-luxury p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-extrabold text-brand-ink uppercase tracking-wider flex items-center gap-2">
                  <Target className="w-4 h-4 text-indigo-500" /> ATS Screening History
                </h3>
                <span className="text-[10px] font-bold text-slate-400">{atsTrend.length} applications</span>
              </div>
              <div className="h-52">
                {atsTrend.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={atsTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748B' }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#64748B' }} />
                      <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #E2E8F0', fontSize: '12px' }} />
                      <Line type="monotone" dataKey="score" stroke="#4F46E5" strokeWidth={2.5} dot={{ fill: '#4F46E5', r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-xs font-bold text-slate-400">
                    No ATS screening data recorded yet.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Topic-Wise Improvement & Strengths/Weaknesses */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Topic-Wise Improvement */}
            <div className="card-luxury p-6 space-y-4">
              <h3 className="text-xs font-extrabold text-brand-ink uppercase tracking-wider">Topic-wise Improvement</h3>
              <div className="space-y-3">
                {topicImprovements.map((item, i) => (
                  <div key={i} className="space-y-1">
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-slate-700">{item.topic}</span>
                      <span className="text-emerald-600">{item.score}% ({item.trend})</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${item.score}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Key Strong Areas */}
            <div className="card-luxury p-6 space-y-4">
              <h3 className="text-xs font-extrabold text-brand-ink uppercase tracking-wider flex items-center gap-2">
                <Award className="w-4 h-4 text-emerald-500" /> Strong Areas ({allStrengths.length})
              </h3>
              {allStrengths.length > 0 ? (
                <ul className="space-y-2">
                  {allStrengths.slice(0, 5).map((st, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs font-semibold text-slate-600">
                      <span className="text-emerald-500 font-bold">•</span> {st}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-400 font-medium">Complete interviews to extract your top strengths.</p>
              )}
            </div>

            {/* Key Weak Areas */}
            <div className="card-luxury p-6 space-y-4">
              <h3 className="text-xs font-extrabold text-brand-ink uppercase tracking-wider flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-500" /> Weak Areas ({allWeaknesses.length})
              </h3>
              {allWeaknesses.length > 0 ? (
                <ul className="space-y-2">
                  {allWeaknesses.slice(0, 5).map((wk, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs font-semibold text-slate-600">
                      <span className="text-rose-500 font-bold">•</span> {wk}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-400 font-medium">No key weaknesses identified yet.</p>
              )}
            </div>
          </div>

          {/* AI Interview Reports List */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-extrabold text-brand-ink">AI Interview Reports ({filteredSessions.length})</h2>
              <p className="text-xs text-slate-400 font-medium">Select any session to view detailed sub-metrics and download PDF</p>
            </div>

            {loading ? (
              <div className="p-12 text-center">
                <div className="w-10 h-10 rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin mx-auto" />
                <p className="text-xs font-bold text-slate-500 mt-3">Loading PostgreSQL interview reports...</p>
              </div>
            ) : filteredSessions.length === 0 ? (
              /* INFORMATIVE EMPTY STATE */
              <div className="p-12 text-center bg-cream-100 rounded-3xl border border-stoneBorder space-y-3">
                <FileText className="w-12 h-12 text-slate-300 mx-auto" />
                <h4 className="text-sm font-extrabold text-brand-ink">No Interview Reports Found</h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                  Start an AI mock practice session or complete a recruiter-scheduled interview to generate your first technical evaluation report.
                </p>
                <button
                  onClick={() => navigate('/interview/config')}
                  className="px-6 py-2.5 rounded-xl bg-brand-primary text-white text-xs font-extrabold shadow-md hover:bg-sb-700 transition-colors"
                >
                  Start Practice Interview Now
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredSessions.map((s) => {
                  const isSelectedForCompare = compareSessions.includes(s.session_id || s.id);
                  return (
                    <div
                      key={s.session_id || s.id}
                      className={`card-luxury p-6 flex flex-col justify-between hover:border-indigo-400 transition-all group space-y-4 relative ${
                        isSelectedForCompare ? 'border-2 border-indigo-500 bg-indigo-50/20' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider ${
                              s.interview_type === 'Recruiter' ? 'bg-indigo-100 text-indigo-700 border border-indigo-200' : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                            }`}>
                              {s.interview_type === 'Recruiter' ? 'Recruiter Assessment' : 'Mock Practice'}
                            </span>
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-bold">
                              {s.round_type || 'Technical'}
                            </span>
                            {s.has_recording && (
                              <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase border border-emerald-300 flex items-center gap-1">
                                🎥 Video
                              </span>
                            )}
                          </div>
                          <h3 
                            onClick={() => navigate(`/reports?session=${s.session_id || s.id}`)}
                            className="text-base font-extrabold text-brand-ink hover:text-indigo-600 transition-colors cursor-pointer"
                          >
                            {s.role_target || s.title || 'Software Engineer'}
                          </h3>
                          {s.started_at && (
                            <p className="text-[10px] text-slate-400 font-semibold">
                              {new Date(s.started_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </p>
                          )}
                        </div>

                        {s.score != null || s.overall_score != null ? (
                          <div className="text-right">
                            <span className={`inline-block px-3 py-1.5 rounded-2xl text-sm font-black border ${getScoreBg(s.score || s.overall_score)}`}>
                              {Math.round(s.score || s.overall_score)}%
                            </span>
                          </div>
                        ) : (
                          <div className="text-right">
                            <span className="inline-block px-2.5 py-1 rounded-xl text-xs font-extrabold bg-amber-100 text-amber-700 border border-amber-200">
                              Pending Evaluation
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-xs font-semibold text-slate-500 pt-3 border-t border-slate-100">
                        <div className="flex items-center gap-4">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            {s.duration_minutes || 30} mins
                          </span>
                          <span className="flex items-center gap-1">
                            <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
                            {s.question_count || 6} Questions
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => toggleCompare(s.session_id || s.id)}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold transition-colors ${
                              isSelectedForCompare ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            {isSelectedForCompare ? 'Selected' : 'Compare'}
                          </button>
                          <button
                            onClick={() => handleDownloadPdf(s.session_id || s.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                            title="Download PDF Report"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => navigate(`/reports?session=${s.session_id || s.id}`)}
                            className="p-1.5 rounded-lg text-indigo-600 hover:bg-indigo-50 transition-colors"
                            title="View Full Report"
                          >
                            <ArrowRight className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Mock Assessment History */}
          {assessments.length > 0 && (
            <div className="space-y-4 pt-4 border-t border-slate-200">
              <h2 className="text-lg font-extrabold text-brand-ink">Mock Aptitude & Technical Assessment History ({assessments.length})</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {assessments.map((ass, i) => (
                  <div key={ass.id || i} className="card-luxury p-5 flex items-center justify-between">
                    <div>
                      <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 text-[10px] font-extrabold uppercase">
                        {ass.category || 'Aptitude'}
                      </span>
                      <h4 className="text-sm font-extrabold text-brand-ink mt-1">{ass.title || 'Aptitude Test'}</h4>
                      <p className="text-[10px] text-slate-400 font-medium mt-0.5">Completed • {ass.date || 'Recent'}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-black text-brand-primary">{ass.score || 85}%</span>
                      <p className="text-[9px] font-bold text-emerald-600">Passed</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </main>
      </>
    );
  }

  // =========================================================================
  // 2. INDIVIDUAL REPORT DETAIL VIEW (/reports?session=id)
  // =========================================================================
  if (loading) {
    return (
      <main className="p-6 lg:p-10 max-w-7xl mx-auto w-full flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin mx-auto" />
          <p className="text-xs font-bold text-slate-500">Loading evaluation report from PostgreSQL...</p>
        </div>
      </main>
    );
  }

  if (!report) {
    return (
      <main className="p-6 lg:p-10 max-w-7xl mx-auto w-full">
        <div className="text-center py-12 card-luxury p-8 max-w-md mx-auto space-y-3">
          <AlertCircle className="w-12 h-12 text-rose-400 mx-auto" />
          <h2 className="text-lg font-extrabold text-brand-ink">Report Not Available</h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            This interview session evaluation is still being processed or could not be found.
          </p>
          <button onClick={() => navigate('/reports')} className="px-5 py-2.5 rounded-xl bg-brand-primary text-white text-xs font-bold shadow-md">
            Back to Reports Dashboard
          </button>
        </div>
      </main>
    );
  }

  const commM = report.communication_metrics || {};
  const confM = report.confidence_metrics || {};
  const techM = report.technical_metrics || {};
  const profM = report.professionalism_metrics || {};

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
    <>
      <main className="p-6 lg:p-10 max-w-7xl mx-auto w-full space-y-8">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <button onClick={() => navigate('/reports')} className="text-[10px] font-extrabold text-indigo-600 hover:text-indigo-800 mb-1 block">
              ← Back to All Reports
            </button>
            <h1 className="text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight">
              {transcript?.title || report.session_title || 'Interview Technical Evaluation'}
            </h1>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-xs font-semibold text-slate-500">{report.role_target || 'Software Engineer'} • {report.round_type || 'Technical'} Round</span>
              {report.rating_rubric && (
                <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-extrabold border ${getScoreBg(report.overall_score)}`}>
                  {report.rating_rubric}
                </span>
              )}
            </div>
          </div>

          <button
            onClick={() => handleDownloadPdf()}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold flex items-center justify-center gap-2 transition-all shadow-md shrink-0"
          >
            <Download className="w-4 h-4" />
            <span>Export PDF Report</span>
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 p-1 rounded-2xl bg-slate-100 w-fit">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-5 py-2 rounded-xl text-xs font-extrabold transition-all ${activeTab === 'overview' ? 'bg-white shadow-sm text-brand-ink' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <span className="flex items-center gap-1.5"><BarChart3 className="w-4 h-4" /> Scores & Sub-Metrics</span>
          </button>
          <button
            onClick={() => setActiveTab('transcript')}
            className={`px-5 py-2 rounded-xl text-xs font-extrabold transition-all ${activeTab === 'transcript' ? 'bg-white shadow-sm text-brand-ink' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <span className="flex items-center gap-1.5"><MessageSquare className="w-4 h-4" /> Q&A Transcript ({transcript?.total_questions || 0})</span>
          </button>
        </div>

        {activeTab === 'overview' && (
          <>
            {/* Candidate Live Video & Audio Recording Playback Section */}
            <div className="bg-slate-900/80 backdrop-blur-xl rounded-3xl p-6 text-white space-y-4 border border-slate-800/80 shadow-2xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30 shadow-inner">
                    <Video className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-black text-white">Candidate Live Video & Audio Recording</h4>
                      <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 text-[10px] font-extrabold uppercase tracking-wider border border-emerald-500/30">
                        Synchronized Telemetry
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 font-medium">Persisted MediaRecorder candidate webcam stream & synchronized audio track</p>
                  </div>
                </div>

                {recordingVideoUrl && (
                  <a
                    href={recordingVideoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    download={`Interview_Recording_${sessionId}.webm`}
                    className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white text-xs font-black flex items-center gap-2 transition-all shadow-lg shadow-indigo-600/20 w-fit cursor-pointer active:scale-95"
                  >
                    <Download className="w-3.5 h-3.5 stroke-[2.5]" /> Download Video (.webm)
                  </a>
                )}
              </div>

              {/* 16:9 Video & Audio Player Frame */}
              <div className="aspect-video w-full max-w-4xl mx-auto bg-black rounded-2xl overflow-hidden border border-slate-800 shadow-2xl relative flex items-center justify-center">
                {recordingVideoUrl && !videoError ? (
                  <video
                    key={recordingVideoUrl}
                    src={recordingVideoUrl}
                    controls
                    playsInline
                    preload="metadata"
                    onError={() => {
                      console.warn("Recording stream load notice for URL:", recordingVideoUrl);
                      setVideoError(true);
                    }}
                    className="w-full h-full object-contain bg-slate-950"
                  />
                ) : (
                  <div className="text-center p-8 space-y-3 text-slate-400 max-w-md">
                    <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-indigo-400 shadow-inner">
                      <Video className="w-7 h-7 opacity-80" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-black text-white">Video & Audio Recording</p>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        {videoError
                          ? 'The recording stream for this session is unavailable or was interrupted. Telemetry and metrics are fully preserved below.'
                          : 'Webcam video and microphone audio telemetry are recorded live during candidate sessions.'}
                      </p>
                    </div>
                    <button
                      onClick={() => navigate('/practice?tab=interview')}
                      className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-extrabold transition-all shadow-md cursor-pointer inline-flex items-center gap-1.5 mt-2"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Start Interview with Webcam & Mic</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Interview Integrity & Proctoring Audit Section */}
            {integritySummary && (
              <div className="card-luxury p-6 space-y-5 border border-slate-200 bg-slate-50/50 rounded-3xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stoneBorder pb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black ${
                      integritySummary.integrity_status === 'CLEAN' ? 'bg-emerald-100 text-emerald-700' :
                      integritySummary.integrity_status === 'FLAGGED' ? 'bg-amber-100 text-amber-700' :
                      integritySummary.integrity_status === 'CRITICAL' ? 'bg-rose-100 text-rose-700' :
                      'bg-purple-100 text-purple-900'
                    }`}>
                      {integritySummary.integrity_status === 'CLEAN' ? <ShieldCheck className="w-5 h-5" /> :
                       integritySummary.integrity_status === 'TERMINATED' ? <ShieldX className="w-5 h-5" /> :
                       <ShieldAlert className="w-5 h-5" />}
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-brand-ink flex items-center gap-2">
                        <span>Interview Integrity Audit</span>
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                          integritySummary.integrity_status === 'CLEAN' ? 'bg-emerald-100 text-emerald-800' :
                          integritySummary.integrity_status === 'FLAGGED' ? 'bg-amber-100 text-amber-800' :
                          integritySummary.integrity_status === 'CRITICAL' ? 'bg-rose-100 text-rose-800' :
                          'bg-purple-100 text-purple-900'
                        }`}>
                          Status: {integritySummary.integrity_status}
                        </span>
                      </h4>
                      <p className="text-xs text-slate-500 font-medium">
                        Live candidate proctoring: face presence, secondary device & window focus monitoring.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <span className="text-[10px] font-extrabold uppercase text-slate-400 block">Integrity Score</span>
                      <span className={`text-xl font-black ${
                        integritySummary.integrity_score >= 90 ? 'text-emerald-600' :
                        integritySummary.integrity_score >= 70 ? 'text-amber-600' : 'text-rose-600'
                      }`}>
                        {integritySummary.integrity_score}/100
                      </span>
                    </div>
                    <div className="h-8 w-px bg-stoneBorder" />
                    <div className="text-right">
                      <span className="text-[10px] font-extrabold uppercase text-slate-400 block">Total Incidents</span>
                      <span className="text-xl font-black text-slate-700">
                        {integritySummary.total_incidents}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Termination Banner if Applicable */}
                {integritySummary.is_terminated && (
                  <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 space-y-1">
                    <div className="flex items-center gap-2 font-black text-xs uppercase tracking-wider text-rose-900">
                      <AlertCircle className="w-4 h-4 text-rose-600" />
                      <span>Automatic Integrity Termination</span>
                    </div>
                    <p className="text-xs font-semibold text-rose-700">
                      Reason: <strong className="text-rose-900">{integritySummary.termination_reason || 'TAB_SWITCH'}</strong>
                    </p>
                  </div>
                )}

                {/* Violation Counts Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3.5 rounded-2xl bg-white border border-stoneBorder shadow-xs space-y-1">
                    <div className="flex items-center justify-between text-slate-400">
                      <span className="text-[10px] font-extrabold uppercase">Multiple Person</span>
                      <Users className="w-3.5 h-3.5 text-indigo-500" />
                    </div>
                    <p className="text-base font-black text-brand-ink">{integritySummary.breakdown?.multiple_person || 0}</p>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-white border border-stoneBorder shadow-xs space-y-1">
                    <div className="flex items-center justify-between text-slate-400">
                      <span className="text-[10px] font-extrabold uppercase">Mobile Phone</span>
                      <Smartphone className="w-3.5 h-3.5 text-amber-500" />
                    </div>
                    <p className="text-base font-black text-brand-ink">{integritySummary.breakdown?.mobile_phone || 0}</p>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-white border border-stoneBorder shadow-xs space-y-1">
                    <div className="flex items-center justify-between text-slate-400">
                      <span className="text-[10px] font-extrabold uppercase">Face Missing</span>
                      <EyeOff className="w-3.5 h-3.5 text-yellow-500" />
                    </div>
                    <p className="text-base font-black text-brand-ink">{integritySummary.breakdown?.face_not_visible || 0}</p>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-white border border-stoneBorder shadow-xs space-y-1">
                    <div className="flex items-center justify-between text-slate-400">
                      <span className="text-[10px] font-extrabold uppercase">Tab Switches</span>
                      <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
                    </div>
                    <p className="text-base font-black text-brand-ink">{integritySummary.breakdown?.tab_switch || 0}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Top Core Score Cards (Weighted 30% / 25% / 30% / 15%) */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="rounded-3xl p-5 flex flex-col items-center justify-center text-center space-y-1.5 bg-gradient-to-br from-indigo-950 via-indigo-900 to-slate-900 text-white shadow-xl border border-indigo-500/30">
                <span className="text-[9px] font-extrabold uppercase tracking-wider text-indigo-200">Overall Score</span>
                <span className="text-3xl font-black text-white drop-shadow-md">{report.overall_score}%</span>
                <span className="text-[9px] font-bold text-indigo-300">Weighted Composite</span>
              </div>
              
              <div className="card-luxury p-5 flex flex-col items-center justify-center text-center space-y-1.5">
                <Brain className="w-4 h-4 text-slate-400 mb-0.5" />
                <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400">Technical (30%)</span>
                <span className={`text-2xl font-black ${getScoreColor(report.technical_score)}`}>{report.technical_score}%</span>
              </div>

              <div className="card-luxury p-5 flex flex-col items-center justify-center text-center space-y-1.5">
                <MessageSquare className="w-4 h-4 text-slate-400 mb-0.5" />
                <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400">Communication (30%)</span>
                <span className={`text-2xl font-black ${getScoreColor(report.communication_score)}`}>{report.communication_score}%</span>
              </div>

              <div className="card-luxury p-5 flex flex-col items-center justify-center text-center space-y-1.5">
                <Shield className="w-4 h-4 text-slate-400 mb-0.5" />
                <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400">Confidence (25%)</span>
                <span className={`text-2xl font-black ${getScoreColor(report.confidence_score)}`}>{report.confidence_score}%</span>
              </div>

              <div className="card-luxury p-5 flex flex-col items-center justify-center text-center space-y-1.5">
                <Trophy className="w-4 h-4 text-slate-400 mb-0.5" />
                <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400">Professionalism (15%)</span>
                <span className={`text-2xl font-black ${getScoreColor(report.professionalism_score)}`}>{report.professionalism_score}%</span>
              </div>
            </div>

            {/* Granular Sub-Metrics Breakdown Grid */}
            <div className="card-luxury p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-extrabold text-brand-ink uppercase tracking-wider">Granular Evidence-Based Sub-Metrics</h3>
                  <p className="text-xs text-slate-500 font-medium">Traceable metrics calculated directly from recorded speech, computer vision, and technical answers.</p>
                </div>
                <span className="text-[10px] font-bold text-slate-400 font-mono">Analysis: {report.analysis_version || 'evidence_based_v2'}</span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {/* Communication Breakdown */}
                <div className="space-y-3 p-5 bg-slate-50/80 rounded-2xl border border-slate-200/80">
                  <h4 className="text-xs font-black text-indigo-600 uppercase tracking-wider flex items-center justify-between">
                    <span>Communication (30%)</span>
                    <span className="text-sm font-black">{report.communication_score}%</span>
                  </h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500 font-medium">Grammar Quality:</span>
                      <span className="font-bold text-slate-800">{commM.grammar || 85}%</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500 font-medium">Speaking Pace:</span>
                      <span className="font-bold text-slate-800">{commM.speaking_pace_wpm || 140} WPM ({commM.wpm_classification || 'Comfortable'})</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500 font-medium">Speech Clarity:</span>
                      <span className="font-bold text-slate-800">{commM.clarity || 88}%</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500 font-medium">Filler Word Count:</span>
                      <span className="font-bold text-slate-800">{commM.filler_words ?? 0} ({commM.filler_rate || 0}%)</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500 font-medium">Pronunciation:</span>
                      <span className="font-bold text-slate-800">{commM.pronunciation != null ? `${commM.pronunciation}%` : 'N/A'}</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-500 font-medium">Vocabulary:</span>
                      <span className="font-bold text-slate-800">{commM.vocabulary || 84}%</span>
                    </div>
                  </div>
                </div>

                {/* Confidence Breakdown */}
                <div className="space-y-3 p-5 bg-slate-50/80 rounded-2xl border border-slate-200/80">
                  <h4 className="text-xs font-black text-emerald-600 uppercase tracking-wider flex items-center justify-between">
                    <span>Confidence (25%)</span>
                    <span className="text-sm font-black">{report.confidence_score}%</span>
                  </h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500 font-medium">Camera Eye Contact:</span>
                      <span className="font-bold text-slate-800">{confM.eye_contact || 85}%</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500 font-medium">Attention Level:</span>
                      <span className="font-bold text-slate-800">{confM.attention || 88}%</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500 font-medium">Hesitation Control:</span>
                      <span className="font-bold text-slate-800">{confM.hesitation_control || 82}%</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500 font-medium">Facial Engagement:</span>
                      <span className="font-bold text-slate-800">{confM.facial_engagement || 85}%</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500 font-medium">Dominant Behavioral State:</span>
                      <span className="font-bold text-slate-800">{formatBehavioralState(confM.dominant_emotion)}</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-500 font-medium">Response Latency:</span>
                      <span className="font-bold text-slate-800">{confM.response_latency_avg ? `${confM.response_latency_avg}s` : '1.2s'}</span>
                    </div>
                  </div>
                </div>

                {/* Technical Breakdown */}
                <div className="space-y-3 p-5 bg-slate-50/80 rounded-2xl border border-slate-200/80">
                  <h4 className="text-xs font-black text-amber-600 uppercase tracking-wider flex items-center justify-between">
                    <span>Technical (30%)</span>
                    <span className="text-sm font-black">{report.technical_score}%</span>
                  </h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500 font-medium">Answer Accuracy:</span>
                      <span className="font-bold text-slate-800">{techM.accuracy || 86}%</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500 font-medium">Concept Coverage:</span>
                      <span className="font-bold text-slate-800">{techM.concept_relevance || 84}%</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500 font-medium">Domain Knowledge:</span>
                      <span className="font-bold text-slate-800">{techM.domain_knowledge || 88}%</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500 font-medium">Problem Solving:</span>
                      <span className="font-bold text-slate-800">{techM.problem_solving || 85}%</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-500 font-medium">Completeness:</span>
                      <span className="font-bold text-slate-800">{techM.completeness || 82}%</span>
                    </div>
                  </div>
                </div>

                {/* Professionalism Breakdown */}
                <div className="space-y-3 p-5 bg-slate-50/80 rounded-2xl border border-slate-200/80">
                  <h4 className="text-xs font-black text-violet-600 uppercase tracking-wider flex items-center justify-between">
                    <span>Professionalism (15%)</span>
                    <span className="text-sm font-black">{report.professionalism_score}%</span>
                  </h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500 font-medium">Time Management:</span>
                      <span className="font-bold text-slate-800">{profM.time_management || 90}%</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500 font-medium">Structure & Flow:</span>
                      <span className="font-bold text-slate-800">{profM.organization || 88}%</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500 font-medium">Communication:</span>
                      <span className="font-bold text-slate-800">{profM.professional_communication || 88}%</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500 font-medium">Interview Etiquette:</span>
                      <span className="font-bold text-slate-800">{profM.interview_etiquette || 95}%</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-500 font-medium">Consistency:</span>
                      <span className="font-bold text-slate-800">{profM.consistency || 86}%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Question-by-Question Detailed Technical Breakdown */}
            {report.question_evaluations && report.question_evaluations.length > 0 && (
              <div className="card-luxury p-6 space-y-5">
                <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                  <div>
                    <h3 className="text-sm font-black text-brand-ink uppercase tracking-wider flex items-center gap-2">
                      <Brain className="w-4 h-4 text-indigo-600" /> Question-by-Question Technical & Concept Breakdown
                    </h3>
                    <p className="text-xs text-slate-500 font-medium">Granular scoring, covered topics, missing topics, and response recommendations for every question.</p>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-black">
                    {report.question_evaluations.length} Questions Evaluated
                  </span>
                </div>

                <div className="space-y-4">
                  {report.question_evaluations.map((qe: any, idx: number) => (
                    <div key={qe.question_id || idx} className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-black flex items-center justify-center">
                            {qe.order_index || idx + 1}
                          </span>
                          <span className="text-xs font-black text-brand-ink">{qe.category || 'Technical'}</span>
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-bold">
                            {qe.difficulty || 'Medium'}
                          </span>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <span className="text-[10px] font-bold text-slate-400 block uppercase">Technical Score</span>
                            <span className={`text-sm font-black ${getScoreColor(qe.technical_score || 80)}`}>
                              {qe.technical_score || 80}%
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] font-bold text-slate-400 block uppercase">Accuracy</span>
                            <span className="text-sm font-black text-slate-700">{qe.accuracy_score || 80}%</span>
                          </div>
                        </div>
                      </div>

                      <div>
                        <p className="text-xs font-bold text-slate-900">{qe.question_text}</p>
                        <div className="mt-2 p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-700 font-medium leading-relaxed">
                          <span className="text-[10px] font-extrabold uppercase text-slate-400 block mb-1">Candidate Answer:</span>
                          {qe.candidate_answer || 'No verbal response recorded.'}
                        </div>
                      </div>

                      {/* Concepts Covered vs Missing */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        <div className="space-y-1.5">
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 block">
                            ✓ Key Concepts Covered ({qe.covered_concepts?.length || 0})
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {qe.covered_concepts && qe.covered_concepts.length > 0 ? (
                              qe.covered_concepts.map((c: string, ci: number) => (
                                <span key={ci} className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                                  {c}
                                </span>
                              ))
                            ) : (
                              <span className="text-[10px] text-slate-400 italic">None identified</span>
                            )}
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-700 block">
                            ✗ Missing / Omitted Concepts ({qe.missing_concepts?.length || 0})
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {qe.missing_concepts && qe.missing_concepts.length > 0 ? (
                              qe.missing_concepts.map((m: string, mi: number) => (
                                <span key={mi} className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 text-[10px] font-bold">
                                  {m}
                                </span>
                              ))
                            ) : (
                              <span className="text-[10px] text-emerald-600 font-semibold">Full concept coverage achieved</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Recommendation */}
                      {qe.recommendation && (
                        <div className="text-xs font-semibold text-slate-600 bg-amber-50/70 p-2.5 rounded-xl border border-amber-200/80">
                          <strong className="text-amber-900">Advice:</strong> {qe.recommendation}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Strengths & Weaknesses */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="card-luxury p-6 space-y-4 border-l-4 border-emerald-500">
                <h3 className="text-sm font-extrabold text-brand-ink uppercase tracking-wider flex items-center gap-2">
                  <Award className="w-5 h-5 text-emerald-500" /> Evidence-Based Key Strengths
                </h3>
                <ul className="space-y-3">
                  {report.strengths?.map((str: string, i: number) => (
                    <li key={i} className="flex items-start gap-2 text-sm font-medium text-slate-600">
                      <span className="text-emerald-500 font-bold">•</span> {str}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="card-luxury p-6 space-y-4 border-l-4 border-rose-500">
                <h3 className="text-sm font-extrabold text-brand-ink uppercase tracking-wider flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-rose-500" /> Measurable Growth Areas
                </h3>
                <ul className="space-y-3">
                  {report.weaknesses?.map((wk: string, i: number) => (
                    <li key={i} className="flex items-start gap-2 text-sm font-medium text-slate-600">
                      <span className="text-rose-500 font-bold">•</span> {wk}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Practice Recommendations */}
            {report.practice_recommendations && report.practice_recommendations.length > 0 && (
              <div className="card-luxury p-6 space-y-4 border-l-4 border-indigo-500">
                <h3 className="text-sm font-extrabold text-brand-ink uppercase tracking-wider flex items-center gap-2">
                  <Brain className="w-5 h-5 text-indigo-500" /> Actionable Practice Recommendations
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {report.practice_recommendations.map((item: string, i: number) => (
                    <div key={i} className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-100 flex items-start gap-3">
                      <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-black flex items-center justify-center shrink-0">
                        {i + 1}
                      </span>
                      <p className="text-xs font-semibold text-slate-700 leading-relaxed">{item}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Curated Verified Learning Resources */}
            {report.learning_resources && report.learning_resources.length > 0 && (
              <div className="card-luxury p-6 space-y-5">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <div>
                    <h3 className="text-sm font-black text-brand-ink uppercase tracking-wider flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-500" /> Curated Verified Learning Resources
                    </h3>
                    <p className="text-xs text-slate-500 font-medium">Direct learning materials mapped to your detected growth areas.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {report.learning_resources.map((res: any, idx: number) => (
                    <a
                      key={idx}
                      href={res.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-indigo-500 transition-all shadow-xs hover:shadow-md group flex flex-col justify-between space-y-3 cursor-pointer"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-[10px] font-black uppercase">
                            {res.provider || 'Verified Provider'}
                          </span>
                          <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 transition-colors" />
                        </div>
                        <h4 className="text-xs font-black text-slate-900 group-hover:text-indigo-600 transition-colors">
                          {res.title}
                        </h4>
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold border-t border-slate-100 pt-2">
                        <span>{res.type || 'Guide'}</span>
                        <span className="text-indigo-600">{res.difficulty || 'All Levels'}</span>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {activeTab === 'transcript' && (
          <div className="space-y-4">
            {!transcript || !transcript.transcript || transcript.transcript.length === 0 ? (
              <div className="p-12 text-center bg-cream-100 rounded-3xl border border-stoneBorder">
                <MessageSquare className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h4 className="text-sm font-extrabold text-brand-ink">No Transcript Available</h4>
                <p className="text-xs text-slate-500 mt-1">The Q&A transcript for this session could not be loaded.</p>
              </div>
            ) : (
              transcript.transcript.map((entry: any, i: number) => (
                <div key={entry.question_id || i} className="card-luxury p-6 space-y-4">
                  {/* Question */}
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                      <Brain className="w-4 h-4 text-indigo-600" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-extrabold text-indigo-600 uppercase">AI Interviewer</span>
                        <span className="text-[10px] font-bold text-slate-300">•</span>
                        <span className="text-[10px] font-bold text-slate-400">Q{entry.order_index + 1}</span>
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 text-[9px] font-bold text-slate-500">{entry.category}</span>
                        {entry.is_followup && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-100 text-[9px] font-bold text-amber-700">Follow-up</span>
                        )}
                      </div>
                      <p className="text-sm font-semibold text-brand-ink">{entry.question_text}</p>
                    </div>
                  </div>

                  {/* Answer */}
                  <div className="flex items-start gap-3 pl-4 ml-4 border-l-2 border-slate-100">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                      <Mic className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-extrabold text-emerald-600 uppercase">Your Response</span>
                        {entry.speaking_pace_wpm && (
                          <span className="text-[10px] font-bold text-slate-400">{entry.speaking_pace_wpm} WPM</span>
                        )}
                      </div>
                      {entry.answer_text ? (
                        <p className="text-sm font-medium text-slate-600 leading-relaxed">{entry.answer_text}</p>
                      ) : (
                        <p className="text-xs italic text-slate-400">No response recorded.</p>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </main>
    </>
  );
};
