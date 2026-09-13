import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Video, FileText, Briefcase, Award, ArrowUpRight, CheckCircle2,
  Clock, MapPin, DollarSign, Activity, Star, Percent, ChevronRight,
  TrendingUp, TrendingDown, Minus, AlertTriangle, BookOpen, ExternalLink,
  Sparkles, Trophy, Brain, MessageSquare, Shield, Target, BarChart3,
  ChevronDown, ChevronUp, Calendar, XCircle, Zap, Download, Search, Filter, Check, Layers, Eye
} from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  BarChart, Bar, PieChart, Pie, Cell, Legend
} from 'recharts';
import api from '../services/api';
import { useWebSocket } from '../context/WebSocketContext';
import { JobApplicationModal } from '../components/candidate/JobApplicationModal';
import { JobDetailsModal } from '../components/recruiter/JobDetailsModal';
import { WelcomeHeroCard } from '../components/ui/WelcomeHeroCard';
import { SemiCircularGauge } from '../components/ui/SemiCircularGauge';
import { DualWaveSplineChart } from '../components/ui/DualWaveSplineChart';

export const CandidateDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { lastMessage } = useWebSocket();

  // Instant Cache Hydration: Render instantly from local cache (0ms perceived latency)
  const getCachedDashboard = () => {
    try {
      const raw = localStorage.getItem('smarthire_cand_dash_cache');
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  };
  const cached = getCachedDashboard();

  const [candidateName, setCandidateName] = useState(() => {
    const raw = localStorage.getItem('user_data') || localStorage.getItem('user');
    if (raw) {
      try { return JSON.parse(raw)?.full_name || 'Candidate'; } catch (e) {}
    }
    return cached?.metrics?.full_name || 'Candidate';
  });

  const [history, setHistory] = useState<any[]>(cached?.history || []);
  const [jobs, setJobs] = useState<any[]>(cached?.jobs || []);
  const [myApplications, setMyApplications] = useState<any[]>(cached?.myApplications || []);
  const [offers, setOffers] = useState<any[]>(cached?.offers || []);

  // Analytics & Performance Trends State
  const [trendData, setTrendData] = useState<any>(cached?.trendData || null);
  const [weakAreasData, setWeakAreasData] = useState<any>(cached?.weakAreasData || null);
  const [skillsData, setSkillsData] = useState<any>(cached?.skillsData || null);
  const [progressData, setProgressData] = useState<any>(cached?.progressData || null);
  const [activeSkillCategory, setActiveSkillCategory] = useState<string>('All');
  const [historySearchTerm, setHistorySearchTerm] = useState('');
  const [historyRoundFilter, setHistoryRoundFilter] = useState('all');
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [downloadingPdfId, setDownloadingPdfId] = useState<string | null>(null);
  const [trendViewMode, setTrendViewMode] = useState<'overall' | 'multiseries' | 'dualwave'>('dualwave');
  const [candidatePieMode, setCandidatePieMode] = useState<'pipeline' | 'competency'>('pipeline');
  const [showAllWeakAreas, setShowAllWeakAreas] = useState<boolean>(false);
  const [showAllSkills, setShowAllSkills] = useState<boolean>(false);

  // Live PostgreSQL Real-Time Metrics State
  const [metrics, setMetrics] = useState<any>(cached?.metrics || {
    jobs_applied: 0,
    active_applications: 0,
    ats_passed: 0,
    ats_rejected: 0,
    interviews_scheduled: 0,
    interviews_completed: 0,
    avg_ats_score: 0.0,
    avg_interview_score: 0.0,
    readiness_score: 0.0,
    total_offers: 0,
    profile_completion: 0,
    pipeline_stage: 'Not Started',
    recent_activity: []
  });

  const [selectedJobForApply, setSelectedJobForApply] = useState<any | null>(null);
  const [selectedJobForView, setSelectedJobForView] = useState<any | null>(null);
  const [schedules, setSchedules] = useState<any[]>(cached?.schedules || []);
  const [assessments, setAssessments] = useState<any[]>(cached?.assessments || []);
  const [assessHistory, setAssessHistory] = useState<any[]>(cached?.assessHistory || []);
  const [historyTab, setHistoryTab] = useState<'interviews' | 'assessments'>('interviews');

  useEffect(() => {
    fetchCandidateData();
    const interval = setInterval(() => fetchCandidateData(), 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (lastMessage) {
      fetchCandidateData();
    }
  }, [lastMessage]);

  const fetchCandidateData = () => {
    const updatedCache: any = { ...(getCachedDashboard() || {}) };
    const persistCache = () => {
      try {
        localStorage.setItem('smarthire_cand_dash_cache', JSON.stringify(updatedCache));
      } catch (e) {}
    };

    // Progressive Decoupled Fetching: Each widget updates immediately as its response arrives
    api.get('/users/candidate-metrics').then((res) => {
      if (res?.data) {
        setMetrics(res.data);
        if (res.data.full_name) setCandidateName(res.data.full_name);
        updatedCache.metrics = res.data;
        persistCache();
      }
    }).catch(() => {});

    api.get('/scheduling/candidate-schedules').then((res) => {
      if (res?.data) {
        setSchedules(res.data);
        updatedCache.schedules = res.data;
        persistCache();
      }
    }).catch(() => {});

    api.get('/scheduling/candidate-assessments').then((res) => {
      if (res?.data) {
        setAssessments(res.data);
        updatedCache.assessments = res.data;
        persistCache();
      }
    }).catch(() => {});

    api.get('/aptitude/history').then((res) => {
      if (res?.data && Array.isArray(res.data)) {
        setAssessHistory(res.data);
        updatedCache.assessHistory = res.data;
        persistCache();
      }
    }).catch(() => {});

    api.get('/interview/history').then((res) => {
      if (res?.data) {
        setHistory(res.data);
        updatedCache.history = res.data;
        persistCache();
      }
    }).catch(() => {});

    api.get('/jobs/public').then((res) => {
      if (res?.data) {
        setJobs(res.data);
        updatedCache.jobs = res.data;
        persistCache();
      }
    }).catch(() => {});

    api.get('/jobs/my-applications').then((res) => {
      if (res?.data) {
        setMyApplications(res.data);
        updatedCache.myApplications = res.data;
        persistCache();
      }
    }).catch(() => {});

    api.get('/offers/my-offers').then((res) => {
      if (res?.data) {
        setOffers(res.data);
        updatedCache.offers = res.data;
        persistCache();
      }
    }).catch(() => {});

    api.get('/analytics/candidate/trends').then((res) => {
      if (res?.data) {
        setTrendData(res.data);
        updatedCache.trendData = res.data;
        persistCache();
      }
    }).catch(() => {});

    api.get('/analytics/candidate/weak-areas').then((res) => {
      if (res?.data) {
        setWeakAreasData(res.data);
        updatedCache.weakAreasData = res.data;
        persistCache();
      }
    }).catch(() => {});

    api.get('/analytics/candidate/skills').then((res) => {
      if (res?.data) {
        setSkillsData(res.data);
        updatedCache.skillsData = res.data;
        persistCache();
      }
    }).catch(() => {});

    api.get('/analytics/candidate/improvement-progress').then((res) => {
      if (res?.data) {
        setProgressData(res.data);
        updatedCache.progressData = res.data;
        persistCache();
      }
    }).catch(() => {});
  };

  const handleDownloadReport = async (sessionId: string, title?: string) => {
    try {
      setDownloadingPdfId(sessionId);
      const response = await api.get(`/interview/report/${sessionId}/pdf`, {
        responseType: 'blob'
      });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Scorecard_${title ? title.replace(/[^a-zA-Z0-9]/g, '_') : sessionId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.warn('Backend PDF endpoint fallback to report viewer:', err);
      navigate(`/reports?session=${sessionId}`);
    } finally {
      setDownloadingPdfId(null);
    }
  };

  const pipelineStages = [
    { label: 'Applied', key: 'Applied' },
    { label: 'ATS Passed', key: 'ATS Passed' },
    { label: 'Online Assessment', key: 'Assessment' },
    { label: 'Technical Interview', key: 'Interview' },
    { label: 'Recruiter Review', key: 'Recruiter Review' },
    { label: 'Offer Received', key: 'Offer' },
    { label: 'Accepted', key: 'Accepted' }
  ];

  const safeMetrics = metrics || {};

  // Calculate completed interviews from history with status or valid scores
  const completedHistory = (history || []).filter((h: any) => {
    const st = (h.status || '').toLowerCase();
    const sc = Number(h.score ?? h.overall_score ?? 0);
    return st === 'completed' || sc > 0;
  });

  // Dynamic Candidate Pipeline Metrics for Donut Pie Chart & Top Cards
  const totalInterviewsConducted = Math.max(
    Number(safeMetrics.interviews_completed || 0),
    completedHistory.length
  );
  const totalOffersReceived = Math.max(Number(safeMetrics.total_offers || 0), (offers || []).length);
  const totalJobsApplied = Math.max(Number(safeMetrics.jobs_applied || 0), (myApplications || []).length);
  const totalPipelineActions = totalInterviewsConducted + totalOffersReceived + totalJobsApplied;

  const candidatePieData = [
    { name: 'Interviews Conducted', value: totalInterviewsConducted, color: '#6366F1' },
    { name: 'Offers Received', value: totalOffersReceived, color: '#10B981' },
    { name: 'Jobs Applied', value: totalJobsApplied, color: '#06B6D4' },
  ];

  const historyAvgScore = completedHistory.length > 0
    ? Math.round(completedHistory.reduce((acc: number, h: any) => acc + Number(h.score ?? h.overall_score ?? 0), 0) / completedHistory.length)
    : 0;

  const effectiveAvgScore = Number(safeMetrics.avg_interview_score) > 0
    ? Math.round(Number(safeMetrics.avg_interview_score))
    : historyAvgScore;

  const hasInterviewData = Boolean(
    totalInterviewsConducted > 0 &&
    (effectiveAvgScore > 0 || (trendData?.timeline && trendData.timeline.length > 0))
  );

  const overallReadinessScore = hasInterviewData
    ? Math.round(
        Number(safeMetrics.readiness_score) > 0
          ? Number(safeMetrics.readiness_score)
          : (effectiveAvgScore > 0 ? Math.min(100, Math.round(effectiveAvgScore * 0.7 + Math.min(30, (safeMetrics.profile_completion || 20) * 0.3))) : 0)
      )
    : 0;

  const candidateCompetencyPieData = hasInterviewData ? [
    { name: 'Technical Depth', value: Math.round(Number(safeMetrics.avg_technical ?? safeMetrics.avg_technical_score ?? trendData?.summary?.latest_technical_score ?? effectiveAvgScore ?? 0)), color: '#8B5CF6' },
    { name: 'Communication', value: Math.round(Number(safeMetrics.avg_communication ?? safeMetrics.avg_communication_score ?? trendData?.summary?.latest_communication_score ?? effectiveAvgScore ?? 0)), color: '#3B82F6' },
    { name: 'Confidence', value: Math.round(Number(safeMetrics.avg_confidence ?? safeMetrics.avg_confidence_score ?? trendData?.summary?.latest_confidence_score ?? effectiveAvgScore ?? 0)), color: '#10B981' },
    { name: 'Professionalism', value: Math.round(Number(safeMetrics.avg_professionalism ?? safeMetrics.avg_professionalism_score ?? trendData?.summary?.latest_professionalism_score ?? effectiveAvgScore ?? 0)), color: '#F59E0B' },
  ] : [];

  const effectiveTimeline = (trendData && trendData.total_interviews > 0 && trendData.timeline && trendData.timeline.length > 0)
    ? trendData.timeline
    : (completedHistory.length > 0
        ? [...completedHistory]
            .sort((a: any, b: any) => new Date(a.started_at || a.created_at || 0).getTime() - new Date(b.started_at || b.created_at || 0).getTime())
            .map((h: any, idx: number) => ({
              session_id: h.id || h.session_id,
              date: h.started_at ? h.started_at.split('T')[0] : 'Recent',
              display_date: h.started_at ? new Date(h.started_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : `Session ${idx + 1}`,
              title: h.title || h.role_target || 'Interview Session',
              role_target: h.role_target || 'Software Engineer',
              round_type: h.round_type || 'Technical',
              overall_score: Math.round(Number(h.score ?? h.overall_score ?? 0)),
              technical_score: Math.round(Number(h.technical_score ?? h.score ?? h.overall_score ?? 0)),
              communication_score: Math.round(Number(h.communication_score ?? h.score ?? h.overall_score ?? 0)),
              confidence_score: Math.round(Number(h.confidence_score ?? h.score ?? h.overall_score ?? 0)),
              professionalism_score: Math.round(Number(h.professionalism_score ?? h.score ?? h.overall_score ?? 0)),
              recommendation: h.recommendation || 'Shortlist'
            }))
        : []);

  const effectiveSummary = (trendData && trendData.summary && trendData.total_interviews > 0)
    ? trendData.summary
    : (completedHistory.length > 0 ? {
        latest_score: Math.round(Number(completedHistory[0].score ?? completedHistory[0].overall_score ?? 0)),
        previous_score: completedHistory.length > 1 ? Math.round(Number(completedHistory[1].score ?? completedHistory[1].overall_score ?? 0)) : null,
        score_change: completedHistory.length > 1
          ? Math.round(Number(completedHistory[0].score ?? completedHistory[0].overall_score ?? 0) - Number(completedHistory[1].score ?? completedHistory[1].overall_score ?? 0))
          : 0,
        average_score: historyAvgScore
      } : null);

  const hasTimeline = Boolean(effectiveTimeline && effectiveTimeline.length > 0);

  const getCurrentStageIndex = () => {
    const current = safeMetrics.pipeline_stage || 'Not Started';
    if (current === 'Accepted') return 6;
    if (current === 'Offer') return 5;
    if (current === 'Recruiter Review') return 4;
    if (current === 'Interview' || current === 'Interview Scheduled') return 3;
    if (current === 'Assessment' || current === 'Online Assessment' || (assessments && assessments.some(a => {
      const st = (a.status || '').toLowerCase();
      return st === 'scheduled' || st === 'inprogress' || st === 'in_progress' || st === 'active';
    }))) return 2;
    if (current === 'ATS Passed') return 1;
    if (current === 'Applied') return 0;
    return -1;
  };

  const currentStageIndex = getCurrentStageIndex();

  return (
    <>
      <main className="p-6 lg:p-10 max-w-7xl mx-auto w-full space-y-8 transition-colors duration-300">
        
        {/* Active Online / Mock Assessment Scheduled Banner */}
        {assessments.filter(a => {
          const st = (a.status || '').toLowerCase();
          return st === 'scheduled' || st === 'inprogress' || st === 'in_progress' || st === 'active';
        }).map((assess) => (
          <div key={assess.id} className="relative overflow-hidden bg-gradient-to-r from-sky-950 via-cyan-950 to-blue-950 rounded-3xl p-6 text-white shadow-xl border border-cyan-500/40 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="absolute right-0 top-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="flex items-center gap-4 relative z-10">
              <div className="w-14 h-14 rounded-2xl bg-cyan-500/20 border border-cyan-400 text-cyan-300 flex items-center justify-center font-extrabold text-xl animate-pulse shadow-lg">
                <Zap className="w-7 h-7 text-cyan-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-cyan-400 text-slate-950 shadow-xs">
                    Stage 3 • Online Assessment Scheduled
                  </span>
                  <span className="text-xs text-cyan-200 font-semibold">Passing Cutoff: {assess.passing_score || 50}%</span>
                </div>
                <h3 className="text-xl font-black text-white mt-1">
                  {assess.job_title ? `${assess.job_title} - Online Skills Assessment` : 'Online Technical Assessment'}
                </h3>
                <p className="text-xs text-slate-300 font-medium mt-0.5">
                  {assess.company_name ? `${assess.company_name} • ` : ''}Duration: {assess.duration_minutes || 30} Mins
                  {assess.topics && assess.topics.length > 0 ? ` • Focus: ${Array.isArray(assess.topics) ? assess.topics.join(', ') : assess.topics}` : ''}
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate(`/assessment/exam?session=${assess.id}`)}
              className="relative z-10 w-full md:w-auto px-8 py-3.5 rounded-2xl bg-gradient-to-r from-cyan-400 to-sky-300 hover:from-cyan-300 hover:to-sky-200 text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-cyan-900/50 hover:scale-105 transition-all shrink-0 cursor-pointer"
            >
              <Zap className="w-4 h-4 fill-current" />
              <span>Launch Online Assessment Now</span>
            </button>
          </div>
        ))}
        
        {/* Active Interview Banner */}
        {schedules.filter(s => {
          const st = (s.status || '').toLowerCase();
          return st === 'scheduled' || st === 'upcoming' || st === 'active';
        }).map((sched) => {
          const schedTimeMs = sched.scheduled_date ? new Date(sched.scheduled_date).getTime() : null;
          const isEarly = schedTimeMs !== null && !isNaN(schedTimeMs) && Date.now() < schedTimeMs;
          const schedDateObj = schedTimeMs ? new Date(schedTimeMs) : null;

          return (
            <div key={sched.id} className="relative overflow-hidden bg-gradient-to-r from-indigo-900 via-indigo-950 to-purple-950 rounded-3xl p-6 text-white shadow-xl border border-indigo-500/30 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="absolute right-0 top-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
              <div className="flex items-center gap-4 relative z-10">
                <div className={`w-14 h-14 rounded-2xl ${isEarly ? 'bg-amber-500/20 border-amber-400 text-amber-300' : 'bg-indigo-500/20 border-indigo-400 text-indigo-300 animate-pulse'} border flex items-center justify-center font-extrabold text-xl shadow-lg`}>
                  {isEarly ? <Clock className="w-7 h-7" /> : <Video className="w-7 h-7" />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                      isEarly ? 'bg-amber-400 text-slate-950' : 'bg-emerald-400 text-slate-950 animate-pulse'
                    } shadow-xs`}>
                      {isEarly ? 'Scheduled Interview' : 'Interview Ready Now'}
                    </span>
                    <span className="text-xs text-indigo-200 font-semibold">{sched.round_type || 'Technical'} Round</span>
                  </div>
                  <h3 className="text-xl font-black text-white mt-1">
                    {sched.title || sched.job_title || 'Technical Interview Session'}
                  </h3>
                  <p className="text-xs text-slate-300 font-medium mt-0.5">
                    Scheduled for: {schedDateObj ? schedDateObj.toLocaleString() : 'Pending'} ({sched.duration_minutes || 30} Mins)
                    {isEarly && (
                      <span className="text-amber-300 font-bold ml-2">
                        • Can only start at {schedDateObj?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <button
                onClick={() => navigate(`/interview/lobby?schedule=${sched.id}`)}
                className={`relative z-10 w-full md:w-auto px-8 py-3.5 rounded-2xl ${
                  isEarly 
                    ? 'bg-gradient-to-r from-amber-400 to-amber-300 hover:from-amber-300 hover:to-amber-200 text-slate-950'
                    : 'bg-gradient-to-r from-indigo-400 to-indigo-300 hover:from-indigo-300 hover:to-indigo-200 text-slate-950'
                } font-black text-xs flex items-center justify-center gap-2 shadow-lg hover:scale-105 transition-all shrink-0 cursor-pointer`}
              >
                {isEarly ? <Clock className="w-4 h-4" /> : <Video className="w-4 h-4" />}
                <span>{isEarly ? 'Setup & Waiting Lobby' : 'Join Live Interview Room Now'}</span>
              </button>
            </div>
          );
        })}

        {/* Atmospheric Cosmic Orbs & Grid */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
          <div className="absolute -top-24 left-[10%] w-[600px] h-[450px] bg-indigo-600/10 dark:bg-indigo-500/15 rounded-full blur-[140px]" />
          <div className="absolute top-[20%] -right-20 w-[550px] h-[450px] bg-purple-600/10 dark:bg-purple-500/15 rounded-full blur-[140px]" />
          <div className="absolute top-[65%] left-[-5%] w-[500px] h-[400px] bg-cyan-600/8 dark:bg-cyan-500/10 rounded-full blur-[120px]" />
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[size:32px_32px]" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          {/* Welcome & Quick Actions - 3D Claymorphic Hero (Matching Reference Image 2) */}
          <div className="lg:col-span-8 flex flex-col justify-between">
            <WelcomeHeroCard
              className="h-full"
              userName={candidateName}
              greeting="Welcome Back"
              icon={TrendingUp}
              badgeText="CANDIDATE INTELLIGENCE SUITE"
              metrics={[
                {
                  label: 'Overall Readiness',
                  value: hasInterviewData ? `${overallReadinessScore}%` : 'Not evaluated yet',
                  subtext: `${totalInterviewsConducted} Evaluated Session${totalInterviewsConducted === 1 ? '' : 's'}`,
                },
                {
                  label: 'Active Pipeline',
                  value: `${safeMetrics.active_applications || 0} Active`,
                  subtext: `${totalOffersReceived} Offer${totalOffersReceived === 1 ? '' : 's'} Extended`,
                },
              ]}
              actionButton={{
                label: 'Practice Mock Interview',
                onClick: () => navigate('/interview/config'),
                icon: Video,
              }}
            />
          </div>

          {/* Right: Pie Chart - Total Interviews Conducted, Offers Received, Jobs Applied */}
          <div className="lg:col-span-4 rounded-[2rem] bg-[#0B0F19] border border-slate-800 p-5 flex flex-col items-center justify-between text-white shadow-xl group transition-all duration-300 h-full">
            {/* Header with View Mode Switcher */}
            <div className="w-full flex items-center justify-between mb-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">
                {candidatePieMode === 'pipeline' ? 'APPLICATION TELEMETRY' : 'BENCHMARK READINESS'}
              </span>
              <div className="flex items-center gap-1 bg-slate-900/90 p-0.5 rounded-xl border border-slate-800">
                <button
                  onClick={() => setCandidatePieMode('pipeline')}
                  className={`px-2 py-0.5 rounded-lg text-[9px] font-black transition-all cursor-pointer ${
                    candidatePieMode === 'pipeline'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  PIPELINE
                </button>
                <button
                  onClick={() => setCandidatePieMode('competency')}
                  className={`px-2 py-0.5 rounded-lg text-[9px] font-black transition-all cursor-pointer ${
                    candidatePieMode === 'competency'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  READINESS
                </button>
              </div>
            </div>

            {/* Subheading */}
            <div className="text-center my-0.5">
              <h4 className="text-xs font-black tracking-wider text-white uppercase">
                {candidatePieMode === 'pipeline' ? 'CAREER PIPELINE BREAKDOWN' : 'INTERVIEW COMPETENCY SPREAD'}
              </h4>
              <p className="text-[10px] text-slate-400 font-medium">
                {candidatePieMode === 'pipeline'
                  ? 'Interviews • Offers • Applications'
                  : 'Technical • Communication • Soft Skills'}
              </p>
            </div>

            {/* Donut Pie Chart */}
            <div className="w-full h-[185px] relative flex items-center justify-center my-1">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <RechartsTooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0];
                        const isPipeline = candidatePieMode === 'pipeline';
                        const total = isPipeline
                          ? totalPipelineActions
                          : candidateCompetencyPieData.reduce((acc, curr) => acc + curr.value, 0);
                        const pct = total > 0 ? Math.round(((Number(data.value) || 0) / total) * 100) : 0;
                        return (
                          <div className="bg-slate-900/95 border border-slate-700/80 px-3 py-1.5 rounded-xl shadow-xl text-xs text-white">
                            <p className="font-extrabold flex items-center gap-1.5" style={{ color: data.payload.color }}>
                              <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: data.payload.color }} />
                              {data.name}
                            </p>
                            <p className="text-slate-300 font-bold mt-0.5">
                              {data.value}{isPipeline ? '' : '%'} ({pct}%)
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Pie
                    data={
                      candidatePieMode === 'pipeline'
                        ? (totalPipelineActions > 0 ? candidatePieData : [{ name: 'No Activity', value: 1, color: '#334155' }])
                        : (hasInterviewData && candidateCompetencyPieData.length > 0
                            ? candidateCompetencyPieData
                            : [{ name: 'Not Evaluated', value: 1, color: '#334155' }])
                    }
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={candidatePieMode === 'pipeline' ? (totalPipelineActions > 0 ? 4 : 0) : (hasInterviewData ? 4 : 0)}
                    dataKey="value"
                    stroke="#0B0F19"
                    strokeWidth={3}
                  >
                    {(candidatePieMode === 'pipeline'
                      ? (totalPipelineActions > 0 ? candidatePieData : [{ name: 'No Activity', value: 1, color: '#334155' }])
                      : (hasInterviewData && candidateCompetencyPieData.length > 0
                          ? candidateCompetencyPieData
                          : [{ name: 'Not Evaluated', value: 1, color: '#334155' }])
                    ).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              {/* Centered Total inside Donut */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                {candidatePieMode === 'pipeline' ? (
                  <>
                    <span className="text-2xl font-black text-white leading-none">{totalPipelineActions}</span>
                    <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold mt-0.5">Pipeline</span>
                  </>
                ) : (
                  <>
                    <span className="text-2xl font-black text-white leading-none">
                      {hasInterviewData ? `${overallReadinessScore}%` : '0%'}
                    </span>
                    <span className="text-[9px] uppercase tracking-wider text-emerald-400 font-bold mt-0.5">
                      {hasInterviewData ? 'Readiness' : 'Not Evaluated'}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* 3 Metrics Row Below Chart */}
            {candidatePieMode === 'pipeline' ? (
              <div className="w-full grid grid-cols-3 gap-2 mt-1 pt-2.5 border-t border-slate-800/80 text-center">
                <div className="bg-slate-900/60 rounded-xl p-2 border border-slate-800/80 flex flex-col items-center hover:border-indigo-500/40 transition-colors">
                  <div className="flex items-center gap-1 text-[10px] text-indigo-400 font-bold uppercase truncate">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
                    Interviews
                  </div>
                  <span className="text-base font-black text-white mt-0.5">{totalInterviewsConducted}</span>
                  <span className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider">Conducted</span>
                </div>
                <div className="bg-slate-900/60 rounded-xl p-2 border border-slate-800/80 flex flex-col items-center hover:border-emerald-500/40 transition-colors">
                  <div className="flex items-center gap-1 text-[10px] text-emerald-400 font-bold uppercase truncate">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                    Offers
                  </div>
                  <span className="text-base font-black text-white mt-0.5">{totalOffersReceived}</span>
                  <span className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider">Received</span>
                </div>
                <div className="bg-slate-900/60 rounded-xl p-2 border border-slate-800/80 flex flex-col items-center hover:border-cyan-500/40 transition-colors">
                  <div className="flex items-center gap-1 text-[10px] text-cyan-400 font-bold uppercase truncate">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 shrink-0" />
                    Applied
                  </div>
                  <span className="text-base font-black text-white mt-0.5">{totalJobsApplied}</span>
                  <span className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider">Submitted</span>
                </div>
              </div>
            ) : (
              <div className="w-full grid grid-cols-3 gap-2 mt-1 pt-2.5 border-t border-slate-800/80 text-center">
                <div className="bg-slate-900/60 rounded-xl p-2 border border-slate-800/80 flex flex-col items-center hover:border-purple-500/40 transition-colors">
                  <div className="flex items-center gap-1 text-[10px] text-purple-400 font-bold uppercase truncate">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500 shrink-0" />
                    Technical
                  </div>
                  <span className="text-base font-black text-white mt-0.5">
                    {hasInterviewData && candidateCompetencyPieData[0] ? `${candidateCompetencyPieData[0].value}%` : '--'}
                  </span>
                  <span className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider">
                    {hasInterviewData ? 'Depth' : 'Pending'}
                  </span>
                </div>
                <div className="bg-slate-900/60 rounded-xl p-2 border border-slate-800/80 flex flex-col items-center hover:border-blue-500/40 transition-colors">
                  <div className="flex items-center gap-1 text-[10px] text-blue-400 font-bold uppercase truncate">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                    Communication
                  </div>
                  <span className="text-base font-black text-white mt-0.5">
                    {hasInterviewData && candidateCompetencyPieData[1] ? `${candidateCompetencyPieData[1].value}%` : '--'}
                  </span>
                  <span className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider">
                    {hasInterviewData ? 'Clarity' : 'Pending'}
                  </span>
                </div>
                <div className="bg-slate-900/60 rounded-xl p-2 border border-slate-800/80 flex flex-col items-center hover:border-amber-500/40 transition-colors">
                  <div className="flex items-center gap-1 text-[10px] text-amber-400 font-bold uppercase truncate">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                    Soft Skills
                  </div>
                  <span className="text-base font-black text-white mt-0.5">
                    {hasInterviewData && candidateCompetencyPieData[3] ? `${candidateCompetencyPieData[3].value}%` : '--'}
                  </span>
                  <span className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider">
                    {hasInterviewData ? 'Professional' : 'Pending'}
                  </span>
                </div>
              </div>
            )}

            {/* Integrated Profile Completion Strip */}
            <div className="w-full mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <div className="relative w-7 h-7 shrink-0 flex items-center justify-center">
                  <svg className="w-7 h-7 transform -rotate-90" viewBox="0 0 36 36">
                    <path
                      className="text-slate-800"
                      strokeWidth="3.5"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                    <path
                      className="text-emerald-500 drop-shadow-[0_0_6px_rgba(16,185,129,0.5)]"
                      strokeDasharray={`${safeMetrics.profile_completion || 0}, 100`}
                      strokeWidth="3.5"
                      strokeLinecap="round"
                      stroke="currentColor"
                      fill="none"
                    />
                  </svg>
                  <span className="absolute text-[8px] font-black text-white">{safeMetrics.profile_completion || 0}%</span>
                </div>
                <div>
                  <p className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400">Profile Completion</p>
                  <p className="text-[10px] font-semibold text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    {(safeMetrics.profile_completion || 0) >= 80 ? 'Optimized' : 'Incomplete'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => navigate('/profile')}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-indigo-300 hover:text-indigo-200 text-[10px] font-bold border border-slate-700 transition-colors cursor-pointer"
              >
                Edit Profile
              </button>
            </div>
          </div>
        </div>

        {/* Essential Core Recruitment Funnel Cards - Pinterest Glassmorphic Bento Tiles */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3.5">
          {[
            { label: 'Jobs Applied', value: totalJobsApplied, badge: 'Targeted', icon: Briefcase, color: 'text-indigo-600 dark:text-indigo-400', iconBg: 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/25', glow: 'hover:shadow-[0_8px_25px_-5px_rgba(99,102,241,0.35)]', lineBg: 'bg-gradient-to-r from-indigo-500 to-blue-400' },
            { label: 'Under Review', value: safeMetrics.active_applications, badge: 'Active', icon: Clock, color: 'text-amber-600 dark:text-amber-400', iconBg: 'bg-amber-500/15 text-amber-400 border border-amber-500/25', glow: 'hover:shadow-[0_8px_25px_-5px_rgba(245,158,11,0.35)]', lineBg: 'bg-gradient-to-r from-amber-500 to-orange-400' },
            { label: 'ATS Passed', value: safeMetrics.ats_passed, badge: 'Qualified', icon: CheckCircle2, color: 'text-emerald-600 dark:text-emerald-400', iconBg: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25', glow: 'hover:shadow-[0_8px_25px_-5px_rgba(16,185,129,0.35)]', lineBg: 'bg-gradient-to-r from-emerald-500 to-teal-400' },
            { label: 'ATS Rejected', value: safeMetrics.ats_rejected, badge: 'Screened', icon: XCircle, color: 'text-rose-600 dark:text-rose-400', iconBg: 'bg-rose-500/15 text-rose-400 border border-rose-500/25', glow: 'hover:shadow-[0_8px_25px_-5px_rgba(244,63,94,0.35)]', lineBg: 'bg-gradient-to-r from-rose-500 to-pink-400' },
            { label: 'Upcoming', value: safeMetrics.interviews_scheduled, badge: 'Scheduled', icon: Calendar, color: 'text-violet-600 dark:text-violet-400', iconBg: 'bg-violet-500/15 text-violet-400 border border-violet-500/25', glow: 'hover:shadow-[0_8px_25px_-5px_rgba(139,92,246,0.35)]', lineBg: 'bg-gradient-to-r from-violet-500 to-purple-400' },
            { label: 'Completed', value: totalInterviewsConducted, badge: 'Evaluated', icon: Award, color: 'text-cyan-600 dark:text-cyan-400', iconBg: 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/25', glow: 'hover:shadow-[0_8px_25px_-5px_rgba(6,182,212,0.35)]', lineBg: 'bg-gradient-to-r from-cyan-500 to-sky-400' },
            { label: 'Total Offers', value: totalOffersReceived, badge: 'Offers 🏆', icon: Trophy, color: 'text-amber-500 dark:text-amber-300', iconBg: 'bg-amber-400/20 text-amber-300 border border-amber-400/40 shadow-[0_0_12px_rgba(251,191,36,0.2)]', glow: 'hover:shadow-[0_8px_25px_-5px_rgba(251,191,36,0.4)]', lineBg: 'bg-gradient-to-r from-amber-400 to-yellow-300' }
          ].map((stat, i) => {
            const Icon = stat.icon;
            return (
              <div
                key={i}
                className={`relative overflow-hidden rounded-2xl bg-white dark:bg-[#111827]/90 p-4 border border-slate-200/80 dark:border-white/10 shadow-xs hover:shadow-lg hover:-translate-y-1.5 transition-all duration-300 flex flex-col justify-between group backdrop-blur-xl ${stat.glow} hover:border-slate-300 dark:hover:border-white/20`}
              >
                <div className="flex items-center justify-between">
                  <div className={`w-8 h-8 rounded-xl ${stat.iconBg} flex items-center justify-center transition-transform group-hover:scale-110 shadow-xs`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300 group-hover:text-white transition-colors border border-transparent dark:group-hover:border-white/10">
                    {stat.badge}
                  </span>
                </div>
                <div className="mt-3.5 text-left">
                  <h4 className="text-2xl lg:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
                    {stat.value || 0}
                  </h4>
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                    {stat.label}
                  </p>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800/80 rounded-full h-1 mt-3 overflow-hidden">
                  <div className={`h-full rounded-full ${stat.lineBg} transition-all duration-500`} style={{ width: stat.value ? '100%' : '15%' }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* ========================================================================= */}
        {/* FEATURE 2: PERFORMANCE TRENDS */}
        {/* ========================================================================= */}
        <section className="bg-white dark:bg-[#111827] rounded-3xl border border-slate-200/80 dark:border-slate-800 p-6 lg:p-8 shadow-xs space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800">
                  HISTORICAL PERFORMANCE
                </span>
                {((trendData && trendData.total_interviews >= 2) || effectiveTimeline.length >= 2) && (
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1 ${
                    (trendData?.overall_trend || (effectiveTimeline.length >= 2 && effectiveTimeline[effectiveTimeline.length - 1].overall_score >= effectiveTimeline[0].overall_score ? 'Improving' : 'Stable')) === 'Improving'
                      ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800'
                      : (trendData?.overall_trend || 'Stable') === 'Declining'
                      ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-400 border border-rose-300 dark:border-rose-800'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700'
                  }`}>
                    {(trendData?.overall_trend === 'Improving' || (!trendData?.overall_trend && effectiveTimeline.length >= 2 && effectiveTimeline[effectiveTimeline.length - 1].overall_score >= effectiveTimeline[0].overall_score)) && <TrendingUp className="w-3 h-3" />}
                    {trendData?.overall_trend === 'Declining' && <TrendingDown className="w-3 h-3" />}
                    {(trendData?.overall_trend === 'Stable' || (!trendData?.overall_trend && effectiveTimeline.length >= 2 && effectiveTimeline[effectiveTimeline.length - 1].overall_score === effectiveTimeline[0].overall_score)) && <Minus className="w-3 h-3" />}
                    Overall: {trendData?.overall_trend || (effectiveTimeline.length >= 2 && effectiveTimeline[effectiveTimeline.length - 1].overall_score >= effectiveTimeline[0].overall_score ? 'Improving' : 'Stable')}
                  </span>
                )}
              </div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight mt-1">
                Performance Trends
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                Authoritative score progression across completed interview evaluations.
              </p>
            </div>

            {effectiveSummary && effectiveTimeline.length > 0 && (
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                  <button
                    onClick={() => setTrendViewMode('dualwave')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                      trendViewMode === 'dualwave' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    <span>Dual-Wave Spline</span>
                  </button>
                  <button
                    onClick={() => setTrendViewMode('overall')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                      trendViewMode === 'overall' ? 'bg-white dark:bg-slate-700 shadow-xs text-indigo-600 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                    }`}
                  >
                    Overall Trajectory
                  </button>
                  <button
                    onClick={() => setTrendViewMode('multiseries')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                      trendViewMode === 'multiseries' ? 'bg-white dark:bg-slate-700 shadow-xs text-indigo-600 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                    }`}
                  >
                    All Competencies
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  <div className="bg-slate-50 dark:bg-slate-800/60 px-3.5 py-2 rounded-2xl border border-slate-200/60 dark:border-slate-700 text-center">
                    <p className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">Latest</p>
                    <p className="text-lg font-black text-slate-900 dark:text-white">{effectiveSummary.latest_score || 0}%</p>
                  </div>
                  {effectiveSummary.previous_score !== null && (
                    <div className="bg-slate-50 dark:bg-slate-800/60 px-3.5 py-2 rounded-2xl border border-slate-200/60 dark:border-slate-700 text-center">
                      <p className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">Change</p>
                      <p className={`text-lg font-black flex items-center justify-center gap-0.5 ${
                        effectiveSummary.score_change > 0 ? 'text-emerald-600 dark:text-emerald-400' : effectiveSummary.score_change < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-600 dark:text-slate-400'
                      }`}>
                        {effectiveSummary.score_change > 0 ? `+${effectiveSummary.score_change}%` : `${effectiveSummary.score_change}%`}
                      </p>
                    </div>
                  )}
                  <div className="bg-slate-50 dark:bg-slate-800/60 px-3.5 py-2 rounded-2xl border border-slate-200/60 dark:border-slate-700 text-center">
                    <p className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">Average</p>
                    <p className="text-lg font-black text-slate-900 dark:text-white">{effectiveSummary.average_score || 0}%</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Dual-Wave Spline & Chart Rendering */}
          {(() => {
            const hasTimeline = Boolean(
              effectiveTimeline &&
              effectiveTimeline.length > 0
            );

            if (!hasTimeline) {
              return (
                <div className="p-10 rounded-2xl bg-slate-50/60 dark:bg-slate-900/40 border border-dashed border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-500 flex items-center justify-center">
                    <TrendingUp className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">No interview data yet</h3>
                    <p className="text-xs text-slate-400 dark:text-slate-500 max-w-md mt-1">
                      Complete your first interview to see your performance trend.
                    </p>
                  </div>
                  <button
                    onClick={() => navigate('/interview/config')}
                    className="mt-2 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
                  >
                    Start First Mock Interview
                  </button>
                </div>
              );
            }

            const dualWaveTimeline = effectiveTimeline.map((t: any) => ({
              label: t.display_date || t.date || 'Session',
              primaryValue: t.overall_score ?? t.technical_score ?? 0,
              secondaryValue: t.communication_score ?? Math.max(0, (t.overall_score || 0) - 10),
            }));

            return (
              <div className="space-y-6">
                {/* Evidence-Based Insight Cards */}
                {trendData.total_interviews >= 2 && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {trendData.summary?.score_change !== 0 && (
                      <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 text-xs flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                          <TrendingUp className="w-4 h-4" />
                        </div>
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          Overall score moved by <strong>{trendData.summary.score_change > 0 ? `+${trendData.summary.score_change}%` : `${trendData.summary.score_change}%`}</strong> across recent evaluations.
                        </span>
                      </div>
                    )}
                    {trendData.categories?.technical && (
                      <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 text-xs flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                          <Brain className="w-4 h-4" />
                        </div>
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          Technical competency trajectory: <strong>{trendData.categories.technical.trend}</strong> ({trendData.categories.technical.latest_score}% latest).
                        </span>
                      </div>
                    )}
                    {trendData.categories?.communication && (
                      <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 text-xs flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                          <MessageSquare className="w-4 h-4" />
                        </div>
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          Communication clarity & pacing: <strong>{trendData.categories.communication.trend}</strong> ({trendData.categories.communication.latest_score}% latest).
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Switch between Dual-Wave Spline and Standard Line Chart */}
                {trendViewMode === 'dualwave' ? (
                  <DualWaveSplineChart
                    data={dualWaveTimeline}
                    title="Competency Growth & Readiness Waves"
                    subtitle="Primary Wave: Technical Depth • Secondary Wave: Communication & Adaptive Reasoning"
                    primaryLabel="Technical Acumen"
                    secondaryLabel="Communication & Problem Solving"
                    height={280}
                  />
                ) : (
                  <div className="w-full h-72 min-h-[280px]" style={{ minHeight: '280px', height: '280px' }}>
                    <ResponsiveContainer width="100%" height={280} minHeight={280}>
                      <LineChart data={effectiveTimeline} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:stroke-slate-800" />
                        <XAxis
                          dataKey="display_date"
                          tick={{ fontSize: 10, fill: '#64748b' }}
                          tickLine={false}
                        />
                        <YAxis
                          domain={[0, 100]}
                          tick={{ fontSize: 10, fill: '#64748b' }}
                          tickLine={false}
                        />
                        <RechartsTooltip
                          content={({ active, payload }: any) => {
                            if (active && payload && payload.length) {
                              const data = payload[0].payload;
                              return (
                                <div className="bg-slate-900 text-white p-3.5 rounded-xl border border-slate-700 shadow-xl text-xs space-y-2 min-w-[200px]">
                                  <div className="border-b border-slate-800 pb-1.5">
                                    <p className="font-extrabold text-indigo-300">{data.title || 'Interview Session'}</p>
                                    <p className="text-[10px] text-slate-400 font-medium">{data.display_date || data.date}</p>
                                  </div>
                                  <div className="space-y-1 text-[11px]">
                                    <div className="flex justify-between font-black text-indigo-200">
                                      <span>Overall Score:</span>
                                      <span>{data.overall_score}%</span>
                                    </div>
                                    <div className="flex justify-between text-slate-300">
                                      <span>Technical:</span>
                                      <span>{data.technical_score}%</span>
                                    </div>
                                    <div className="flex justify-between text-slate-300">
                                      <span>Communication:</span>
                                      <span>{data.communication_score}%</span>
                                    </div>
                                    <div className="flex justify-between text-slate-300">
                                      <span>Confidence:</span>
                                      <span>{data.confidence_score}%</span>
                                    </div>
                                    <div className="flex justify-between text-slate-300">
                                      <span>Professionalism:</span>
                                      <span>{data.professionalism_score}%</span>
                                    </div>
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        {trendViewMode === 'multiseries' && (
                          <Legend
                            verticalAlign="top"
                            height={36}
                            formatter={(val) => <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">{val}</span>}
                          />
                        )}
                        <Line
                          type="monotone"
                          dataKey="overall_score"
                          stroke="#4F46E5"
                          strokeWidth={3}
                          dot={{ fill: '#4F46E5', r: 4, strokeWidth: 2, stroke: '#ffffff' }}
                          activeDot={{ r: 6, strokeWidth: 3, stroke: '#4F46E5' }}
                          name="Overall Score"
                        />
                        {trendViewMode === 'multiseries' && (
                          <>
                            <Line
                              type="monotone"
                              dataKey="technical_score"
                              stroke="#F59E0B"
                              strokeWidth={2}
                              dot={{ fill: '#F59E0B', r: 3 }}
                              name="Technical (30%)"
                            />
                            <Line
                              type="monotone"
                              dataKey="communication_score"
                              stroke="#3B82F6"
                              strokeWidth={2}
                              dot={{ fill: '#3B82F6', r: 3 }}
                              name="Communication (30%)"
                            />
                            <Line
                              type="monotone"
                              dataKey="confidence_score"
                              stroke="#10B981"
                              strokeWidth={2}
                              dot={{ fill: '#10B981', r: 3 }}
                              name="Confidence (25%)"
                            />
                            <Line
                              type="monotone"
                              dataKey="professionalism_score"
                              stroke="#8B5CF6"
                              strokeWidth={2}
                              dot={{ fill: '#8B5CF6', r: 3 }}
                              name="Professionalism (15%)"
                            />
                          </>
                        )}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            );
          })()}

              {/* Category Mini-Trends */}
              {trendData?.total_interviews > 0 && trendData?.categories && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    { label: 'Technical', key: 'technical', icon: Brain, color: 'text-amber-500 dark:text-amber-400', bg: 'bg-amber-500/10 text-amber-500' },
                    { label: 'Communication', key: 'communication', icon: MessageSquare, color: 'text-indigo-500 dark:text-indigo-400', bg: 'bg-indigo-500/10 text-indigo-500' },
                    { label: 'Confidence', key: 'confidence', icon: Shield, color: 'text-emerald-500 dark:text-emerald-400', bg: 'bg-emerald-500/10 text-emerald-500' },
                    { label: 'Professionalism', key: 'professionalism', icon: Trophy, color: 'text-purple-500 dark:text-purple-400', bg: 'bg-purple-500/10 text-purple-500' }
                  ].map((cat) => {
                    const cData = trendData?.categories?.[cat.key];
                    if (!cData) return null;
                    return (
                      <div key={cat.key} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 space-y-2.5 hover:border-indigo-300/40 transition-all">
                        <div className="flex items-center justify-between pb-1 border-b border-slate-200/50 dark:border-slate-700/50">
                          <div className="flex items-center gap-2">
                            <div className={`w-7 h-7 rounded-lg ${cat.bg} flex items-center justify-center shrink-0`}>
                              <cat.icon className={`w-3.5 h-3.5 ${cat.color}`} />
                            </div>
                            <span className="text-xs font-black text-slate-800 dark:text-slate-100">{cat.label}</span>
                          </div>
                          <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${
                            cData.trend === 'Improving' ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 border border-emerald-300/50' :
                            cData.trend === 'Declining' ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-400 border border-rose-300/50' :
                            'bg-slate-200/60 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                          }`}>
                            {cData.trend}
                          </span>
                        </div>
                        <div className="flex items-baseline justify-between pt-0.5">
                          <div>
                            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">Latest Score</span>
                            <h4 className="text-2xl font-black text-slate-900 dark:text-white">{cData.latest_score}%</h4>
                          </div>
                          {cData.previous_score !== null && (
                            <div className="text-right">
                              <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">Delta</span>
                              <span className={`text-xs font-black ${
                                cData.score_change > 0 ? 'text-emerald-600 dark:text-emerald-400' : cData.score_change < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'
                              }`}>
                                {cData.score_change > 0 ? `+${cData.score_change}%` : `${cData.score_change}%`}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="pt-2 border-t border-slate-200/50 dark:border-slate-700/50 flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                          <span>Overall Average</span>
                          <span className="font-bold text-slate-700 dark:text-slate-200">{cData.average_score}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
        </section>

        {/* ========================================================================= */}
        {/* FEATURE: SKILL-WISE ANALYTICS & COMPETENCY MASTERY */}
        {/* ========================================================================= */}
        <section className="bg-white dark:bg-[#111827] rounded-3xl border border-slate-200/80 dark:border-slate-800 p-6 lg:p-8 shadow-xs space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800">
                  COMPETENCY INTELLIGENCE
                </span>
                {skillsData?.total_skills_tracked > 0 && (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800">
                    {skillsData.total_skills_tracked} Skills Evaluated
                  </span>
                )}
              </div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight mt-1">
                Skill-Wise Analytics & Mastery
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                Granular competency evaluations derived from AI interview evaluations and verified resume skills.
              </p>
            </div>

            {/* Category Filter Pills (Single-line scrolling, no awkward wrapping) */}
            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl overflow-x-auto whitespace-nowrap scrollbar-none max-w-full">
              {['All', 'Technical', 'Communication', 'Behavior', 'Professionalism'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => {
                    setActiveSkillCategory(cat);
                    setShowAllSkills(false);
                  }}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all shrink-0 cursor-pointer ${
                    activeSkillCategory === cat
                      ? 'bg-white dark:bg-indigo-600 shadow-xs text-indigo-600 dark:text-white'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Category Averages Row */}
          {skillsData?.has_data && skillsData?.category_averages && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Technical Depth', cat: 'Technical', icon: Brain, color: 'text-amber-500' },
                { label: 'Communication Clarity', cat: 'Communication', icon: MessageSquare, color: 'text-indigo-500' },
                { label: 'Behavioral Poise', cat: 'Behavior', icon: Shield, color: 'text-emerald-500' },
                { label: 'Professional Standards', cat: 'Professionalism', icon: Trophy, color: 'text-purple-500' }
              ].map((item) => {
                const rawScore = skillsData.category_averages[item.cat];
                const hasScore = typeof rawScore === 'number' && rawScore > 0;
                return (
                  <div key={item.cat} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
                      <item.icon className={`w-4 h-4 ${item.color}`} />
                      <span>{item.label}</span>
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span className="text-2xl font-black text-slate-900 dark:text-white">
                        {hasScore ? `${rawScore}%` : '—'}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Benchmark: 75%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Skills Grid */}
          {(!skillsData?.has_data || !skillsData?.skills || skillsData.skills.length === 0) ? (
            <div className="p-10 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 text-center space-y-2">
              <Brain className="w-10 h-10 text-indigo-400 mx-auto opacity-50" />
              <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200">No Verified Skill Telemetry Yet</h4>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Complete interview sessions or mock assessments to establish your verified technical and behavioral skill benchmarks.
              </p>
            </div>
          ) : (
            (() => {
              const filteredSkills = skillsData.skills.filter((s: any) => {
                if (activeSkillCategory === 'All') return true;
                const catLower = (s.category || '').toLowerCase();
                const filterLower = activeSkillCategory.toLowerCase();
                if (filterLower === 'technical') {
                  return catLower.includes('tech') || !['communication', 'behavior', 'professionalism'].includes(catLower);
                }
                return catLower.includes(filterLower);
              });

              const displayedSkills = showAllSkills ? filteredSkills : filteredSkills.slice(0, 5);

              return (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {displayedSkills.map((sk: any, idx: number) => {
                      const profColor =
                        sk.proficiency === 'Expert' ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border-emerald-300' :
                        sk.proficiency === 'Proficient' ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400 border-blue-300' :
                        sk.proficiency === 'Intermediate' ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400 border-amber-300' :
                        'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-400 border-rose-300';

                      const barColor =
                        sk.score >= 85 ? 'bg-gradient-to-r from-emerald-500 to-teal-400' :
                        sk.score >= 70 ? 'bg-gradient-to-r from-indigo-500 to-blue-400' :
                        sk.score >= 55 ? 'bg-gradient-to-r from-amber-500 to-yellow-400' :
                        'bg-gradient-to-r from-rose-500 to-pink-400';

                      return (
                        <div
                          key={idx}
                          className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 space-y-3 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-200/70 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                                {sk.category}
                              </span>
                              <h4 className="text-sm font-black text-slate-900 dark:text-white mt-1">{sk.skill}</h4>
                            </div>
                            <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${profColor}`}>
                              {sk.proficiency}
                            </span>
                          </div>

                          <div className="space-y-1">
                            <div className="flex justify-between text-xs font-bold text-slate-600 dark:text-slate-300">
                              <span>Mastery Score</span>
                              <span className="font-black text-slate-900 dark:text-white">{sk.score}%</span>
                            </div>
                            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                              <div className={`h-full rounded-full ${barColor} transition-all duration-700`} style={{ width: `${sk.score}%` }} />
                            </div>
                          </div>

                          <div className="flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500 font-semibold pt-1 border-t border-slate-200/50 dark:border-slate-800">
                            <span>Observations: <strong>{sk.observations_count}x</strong></span>
                            {sk.trend && (
                              <span className="capitalize flex items-center gap-1">
                                {sk.trend === 'improving' && <TrendingUp className="w-3 h-3 text-emerald-500" />}
                                {sk.trend === 'declining' && <TrendingDown className="w-3 h-3 text-rose-500" />}
                                {sk.trend === 'stable' && <Minus className="w-3 h-3 text-slate-400" />}
                                Trend: {sk.trend}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {/* 6th Slot: Interactive Teaser Card to perfectly balance 3-col grid */}
                    {!showAllSkills && filteredSkills.length > 5 && (
                      <button
                        onClick={() => setShowAllSkills(true)}
                        className="p-5 rounded-2xl border-2 border-dashed border-indigo-300/80 dark:border-indigo-700/60 bg-gradient-to-br from-indigo-50/50 via-slate-50/30 to-purple-50/50 dark:from-indigo-950/20 dark:via-slate-800/40 dark:to-purple-950/20 hover:border-indigo-500 dark:hover:border-indigo-500 hover:from-indigo-100/60 dark:hover:from-indigo-900/30 transition-all flex flex-col items-center justify-center text-center group cursor-pointer min-h-[160px] shadow-xs"
                      >
                        <div className="w-11 h-11 rounded-2xl bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-2.5 group-hover:scale-110 transition-transform shadow-xs">
                          <Layers className="w-5 h-5" />
                        </div>
                        <span className="text-sm font-black text-slate-900 dark:text-white">
                          +{filteredSkills.length - 5} More Skills
                        </span>
                        <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 mt-1 flex items-center gap-1">
                          See more & expand <ChevronDown className="w-3.5 h-3.5 group-hover:translate-y-0.5 transition-transform" />
                        </span>
                      </button>
                    )}
                  </div>

                  {/* Expand / Collapse Bottom Action Bar */}
                  {filteredSkills.length > 5 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800 gap-3">
                      <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                        Showing <strong className="text-slate-900 dark:text-white">{showAllSkills ? filteredSkills.length : 5}</strong> of <strong className="text-slate-900 dark:text-white">{filteredSkills.length}</strong> skills
                      </p>
                      <button
                        onClick={() => setShowAllSkills(!showAllSkills)}
                        id="expand-skills-btn"
                        className="px-6 py-2.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/70 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200/80 dark:border-indigo-800/80 text-xs font-black flex items-center gap-2 transition-all shadow-xs hover:shadow-md cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                      >
                        {showAllSkills ? (
                          <>
                            <span>Show Less Skills</span>
                            <ChevronUp className="w-4 h-4" />
                          </>
                        ) : (
                          <>
                            <span>See More Skills ({filteredSkills.length - 5} remaining)</span>
                            <ChevronDown className="w-4 h-4" />
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              );
            })()
          )}
        </section>

        {/* ========================================================================= */}
        {/* FEATURE 1: RECURRING WEAK AREAS */}
        {/* ========================================================================= */}
        <section className="bg-white dark:bg-[#111827] rounded-3xl border border-slate-200/80 dark:border-slate-800 p-6 lg:p-8 shadow-xs space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-5">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200/60 dark:border-rose-800">
                  PREDICTIVE INTELLIGENCE
                </span>
                {weakAreasData && weakAreasData.weak_areas_count > 0 && (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-800">
                    {weakAreasData.weak_areas_count} Focus Area{weakAreasData.weak_areas_count > 1 ? 's' : ''} Identified
                  </span>
                )}
              </div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight mt-1">
                Recurring Weak Areas & Predictive Recommendations
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                Pattern recognition across your completed interviews with evidence-backed learning pathways.
              </p>
            </div>
          </div>

          {(!weakAreasData?.weak_areas || weakAreasData.weak_areas.length === 0) ? (
            <div className="p-8 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 text-center space-y-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto opacity-80" />
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">No Recurring Weak Areas Detected</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                {weakAreasData?.total_interviews === 0
                  ? "Complete your first interview simulation to uncover target focus competencies."
                  : "No recurring weak areas detected from available interview history. Maintain your performance across upcoming interviews!"}
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {(showAllWeakAreas ? (weakAreasData.weak_areas || []) : (weakAreasData.weak_areas || []).slice(0, 12)).map((wa: any, idx: number) => (
                  <div key={idx} className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 flex flex-col justify-between space-y-4 hover:border-indigo-300 dark:hover:border-indigo-600 transition-colors">
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-200/70 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                            {wa.category}
                          </span>
                          <h4 className="text-base font-black text-slate-900 dark:text-white mt-1.5">{wa.skill}</h4>
                        </div>
                        <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ${
                          wa.severity === 'high' ? 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-400 border border-rose-300 dark:border-rose-800' :
                          wa.severity === 'medium' ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-800' :
                          'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                        }`}>
                          {wa.severity} Priority
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 bg-white dark:bg-slate-900/60 p-3 rounded-xl border border-slate-100 dark:border-slate-800 text-center">
                        <div>
                          <p className="text-[9px] font-bold uppercase text-slate-400">Occurrences</p>
                          <p className="text-xs font-black text-slate-800 dark:text-slate-200 mt-0.5">{wa.weak_occurrences}x</p>
                        </div>
                        <div>
                          <p className="text-[9px] font-bold uppercase text-slate-400">Avg Score</p>
                          <p className="text-xs font-black text-slate-800 dark:text-slate-200 mt-0.5">{wa.average_score}%</p>
                        </div>
                        <div>
                          <p className="text-[9px] font-bold uppercase text-slate-400">Trend</p>
                          <p className={`text-xs font-black capitalize mt-0.5 ${
                            wa.trend === 'improving' ? 'text-emerald-600 dark:text-emerald-400' :
                            wa.trend === 'declining' ? 'text-rose-600 dark:text-rose-400' : 'text-slate-600 dark:text-slate-300'
                          }`}>
                            {wa.trend}
                          </p>
                        </div>
                      </div>

                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">Recommendation</p>
                        <p className="text-xs text-slate-600 dark:text-slate-300 font-medium leading-relaxed bg-white dark:bg-slate-900/60 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                          {wa.recommendation}
                        </p>
                      </div>
                    </div>

                    {wa.resources && wa.resources.length > 0 && (
                      <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800 space-y-1.5">
                        <p className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400">Verified Study Resources</p>
                        {wa.resources.slice(0, 2).map((res: any, rIdx: number) => (
                          <a
                            key={rIdx}
                            href={res.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-slate-900/40 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 border border-slate-100 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors text-xs font-bold"
                          >
                            <span className="truncate pr-2">{res.title}</span>
                            <ExternalLink className="w-3.5 h-3.5 shrink-0 opacity-60" />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Expand / Collapse Button */}
              {weakAreasData?.weak_areas && weakAreasData.weak_areas.length > 12 && (
                <div className="flex flex-col sm:flex-row items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800 gap-3">
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                    Showing <strong className="text-slate-900 dark:text-white">{showAllWeakAreas ? weakAreasData.weak_areas.length : 12}</strong> of <strong className="text-slate-900 dark:text-white">{weakAreasData.weak_areas.length}</strong> focus areas
                  </p>
                  <button
                    onClick={() => setShowAllWeakAreas(!showAllWeakAreas)}
                    id="expand-weak-areas-btn"
                    className="px-6 py-2.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/70 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200/80 dark:border-indigo-800/80 text-xs font-black flex items-center gap-2 transition-all shadow-xs hover:shadow-md cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                  >
                    {showAllWeakAreas ? (
                      <>
                        <span>Show Less Focus Areas</span>
                        <ChevronUp className="w-4 h-4" />
                      </>
                    ) : (
                      <>
                        <span>See More Focus Areas ({(weakAreasData?.weak_areas?.length || 12) - 12} remaining)</span>
                        <ChevronDown className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              )}
            </>
          )}
        </section>

        {/* ========================================================================= */}
        {/* FEATURE: AI FEEDBACK & IMPROVEMENT PROGRESS */}
        {/* ========================================================================= */}
        <section className="bg-white dark:bg-[#111827] rounded-3xl border border-slate-200/80 dark:border-slate-800 p-6 lg:p-8 shadow-xs space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 border border-purple-200/60 dark:border-purple-800">
                  AI COACHING INTELLIGENCE
                </span>
                {progressData?.improvement_velocity !== undefined && (
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1 ${
                    progressData.overall_change > 0 ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 border border-emerald-300' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}>
                    <TrendingUp className="w-3 h-3" />
                    Overall Progression: {progressData.overall_change > 0 ? `+${progressData.overall_change}%` : `${progressData.overall_change}%`}
                  </span>
                )}
              </div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight mt-1">
                AI Feedback & Improvement Progress
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                Dynamic milestone achievements, performance velocity, and targeted AI coaching directives.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Coaching Directives Banner */}
            <div className="lg:col-span-8 p-6 rounded-2xl bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-pink-500/5 border border-indigo-500/30 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 text-white flex items-center justify-center font-bold shadow-md">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-slate-900 dark:text-white">AI Coach Personalized Assessment</h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Synthesized across completed technical & behavioral rounds.</p>
                </div>
              </div>

              <p className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 leading-relaxed bg-white/70 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200/60 dark:border-slate-800">
                {progressData?.coaching_summary || 'Complete simulation sessions to unlock personalized AI feedback and automated performance milestones.'}
              </p>

              {/* Action Items List */}
              {progressData?.action_items && progressData.action_items.length > 0 && (
                <div className="space-y-2 pt-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Recommended AI Action Plan:
                  </span>
                  <div className="space-y-2">
                    {progressData.action_items.map((act: string, aIdx: number) => (
                      <div key={aIdx} className="flex items-start gap-2.5 p-3 rounded-xl bg-white/60 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                        <span>{act}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Milestones & Velocity Column */}
            <div className="lg:col-span-4 flex flex-col gap-4">
              {/* Velocity Metric Card */}
              <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">IMPROVEMENT VELOCITY</span>
                  <Award className="w-4 h-4 text-indigo-500" />
                </div>
                <div className="flex items-baseline gap-2">
                  <h3 className="text-3xl font-black text-slate-900 dark:text-white">
                    {progressData?.improvement_velocity !== undefined ? (progressData.improvement_velocity > 0 ? `+${progressData.improvement_velocity}%` : `${progressData.improvement_velocity}%`) : '0%'}
                  </h3>
                  <span className="text-xs font-bold text-slate-400">/ interview</span>
                </div>
                <p className="text-[10px] text-slate-500 font-medium">Average overall score delta gained per completed session.</p>
              </div>

              {/* Milestones Earned */}
              <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 space-y-3 flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">ACHIEVEMENT BADGES</span>
                  <Trophy className="w-4 h-4 text-amber-500" />
                </div>
                <div className="space-y-2">
                  {(!progressData?.has_data || !progressData?.milestones || progressData.milestones.length === 0) ? (
                    <div className="p-4 text-center rounded-xl bg-white dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
                      <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">No Badges Earned Yet</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Complete mock assessments or interview sessions to earn achievement badges.</p>
                    </div>
                  ) : (
                    progressData.milestones.map((m: any, mIdx: number) => (
                      <div key={m.id || mIdx} className="p-2.5 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 flex items-center gap-3">
                        <span className="text-xl shrink-0">{m.badge}</span>
                        <div className="min-w-0">
                          <h5 className="text-xs font-black text-slate-900 dark:text-white truncate">{m.title}</h5>
                          <p className="text-[10px] text-slate-400 truncate">{m.description}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* INTERVIEW HISTORY & REAL-TIME ACTIVITY FEED */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Enhanced History Section with Tabs for AI Interviews and Mock Assessments */}
          <div className="lg:col-span-7 xl:col-span-8 bg-white dark:bg-[#111827] rounded-3xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-xs flex flex-col justify-between space-y-4">
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <button
                      onClick={() => setHistoryTab('interviews')}
                      className={`px-3 py-1 rounded-xl text-xs font-black transition-all cursor-pointer ${
                        historyTab === 'interviews'
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      🎙️ AI Interviews ({history.length})
                    </button>
                    <button
                      onClick={() => setHistoryTab('assessments')}
                      className={`px-3 py-1 rounded-xl text-xs font-black transition-all cursor-pointer ${
                        historyTab === 'assessments'
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      📝 Mock Assessments ({assessHistory.length})
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400 font-medium">
                    {historyTab === 'interviews'
                      ? 'Full interview scorecards, recordings, and printable PDF reports.'
                      : 'Mock assessment test history with detailed answer sheet review & explanations.'}
                  </p>
                </div>

                {/* Round Filter for Interviews */}
                {historyTab === 'interviews' && (
                  <div className="flex items-center gap-2">
                    <select
                      value={historyRoundFilter}
                      onChange={(e) => setHistoryRoundFilter(e.target.value)}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer"
                    >
                      <option value="all">All Rounds</option>
                      <option value="technical">Technical</option>
                      <option value="behavioral">Behavioral</option>
                      <option value="hr">HR</option>
                      <option value="practice">Practice</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Search filter for Interviews */}
              {historyTab === 'interviews' && (
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search by role target or session title..."
                    value={historySearchTerm}
                    onChange={(e) => setHistorySearchTerm(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              )}

              <div className="space-y-3 overflow-y-auto custom-scrollbar max-h-[420px] pr-1">
                {historyTab === 'assessments' ? (
                  assessHistory.length === 0 ? (
                    <div className="py-12 flex flex-col items-center justify-center text-center text-slate-400 dark:text-slate-600">
                      <BookOpen className="w-12 h-12 mb-2 opacity-40 text-indigo-400" />
                      <p className="text-xs font-semibold">No mock assessments completed yet.</p>
                      <button
                        onClick={() => navigate('/practice')}
                        className="mt-3 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-extrabold rounded-xl transition-all cursor-pointer"
                      >
                        Start Practice Assessment
                      </button>
                    </div>
                  ) : (
                    assessHistory.map((item: any) => (
                      <div
                        key={item.session_id}
                        className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-100 dark:border-slate-800 transition-all space-y-3"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-cyan-100 dark:bg-cyan-950/80 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0">
                              <Zap className="w-4 h-4" />
                            </div>
                            <div>
                              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                {item.title || 'Technical Assessment'}
                              </h4>
                              <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                                <span>{item.date || 'Recent'}</span>
                                <span>•</span>
                                <span className="capitalize">{item.difficulty || 'Medium'}</span>
                                <span>•</span>
                                <span>{item.question_count || 10} Questions</span>
                              </div>
                            </div>
                          </div>
                          {item.overall_score !== null && item.overall_score !== undefined ? (
                            <span className={`px-2.5 py-1 rounded-lg text-xs font-black self-start sm:self-center ${
                              item.overall_score >= 70
                                ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400'
                                : 'bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-400'
                            }`}>
                              {item.overall_score}% {item.hiring_recommendation === 'Pass' ? 'PASSED' : 'COMPLETED'}
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                              {item.status || 'Completed'}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 pt-2 border-t border-slate-200/50 dark:border-slate-700/50">
                          <button
                            onClick={() => navigate(`/assessment/review?session=${item.session_id}`)}
                            className="flex-1 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/80 dark:hover:bg-indigo-900 text-indigo-600 dark:text-indigo-400 text-[10px] font-extrabold flex items-center justify-center gap-1 border border-indigo-200 dark:border-indigo-800 transition-colors cursor-pointer"
                          >
                            <Eye className="w-3 h-3" />
                            <span>Review Test & Answer Sheet</span>
                          </button>
                        </div>
                      </div>
                    ))
                  )
                ) : history.length === 0 ? (
                  <div className="py-12 flex flex-col items-center justify-center text-center text-slate-400 dark:text-slate-600">
                    <Award className="w-12 h-12 mb-2 opacity-40 text-indigo-400" />
                    <p className="text-xs font-semibold">No evaluation reports generated yet.</p>
                    <p className="text-[11px] text-slate-400 mt-1">Complete an interview session to review your full scorecard.</p>
                  </div>
                ) : (
                  history
                    .filter((item: any) => {
                      const title = (item.role_target || item.title || '').toLowerCase();
                      const round = (item.round_type || '').toLowerCase();
                      const matchesSearch = !historySearchTerm || title.includes(historySearchTerm.toLowerCase());
                      const matchesRound = historyRoundFilter === 'all' || round.includes(historyRoundFilter.toLowerCase());
                      return matchesSearch && matchesRound;
                    })
                    .slice(0, showAllHistory ? undefined : 6)
                    .map((item: any) => {
                      const sid = item.session_id || item.id;
                      const isDownloading = downloadingPdfId === sid;

                      return (
                        <div
                          key={sid}
                          className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-100 dark:border-slate-800 transition-all space-y-3"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                                <Video className="w-4 h-4" />
                              </div>
                              <div>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                    {item.role_target || item.title || 'Practice Session'}
                                  </h4>
                                  <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                                    {item.round_type || 'Technical'}
                                  </span>
                                  {item.has_recording && (
                                    <span className="px-1.5 py-0.2 rounded bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 text-[9px] font-black uppercase border border-emerald-300 dark:border-emerald-800">
                                      🎥 Video
                                    </span>
                                  )}
                                </div>
                                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                                  {item.started_at || item.created_at
                                    ? new Date(item.started_at || item.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                                    : 'Recent'}
                                </p>
                              </div>
                            </div>

                            {item.overall_score !== null && item.overall_score !== undefined && (
                              <span className={`px-2.5 py-1 rounded-lg text-xs font-black self-start sm:self-center ${
                                item.overall_score >= 80 ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400' :
                                item.overall_score >= 60 ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-400' :
                                'bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-400'
                              }`}>
                                {item.overall_score}% Overall
                              </span>
                            )}
                          </div>

                          {/* Action buttons row */}
                          <div className="flex items-center gap-2 pt-2 border-t border-slate-200/50 dark:border-slate-700/50">
                            <button
                              onClick={() => navigate(`/reports?session=${sid}`)}
                              className="flex-1 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/80 dark:hover:bg-indigo-900 text-indigo-600 dark:text-indigo-400 text-[10px] font-extrabold flex items-center justify-center gap-1 border border-indigo-200 dark:border-indigo-800 transition-colors cursor-pointer"
                            >
                              <Eye className="w-3 h-3" />
                              <span>View Full Scorecard</span>
                            </button>

                            <button
                              onClick={() => handleDownloadReport(sid, item.role_target || item.title)}
                              disabled={isDownloading}
                              className="px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/80 dark:hover:bg-emerald-900 text-emerald-700 dark:text-emerald-300 text-[10px] font-extrabold flex items-center gap-1 border border-emerald-200 dark:border-emerald-800 transition-colors cursor-pointer disabled:opacity-50"
                              title="Download PDF Scorecard Report"
                            >
                              <Download className="w-3 h-3" />
                              <span>{isDownloading ? 'Generating...' : 'Download Report'}</span>
                            </button>
                          </div>
                        </div>
                      );
                    })
                )}
              </div>
            </div>

            {historyTab === 'interviews' && history.length > 6 && (
              <button
                onClick={() => setShowAllHistory(!showAllHistory)}
                className="w-full mt-3 py-2 rounded-xl text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 transition-colors text-center cursor-pointer"
              >
                {showAllHistory ? 'Show Recent 6 Interviews' : `View All ${history.length} Interviews`}
              </button>
            )}
          </div>

          {/* Real-Time Activity Log */}
          <div className="lg:col-span-5 xl:col-span-4 bg-white dark:bg-[#111827] rounded-3xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-xs flex flex-col justify-between min-h-[440px]">
            <div>
              <div className="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <Activity className="w-4 h-4 text-indigo-500" />
                  <span>Real-Time Activity Feed</span>
                </h3>
                <span className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Live Stream
                </span>
              </div>
              <div className="space-y-3 overflow-y-auto custom-scrollbar pr-1 max-h-[360px]">
                {(!safeMetrics.recent_activity || safeMetrics.recent_activity.length === 0) ? (
                  <div className="py-12 flex flex-col items-center justify-center text-center p-6 text-slate-400 dark:text-slate-600">
                    <Activity className="w-10 h-10 mb-2 opacity-40 text-indigo-400" />
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300">No recent activity detected.</p>
                    <p className="text-[11px] text-slate-400 mt-1">Actions you perform will stream here in real time.</p>
                  </div>
                ) : (
                  (safeMetrics.recent_activity || []).map((act: any, aIdx: number) => (
                    <div key={act.id || aIdx} className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800/80 flex items-start gap-3 hover:border-indigo-300/40 transition-colors">
                      <div className="mt-0.5 w-7 h-7 rounded-xl bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 flex items-center justify-center shrink-0">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h5 className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{act.title}</h5>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-0.5 leading-relaxed">{act.message}</p>
                        <span className="text-[9px] text-slate-400 dark:text-slate-500 font-bold mt-1.5 block">
                          {act.created_at ? new Date(act.created_at).toLocaleString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' }) : 'Recent'}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-400 dark:text-slate-500 text-center font-medium">
              WebSocket synchronized with backend event bus
            </div>
          </div>
        </div>

        {/* Recommended Jobs */}
        <div className="bg-white dark:bg-[#111827] rounded-3xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-xs">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">Recommended Jobs</h3>
            <button onClick={() => navigate('/jobs')} className="text-xs text-indigo-600 dark:text-indigo-400 font-bold hover:underline flex items-center gap-1 cursor-pointer">
              View Job Board <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {jobs.slice(0, 3).map((job) => {
              const isApplied = myApplications.some((a: any) => a.job_id === job.id);
              return (
                <div key={job.id} className="p-5 flex flex-col justify-between bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-600 transition-colors">
                  <div>
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">{job.title}</h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">{job.company_name || 'Enterprise Client'}</p>
                      </div>
                      {isApplied && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 text-[9px] font-extrabold flex items-center gap-1 border border-emerald-200 dark:border-emerald-800">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                          Applied
                        </span>
                      )}
                    </div>
                    
                    <div className="flex flex-wrap gap-2 mt-3 text-[10px] text-slate-600 dark:text-slate-300 font-bold uppercase tracking-wide">
                      <span className="flex items-center gap-1 bg-slate-200/60 dark:bg-slate-700/60 px-2 py-1 rounded-md">
                        <MapPin className="w-3 h-3" /> {job.location || 'Remote'}
                      </span>
                      <span className="flex items-center gap-1 bg-slate-200/60 dark:bg-slate-700/60 px-2 py-1 rounded-md">
                        <DollarSign className="w-3 h-3" /> {job.salary_range || 'N/A'}
                      </span>
                    </div>
                  </div>
                  {isApplied ? (
                    <button
                      disabled
                      className="mt-5 w-full py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 font-bold text-xs border border-emerald-200 dark:border-emerald-800 cursor-not-allowed flex items-center justify-center gap-1"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      Applied
                    </button>
                  ) : (
                    <button
                      onClick={() => setSelectedJobForApply(job)}
                      className="mt-5 w-full py-2.5 rounded-xl bg-slate-900 dark:bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-600 dark:hover:bg-indigo-500 transition-colors cursor-pointer"
                    >
                      Quick Apply
                    </button>
                  )}
                </div>
              );
            })}
            {jobs.length === 0 && (
              <div className="col-span-3 text-center p-8 text-slate-400 dark:text-slate-600">
                <Briefcase className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-xs font-medium">No recommended jobs available at this time.</p>
              </div>
            )}
          </div>
        </div>

      </main>

      {selectedJobForApply && (
        <JobApplicationModal
          isOpen={!!selectedJobForApply}
          job={selectedJobForApply}
          onClose={() => setSelectedJobForApply(null)}
          onSuccess={() => {
            setSelectedJobForApply(null);
            fetchCandidateData();
          }}
        />
      )}

      {selectedJobForView && (
        <JobDetailsModal
          isOpen={!!selectedJobForView}
          job={selectedJobForView}
          onClose={() => setSelectedJobForView(null)}
        />
      )}
    </>
  );
};

export default CandidateDashboard;
