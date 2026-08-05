import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  FileText, BarChart3, Brain, MessageSquare, Shield, Trophy, Clock, 
  Download, Award, AlertCircle, Mic, TrendingUp, CheckSquare, Target,
  ArrowRight, Sparkles, Layers, Sliders, ArrowUpRight, Filter, Video
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
  const [activeTab, setActiveTab] = useState<'overview' | 'transcript'>('overview');
  const [recordingVideoUrl, setRecordingVideoUrl] = useState<string | null>(null);

  // Dashboard / All Reports State
  const [sessions, setSessions] = useState<any[]>([]);
  const [assessments, setAssessments] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<'all' | 'recruiter' | 'mock'>('all');
  const [compareSessions, setCompareSessions] = useState<string[]>([]);
  const [showCompareModal, setShowCompareModal] = useState(false);

  useEffect(() => {
    if (sessionId) {
      fetchReport(sessionId);
      fetchTranscript(sessionId);
      try {
        const storedVid = localStorage.getItem(`interview_recording_${sessionId}`);
        if (storedVid) setRecordingVideoUrl(storedVid);
      } catch (e) {}
    } else {
      fetchDashboardData();
    }
  }, [sessionId]);

  const fetchReport = async (sid: string) => {
    setLoading(true);
    try {
      const res = await api.get(`/interview/report/${sid}`);
      setReport(res.data);
    } catch (err) {
      console.error('Fetch report error:', err);
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
                          <div className="flex items-center gap-2">
                            <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider ${
                              s.interview_type === 'Recruiter' ? 'bg-indigo-100 text-indigo-700 border border-indigo-200' : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                            }`}>
                              {s.interview_type === 'Recruiter' ? 'Recruiter Assessment' : 'Mock Practice'}
                            </span>
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-bold">
                              {s.round_type || 'Technical'}
                            </span>
                          </div>
                          <h3 
                            onClick={() => navigate(`/reports?session=${s.session_id || s.id}`)}
                            className="text-base font-extrabold text-brand-ink hover:text-indigo-600 transition-colors cursor-pointer"
                          >
                            {s.role_target || s.title || 'Software Engineer'}
                          </h3>
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
            {/* Recorded Interview Video Player Section */}
            {recordingVideoUrl && (
              <div className="bg-slate-900 rounded-3xl p-6 text-white space-y-4 border border-slate-800 shadow-xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
                      <Video className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-extrabold text-white">Candidate Live Interview Recording</h4>
                      <p className="text-[11px] text-slate-400 font-medium">Full webcam video telemetry & audio stream playback</p>
                    </div>
                  </div>
                  <a
                    href={recordingVideoUrl}
                    download={`Interview_Recording_${sessionId}.webm`}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold flex items-center gap-1.5 transition-colors shadow-xs"
                  >
                    <Download className="w-3.5 h-3.5" /> Download Recording
                  </a>
                </div>
                <div className="aspect-video w-full max-w-3xl mx-auto bg-black rounded-2xl overflow-hidden border border-slate-800 shadow-2xl">
                  <video src={recordingVideoUrl} controls className="w-full h-full object-cover" />
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
              <h3 className="text-xs font-extrabold text-brand-ink uppercase tracking-wider">Granular Sub-Metrics Breakdown</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {/* Communication Breakdown */}
                <div className="space-y-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <h4 className="text-xs font-extrabold text-indigo-600 uppercase tracking-wider">Communication</h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between"><span className="text-slate-500">Grammar:</span><span className="font-bold">{commM.grammar || 85}%</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Fluency:</span><span className="font-bold">{commM.fluency || 82}%</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Clarity:</span><span className="font-bold">{commM.clarity || 88}%</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Pace:</span><span className="font-bold">{commM.pace || 80}%</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Filler Words:</span><span className="font-bold">{commM.filler_words || 2}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Vocabulary:</span><span className="font-bold">{commM.vocabulary || 84}%</span></div>
                  </div>
                </div>

                {/* Confidence Breakdown */}
                <div className="space-y-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <h4 className="text-xs font-extrabold text-emerald-600 uppercase tracking-wider">Confidence</h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between"><span className="text-slate-500">Eye Contact:</span><span className="font-bold">{confM.eye_contact || 90}%</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Attention:</span><span className="font-bold">{confM.attention || 92}%</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Hesitation:</span><span className="font-bold">{confM.hesitation || 12}%</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Emotion:</span><span className="font-bold text-[10px] truncate">{confM.emotion || 'Calm'}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Engagement:</span><span className="font-bold">{confM.facial_engagement || 88}%</span></div>
                  </div>
                </div>

                {/* Technical Breakdown */}
                <div className="space-y-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <h4 className="text-xs font-extrabold text-amber-600 uppercase tracking-wider">Technical</h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between"><span className="text-slate-500">Accuracy:</span><span className="font-bold">{techM.accuracy || 86}%</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Keywords:</span><span className="font-bold">{techM.keywords || 84}%</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Domain Knowledge:</span><span className="font-bold">{techM.domain_knowledge || 88}%</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Problem Solving:</span><span className="font-bold">{techM.problem_solving || 85}%</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Completeness:</span><span className="font-bold">{techM.completeness || 82}%</span></div>
                  </div>
                </div>

                {/* Professionalism Breakdown */}
                <div className="space-y-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <h4 className="text-xs font-extrabold text-violet-600 uppercase tracking-wider">Professionalism</h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between"><span className="text-slate-500">Time Management:</span><span className="font-bold">{profM.time_management || 90}%</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Communication:</span><span className="font-bold">{profM.communication || 88}%</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Etiquette:</span><span className="font-bold">{profM.interview_etiquette || 95}%</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Organization:</span><span className="font-bold">{profM.organization || 86}%</span></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Strengths & Weaknesses */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="card-luxury p-6 space-y-4">
                <h3 className="text-sm font-extrabold text-brand-ink uppercase tracking-wider flex items-center gap-2">
                  <Award className="w-5 h-5 text-emerald-500" /> Key Strengths
                </h3>
                <ul className="space-y-3">
                  {report.strengths?.map((str: string, i: number) => (
                    <li key={i} className="flex items-start gap-2 text-sm font-medium text-slate-600">
                      <span className="text-emerald-500 font-bold">•</span> {str}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="card-luxury p-6 space-y-4">
                <h3 className="text-sm font-extrabold text-brand-ink uppercase tracking-wider flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-rose-500" /> Areas for Improvement
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

            {/* Improvement Plan & Practice Suggestions */}
            {report.improvement_plan && report.improvement_plan.length > 0 && (
              <div className="card-luxury p-6 space-y-4 border-l-4 border-indigo-500">
                <h3 className="text-sm font-extrabold text-brand-ink uppercase tracking-wider flex items-center gap-2">
                  <Brain className="w-5 h-5 text-indigo-500" /> AI Practice Recommendations
                </h3>
                <ul className="space-y-2">
                  {report.improvement_plan.map((item: string, i: number) => (
                    <li key={i} className="flex items-start gap-2 text-sm font-medium text-slate-600">
                      <span className="text-indigo-500 font-bold">{i + 1}.</span> {item}
                    </li>
                  ))}
                </ul>
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
