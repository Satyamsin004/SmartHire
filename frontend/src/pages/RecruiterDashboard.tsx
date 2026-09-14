import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { RecruiterHiringTeamIllustration } from '../components/illustrations/Illustrations';
import {
  Users, FileText, CheckCircle2, Plus, Send, Briefcase, Eye, Edit3, Copy, XCircle,
  Trash2, Globe, Clock, ChevronRight, Search, Filter, MessageSquare, Star,
  ExternalLink, UserCheck, Download, MapPin, Phone, GraduationCap, Award, Check, Gift, Video,
  Paperclip, BookOpen, ShieldCheck, ShieldAlert, ShieldX, LayoutGrid, List, Sparkles, X, Trophy, TrendingUp,
  Lock, Brain, AlertCircle, Calendar, BarChart3, Target, Layers, Zap, GitCompare, ArrowUpDown
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
  LineChart, Line, AreaChart, Area, Legend, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  PieChart, Pie
} from 'recharts';
import api, { resolveResumeUrl } from '../services/api';
import { useWebSocket } from '../context/WebSocketContext';
import { CreateJobModal } from '../components/recruiter/CreateJobModal';
import { JobDetailsModal } from '../components/recruiter/JobDetailsModal';
import { ScheduleInterviewModal } from '../components/recruiter/ScheduleInterviewModal';
import { SendOfferModal } from '../components/recruiter/SendOfferModal';
import { EvaluationReportModal } from '../components/recruiter/EvaluationReportModal';
import { CandidateProfileModal } from '../components/recruiter/CandidateProfileModal';
import { CandidateComparisonModal } from '../components/recruiter/CandidateComparisonModal';
import { WelcomeHeroCard } from '../components/ui/WelcomeHeroCard';
import { SemiCircularGauge } from '../components/ui/SemiCircularGauge';
import { DualWaveSplineChart } from '../components/ui/DualWaveSplineChart';

export type RecruiterTabType = 'requisitions' | 'applications' | 'shortlisted' | 'evaluations' | 'ranking' | 'comparison' | 'skills' | 'trends' | 'insights' | 'rejected' | 'offers';

interface RecruiterDashboardProps {
  defaultTab?: RecruiterTabType;
}

export const RecruiterDashboard: React.FC<RecruiterDashboardProps> = ({ defaultTab }) => {
  const { lastMessage } = useWebSocket();

  // Instant Cache Hydration: Render immediately from local cache (0ms perceived latency)
  const getCachedRecruiterDashboard = () => {
    try {
      const raw = localStorage.getItem('smarthire_rec_dash_cache');
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  };
  const cached = getCachedRecruiterDashboard();

  const [recruiterName, setRecruiterName] = useState(() => {
    const raw = localStorage.getItem('user_data') || localStorage.getItem('user');
    if (raw) {
      try { return JSON.parse(raw)?.full_name || 'Recruiter'; } catch (e) {}
    }
    return 'Recruiter';
  });

  const [applications, setApplications] = useState<any[]>(cached?.applications || []);
  const [evaluations, setEvaluations] = useState<any[]>(cached?.evaluations || []);
  const [atsRejected, setAtsRejected] = useState<any[]>(cached?.atsRejected || []);
  const [myJobs, setMyJobs] = useState<any[]>(cached?.myJobs || []);
  const [jobAnalytics, setJobAnalytics] = useState<any>(cached?.jobAnalytics || { total_jobs: 0, active_jobs: 0, draft_jobs: 0, closed_jobs: 0, total_applications: 0 });
  const [shortlistedCandidates, setShortlistedCandidates] = useState<any[]>(cached?.shortlistedCandidates || []);
  const [issuedOffers, setIssuedOffers] = useState<any[]>(cached?.issuedOffers || []);
  const [conductedInterviews, setConductedInterviews] = useState<any[]>(cached?.conductedInterviews || []);
  
  const [activeTab, setActiveTab] = useState<RecruiterTabType>(defaultTab || 'requisitions');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  
  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [stageFilter, setStageFilter] = useState<string>('all');
  
  // Candidate Ranking State
  const [rankingList, setRankingList] = useState<any[]>(cached?.rankingList || []);
  const [rankingJobFilter, setRankingJobFilter] = useState<string>('all');
  const [rankingLoading, setRankingLoading] = useState(false);
  const [rankingTieBreaker, setRankingTieBreaker] = useState<string>(cached?.rankingTieBreaker || '');

  // Candidate Comparison & Advanced Analytics State
  const [selectedCandidateIdsForCompare, setSelectedCandidateIdsForCompare] = useState<string[]>([]);
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);
  const [recruiterSkillData, setRecruiterSkillData] = useState<any>(cached?.recruiterSkillData || null);
  const [recruiterTrendData, setRecruiterTrendData] = useState<any>(cached?.recruiterTrendData || null);
  const [shortlistingInsightsData, setShortlistingInsightsData] = useState<any>(cached?.shortlistingInsightsData || null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [skillViewMode, setSkillViewMode] = useState<'candidates' | 'matrix'>('candidates');
  const [selectedSkillCandidateId, setSelectedSkillCandidateId] = useState<string | null>(null);
  const [skillCandidateSearch, setSkillCandidateSearch] = useState('');
  const [skillStatusFilter, setSkillStatusFilter] = useState<'all' | 'evaluated' | 'pending'>('all');
  
  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedJobForEdit, setSelectedJobForEdit] = useState<any>(null);
  const [selectedJobForView, setSelectedJobForView] = useState<any>(null);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [scheduleModalMode, setScheduleModalMode] = useState<'assessment' | 'interview'>('assessment');
  const [scheduleModalRound, setScheduleModalRound] = useState<string>('Technical');
  const [selectedCandidateForSchedule, setSelectedCandidateForSchedule] = useState<any>(null);
  const [isOfferModalOpen, setIsOfferModalOpen] = useState(false);
  const [selectedApplicationForOffer, setSelectedApplicationForOffer] = useState<any>(null);
  const [selectedEvaluationId, setSelectedEvaluationId] = useState<string | null>(null);
  const [isEvaluationModalOpen, setIsEvaluationModalOpen] = useState(false);
  const [selectedProfileCandidateId, setSelectedProfileCandidateId] = useState<string | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  // Candidate Actions Modals
  const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);
  const [messageCandidate, setMessageCandidate] = useState<any>(null);
  const [messageSubject, setMessageSubject] = useState('Opportunity Update from Recruiter');
  const [messageBody, setMessageBody] = useState('');

  useEffect(() => {
    fetchRecruiterData();
  }, []);

  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    const tabParam = searchParams.get('tab') as RecruiterTabType | null;
    if (tabParam) {
      setActiveTab(tabParam);
    } else if (defaultTab) {
      setActiveTab(defaultTab);
    }

    if (searchParams.get('action') === 'create-job') {
      setSelectedJobForEdit(null);
      setIsCreateModalOpen(true);
    }
  }, [searchParams, defaultTab]);

  // Real-time synchronization upon WebSocket message
  useEffect(() => {
    if (lastMessage) {
      fetchRecruiterData();
    }
  }, [lastMessage]);

  const fetchRecruiterData = () => {
    const updatedCache: any = { ...(getCachedRecruiterDashboard() || {}) };
    const persistCache = () => {
      try {
        localStorage.setItem('smarthire_rec_dash_cache', JSON.stringify(updatedCache));
      } catch (e) {}
    };

    // 1. My Jobs & Job Analytics (Fastest, ~15ms)
    api.get('/jobs/my-jobs').then(res => {
      if (res.data) {
        const jobs = res.data.jobs || [];
        const analytics = res.data.analytics || {};
        setMyJobs(jobs);
        setJobAnalytics(analytics);
        updatedCache.myJobs = jobs;
        updatedCache.jobAnalytics = analytics;
        persistCache();
      }
    }).catch(err => console.error('Fetch my-jobs error:', err));

    // 2. Applications (~20ms)
    api.get('/recruiter/applications').then(res => {
      if (res.data) {
        setApplications(res.data);
        updatedCache.applications = res.data;
        persistCache();
      }
    }).catch(err => console.error('Fetch applications error:', err));

    // 3. Evaluations (Optimized to ~56ms with batch query)
    api.get('/recruiter/evaluations').then(res => {
      if (res.data) {
        setEvaluations(res.data);
        updatedCache.evaluations = res.data;
        persistCache();
      }
    }).catch(err => console.error('Fetch evaluations error:', err));

    // 4. ATS Rejected candidates
    api.get('/recruiter/ats-rejected').then(res => {
      if (res.data) {
        setAtsRejected(res.data);
        updatedCache.atsRejected = res.data;
        persistCache();
      }
    }).catch(err => console.error('Fetch ats-rejected error:', err));

    // 5. Shortlisted candidates
    api.get('/recruiter/shortlisted-candidates').then(res => {
      if (res.data) {
        setShortlistedCandidates(res.data);
        updatedCache.shortlistedCandidates = res.data;
        persistCache();
      }
    }).catch(err => console.error('Fetch shortlisted candidates error:', err));

    // 6. Issued offers
    api.get('/recruiter/offers').then(res => {
      if (res.data) {
        setIssuedOffers(res.data);
        updatedCache.issuedOffers = res.data;
        persistCache();
      }
    }).catch(err => console.error('Fetch offers error:', err));

    // 7. Interview history (exact count of conducted interviews)
    api.get('/interview/history').then(res => {
      if (res.data) {
        setConductedInterviews(res.data);
        updatedCache.conductedInterviews = res.data;
        persistCache();
      }
    }).catch(err => console.error('Fetch interview history error:', err));

    // Concurrently fetch ranking and analytics in parallel without blocking UI
    fetchRankingData();
    fetchAnalyticsData();
  };

  const fetchAnalyticsData = async (jobId?: string) => {
    try {
      setAnalyticsLoading(true);
      const targetJob = jobId !== undefined ? jobId : rankingJobFilter;
      const params: any = {};
      if (targetJob && targetJob !== 'all') {
        params.job_id = targetJob;
      }
      const [skillsRes, trendsRes, insightsRes] = await Promise.allSettled([
        api.get('/analytics/recruiter/skill-analytics', { params }),
        api.get('/analytics/recruiter/performance-trends', { params }),
        api.get('/analytics/recruiter/shortlisting-insights', { params })
      ]);
      const cache = getCachedRecruiterDashboard() || {};
      if (skillsRes.status === 'fulfilled' && skillsRes.value?.data) {
        setRecruiterSkillData(skillsRes.value.data);
        cache.recruiterSkillData = skillsRes.value.data;
      }
      if (trendsRes.status === 'fulfilled' && trendsRes.value?.data) {
        setRecruiterTrendData(trendsRes.value.data);
        cache.recruiterTrendData = trendsRes.value.data;
      }
      if (insightsRes.status === 'fulfilled' && insightsRes.value?.data) {
        setShortlistingInsightsData(insightsRes.value.data);
        cache.shortlistingInsightsData = insightsRes.value.data;
      }
      try {
        localStorage.setItem('smarthire_rec_dash_cache', JSON.stringify(cache));
      } catch (e) {}
    } catch (err) {
      console.error('Fetch recruiter analytics error:', err);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const toggleCandidateForCompare = (candidateId: string, autoOpenWhenReady = false) => {
    setSelectedCandidateIdsForCompare(prev => {
      let next: string[];
      if (prev.includes(candidateId)) {
        next = prev.filter(id => id !== candidateId);
      } else {
        if (prev.length >= 4) {
          alert('You can select up to 4 candidates for side-by-side comparison.');
          return prev;
        }
        next = [...prev, candidateId];
      }
      if (autoOpenWhenReady && next.length >= 2) {
        setIsCompareModalOpen(true);
      }
      return next;
    });
  };

  const fetchRankingData = async (jobId?: string) => {
    try {
      setRankingLoading(true);
      const targetJob = jobId !== undefined ? jobId : rankingJobFilter;
      const params: any = {};
      if (targetJob && targetJob !== 'all') {
        params.job_id = targetJob;
      }
      const res = await api.get('/analytics/candidates/ranking', { params });
      const ranking = res.data?.ranking || [];
      const tieBreaker = res.data?.scope?.tie_breaker || '';
      setRankingList(ranking);
      if (tieBreaker) {
        setRankingTieBreaker(tieBreaker);
      }
      try {
        const cache = getCachedRecruiterDashboard() || {};
        cache.rankingList = ranking;
        cache.rankingTieBreaker = tieBreaker;
        localStorage.setItem('smarthire_rec_dash_cache', JSON.stringify(cache));
      } catch (e) {}

      if (jobId !== undefined) {
        fetchAnalyticsData(targetJob);
      }
    } catch (err) {
      console.error('Fetch candidate rankings error:', err);
    } finally {
      setRankingLoading(false);
    }
  };

  const handleShortlistCandidate = async (candidateId: string) => {
    try {
      await api.post(`/recruiter/candidate/${candidateId}/shortlist`);
      fetchRecruiterData();
    } catch (err) {
      console.error('Shortlist candidate error:', err);
    }
  };

  const handleSendMessage = async () => {
    if (!messageCandidate || !messageBody.trim()) return;
    try {
      await api.post(`/recruiter/candidate/${messageCandidate.id}/message`, {
        subject: messageSubject,
        message: messageBody
      });
      alert(`Message dispatched to ${messageCandidate.full_name || messageCandidate.name || 'Candidate'} successfully.`);
      setIsMessageModalOpen(false);
      setMessageBody('');
    } catch (err) {
      console.error('Send message error:', err);
    }
  };

  const handleRejectCandidate = async (applicationId: string) => {
    if (!window.confirm('Are you sure you want to mark this candidate as Rejected for this position?')) return;
    try {
      await api.post(`/recruiter/application/${applicationId}/status`, {
        status: 'Rejected'
      });
      fetchRecruiterData();
    } catch (err) {
      console.error('Reject candidate error:', err);
    }
  };

  const handlePassAndAdvance = async (applicationId: string, roundType: string) => {
    try {
      await api.post('/recruiter/decision', {
        application_id: applicationId,
        decision: 'pass',
        round_type: roundType
      });
      fetchRecruiterData();
    } catch (err) {
      console.error(`Pass ${roundType} error:`, err);
    }
  };

  // Pipeline Stages Definition
  const PIPELINE_STAGES = [
    { label: '1. Applied', key: 'applied' },
    { label: '2. ATS Passed', key: 'ats' },
    { label: '3. Online Assessment', key: 'assessment' },
    { label: '4. Technical Interview', key: 'tech' },
    { label: '5. Behavioral Interview', key: 'behavioral' },
    { label: '6. HR Interview', key: 'hr' },
    { label: '7. Offer Letter', key: 'offer' },
    { label: '8. Candidate Decision', key: 'decision' },
  ];

  const getStageStatus = (app: any, stageIdx: number) => {
    const status = (app.status || '').toLowerCase();
    const atsScore = app.ats_score !== null && app.ats_score !== undefined ? app.ats_score : (app.match_score ?? null);
    const isAtsPassed = atsScore !== null ? atsScore >= 80 : (status.includes('shortlist') || status.includes('screen') || status.includes('interview') || status.includes('assessment') || status.includes('offer') || status.includes('hired'));
    const recAssess = app.recruiter_assessment;
    const offer = app.offer_details;

    const hasOffer = Boolean(offer || status.includes('offer') || status.includes('hired') || status.includes('accepted'));
    const isOfferAccepted = offer?.status === 'Accepted' || status.includes('hired') || status.includes('accepted');

    // If an offer has been issued or candidate is hired/accepted, all prerequisite stages are completed
    if (hasOffer) {
      if (stageIdx === 0) return { text: 'Completed', color: 'bg-emerald-500 text-white border-emerald-500', isDone: true };
      if (stageIdx === 1) return { text: 'Completed (ATS Passed)', color: 'bg-emerald-500 text-white border-emerald-500', isDone: true };
      if (stageIdx === 2) {
        if (recAssess && recAssess.score !== null) {
          const passT = recAssess?.passing_score ?? 70;
          return recAssess.score >= passT
            ? { text: 'Completed (Passed)', color: 'bg-emerald-500 text-white border-emerald-500', isDone: true }
            : { text: `Failed (<${passT}%)`, color: 'bg-rose-500 text-white border-rose-500', isFailed: true };
        }
        return { text: 'Assessment Pending', color: 'bg-amber-500 text-white border-amber-500 animate-pulse', isCurrent: true };
      }
      if (stageIdx === 3) return { text: 'Passed (Qualified)', color: 'bg-emerald-500 text-white border-emerald-500', isDone: true };
      if (stageIdx === 4) return { text: 'Passed (Qualified)', color: 'bg-emerald-500 text-white border-emerald-500', isDone: true };
      if (stageIdx === 5) return { text: 'Passed (Qualified)', color: 'bg-emerald-500 text-white border-emerald-500', isDone: true };
      if (stageIdx === 6) {
        if (isOfferAccepted) return { text: 'Offer Accepted', color: 'bg-emerald-500 text-white border-emerald-500', isDone: true };
        return { text: 'Offer Released', color: 'bg-emerald-600 text-white border-emerald-600 animate-pulse', isCurrent: true };
      }
      if (stageIdx === 7) {
        if (isOfferAccepted) return { text: 'Hired', color: 'bg-emerald-600 text-white border-emerald-600', isDone: true };
        return { text: 'Pending Decision', color: 'bg-amber-500 text-white border-amber-500 animate-pulse', isCurrent: true };
      }
    }

    // Stage 1: Applied
    if (stageIdx === 0) {
      return { text: 'Completed', color: 'bg-emerald-500 text-white border-emerald-500', isDone: true };
    }

    // Stage 2: ATS Passed
    if (stageIdx === 1) {
      if (!isAtsPassed) {
        return { text: 'Rejected (ATS < 80%)', color: 'bg-rose-500 text-white border-rose-500', isFailed: true };
      }
      return { text: 'Completed (ATS Passed)', color: 'bg-emerald-500 text-white border-emerald-500', isDone: true };
    }

    // If ATS Failed, all subsequent pipeline stages are stopped/disabled
    if (!isAtsPassed) {
      return { text: 'Pipeline Stopped', color: 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700', isUpcoming: true };
    }

    const passThreshold = recAssess?.passing_score ?? (status.includes('assessment pass') && (recAssess?.score ?? app.assessment_score) ? Math.min(recAssess?.score ?? app.assessment_score, 50) : 70);
    const isAssessmentConducted = Boolean(
      (recAssess && recAssess.score !== null && recAssess.score !== undefined) ||
      (app.assessment_score !== null && app.assessment_score !== undefined) ||
      status.includes('assessment pass') ||
      status.includes('assessment fail')
    );
    const assessScore = isAssessmentConducted ? (recAssess?.score ?? app.assessment_score ?? null) : null;
    const isAssessmentPassed = Boolean(
      status.includes('assessment pass') ||
      app.assessment_passed === true ||
      recAssess?.is_passed === true ||
      recAssess?.recommendation === 'Pass' ||
      recAssess?.status === 'Passed' ||
      (isAssessmentConducted && assessScore !== null && assessScore >= passThreshold)
    );
    const isAssessmentFailed = !isAssessmentPassed && Boolean(
      status.includes('assessment fail') ||
      recAssess?.status === 'Failed' ||
      recAssess?.recommendation === 'Fail' ||
      (isAssessmentConducted && assessScore !== null && assessScore < passThreshold)
    );

    // Stage 3: Online Assessment (Mandatory for all applicants)
    if (stageIdx === 2) {
      if (isAssessmentFailed) {
        return { text: `Failed (<${passThreshold}%)`, color: 'bg-rose-500 text-white border-rose-500', isFailed: true };
      }
      if (isAssessmentPassed) {
        return { text: assessScore != null ? `Passed (${assessScore}%)` : `Passed (≥${passThreshold}%)`, color: 'bg-emerald-500 text-white border-emerald-500', isDone: true };
      }
      if (status.includes('assessment scheduled') || recAssess?.status === 'Scheduled' || recAssess?.status === 'scheduled' || recAssess?.status === 'active') {
        return { text: 'Assessment Scheduled', color: 'bg-blue-600 text-white border-blue-600 animate-pulse', isCurrent: true };
      }
      return { text: 'Assessment Pending', color: 'bg-amber-500 text-white border-amber-500 animate-pulse', isCurrent: true };
    }

    if (!isAssessmentPassed) {
      if (isAssessmentFailed) {
        return { text: 'Pipeline Stopped', color: 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700', isUpcoming: true };
      }
      return { text: 'Upcoming (Assessment Required)', color: 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700', isUpcoming: true };
    }

    // Technical Interview: Manual Recruiter Pass/Reject Decision
    const techRound = app.technical_round;
    const behavRound = app.behavioral_round;
    const hrRound = app.hr_round;
    const techScore = techRound?.technical_score ?? techRound?.overall_score ?? (app.technical_score ?? app.overall_score ?? null);
    const isTechFailed = status.includes('tech failed') || status.includes('technical failed') || (status === 'rejected' && !behavRound && !hrRound);
    const isTechPassed = !isTechFailed && (
      techRound?.is_passed === true ||
      techRound?.status === 'Passed' ||
      techRound?.status === 'Passed by Recruiter' ||
      status.includes('tech passed') || status.includes('technical passed') || status.includes('round 2') ||
      status.includes('behavioral') || status.includes('hr') || status.includes('selected') ||
      status.includes('offer') || status.includes('hired') || status.includes('accepted') || status.includes('interview passed') ||
      Boolean(behavRound) || Boolean(hrRound) || Boolean(offer)
    );
    const isTechConducted = Boolean(techRound?.is_conducted || techScore !== null || isTechPassed);

    // Stage 4: Technical Interview
    if (stageIdx === 3) {
      if (isTechFailed) {
        return { text: 'Rejected', color: 'bg-rose-500 text-white border-rose-500', isFailed: true };
      }
      if (isTechPassed) {
        return { text: 'Passed (Qualified)', color: 'bg-emerald-500 text-white border-emerald-500', isDone: true };
      }
      if (isTechConducted) {
        return { text: 'Evaluation Ready', color: 'bg-purple-600 text-white border-purple-600 animate-pulse', isCurrent: true };
      }
      if (status.includes('interview scheduled') || techRound?.status === 'Scheduled') {
        return { text: 'Tech Scheduled', color: 'bg-purple-600 text-white border-purple-600 animate-pulse', isCurrent: true };
      }
      return { text: 'Tech Pending', color: 'bg-amber-500 text-white border-amber-500 animate-pulse', isCurrent: true };
    }

    if (!isTechPassed) {
      if (isTechFailed) {
        return { text: 'Pipeline Stopped', color: 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700', isUpcoming: true };
      }
      return { text: 'Upcoming (Tech Pass Required)', color: 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700', isUpcoming: true };
    }

    // Behavioral Interview: Manual Recruiter Pass/Reject Decision
    const behavScore = behavRound?.overall_score ?? (app.communication_score ?? null);
    const isBehavFailed = status.includes('behavioral failed') || (status === 'rejected' && !hrRound && !offer);
    const isBehavPassed = !isBehavFailed && (
      behavRound?.is_passed === true ||
      behavRound?.status === 'Passed' ||
      behavRound?.status === 'Passed by Recruiter' ||
      status.includes('behavioral passed') || status.includes('move to hr') || status.includes('hr') ||
      status.includes('selected') || status.includes('offer') || status.includes('hired') || status.includes('accepted') ||
      Boolean(hrRound) || Boolean(offer)
    );
    const isBehavConducted = Boolean(behavRound?.is_conducted || behavScore !== null || isBehavPassed);

    // Stage 5: Behavioral Interview
    if (stageIdx === 4) {
      if (isBehavFailed) {
        return { text: 'Rejected', color: 'bg-rose-500 text-white border-rose-500', isFailed: true };
      }
      if (isBehavPassed) {
        return { text: 'Passed (Qualified)', color: 'bg-emerald-500 text-white border-emerald-500', isDone: true };
      }
      if (isBehavConducted) {
        return { text: 'Evaluation Ready', color: 'bg-blue-600 text-white border-blue-600 animate-pulse', isCurrent: true };
      }
      if (status.includes('behavioral') || behavRound?.status === 'Scheduled') {
        return { text: 'Behavioral Scheduled', color: 'bg-blue-600 text-white border-blue-600 animate-pulse', isCurrent: true };
      }
      return { text: 'Behavioral Pending', color: 'bg-amber-500 text-white border-amber-500 animate-pulse', isCurrent: true };
    }

    if (!isBehavPassed) {
      if (isBehavFailed) {
        return { text: 'Pipeline Stopped', color: 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700', isUpcoming: true };
      }
      return { text: 'Upcoming (Behavioral Pass Required)', color: 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700', isUpcoming: true };
    }

    // HR Interview: Manual Recruiter Pass/Reject Decision
    const hrScore = hrRound?.overall_score ?? (app.professionalism_score ?? null);
    const isHrFailed = status.includes('hr failed') || (status === 'rejected' && !offer);
    const isHrPassed = !isHrFailed && (
      hrRound?.is_passed === true ||
      hrRound?.status === 'Passed' ||
      hrRound?.status === 'Passed by Recruiter' ||
      status.includes('hr passed') || status.includes('hr completed') || status.includes('selected') ||
      status.includes('offer') || status.includes('hired') || status.includes('accepted') ||
      Boolean(offer)
    );
    const isHrConducted = Boolean(hrRound?.is_conducted || hrScore !== null || isHrPassed);

    // Stage 6: HR Interview
    if (stageIdx === 5) {
      if (isHrFailed) {
        return { text: 'Rejected', color: 'bg-rose-500 text-white border-rose-500', isFailed: true };
      }
      if (isHrPassed) {
        return { text: 'Passed (Qualified)', color: 'bg-emerald-500 text-white border-emerald-500', isDone: true };
      }
      if (isHrConducted) {
        return { text: 'Evaluation Ready', color: 'bg-teal-600 text-white border-teal-600 animate-pulse', isCurrent: true };
      }
      if (status.includes('hr') || hrRound?.status === 'Scheduled') {
        return { text: 'HR Scheduled', color: 'bg-teal-600 text-white border-teal-600 animate-pulse', isCurrent: true };
      }
      return { text: 'HR Pending', color: 'bg-amber-500 text-white border-amber-500 animate-pulse', isCurrent: true };
    }

    if (!isHrPassed) {
      if (isHrFailed) {
        return { text: 'Pipeline Stopped', color: 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700', isUpcoming: true };
      }
      return { text: 'Upcoming (HR Pass Required)', color: 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700', isUpcoming: true };
    }

    // Stage 7: Offer Letter
    if (stageIdx === 6) {
      if (!offer && !status.includes('offer') && !status.includes('accepted') && !status.includes('hired')) {
        return { text: 'Decision Pending', color: 'bg-amber-500 text-white border-amber-500 animate-pulse', isCurrent: true };
      }
      if (offer?.status === 'Accepted' || status.includes('accepted') || status.includes('hired')) {
        return { text: 'Offer Accepted', color: 'bg-emerald-500 text-white border-emerald-500', isDone: true };
      }
      if (offer?.status === 'Rejected' || offer?.status === 'Declined' || status.includes('declined')) {
        return { text: 'Offer Declined', color: 'bg-rose-500 text-white border-rose-500', isFailed: true };
      }
      return { text: 'Offer Released', color: 'bg-emerald-600 text-white border-emerald-600 animate-pulse', isCurrent: true };
    }

    // Stage 8: Candidate Decision
    if (stageIdx === 7) {
      if (offer?.status === 'Accepted' || status.includes('accepted') || status.includes('hired')) {
        return { text: 'Hired', color: 'bg-emerald-600 text-white border-emerald-600', isDone: true };
      }
      return { text: 'Pending Decision', color: 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700', isUpcoming: true };
    }

    return { text: 'Pending', color: 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700', isUpcoming: true };
  };

  // Filtered Applications for Display
  const currentList = (activeTab === 'evaluations' ? evaluations : applications).filter((item) => {
    const st = (item.status || 'Applied').toLowerCase();
    const nameMatch = !searchTerm || 
      (item.candidate_name || item.full_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.candidate_email || item.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.job_title || '').toLowerCase().includes(searchTerm.toLowerCase());

    if (!nameMatch) return false;

    if (stageFilter === 'all') return true;
    if (stageFilter === 'stage_ats') return (st.includes('ats passed') || st === 'shortlisted' || st === 'applied') && (item.ats_score == null || item.ats_score >= 80);
    if (stageFilter === 'stage_assess_sched') return st.includes('assessment') || item.recruiter_assessment != null || item.assessment_score != null;
    if (stageFilter === 'stage_assess_pass') return st.includes('assessment pass') || item.recruiter_assessment?.is_passed || item.assessment_passed;
    if (stageFilter === 'stage_int_sched') return st.includes('interview scheduled') || st.includes('tech scheduled');
    if (stageFilter === 'stage_int_pass') return st.includes('interview passed') || st.includes('selected') || st.includes('tech passed') || st.includes('assessment pass') || item.overall_score != null;
    if (stageFilter === 'stage_rejected') return st.includes('fail') || st.includes('reject');
    return true;
  });

  // Filtered Candidate Rankings
  const filteredRankings = rankingList.filter((cand) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      (cand.candidate_name || '').toLowerCase().includes(term) ||
      (cand.candidate_email || '').toLowerCase().includes(term) ||
      (cand.job_title || '').toLowerCase().includes(term)
    );
  });

  const evaluatedRankings = filteredRankings.filter((cand) => cand.rank != null && cand.overall_score != null);
  const pendingRankings = filteredRankings.filter((cand) => cand.rank == null || cand.overall_score == null);

  // Dynamic Recruitment Pipeline Metrics
  const totalApps = (applications || []).length;
  const scoredApps = (applications || []).filter((a) => (a.ats_score ?? a.resume_score) != null);
  const avgAtsScore = scoredApps.length > 0
    ? Math.round(scoredApps.reduce((acc, a) => acc + (a.ats_score ?? a.resume_score ?? 0), 0) / scoredApps.length)
    : 86;
  const qualifiedApps = (applications || []).filter((a) => {
    const st = (a.status || '').toLowerCase();
    const ats = a.ats_score ?? a.resume_score ?? 0;
    return ats >= 70 || st.includes('pass') || st.includes('scheduled') || st.includes('offer') || st.includes('hired') || st.includes('selected') || st.includes('shortlisted');
  }).length;
  const qualificationRate = totalApps > 0 ? Math.min(100, Math.max(0, Math.round((qualifiedApps / totalApps) * 100))) : 85;

  const totalInterviewsConducted = (conductedInterviews && conductedInterviews.length > 0)
    ? conductedInterviews.length
    : (evaluations || []).length;
  const totalOffersIssued = (issuedOffers || []).length;
  const totalRequisites = (myJobs || []).length || jobAnalytics?.total_jobs || 0;
  const totalPipelineActions = totalInterviewsConducted + totalOffersIssued + totalRequisites;

  const pieData = [
    { name: 'Interviews Conducted', value: totalInterviewsConducted, color: '#6366F1' },
    { name: 'Offers Issued', value: totalOffersIssued, color: '#10B981' },
    { name: 'Total Requisites', value: totalRequisites, color: '#06B6D4' }
  ];

  // Dynamic Overall Brief Insights Synthesis
  const topCandidate = rankingList.length > 0
    ? [...rankingList].sort((a, b) => (Number(b.overall_score || 0)) - (Number(a.overall_score || 0)))[0]
    : null;

  const briefOverallInsight = (() => {
    if (totalApps === 0 && totalRequisites === 0) {
      return 'No active requisitions or applicants yet. Post requisitions to initiate AI resume screening and interview telemetry.';
    }
    const parts: string[] = [];
    parts.push(`${totalInterviewsConducted} total interview${totalInterviewsConducted !== 1 ? 's' : ''} conducted across ${totalRequisites} active requisition${totalRequisites !== 1 ? 's' : ''}.`);
    if (totalOffersIssued > 0) {
      parts.push(`${totalOffersIssued} offer${totalOffersIssued !== 1 ? 's' : ''} issued.`);
    }
    if (topCandidate && Number(topCandidate.overall_score || 0) > 0) {
      parts.push(`Top candidate ${topCandidate.candidate_name || 'Applicant'} leads with ${topCandidate.overall_score}% score for ${topCandidate.job_title || 'requisition'}.`);
    }
    parts.push(`Pipeline throughput compliance is at ${qualificationRate}%.`);
    return parts.join(' ');
  })();

  return (
    <>
      <main className="p-6 lg:p-10 max-w-7xl mx-auto w-full space-y-8 transition-colors duration-300">
        
        {/* Recruiter Executive Command Deck (Matching Reference Images 1 & 2) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          {/* Left: 3D Welcome Hero Card (Matching Reference Image 2) */}
          <div className="lg:col-span-8 flex flex-col justify-between">
            <WelcomeHeroCard
              userName={recruiterName}
              greeting="Welcome Back"
              icon={TrendingUp}
              badgeText="TALENT INTELLIGENCE COMMAND"
              metrics={[
                {
                  label: 'Active Requisitions',
                  value: `${jobAnalytics?.active_jobs ?? (myJobs || []).filter(j => j?.status === 'Active').length ?? (myJobs || []).length}`,
                  subtext: `${jobAnalytics?.total_jobs ?? (myJobs || []).length} Total Postings`,
                },
                {
                  label: 'Applicant Pipeline',
                  value: `${(applications || []).length} Candidates`,
                  subtext: `${(evaluations || []).length} Evaluated Sessions`,
                },
              ]}
              actionButton={{
                label: 'Post New Job Requisition',
                onClick: () => { setSelectedJobForEdit(null); setIsCreateModalOpen(true); },
                icon: Plus,
              }}
            />
          </div>

          {/* Right: Pie Chart - Total Interviews Conducted, Offers Issued, Total Requisites */}
          <div className="lg:col-span-4 rounded-[2rem] bg-[#0B0F19] border border-slate-800 p-5 flex flex-col items-center justify-between text-white shadow-xl group transition-all duration-300">
            <div className="w-full flex items-center justify-between mb-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">PIPELINE TELEMETRY</span>
              <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                {totalPipelineActions} TOTAL ACTIONS
              </span>
            </div>

            <div className="text-center my-0.5">
              <h4 className="text-xs font-black tracking-wider text-white uppercase">RECRUITMENT ACTIVITY BREAKDOWN</h4>
              <p className="text-[10px] text-slate-400 font-medium">Interviews • Offers • Requisitions</p>
            </div>

            {/* Donut Pie Chart */}
            <div className="w-full h-[210px] relative flex items-center justify-center my-2">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0];
                        const pct = totalPipelineActions > 0 ? Math.round(((Number(data.value) || 0) / totalPipelineActions) * 100) : 0;
                        return (
                          <div className="bg-slate-900/95 border border-slate-700/80 px-3 py-1.5 rounded-xl shadow-xl text-xs text-white">
                            <p className="font-extrabold flex items-center gap-1.5" style={{ color: data.payload.color }}>
                              <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: data.payload.color }} />
                              {data.name}
                            </p>
                            <p className="text-slate-300 font-bold mt-0.5">{data.value} ({pct}%)</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Pie
                    data={totalPipelineActions > 0 ? pieData : [{ name: 'No Activity', value: 1, color: '#334155' }]}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={82}
                    paddingAngle={totalPipelineActions > 0 ? 4 : 0}
                    dataKey="value"
                    stroke="#0B0F19"
                    strokeWidth={3}
                  >
                    {(totalPipelineActions > 0 ? pieData : [{ name: 'No Activity', value: 1, color: '#334155' }]).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              {/* Centered Total inside Donut */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-2xl font-black text-white leading-none">{totalPipelineActions}</span>
                <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold mt-0.5">Pipeline</span>
              </div>
            </div>

            {/* 3 Metrics Row: Total Interviews Conducted, Offers Issued, Total Requisites */}
            <div className="w-full grid grid-cols-3 gap-2 mt-2 pt-3 border-t border-slate-800/80 text-center">
              <div className="bg-slate-900/60 rounded-xl p-2.5 border border-slate-800/80 flex flex-col items-center hover:border-indigo-500/40 transition-colors">
                <div className="flex items-center gap-1.5 text-[10px] text-indigo-400 font-bold uppercase truncate">
                  <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
                  Interviews
                </div>
                <span className="text-base font-black text-white mt-1">{totalInterviewsConducted}</span>
                <span className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider">Conducted</span>
              </div>
              <div className="bg-slate-900/60 rounded-xl p-2.5 border border-slate-800/80 flex flex-col items-center hover:border-emerald-500/40 transition-colors">
                <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-bold uppercase truncate">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                  Offers
                </div>
                <span className="text-base font-black text-white mt-1">{totalOffersIssued}</span>
                <span className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider">Issued</span>
              </div>
              <div className="bg-slate-900/60 rounded-xl p-2.5 border border-slate-800/80 flex flex-col items-center hover:border-cyan-500/40 transition-colors">
                <div className="flex items-center gap-1.5 text-[10px] text-cyan-400 font-bold uppercase truncate">
                  <span className="w-2 h-2 rounded-full bg-cyan-500 shrink-0" />
                  Requisites
                </div>
                <span className="text-base font-black text-white mt-1">{totalRequisites}</span>
                <span className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider">Total</span>
              </div>
            </div>
          </div>
        </div>

        {/* Unified 5-Stage Recruitment Workflow & Interactive Navigation */}
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
            
            {/* Stage 1: Job Requisitions */}
            <button
              onClick={() => setActiveTab('requisitions')}
              className={`relative text-left p-4 rounded-2xl transition-all duration-200 cursor-pointer overflow-hidden border group ${
                activeTab === 'requisitions'
                  ? 'bg-gradient-to-b from-indigo-500/15 via-slate-900/90 to-slate-900 border-indigo-500 ring-2 ring-indigo-500/40 shadow-xl shadow-indigo-500/10'
                  : 'bg-slate-900/70 hover:bg-slate-850 border-slate-800/80 hover:border-slate-700 text-slate-400 hover:text-slate-200'
              }`}
            >
              {activeTab === 'requisitions' && (
                <span className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 to-indigo-400"></span>
              )}
              <div className="flex items-center justify-between mb-2">
                <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${
                  activeTab === 'requisitions'
                    ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                    : 'bg-slate-800 text-slate-400'
                }`}>
                  Stage 01
                </span>
                <div className={`p-1.5 rounded-lg ${
                  activeTab === 'requisitions' ? 'bg-indigo-500/20 text-indigo-300' : 'bg-slate-800/80 text-slate-400 group-hover:text-indigo-400'
                }`}>
                  <Briefcase className="w-4 h-4" />
                </div>
              </div>
              <div className="text-3xl font-black text-white tracking-tight">
                {myJobs.length}
              </div>
              <div className="text-xs font-bold text-slate-200 mt-1 flex items-center justify-between">
                <span>Job Requisitions</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">Active postings</div>
            </button>

            {/* Stage 2: Talent Pipeline */}
            <button
              onClick={() => {
                if (!['applications', 'shortlisted', 'rejected'].includes(activeTab)) {
                  setActiveTab('applications');
                }
              }}
              className={`relative text-left p-4 rounded-2xl transition-all duration-200 cursor-pointer overflow-hidden border group ${
                ['applications', 'shortlisted', 'rejected'].includes(activeTab)
                  ? 'bg-gradient-to-b from-blue-500/15 via-slate-900/90 to-slate-900 border-blue-500 ring-2 ring-blue-500/40 shadow-xl shadow-blue-500/10'
                  : 'bg-slate-900/70 hover:bg-slate-850 border-slate-800/80 hover:border-slate-700 text-slate-400 hover:text-slate-200'
              }`}
            >
              {['applications', 'shortlisted', 'rejected'].includes(activeTab) && (
                <span className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-cyan-400"></span>
              )}
              <div className="flex items-center justify-between mb-2">
                <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${
                  ['applications', 'shortlisted', 'rejected'].includes(activeTab)
                    ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                    : 'bg-slate-800 text-slate-400'
                }`}>
                  Stage 02
                </span>
                <div className={`p-1.5 rounded-lg ${
                  ['applications', 'shortlisted', 'rejected'].includes(activeTab) ? 'bg-blue-500/20 text-blue-300' : 'bg-slate-800/80 text-slate-400 group-hover:text-blue-400'
                }`}>
                  <Users className="w-4 h-4" />
                </div>
              </div>
              <div className="text-3xl font-black text-white tracking-tight">
                {applications.length}
              </div>
              <div className="text-xs font-bold text-slate-200 mt-1 flex items-center justify-between">
                <span>Talent Pipeline</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">Total applicants</div>
            </button>

            {/* Stage 3: Evaluations & Ranking */}
            <button
              onClick={() => {
                if (!['ranking', 'comparison'].includes(activeTab)) {
                  setActiveTab('ranking');
                }
              }}
              className={`relative text-left p-4 rounded-2xl transition-all duration-200 cursor-pointer overflow-hidden border group ${
                ['ranking', 'comparison'].includes(activeTab)
                  ? 'bg-gradient-to-b from-purple-500/15 via-slate-900/90 to-slate-900 border-purple-500 ring-2 ring-purple-500/40 shadow-xl shadow-purple-500/10'
                  : 'bg-slate-900/70 hover:bg-slate-850 border-slate-800/80 hover:border-slate-700 text-slate-400 hover:text-slate-200'
              }`}
            >
              {['ranking', 'comparison'].includes(activeTab) && (
                <span className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 to-pink-500"></span>
              )}
              <div className="flex items-center justify-between mb-2">
                <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${
                  ['ranking', 'comparison'].includes(activeTab)
                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                    : 'bg-slate-800 text-slate-400'
                }`}>
                  Stage 03
                </span>
                <div className={`p-1.5 rounded-lg ${
                  ['ranking', 'comparison'].includes(activeTab) ? 'bg-purple-500/20 text-purple-300' : 'bg-slate-800/80 text-slate-400 group-hover:text-purple-400'
                }`}>
                  <Trophy className="w-4 h-4" />
                </div>
              </div>
              <div className="text-3xl font-black text-white tracking-tight">
                {rankingList.length}
              </div>
              <div className="text-xs font-bold text-slate-200 mt-1 flex items-center justify-between">
                <span>Evaluations & Merit</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">Assessed sessions</div>
            </button>

            {/* Stage 4: Skill Analytics & Mastery */}
            <button
              onClick={() => {
                if (!['skills', 'insights', 'trends'].includes(activeTab)) {
                  setActiveTab('skills');
                }
              }}
              className={`relative text-left p-4 rounded-2xl transition-all duration-200 cursor-pointer overflow-hidden border group ${
                ['skills', 'insights', 'trends'].includes(activeTab)
                  ? 'bg-gradient-to-b from-teal-500/15 via-slate-900/90 to-slate-900 border-teal-500 ring-2 ring-teal-500/40 shadow-xl shadow-teal-500/10'
                  : 'bg-slate-900/70 hover:bg-slate-850 border-slate-800/80 hover:border-slate-700 text-slate-400 hover:text-slate-200'
              }`}
            >
              {['skills', 'insights', 'trends'].includes(activeTab) && (
                <span className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-teal-500 to-emerald-400"></span>
              )}
              <div className="flex items-center justify-between mb-2">
                <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${
                  ['skills', 'insights', 'trends'].includes(activeTab)
                    ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                    : 'bg-slate-800 text-slate-400'
                }`}>
                  Stage 04
                </span>
                <div className={`p-1.5 rounded-lg ${
                  ['skills', 'insights', 'trends'].includes(activeTab) ? 'bg-teal-500/20 text-teal-300' : 'bg-slate-800/80 text-slate-400 group-hover:text-teal-400'
                }`}>
                  <Brain className="w-4 h-4" />
                </div>
              </div>
              <div className="text-3xl font-black text-white tracking-tight">
                {recruiterSkillData?.candidate_skills?.length || 0}
              </div>
              <div className="text-xs font-bold text-slate-200 mt-1 flex items-center justify-between">
                <span>Skill Analytics</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">Per-candidate mastery</div>
            </button>

            {/* Stage 5: Offer Letters */}
            <button
              onClick={() => setActiveTab('offers')}
              className={`col-span-2 sm:col-span-1 relative text-left p-4 rounded-2xl transition-all duration-200 cursor-pointer overflow-hidden border group ${
                activeTab === 'offers'
                  ? 'bg-gradient-to-b from-emerald-500/15 via-slate-900/90 to-slate-900 border-emerald-500 ring-2 ring-emerald-500/40 shadow-xl shadow-emerald-500/10'
                  : 'bg-slate-900/70 hover:bg-slate-850 border-slate-800/80 hover:border-slate-700 text-slate-400 hover:text-slate-200'
              }`}
            >
              {activeTab === 'offers' && (
                <span className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-400"></span>
              )}
              <div className="flex items-center justify-between mb-2">
                <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${
                  activeTab === 'offers'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-slate-800 text-slate-400'
                }`}>
                  Stage 05
                </span>
                <div className={`p-1.5 rounded-lg ${
                  activeTab === 'offers' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800/80 text-slate-400 group-hover:text-emerald-400'
                }`}>
                  <Gift className="w-4 h-4" />
                </div>
              </div>
              <div className="text-3xl font-black text-white tracking-tight">
                {issuedOffers.length || applications.filter(a => a.status === 'Offer Sent' || a.status === 'Hired').length}
              </div>
              <div className="text-xs font-bold text-slate-200 mt-1 flex items-center justify-between">
                <span>Offer Letters</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">Contracts released</div>
            </button>
          </div>

          {/* Contextual Sub-Views Pill Bar (Rendered only when active stage has sub-tabs) */}
          {['applications', 'shortlisted', 'rejected'].includes(activeTab) && (
            <div className="flex items-center gap-2 p-1.5 rounded-xl bg-slate-900/80 border border-slate-800/90 backdrop-blur-md overflow-x-auto">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider px-2 shrink-0">Pipeline Views:</span>
              <button
                onClick={() => setActiveTab('applications')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
                  activeTab === 'applications'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25 ring-1 ring-blue-400/40'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>All Applications ({applications.length})</span>
              </button>
              <button
                onClick={() => setActiveTab('shortlisted')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
                  activeTab === 'shortlisted'
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/25 ring-1 ring-emerald-400/40'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Shortlisted Top Talent ({shortlistedCandidates.length})</span>
              </button>
              <button
                onClick={() => setActiveTab('rejected')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
                  activeTab === 'rejected'
                    ? 'bg-rose-600 text-white shadow-md shadow-rose-600/25 ring-1 ring-rose-400/40'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>ATS Filtered Out ({atsRejected.length})</span>
              </button>
            </div>
          )}

          {['ranking', 'comparison'].includes(activeTab) && (
            <div className="flex items-center gap-2 p-1.5 rounded-xl bg-slate-900/80 border border-slate-800/90 backdrop-blur-md overflow-x-auto">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider px-2 shrink-0">Evaluation Views:</span>
              <button
                onClick={() => setActiveTab('ranking')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
                  activeTab === 'ranking'
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-600/25 ring-1 ring-purple-400/40'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Trophy className="w-3.5 h-3.5" />
                <span>AI Merit Leaderboard ({rankingList.length})</span>
              </button>
              <button
                onClick={() => setActiveTab('comparison')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
                  activeTab === 'comparison'
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-600/25 ring-1 ring-purple-400/40'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <GitCompare className="w-3.5 h-3.5" />
                <span>Candidate Comparison Matrix {selectedCandidateIdsForCompare.length > 0 && `(${selectedCandidateIdsForCompare.length})`}</span>
              </button>
            </div>
          )}

          {['skills', 'insights', 'trends'].includes(activeTab) && (
            <div className="flex items-center gap-2 p-1.5 rounded-xl bg-slate-900/80 border border-slate-800/90 backdrop-blur-md overflow-x-auto">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider px-2 shrink-0">Skill Analytics Views:</span>
              <button
                onClick={() => setActiveTab('skills')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
                  activeTab === 'skills'
                    ? 'bg-teal-600 text-white shadow-md shadow-teal-600/25 ring-1 ring-teal-400/40'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Target className="w-3.5 h-3.5" />
                <span>Skill-Wise Analytics (Per Candidate)</span>
              </button>
              <button
                onClick={() => setActiveTab('insights')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
                  activeTab === 'insights'
                    ? 'bg-rose-600 text-white shadow-md shadow-rose-600/25 ring-1 ring-rose-400/40'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Shortlisting Insights</span>
              </button>
              <button
                onClick={() => setActiveTab('trends')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
                  activeTab === 'trends'
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-600/25 ring-1 ring-purple-400/40'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5" />
                <span>Performance Trends</span>
              </button>
            </div>
          )}
        </div>

        {/* Active View Context Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
              {activeTab === 'requisitions' && 'Job Requisitions & Openings'}
              {activeTab === 'applications' && 'Candidate Applications & Pipeline'}
              {activeTab === 'shortlisted' && 'Shortlisted Top Talent'}
              {activeTab === 'rejected' && 'ATS Filtered Candidates'}
              {activeTab === 'ranking' && 'Candidate Ranking Leaderboard'}
              {activeTab === 'comparison' && 'Side-by-Side Candidate Matrix'}
              {activeTab === 'evaluations' && 'Interview Evaluations & Scorecards'}
              {activeTab === 'skills' && 'Skill-Wise Talent Analytics & Mastery'}
              {activeTab === 'insights' && 'AI Shortlisting Recommendations'}
              {activeTab === 'trends' && 'Candidate Performance Trends'}
              {activeTab === 'offers' && 'Offer Letters & Employment Contracts'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold mt-0.5">
              {activeTab === 'requisitions' && 'Manage job postings, applicant tracking, and hiring requisition stages.'}
              {activeTab === 'applications' && 'Review incoming applicants, filter by hiring stage, and advance candidates.'}
              {activeTab === 'shortlisted' && 'Review high-merit candidates fast-tracked for assessment and interview rounds.'}
              {activeTab === 'rejected' && 'Applicants who did not pass minimum ATS requirements or assessment criteria.'}
              {activeTab === 'ranking' && 'Deterministic AI merit score combining ATS match, coding depth, and interview responses.'}
              {activeTab === 'comparison' && 'Side-by-side radar and metric comparison for selected candidate profiles.'}
              {activeTab === 'evaluations' && 'Review AI assessment rubrics, interview performance scores, and transcripts.'}
              {activeTab === 'skills' && 'Granular candidate skill breakdowns (JavaScript, React, DSA, Python, SQL, System Design).'}
              {activeTab === 'insights' && 'Algorithmic shortlisting intelligence and top match recommendations.'}
              {activeTab === 'trends' && 'Temporal score progression and evaluation metrics across candidate cohorts.'}
              {activeTab === 'offers' && 'Issue, customize, release, and track formal candidate employment offer letters.'}
            </p>
          </div>
        </div>

        {/* Content Section */}
        <div className="space-y-6">
          
          {/* Requisitions Tab */}
          {activeTab === 'requisitions' && (
            <div className="card-luxury p-0 overflow-hidden shadow-soft-lg">
              <div className="p-6 border-b border-stoneBorder flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">Job Requisitions</h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300 font-semibold mt-0.5">Manage live job requisitions, requirements, and candidate pipelines.</p>
                </div>
                <button
                  onClick={() => { setSelectedJobForEdit(null); setIsCreateModalOpen(true); }}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create Requisition</span>
                </button>
              </div>

              <div className="overflow-x-auto">
                {myJobs.length === 0 ? (
                  <div className="p-16 text-center text-xs text-slate-500 dark:text-slate-400 font-medium">
                    No job requisitions created yet. Click "Post New Job" to create your first requisition.
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse min-w-max">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-black text-slate-700 dark:text-slate-200 uppercase tracking-wider bg-slate-50 dark:bg-slate-900">
                        <th className="py-4 px-6">Position & Title</th>
                        <th className="py-4 px-4">Department</th>
                        <th className="py-4 px-4">Type & Location</th>
                        <th className="py-4 px-4">Experience</th>
                        <th className="py-4 px-4">Applications</th>
                        <th className="py-4 px-4">Status</th>
                        <th className="py-4 px-6 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/80 dark:divide-slate-800 text-xs font-bold text-slate-900 dark:text-slate-100">
                      {myJobs.map((job) => (
                        <tr key={job.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                          <td className="py-4 px-6">
                            <div className="font-black text-slate-900 dark:text-white text-sm">{job.title}</div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">{job.company_name}</div>
                          </td>
                          <td className="py-4 px-4 text-slate-700 dark:text-slate-300 font-bold">{job.department || 'Engineering'}</td>
                          <td className="py-4 px-4">
                            <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-bold mr-2 border border-slate-200 dark:border-slate-700">{job.job_type}</span>
                            <span className="text-slate-700 dark:text-slate-300 font-medium">{job.location || 'Remote'}</span>
                          </td>
                          <td className="py-4 px-4 text-slate-700 dark:text-slate-300 font-bold">{job.experience_level || 'Mid-Senior'}</td>
                          <td className="py-4 px-4">
                            <span className="px-3 py-1 rounded-full text-[11px] font-black bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                              {job.applications_count || 0} Applied
                            </span>
                          </td>
                          <td className="py-4 px-4">
                            <span className={`px-3 py-1 rounded-full text-[11px] font-black border ${
                              (job.status || '').toLowerCase() === 'active' || (job.status || '').toLowerCase() === 'published'
                                ? 'bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                            }`}>
                              {job.status}
                            </span>
                          </td>
                          <td className="py-4 px-6 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => setSelectedJobForView(job)}
                                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                                title="View Requisition Details"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => { setSelectedJobForEdit(job); setIsCreateModalOpen(true); }}
                                className="p-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/80 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 font-bold border border-indigo-200 dark:border-indigo-800 transition-colors cursor-pointer"
                                title="Edit Requisition"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* Applications / Pipeline / Shortlisted / Rejected Tabs */}
          {(activeTab === 'applications' || activeTab === 'shortlisted' || activeTab === 'rejected') && (
            <div className="space-y-6">
              
              {/* Filter & View Switcher Bar */}
              <div className="card-luxury p-5 border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative min-w-[280px]">
                    <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search candidates by name, email, or role..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  {activeTab === 'applications' && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        onClick={() => setStageFilter('all')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                          stageFilter === 'all' 
                            ? 'bg-indigo-600 text-white shadow-xs' 
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        All ({applications.length})
                      </button>
                      <button
                        onClick={() => setStageFilter('stage_ats')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                          stageFilter === 'stage_ats' 
                            ? 'bg-amber-600 text-white shadow-xs' 
                            : 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/60'
                        }`}
                      >
                        Stage 2: ATS Passed
                      </button>
                      <button
                        onClick={() => setStageFilter('stage_assess_sched')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                          stageFilter === 'stage_assess_sched' 
                            ? 'bg-blue-600 text-white shadow-xs' 
                            : 'bg-blue-50 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/60'
                        }`}
                      >
                        Stage 3: Assessment
                      </button>
                      <button
                        onClick={() => setStageFilter('stage_int_sched')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                          stageFilter === 'stage_int_sched' 
                            ? 'bg-purple-600 text-white shadow-xs' 
                            : 'bg-purple-50 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border border-purple-200/60 dark:border-purple-800 hover:bg-purple-100 dark:hover:bg-purple-900/60'
                        }`}
                      >
                        Stage 4: Interview
                      </button>
                      <button
                        onClick={() => setStageFilter('stage_int_pass')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                          stageFilter === 'stage_int_pass' 
                            ? 'bg-emerald-600 text-white shadow-xs' 
                            : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/60'
                        }`}
                      >
                        Passed / Selected
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                  <button
                    onClick={() => setViewMode('cards')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                      viewMode === 'cards' 
                        ? 'bg-white dark:bg-slate-700 shadow-xs text-slate-900 dark:text-white' 
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                    <span>Pipeline Cards</span>
                  </button>
                  <button
                    onClick={() => setViewMode('table')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                      viewMode === 'table' 
                        ? 'bg-white dark:bg-slate-700 shadow-xs text-slate-900 dark:text-white' 
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <List className="w-3.5 h-3.5" />
                    <span>Table View</span>
                  </button>
                </div>
              </div>

              {/* Empty State */}
              {currentList.length === 0 ? (
                <div className="p-16 text-center card-luxury border border-stoneBorder space-y-2">
                  <FileText className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                  <h4 className="text-sm font-black text-brand-ink">No Candidate Applications Found</h4>
                  <p className="text-xs text-slate-500 font-medium max-w-md mx-auto">
                    {searchTerm ? 'No applications match your search query.' : 'There are currently no active applications in this stage.'}
                  </p>
                </div>
              ) : viewMode === 'cards' ? (
                /* Big Tech Application Tracking Cards */
                <div className="space-y-6">
                  {currentList.map((app, i) => {
                    const st = (app.status || 'Applied').toLowerCase();
                    const atsScore = app.ats_score !== null && app.ats_score !== undefined ? app.ats_score : 80;
                    const isAtsPassed = atsScore >= 80;

                    const recAssess = app.recruiter_assessment;
                    const offer = app.offer_details;

                    // Assessment state
                    const passThreshold = recAssess?.passing_score ?? (st.includes('assessment pass') && (recAssess?.score ?? app.assessment_score) ? Math.min(recAssess?.score ?? app.assessment_score, 50) : 70);
                    const isAssessmentConducted = Boolean(
                      (recAssess && recAssess.score !== null && recAssess.score !== undefined) ||
                      (app.assessment_score !== null && app.assessment_score !== undefined) ||
                      st.includes('assessment pass') ||
                      st.includes('assessment fail')
                    );
                    const assessScore = isAssessmentConducted ? (recAssess?.score ?? app.assessment_score ?? null) : null;
                    const isAssessPassed = Boolean(
                      st.includes('assessment pass') ||
                      app.assessment_passed === true ||
                      recAssess?.is_passed === true ||
                      recAssess?.recommendation === 'Pass' ||
                      recAssess?.status === 'Passed' ||
                      (isAssessmentConducted && assessScore !== null && assessScore >= passThreshold)
                    );
                    const isAssessFailed = !isAssessPassed && Boolean(
                      st.includes('assessment fail') ||
                      recAssess?.status === 'Failed' ||
                      recAssess?.recommendation === 'Fail' ||
                      (isAssessmentConducted && assessScore !== null && assessScore < passThreshold)
                    );
                    const isAssessScheduled = Boolean(
                      (recAssess?.status === 'Scheduled' || recAssess?.status === 'scheduled' || recAssess?.status === 'active' || st.includes('assessment scheduled')) &&
                      !isAssessmentConducted && !isAssessPassed && !isAssessFailed
                    );
                    const isAssessmentWaived = !recAssess && !isAssessmentConducted && !isAssessPassed && (
                      st.includes('interview') || st.includes('tech') || st.includes('selected') || st.includes('hired') || st.includes('offer')
                    );

                    // Technical round state (Manual Recruiter Pass/Reject Decision)
                    const techRound = app.technical_round;
                    const behavRound = app.behavioral_round;
                    const hrRound = app.hr_round;
                    const isTechEligible = isAtsPassed && (isAssessPassed || isAssessmentWaived);
                    const techScore = techRound?.technical_score ?? techRound?.overall_score ?? (app.technical_score ?? app.overall_score ?? null);
                    const isTechFailed = st.includes('tech failed') || st.includes('technical failed') || (st === 'rejected' && !behavRound && !hrRound);
                    const isTechPassed = isTechEligible && !isTechFailed && (
                      techRound?.is_passed === true ||
                      techRound?.status === 'Passed' ||
                      techRound?.status === 'Passed by Recruiter' ||
                      st.includes('tech passed') || st.includes('technical passed') || st.includes('round 2') ||
                      st.includes('behavioral') || st.includes('hr') || st.includes('selected') ||
                      st.includes('offer') || st.includes('hired') || st.includes('interview passed') ||
                      Boolean(behavRound) || Boolean(hrRound) || Boolean(offer)
                    );
                    const isTechConducted = Boolean(techRound?.is_conducted || techRound?.status === 'Completed' || (techScore !== null && techRound?.is_conducted) || isTechPassed);
                    const isTechScheduled = Boolean((techRound?.status === 'Scheduled' || st.includes('tech scheduled') || st.includes('technical scheduled') || (st.includes('interview scheduled') && !isTechPassed)) && !isTechPassed && !isTechFailed);

                    // Behavioral round state (Manual Recruiter Pass/Reject Decision)
                    const isBehavEligible = isTechEligible && (isTechPassed || Boolean(behavRound) || Boolean(hrRound) || Boolean(offer));
                    const behavScore = behavRound?.overall_score ?? behavRound?.score ?? (behavRound?.is_conducted ? app.communication_score : null);
                    const isBehavFailed = st.includes('behavioral failed') || (st === 'rejected' && !hrRound && !offer);
                    const isBehavPassed = isBehavEligible && !isBehavFailed && (
                      behavRound?.is_passed === true ||
                      behavRound?.status === 'Passed' ||
                      behavRound?.status === 'Passed by Recruiter' ||
                      st.includes('behavioral passed') || st.includes('move to hr') || st.includes('hr') ||
                      st.includes('selected') || st.includes('offer') || st.includes('hired') ||
                      Boolean(hrRound) || Boolean(offer)
                    );
                    const isBehavConducted = Boolean(behavRound?.is_conducted || (behavRound?.status === 'Completed') || (behavScore !== null && behavRound?.is_conducted) || isBehavPassed);
                    const isBehavScheduled = Boolean((behavRound?.status === 'Scheduled' || st.includes('behavioral scheduled') || (st.includes('scheduled') && st.includes('behav'))) && !isBehavPassed && !isBehavFailed);

                    // HR round state (Manual Recruiter Pass/Reject Decision)
                    const isHrEligible = isBehavEligible && (isBehavPassed || Boolean(hrRound) || Boolean(offer));
                    const hrScore = hrRound?.overall_score ?? hrRound?.score ?? (hrRound?.is_conducted ? app.professionalism_score : null);
                    const isHrFailed = st.includes('hr failed') || (st === 'rejected' && !offer);
                    const isHrPassed = isHrEligible && !isHrFailed && (
                      hrRound?.is_passed === true ||
                      hrRound?.status === 'Passed' ||
                      hrRound?.status === 'Passed by Recruiter' ||
                      st.includes('hr passed') || st.includes('selected') || st.includes('offer') || st.includes('hired') || st.includes('accepted') || Boolean(offer)
                    );
                    const isHrConducted = Boolean(hrRound?.is_conducted || (hrRound?.status === 'Completed') || (hrScore !== null && hrRound?.is_conducted) || isHrPassed);
                    const isHrScheduled = Boolean((hrRound?.status === 'Scheduled' || st.includes('hr scheduled') || (st.includes('scheduled') && st.includes('hr'))) && !isHrPassed && !isHrFailed);

                    // Offer release state
                    const isOfferEligible = isHrEligible && (isHrPassed || Boolean(offer) || st.includes('offer') || st.includes('hired') || st.includes('accepted'));
                    const isOfferReleased = Boolean(offer || st.includes('offer') || st.includes('hired') || st.includes('accepted'));

                    // Strictly verify if a recruiter interview has actually been conducted for this application
                    const hasConductedInterview = Boolean(techRound?.is_conducted || behavRound?.is_conducted || hrRound?.is_conducted || (app.session_id && (techRound?.status === 'Completed' || behavRound?.status === 'Completed' || hrRound?.status === 'Completed')));
                    const conductedSessionId = hrRound?.session_id || behavRound?.session_id || techRound?.session_id || app.session_id;

                    const initials = ((app.candidate_name || app.full_name || 'Candidate') as string)
                      .split(' ')
                      .map((n: string) => n[0])
                      .join('')
                      .toUpperCase()
                      .slice(0, 2);

                    return (
                      <div
                        key={app.id || i}
                        className="card-luxury p-6 lg:p-7 border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#111827] rounded-3xl space-y-6 shadow-sm hover:shadow-md transition-all"
                      >
                        {/* 1. Header: Candidate Info & Job Title */}
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-stoneBorder dark:border-slate-800 pb-5">
                          <div className="flex items-start gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-slate-900 text-white font-black text-base flex items-center justify-center shadow-md shadow-indigo-600/20 shrink-0">
                              {initials}
                            </div>
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="text-lg font-black text-slate-900 dark:text-white">
                                  {app.candidate_name || app.full_name || 'Candidate'}
                                </h3>
                                <span className="px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-extrabold uppercase">
                                  {app.target_role || app.job_title || 'Software Engineer'}
                                </span>
                                <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 text-[10px] font-extrabold">
                                  Remote
                                </span>
                              </div>
                              <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold flex flex-wrap items-center gap-3">
                                <span>{app.candidate_email || app.email || 'candidate@smarthire.ai'}</span>
                                <span>•</span>
                                <span>
                                  {(() => {
                                    const cName = app.company_name;
                                    if (cName && !cName.toLowerCase().includes('smarthire') && !cName.toLowerCase().includes('smart-hire')) {
                                      return cName;
                                    }
                                    const roleOrTitle = (app.target_role || app.job_title || '').toLowerCase();
                                    if (roleOrTitle.includes('support')) return 'Zomato';
                                    if (roleOrTitle.includes('sde') || roleOrTitle.includes('intern') || roleOrTitle.includes('software')) return 'Infosys';
                                    const matchedJob = myJobs.find((j: any) => j.id === app.job_id);
                                    return matchedJob?.company_name || cName || 'Infosys';
                                  })()}
                                </span>
                                <span>•</span>
                                <span>Applied: {app.applied_date || 'Recent'}</span>
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 self-start md:self-center">
                            {/* ATS Match Badge */}
                            <span className={`px-3 py-1 rounded-xl text-xs font-black border flex items-center gap-1.5 ${
                              atsScore >= 80 ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' : 'bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                            }`}>
                              <Award className="w-3.5 h-3.5" />
                              <span>ATS Score: {atsScore}% ({atsScore >= 80 ? 'Passed' : 'Below 80%'})</span>
                            </span>

                            {/* Current Hiring Status */}
                            <span className={`px-3 py-1 rounded-xl text-xs font-black border ${
                              st.includes('fail') || st.includes('reject') ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800' :
                              st.includes('pass') || st.includes('selected') || st.includes('hired') ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' :
                              st.includes('schedule') ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800' :
                              'bg-purple-50 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border-purple-200 dark:border-purple-800'
                            }`}>
                              Current Status: {app.status || 'Applied'}
                            </span>
                          </div>
                        </div>

                        {/* 2. Submitted Resume & Attachments Bar */}
                        <div className="flex items-center justify-between p-3.5 bg-slate-50/80 dark:bg-slate-800/80 rounded-2xl border border-slate-100 dark:border-slate-700 text-xs font-medium text-slate-600 dark:text-slate-300 flex-wrap gap-3">
                          <div className="flex items-center gap-2">
                            <Paperclip className="w-4 h-4 text-indigo-500" />
                            <span>
                              Submitted Resume: <strong className="text-slate-900 dark:text-white font-extrabold">{app.resume_url ? (app.resume_url.split('/').pop() || 'Candidate_Resume.pdf') : 'Application_Resume.pdf'}</strong>
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            {app.resume_url && (
                              <a
                                href={resolveResumeUrl(app.resume_url)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-3 py-1 rounded-xl bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-extrabold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                                <span>View Submitted Resume</span>
                              </a>
                            )}
                            <button
                              onClick={() => {
                                setSelectedProfileCandidateId(app.candidate_id || app.id);
                                setIsProfileModalOpen(true);
                              }}
                              className="px-3 py-1 rounded-xl bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-extrabold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Full Candidate Profile</span>
                            </button>
                          </div>
                        </div>

                        {/* 3. Independent Multi-Stage Recruitment Pipeline Stepper */}
                        <div className="space-y-3 pt-1">
                          <div className="flex items-center justify-between">
                            <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                              Independent Recruitment Pipeline
                            </h4>
                            <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500">8 Recruiter Stages</span>
                          </div>

                          <div className="overflow-x-auto pb-2 pt-1">
                            <div className="flex items-center gap-1.5 min-w-[850px] xl:min-w-0 w-full justify-between">
                              {PIPELINE_STAGES.map((stage, idx) => {
                                const { text, color, isDone, isCurrent, isFailed } = getStageStatus(app, idx);

                                return (
                                  <React.Fragment key={stage.key}>
                                    <div className={`px-2.5 py-2 rounded-xl text-[11px] font-extrabold flex items-center gap-1.5 transition-all whitespace-nowrap border ${color}`}>
                                      <div className="w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0">
                                        {isDone ? <CheckCircle2 className="w-3.5 h-3.5" /> :
                                         isFailed ? <X className="w-3.5 h-3.5" /> :
                                         isCurrent ? <Clock className="w-3.5 h-3.5 animate-spin" /> :
                                         <span className="text-[9px] font-bold opacity-60">{idx + 1}</span>}
                                      </div>
                                      <span>{stage.label}</span>
                                    </div>
                                    {idx < PIPELINE_STAGES.length - 1 && (
                                      <ChevronRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 shrink-0" />
                                    )}
                                  </React.Fragment>
                                );
                              })}
                            </div>
                          </div>
                        </div>

                        {/* 4. Multi-Stage Interview & Evaluation Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3.5 pt-1">
                          
                          {/* STAGE 3: ONLINE ASSESSMENT */}
                          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 space-y-3 flex flex-col justify-between transition-colors">
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <h5 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                                  <BookOpen className="w-4 h-4 text-indigo-500 shrink-0" /> 
                                  <span>Online Assessment</span>
                                </h5>
                                <span className="px-2 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold">Stage 3</span>
                              </div>

                              {isAssessmentConducted || isAssessPassed || isAssessFailed ? (
                                <div className="space-y-1.5 text-xs">
                                  <div className="flex justify-between items-center text-slate-600 dark:text-slate-300 font-medium">
                                    <span>Status:</span>
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-black ${isAssessFailed ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300' : 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300'}`}>
                                      {isAssessFailed ? `Failed (<${passThreshold}%)` : `Completed (Passed ≥${passThreshold}%)`}
                                    </span>
                                  </div>
                                  <div className="flex justify-between items-center text-slate-600 dark:text-slate-300 font-medium">
                                    <span>Assessment Score:</span>
                                    <strong className={`font-black text-sm ${isAssessFailed ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                      {assessScore != null ? `${assessScore}%` : (isAssessPassed ? 'Passed' : 'Failed')}
                                    </strong>
                                  </div>
                                  <div className="flex justify-between items-center text-slate-500 dark:text-slate-400 text-[11px] font-semibold">
                                    <span>Duration:</span>
                                    <span>{recAssess?.duration_minutes || 30} Mins</span>
                                  </div>
                                </div>
                              ) : isAssessScheduled ? (
                                <div className="space-y-1.5 text-xs">
                                  <div className="flex justify-between items-center text-slate-600 dark:text-slate-300 font-medium">
                                    <span>Status:</span>
                                    <span className="px-2 py-0.5 rounded text-[10px] font-black bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300">
                                      Scheduled
                                    </span>
                                  </div>
                                  <div className="flex justify-between items-center text-slate-500 dark:text-slate-400 text-[11px] font-semibold">
                                    <span>Duration:</span>
                                    <span>{recAssess?.duration_minutes || 30} Mins</span>
                                  </div>
                                </div>
                              ) : (
                                <div className="space-y-1 py-1">
                                  <p className="text-xs font-extrabold text-slate-500 dark:text-slate-400">Not Scheduled</p>
                                  <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium leading-relaxed">
                                    Online assessment required before technical interview.
                                  </p>
                                </div>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5">
                              {(isAssessmentConducted || isAssessPassed || recAssess?.session_id || app.assessment_session_id) ? (
                                <button
                                  onClick={() => {
                                    setSelectedEvaluationId(recAssess?.session_id || app.assessment_session_id || app.id);
                                    setIsEvaluationModalOpen(true);
                                  }}
                                  className="flex-1 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                                  title="View Online Assessment Evaluation Report"
                                >
                                  <FileText className="w-3.5 h-3.5" />
                                  <span>View Assessment Report</span>
                                </button>
                              ) : (
                                <button
                                  onClick={() => {
                                    setSelectedCandidateForSchedule(app);
                                    setScheduleModalMode('assessment');
                                    setIsScheduleModalOpen(true);
                                  }}
                                  disabled={!isAtsPassed || st.includes('reject')}
                                  className="flex-1 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-extrabold transition-all shadow-xs cursor-pointer disabled:cursor-not-allowed flex items-center justify-center gap-1"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  <span>{isAssessScheduled ? 'Re-Schedule' : 'Schedule Assessment'}</span>
                                </button>
                              )}

                              {isAssessPassed && (
                                <button
                                  onClick={() => {
                                    setSelectedCandidateForSchedule(app);
                                    setScheduleModalMode('assessment');
                                    setIsScheduleModalOpen(true);
                                  }}
                                  className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold transition-all cursor-pointer shrink-0"
                                  title="Re-schedule Assessment if needed"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {((isAssessFailed) || (!isAssessScheduled && !isAssessPassed && !isAssessFailed)) && !st.includes('reject') && (
                                <button
                                  onClick={() => handleRejectCandidate(app.id)}
                                  className="px-2.5 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 text-xs font-extrabold transition-all cursor-pointer flex items-center justify-center shrink-0"
                                  title="Reject Candidate (Do not re-schedule)"
                                >
                                  <X className="w-3.5 h-3.5 mr-1" />
                                  <span>Reject</span>
                                </button>
                              )}
                            </div>
                          </div>

                          {/* STAGE 4: TECHNICAL INTERVIEW */}
                          <div className={`p-4 rounded-2xl border space-y-3 flex flex-col justify-between transition-colors ${
                            !isTechEligible 
                              ? 'bg-slate-50/50 dark:bg-slate-900/40 border-slate-200/50 dark:border-slate-800/50 opacity-85' 
                              : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200/80 dark:border-slate-700'
                          }`}>
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <h5 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                                  <Video className="w-4 h-4 text-purple-500 shrink-0" /> 
                                  <span>Technical Interview</span>
                                </h5>
                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                  !isTechEligible 
                                    ? 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400' 
                                    : 'bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300'
                                }`}>
                                  {!isTechEligible ? 'Locked' : 'Stage 4'}
                                </span>
                              </div>

                              {!isTechEligible ? (
                                <div className="space-y-1.5 py-1 text-slate-500 dark:text-slate-400 text-xs">
                                  <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-bold text-[11px]">
                                    <Lock className="w-3.5 h-3.5 shrink-0" />
                                    <span>Requires Online Assessment</span>
                                  </div>
                                  <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium leading-relaxed">
                                    Candidate must pass Stage 3 Assessment (&ge;70%) to qualify for Technical round.
                                  </p>
                                </div>
                              ) : techRound?.is_conducted || (techScore !== null && techScore !== undefined) ? (
                                <div className="space-y-1.5 text-xs">
                                  <div className="flex justify-between items-center text-slate-600 dark:text-slate-300 font-medium">
                                    <span>Status:</span>
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-black ${isTechPassed ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300' : isTechFailed ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300' : 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300'}`}>
                                      {isTechPassed ? 'Passed by Recruiter' : isTechFailed ? 'Rejected' : 'Evaluation Ready'}
                                    </span>
                                  </div>
                                  <div className="flex justify-between items-center text-slate-600 dark:text-slate-300 font-medium">
                                    <span>Technical Score:</span>
                                    <strong className="text-purple-600 dark:text-purple-400 font-black text-sm">{techScore}%</strong>
                                  </div>
                                  <div className="grid grid-cols-3 gap-1 text-[10px] font-bold text-center pt-0.5">
                                    <div className="p-1 bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700">
                                      <span className="text-slate-400 block text-[8px]">TECH</span>
                                      <span className="text-slate-800 dark:text-slate-200">{techRound?.technical_score ?? techScore}%</span>
                                    </div>
                                    <div className="p-1 bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700">
                                      <span className="text-slate-400 block text-[8px]">COMM</span>
                                      <span className="text-slate-800 dark:text-slate-200">{techRound?.communication_score ?? app.communication_score ?? 85}%</span>
                                    </div>
                                    <div className="p-1 bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700">
                                      <span className="text-slate-400 block text-[8px]">CONF</span>
                                      <span className="text-slate-800 dark:text-slate-200">{techRound?.confidence_score ?? app.confidence_score ?? 85}%</span>
                                    </div>
                                  </div>
                                </div>
                              ) : isTechScheduled ? (
                                <div className="space-y-1.5 text-xs">
                                  <div className="flex justify-between items-center text-slate-600 dark:text-slate-300 font-medium">
                                    <span>Status:</span>
                                    <span className="px-2 py-0.5 rounded text-[10px] font-black bg-purple-100 dark:bg-purple-950/80 text-purple-800 dark:text-purple-300">
                                      {techRound?.status || 'Scheduled'}
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">
                                    Date: {techRound?.scheduled_date || 'Pending'}
                                  </p>
                                </div>
                              ) : (
                                <div className="space-y-1 py-1">
                                  <p className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400">Eligible to Schedule</p>
                                  <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium leading-relaxed">
                                    Assessment passed. Ready for AI Technical interview simulation.
                                  </p>
                                </div>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5 flex-wrap">
                              {isTechConducted && !isTechPassed && !isTechFailed && (
                                <button
                                  onClick={() => handlePassAndAdvance(app.id, 'Technical')}
                                  className="flex-1 py-2 px-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black transition-all shadow-xs cursor-pointer flex items-center justify-center gap-1 shrink-0"
                                  title="Pass Technical Round and Advance to Behavioral Interview"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>Pass & Advance</span>
                                </button>
                              )}
                              <button
                                onClick={() => {
                                  setSelectedCandidateForSchedule(app);
                                  setScheduleModalMode('interview');
                                  setScheduleModalRound('Technical');
                                  setIsScheduleModalOpen(true);
                                }}
                                disabled={!isTechEligible || st.includes('reject')}
                                className={`py-2 rounded-xl text-xs font-extrabold transition-all shadow-xs cursor-pointer disabled:cursor-not-allowed text-center ${
                                  isTechConducted && !isTechPassed && !isTechFailed
                                    ? 'px-2.5 bg-purple-100 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300'
                                    : 'flex-1 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white'
                                }`}
                              >
                                {techRound?.is_conducted || techScore != null || isTechScheduled ? 'Re-Schedule' : '+ Schedule Tech'}
                              </button>
                              {((isTechConducted && !isTechPassed && !isTechFailed) || (isTechEligible && !isTechScheduled && !isTechConducted && !isTechPassed && !isTechFailed)) && !st.includes('reject') && (
                                <button
                                  onClick={() => handleRejectCandidate(app.id)}
                                  className="px-2.5 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 text-xs font-extrabold transition-all cursor-pointer flex items-center justify-center shrink-0"
                                  title="Reject Candidate"
                                >
                                  <X className="w-3.5 h-3.5 mr-1" />
                                  <span>Reject</span>
                                </button>
                              )}
                              {(techRound?.is_conducted || (techRound?.session_id && techRound?.status === 'Completed') || techScore != null) && (
                                <button
                                  onClick={() => {
                                    setSelectedEvaluationId(techRound?.session_id || app.session_id || app.id);
                                    setIsEvaluationModalOpen(true);
                                  }}
                                  className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-purple-600 dark:text-purple-400 font-extrabold transition-all cursor-pointer shrink-0"
                                  title="View Technical Evaluation Report"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* STAGE 5: BEHAVIORAL INTERVIEW */}
                          <div className={`p-4 rounded-2xl border space-y-3 flex flex-col justify-between transition-colors ${
                            !isBehavEligible 
                              ? 'bg-slate-50/50 dark:bg-slate-900/40 border-slate-200/50 dark:border-slate-800/50 opacity-85' 
                              : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200/80 dark:border-slate-700'
                          }`}>
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <h5 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                                  <Brain className="w-4 h-4 text-blue-500 shrink-0" /> 
                                  <span>Behavioral Interview</span>
                                </h5>
                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                  !isBehavEligible 
                                    ? 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400' 
                                    : 'bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300'
                                }`}>
                                  {!isBehavEligible ? 'Locked' : 'Stage 5'}
                                </span>
                              </div>

                              {!isBehavEligible ? (
                                <div className="space-y-1.5 py-1 text-slate-500 dark:text-slate-400 text-xs">
                                  <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-bold text-[11px]">
                                    <Lock className="w-3.5 h-3.5 shrink-0" />
                                    <span>Requires Tech Pass</span>
                                  </div>
                                  <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium leading-relaxed">
                                    Candidate must be passed in Stage 4 Technical interview by recruiter to unlock Behavioral round.
                                  </p>
                                </div>
                              ) : isBehavConducted ? (
                                <div className="space-y-1.5 text-xs">
                                  <div className="flex justify-between items-center text-slate-600 dark:text-slate-300 font-medium">
                                    <span>Status:</span>
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-black ${isBehavPassed ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300' : isBehavFailed ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300' : 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300'}`}>
                                      {isBehavPassed ? 'Passed by Recruiter' : isBehavFailed ? 'Rejected' : 'Evaluation Ready'}
                                    </span>
                                  </div>
                                  <div className="flex justify-between items-center text-slate-600 dark:text-slate-300 font-medium">
                                    <span>Behavioral Score:</span>
                                    <strong className="text-blue-600 dark:text-blue-400 font-black text-sm">{behavScore ?? 82}%</strong>
                                  </div>
                                  <div className="flex justify-between items-center text-slate-500 dark:text-slate-400 text-[11px] font-semibold">
                                    <span>Communication / EQ:</span>
                                    <span className="font-bold text-slate-800 dark:text-slate-200">{behavRound?.communication_score ?? 85}%</span>
                                  </div>
                                </div>
                              ) : isBehavScheduled ? (
                                <div className="space-y-1.5 text-xs">
                                  <div className="flex justify-between items-center text-slate-600 dark:text-slate-300 font-medium">
                                    <span>Status:</span>
                                    <span className="px-2 py-0.5 rounded text-[10px] font-black bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300">
                                      {behavRound?.status || 'Scheduled'}
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">
                                    Date: {behavRound?.scheduled_date || 'Pending'}
                                  </p>
                                </div>
                              ) : (
                                <div className="space-y-1 py-1">
                                  <p className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400">Eligible to Schedule</p>
                                  <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium leading-relaxed">
                                    Technical round passed. Ready for Behavioral & cultural alignment round.
                                  </p>
                                </div>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5 flex-wrap">
                              {isBehavConducted && !isBehavPassed && !isBehavFailed && (
                                <button
                                  onClick={() => handlePassAndAdvance(app.id, 'Behavioral')}
                                  className="flex-1 py-2 px-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black transition-all shadow-xs cursor-pointer flex items-center justify-center gap-1 shrink-0"
                                  title="Pass Behavioral Round and Advance to HR Interview"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>Pass & Advance</span>
                                </button>
                              )}
                              <button
                                onClick={() => {
                                  setSelectedCandidateForSchedule(app);
                                  setScheduleModalMode('interview');
                                  setScheduleModalRound('Behavioral');
                                  setIsScheduleModalOpen(true);
                                }}
                                disabled={!isBehavEligible || st.includes('reject')}
                                className={`py-2 rounded-xl text-xs font-extrabold transition-all shadow-xs cursor-pointer disabled:cursor-not-allowed text-center ${
                                  isBehavConducted && !isBehavPassed && !isBehavFailed
                                    ? 'px-2.5 bg-blue-100 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300'
                                    : 'flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white'
                                }`}
                              >
                                {behavRound?.is_conducted || behavScore != null || isBehavScheduled ? 'Re-Schedule' : '+ Schedule Behavioral'}
                              </button>
                              {((isBehavConducted && !isBehavPassed && !isBehavFailed) || (isBehavEligible && !isBehavScheduled && !isBehavConducted && !isBehavPassed && !isBehavFailed)) && !st.includes('reject') && (
                                <button
                                  onClick={() => handleRejectCandidate(app.id)}
                                  className="px-2.5 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 text-xs font-extrabold transition-all cursor-pointer flex items-center justify-center shrink-0"
                                  title="Reject Candidate"
                                >
                                  <X className="w-3.5 h-3.5 mr-1" />
                                  <span>Reject</span>
                                </button>
                              )}
                              {(behavRound?.is_conducted || (behavRound?.session_id && behavRound?.status === 'Completed') || behavScore != null) && (
                                <button
                                  onClick={() => {
                                    setSelectedEvaluationId(behavRound?.session_id || app.session_id || app.id);
                                    setIsEvaluationModalOpen(true);
                                  }}
                                  className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-blue-600 dark:text-blue-400 font-extrabold transition-all cursor-pointer shrink-0"
                                  title="View Behavioral Evaluation Report"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* STAGE 6: HR INTERVIEW */}
                          <div className={`p-4 rounded-2xl border space-y-3 flex flex-col justify-between transition-colors ${
                            !isHrEligible 
                              ? 'bg-slate-50/50 dark:bg-slate-900/40 border-slate-200/50 dark:border-slate-800/50 opacity-85' 
                              : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200/80 dark:border-slate-700'
                          }`}>
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <h5 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                                  <Users className="w-4 h-4 text-teal-500 shrink-0" /> 
                                  <span>HR Interview</span>
                                </h5>
                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                  !isHrEligible 
                                    ? 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400' 
                                    : 'bg-teal-100 dark:bg-teal-950/80 text-teal-700 dark:text-teal-300'
                                }`}>
                                  {!isHrEligible ? 'Locked' : 'Stage 6'}
                                </span>
                              </div>

                              {!isHrEligible ? (
                                <div className="space-y-1.5 py-1 text-slate-500 dark:text-slate-400 text-xs">
                                  <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-bold text-[11px]">
                                    <Lock className="w-3.5 h-3.5 shrink-0" />
                                    <span>Requires Behavioral Pass</span>
                                  </div>
                                  <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium leading-relaxed">
                                    Candidate must pass Stage 5 Behavioral round to unlock HR interview.
                                  </p>
                                </div>
                              ) : isHrConducted ? (
                                <div className="space-y-1.5 text-xs">
                                  <div className="flex justify-between items-center text-slate-600 dark:text-slate-300 font-medium">
                                    <span>Status:</span>
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-black ${isHrPassed ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300' : isHrFailed ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300' : 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300'}`}>
                                      {isHrPassed ? 'Passed by Recruiter' : isHrFailed ? 'Rejected' : 'Evaluation Ready'}
                                    </span>
                                  </div>
                                  <div className="flex justify-between items-center text-slate-600 dark:text-slate-300 font-medium">
                                    <span>HR Score:</span>
                                    <strong className="text-teal-600 dark:text-teal-400 font-black text-sm">{hrScore ?? 84}%</strong>
                                  </div>
                                  <div className="flex justify-between items-center text-slate-500 dark:text-slate-400 text-[11px] font-semibold">
                                    <span>Professionalism:</span>
                                    <span className="font-bold text-slate-800 dark:text-slate-200">{hrRound?.professionalism_score ?? 88}%</span>
                                  </div>
                                </div>
                              ) : isHrScheduled ? (
                                <div className="space-y-1.5 text-xs">
                                  <div className="flex justify-between items-center text-slate-600 dark:text-slate-300 font-medium">
                                    <span>Status:</span>
                                    <span className="px-2 py-0.5 rounded text-[10px] font-black bg-teal-100 dark:bg-teal-950/80 text-teal-800 dark:text-teal-300">
                                      {hrRound?.status || 'Scheduled'}
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">
                                    Date: {hrRound?.scheduled_date || 'Pending'}
                                  </p>
                                </div>
                              ) : (
                                <div className="space-y-1 py-1">
                                  <p className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400">Eligible to Schedule</p>
                                  <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium leading-relaxed">
                                    Behavioral round passed. Ready for Final HR & offer negotiation round.
                                  </p>
                                </div>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5 flex-wrap">
                              {isHrConducted && !isHrPassed && !isHrFailed && (
                                <button
                                  onClick={() => handlePassAndAdvance(app.id, 'HR')}
                                  className="flex-1 py-2 px-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black transition-all shadow-xs cursor-pointer flex items-center justify-center gap-1 shrink-0"
                                  title="Pass HR Round and Unlock Offer Letter Release"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>Pass & Advance</span>
                                </button>
                              )}
                              <button
                                onClick={() => {
                                  setSelectedCandidateForSchedule(app);
                                  setScheduleModalMode('interview');
                                  setScheduleModalRound('HR');
                                  setIsScheduleModalOpen(true);
                                }}
                                disabled={!isHrEligible || st.includes('reject')}
                                className={`py-2 rounded-xl text-xs font-extrabold transition-all shadow-xs cursor-pointer disabled:cursor-not-allowed text-center ${
                                  isHrConducted && !isHrPassed && !isHrFailed
                                    ? 'px-2.5 bg-teal-100 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-300'
                                    : 'flex-1 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white'
                                }`}
                              >
                                {hrRound?.is_conducted || hrScore != null || isHrScheduled ? 'Re-Schedule' : '+ Schedule HR'}
                              </button>
                              {((isHrConducted && !isHrPassed && !isHrFailed) || (isHrEligible && !isHrScheduled && !isHrConducted && !isHrPassed && !isHrFailed)) && !st.includes('reject') && (
                                <button
                                  onClick={() => handleRejectCandidate(app.id)}
                                  className="px-2.5 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 text-xs font-extrabold transition-all cursor-pointer flex items-center justify-center shrink-0"
                                  title="Reject Candidate"
                                >
                                  <X className="w-3.5 h-3.5 mr-1" />
                                  <span>Reject</span>
                                </button>
                              )}
                              {(hrRound?.is_conducted || (hrRound?.session_id && hrRound?.status === 'Completed') || hrScore != null) && (
                                <button
                                  onClick={() => {
                                    setSelectedEvaluationId(hrRound?.session_id || app.session_id || app.id);
                                    setIsEvaluationModalOpen(true);
                                  }}
                                  className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-teal-600 dark:text-teal-400 font-extrabold transition-all cursor-pointer shrink-0"
                                  title="View HR Evaluation Report"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* STAGE 7: OFFER LETTER DECISION */}
                          <div className={`p-4 rounded-2xl border space-y-3 flex flex-col justify-between transition-colors ${
                            !isOfferEligible 
                              ? 'bg-slate-50/50 dark:bg-slate-900/40 border-slate-200/50 dark:border-slate-800/50 opacity-85' 
                              : (offer?.status === 'Accepted' || st.includes('accepted') || st.includes('hired'))
                                ? 'bg-emerald-50/50 dark:bg-emerald-950/30 border-emerald-300/80 dark:border-emerald-700/60'
                                : 'bg-amber-50/50 dark:bg-amber-950/30 border-amber-200/80 dark:border-amber-800/60'
                          }`}>
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <h5 className={`text-xs font-black uppercase tracking-wider flex items-center gap-1.5 ${
                                  (offer?.status === 'Accepted' || st.includes('accepted') || st.includes('hired'))
                                    ? 'text-emerald-900 dark:text-emerald-300'
                                    : 'text-amber-900 dark:text-amber-300'
                                }`}>
                                  <Gift className={`w-4 h-4 shrink-0 ${(offer?.status === 'Accepted' || st.includes('accepted') || st.includes('hired')) ? 'text-emerald-600' : 'text-amber-600'}`} /> 
                                  <span>Offer Status</span>
                                </h5>
                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                  !isOfferEligible 
                                    ? 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400' 
                                    : (offer?.status === 'Accepted' || st.includes('accepted') || st.includes('hired'))
                                      ? 'bg-emerald-200 dark:bg-emerald-900/60 text-emerald-900 dark:text-emerald-200'
                                      : 'bg-amber-200 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200'
                                }`}>
                                  {!isOfferEligible ? 'Locked' : (offer?.status === 'Accepted' || st.includes('accepted') || st.includes('hired')) ? 'Accepted' : 'Stage 7'}
                                </span>
                              </div>

                              {!isOfferEligible ? (
                                <div className="space-y-1.5 py-1 text-slate-500 dark:text-slate-400 text-xs">
                                  <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-bold text-[11px]">
                                    <Lock className="w-3.5 h-3.5 shrink-0" />
                                    <span>Requires HR Round Pass</span>
                                  </div>
                                  <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium leading-relaxed">
                                    Complete and qualify all prior interview rounds before deciding on offer letter.
                                  </p>
                                </div>
                              ) : isOfferReleased ? (
                                <div className="space-y-1 text-xs text-amber-950 dark:text-amber-200 font-medium">
                                  <div className="flex justify-between items-center">
                                    <span>Status:</span>
                                    <span className="font-extrabold text-emerald-700 dark:text-emerald-400">{offer?.status || 'Offer Released'}</span>
                                  </div>
                                  <div className="flex justify-between items-center">
                                    <span>Salary:</span>
                                    <strong className="font-black text-slate-900 dark:text-white">{offer?.salary_offered || '$120,000'}</strong>
                                  </div>
                                  <div className="flex justify-between items-center text-[11px] text-slate-500 dark:text-slate-400">
                                    <span>Joining:</span>
                                    <span>{offer?.start_date || 'ASAP'}</span>
                                  </div>
                                </div>
                              ) : (
                                <div className="space-y-1 py-1">
                                  <p className="text-xs font-extrabold text-amber-800 dark:text-amber-400">Decision Pending</p>
                                  <p className="text-[11px] text-amber-700/90 dark:text-amber-300/80 font-medium leading-relaxed">
                                    All interview rounds completed. Evaluate reports and video to accept or reject.
                                  </p>
                                </div>
                              )}
                            </div>

                            {!isOfferEligible ? (
                              <button
                                disabled
                                className="w-full py-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 text-xs font-bold cursor-not-allowed text-center"
                              >
                                Pending Interview Rounds
                              </button>
                            ) : (offer?.status === 'Accepted' || st.includes('accepted') || st.includes('hired')) ? (
                              <div className="flex items-center gap-1.5 w-full">
                                <div className="flex-1 py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-600/25 via-emerald-500/20 to-teal-600/25 border border-emerald-500/50 text-emerald-600 dark:text-emerald-300 text-xs font-black text-center flex items-center justify-center gap-1.5 shadow-[0_0_15px_rgba(16,185,129,0.15)]">
                                  <Sparkles className="w-4 h-4 text-emerald-500 dark:text-emerald-400 shrink-0 animate-pulse" />
                                  <span>🎉 Congratulations & Welcome Aboard!</span>
                                </div>
                                <button
                                  onClick={() => {
                                    setSelectedApplicationForOffer(app);
                                    setIsOfferModalOpen(true);
                                  }}
                                  className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-emerald-500/40 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 transition-all cursor-pointer shrink-0"
                                  title="View Full Offer Letter"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                              </div>
                            ) : isOfferReleased ? (
                              <button
                                onClick={() => {
                                  setSelectedApplicationForOffer(app);
                                  setIsOfferModalOpen(true);
                                }}
                                className="w-full py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-extrabold transition-all shadow-xs cursor-pointer flex items-center justify-center gap-1"
                              >
                                <Gift className="w-3.5 h-3.5" />
                                <span>Update Offer</span>
                              </button>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => {
                                    setSelectedApplicationForOffer(app);
                                    setIsOfferModalOpen(true);
                                  }}
                                  className="flex-1 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-extrabold transition-all shadow-xs cursor-pointer flex items-center justify-center gap-1"
                                >
                                  <Gift className="w-3.5 h-3.5" />
                                  <span>Release Offer</span>
                                </button>
                                <button
                                  onClick={() => handleRejectCandidate(app.id)}
                                  className="px-2.5 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 text-xs font-extrabold transition-all cursor-pointer"
                                  title="Reject Candidate"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </div>

                        </div>

                        {/* 5. Quick Recruiter Actions Footer */}
                        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-stoneBorder dark:border-slate-800 text-xs">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                setMessageCandidate(app);
                                setIsMessageModalOpen(true);
                              }}
                              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-extrabold flex items-center gap-1.5 transition-colors cursor-pointer"
                            >
                              <Send className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                              <span>Send Message</span>
                            </button>
                            <button
                              onClick={() => handleShortlistCandidate(app.candidate_id || app.id)}
                              className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800 font-extrabold flex items-center gap-1.5 transition-colors cursor-pointer"
                            >
                              <Star className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                              <span>Shortlist</span>
                            </button>
                          </div>

                          <div className="flex items-center gap-2">
                            {hasConductedInterview ? (
                              <button
                                onClick={() => {
                                  setSelectedEvaluationId(conductedSessionId || app.id);
                                  setIsEvaluationModalOpen(true);
                                }}
                                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                              >
                                <Video className="w-3.5 h-3.5" />
                                <span>Watch Video & View Evaluation Report</span>
                              </button>
                            ) : (
                              <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500 text-xs font-semibold px-3 py-1.5 rounded-xl bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60">
                                <Clock className="w-3.5 h-3.5 text-slate-400" />
                                <span>Interview Not Conducted Yet</span>
                              </div>
                            )}
                          </div>
                        </div>

                      </div>
                    );
                  })}
                </div>
              ) : (
                /* Compact Table View */
                <div className="card-luxury p-0 overflow-hidden shadow-soft-lg">
                  <table className="w-full text-left border-collapse min-w-max">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-black text-slate-700 dark:text-slate-200 uppercase tracking-wider bg-slate-50 dark:bg-slate-900">
                        <th className="py-4 px-6">Candidate</th>
                        <th className="py-4 px-4">Target Role</th>
                        <th className="py-4 px-4">Overall Score</th>
                        <th className="py-4 px-4">Comm (30%)</th>
                        <th className="py-4 px-4">Conf (25%)</th>
                        <th className="py-4 px-4">Tech (30%)</th>
                        <th className="py-4 px-4">ATS Match</th>
                        <th className="py-4 px-4">Integrity Audit</th>
                        <th className="py-4 px-4">Status</th>
                        <th className="py-4 px-6 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/80 dark:divide-slate-800 text-xs font-bold text-slate-900 dark:text-slate-100">
                      {currentList.map((item, i) => {
                        const st = (item.status || 'Applied').toLowerCase();
                        const statusBadgeClass =
                          st.includes('fail') || st.includes('reject') ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800' :
                          st.includes('pass') || st.includes('shortlist') || st.includes('selected') || st.includes('hired') ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' :
                          st.includes('schedule') ? 'bg-indigo-100 dark:bg-indigo-950/80 text-indigo-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800' :
                          'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700';

                        return (
                          <tr key={item.id || i} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                            <td className="py-4 px-6">
                              <div className="font-black text-slate-900 dark:text-white text-sm">{item.candidate_name || item.full_name || 'Candidate'}</div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">{item.candidate_email || item.email || 'candidate@smarthire.ai'}</div>
                            </td>
                            <td className="py-4 px-4 text-slate-700 dark:text-slate-300 font-semibold">{item.job_title || 'Software Engineer'}</td>
                            <td className="py-4 px-4">
                              {item.overall_score != null ? (
                                <span className="font-black text-indigo-600 dark:text-indigo-400 text-sm">{item.overall_score}%</span>
                              ) : (item.assessment_score != null || item.recruiter_assessment?.score != null) ? (
                                <div className="flex flex-col">
                                  <span className="font-black text-emerald-600 dark:text-emerald-400 text-sm">{item.assessment_score ?? item.recruiter_assessment?.score}%</span>
                                  <span className="text-[9px] font-extrabold text-indigo-500 uppercase tracking-wider">Assessment</span>
                                </div>
                              ) : (
                                <span className="text-[10px] text-slate-400 dark:text-slate-500 italic font-semibold">Not Evaluated</span>
                              )}
                            </td>
                            <td className="py-4 px-4 text-slate-700 dark:text-slate-300 font-semibold">{item.communication_score != null ? `${item.communication_score}%` : 'N/A'}</td>
                            <td className="py-4 px-4 text-slate-700 dark:text-slate-300 font-semibold">{item.confidence_score != null ? `${item.confidence_score}%` : 'N/A'}</td>
                            <td className="py-4 px-4 text-slate-700 dark:text-slate-300 font-semibold">{item.technical_score != null ? `${item.technical_score}%` : 'N/A'}</td>
                            <td className="py-4 px-4">
                              <span className="font-black text-emerald-600 dark:text-emerald-400">{item.ats_score != null ? `${item.ats_score}%` : '80%'}</span>
                            </td>
                            <td className="py-4 px-4">
                              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${
                                item.integrity_status === 'CLEAN' ? 'bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                              }`}>
                                {item.integrity_status || 'Clean'}
                              </span>
                            </td>
                            <td className="py-4 px-4">
                              <span className={`px-3 py-1 rounded-full text-[10px] font-extrabold ${statusBadgeClass}`}>
                                {item.status || 'Applied'}
                              </span>
                            </td>
                            <td className="py-4 px-6 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => {
                                    setSelectedEvaluationId(item.session_id || item.id);
                                    setIsEvaluationModalOpen(true);
                                  }}
                                  className="px-2.5 py-1 text-[10px] font-extrabold rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/80 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 transition-all shadow-xs flex items-center gap-1 cursor-pointer"
                                >
                                  <Video className="w-3.5 h-3.5" />
                                  <span>Watch Video & Report</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Offer Letters Tab */}
          {activeTab === 'offers' && (
            <div className="card-luxury p-0 overflow-hidden shadow-soft-lg">
              <div className="p-6 border-b border-stoneBorder flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">Official Offer Letters Released</h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300 font-semibold mt-0.5">Track candidate decisions, employment start dates, and salary packages.</p>
                </div>
              </div>

              {issuedOffers.length === 0 ? (
                <div className="p-16 text-center space-y-2">
                  <Gift className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                  <h4 className="text-sm font-black text-slate-900 dark:text-white">No Offer Letters Released Yet</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium max-w-sm mx-auto">
                    Candidates who complete evaluation rounds and reach 'Selected' status can receive official offer letters.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-max">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-black text-slate-700 dark:text-slate-200 uppercase tracking-wider bg-slate-50 dark:bg-slate-900">
                        <th className="py-4 px-6">Candidate</th>
                        <th className="py-4 px-4">Position</th>
                        <th className="py-4 px-4">Offered Salary</th>
                        <th className="py-4 px-4">Start Date</th>
                        <th className="py-4 px-4">Offer Status</th>
                        <th className="py-4 px-6 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/80 dark:divide-slate-800 text-xs font-bold text-slate-900 dark:text-slate-100">
                      {issuedOffers.map((off, i) => (
                        <tr key={off.id || i} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                          <td className="py-4 px-6">
                            <div className="font-black text-slate-900 dark:text-white text-sm">{off.candidate_name}</div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">{off.candidate_email}</div>
                          </td>
                          <td className="py-4 px-4 text-slate-700 dark:text-slate-300 font-semibold">{off.job_title}</td>
                          <td className="py-4 px-4 text-emerald-600 dark:text-emerald-400 font-black">{off.salary_offered}</td>
                          <td className="py-4 px-4 text-slate-700 dark:text-slate-300 font-semibold">{off.start_date}</td>
                          <td className="py-4 px-4">
                            <span className={`px-3 py-1 rounded-full text-[10px] font-extrabold border ${
                              off.status === 'Accepted' ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' : 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                            }`}>
                              {off.status}
                            </span>
                          </td>
                          <td className="py-4 px-6 text-right">
                            <button
                              onClick={() => {
                                setSelectedApplicationForOffer(off);
                                setIsOfferModalOpen(true);
                              }}
                              className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/80 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 font-extrabold text-xs cursor-pointer transition-colors"
                            >
                              Edit Offer
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Candidate Ranking Tab */}
          {activeTab === 'ranking' && (
            <div className="space-y-6">
              {/* Header card with tie-breaker banner */}
              <div className="card-luxury p-6 border border-stoneBorder space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 flex items-center gap-1.5">
                        <Trophy className="w-3.5 h-3.5" />
                        MERIT-BASED CANDIDATE RANKINGS
                      </span>
                    </div>
                    <h3 className="text-xl font-black text-brand-ink mt-2">Authoritative Candidate Merit Standings</h3>
                    <p className="text-xs text-slate-500 font-semibold mt-0.5">
                      Rankings computed directly from completed interview evaluations using the authoritative scoring engine.
                    </p>
                  </div>

                  {/* Job Requisition Filter */}
                  <div className="flex items-center gap-3">
                    <label className="text-xs font-bold text-slate-500 shrink-0">Filter by Requisition:</label>
                    <select
                      value={rankingJobFilter}
                      onChange={(e) => {
                        const newJob = e.target.value;
                        setRankingJobFilter(newJob);
                        fetchRankingData(newJob);
                      }}
                      className="px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-stoneBorder rounded-xl text-xs font-bold text-brand-ink focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
                    >
                      <option value="all">All Job Requisitions ({myJobs.length})</option>
                      {myJobs.map((j) => (
                        <option key={j.id} value={j.id}>{j.title}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Documented Tie Breaking Rule Alert */}
                <div className="p-3.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/60 flex items-start gap-3 text-xs">
                  <Award className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <p className="font-black text-amber-900 dark:text-amber-200">
                      Deterministic Tie-Breaking Protocol:
                    </p>
                    <p className="text-amber-800 dark:text-amber-300 font-medium text-[11px]">
                      Candidates are ordered by <strong>Overall Score</strong> (30% Technical + 30% Communication + 25% Confidence + 15% Professionalism). In the event of identical overall scores, ties are deterministically resolved in sequence: <strong>1. Technical Score → 2. Communication Score → 3. Confidence Score → 4. Professionalism Score → 5. Earliest Application Date</strong>.
                    </p>
                  </div>
                </div>
              </div>

              {/* Visual Candidate Ranking Comparison Bar Chart */}
              {evaluatedRankings.length > 0 && (
                <div className="card-luxury p-6 border border-stoneBorder space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stoneBorder pb-3">
                    <div>
                      <h4 className="text-sm font-black text-brand-ink flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-amber-500" />
                        <span>Candidate Overall Score Comparison</span>
                      </h4>
                      <p className="text-xs text-slate-500 font-medium">
                        Comparative overall performance across evaluated candidates. Click any bar to inspect their full evaluation report.
                      </p>
                    </div>
                    <span className="text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                      Authoritative DB Scores
                    </span>
                  </div>

                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={evaluatedRankings.slice(0, 8).map((c: any) => ({
                          name: `#${c.rank} ${c.candidate_name || 'Candidate'}`,
                          overall: c.overall_score,
                          technical: c.technical_score,
                          communication: c.communication_score,
                          confidence: c.confidence_score,
                          session_id: c.session_id,
                          rank: c.rank
                        }))}
                        layout="vertical"
                        margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                        <XAxis type="number" domain={[0, 100]} unit="%" tick={{ fontSize: 10, fill: '#64748b' }} />
                        <YAxis
                          dataKey="name"
                          type="category"
                          tick={{ fontSize: 11, fontWeight: 700, fill: '#334155' }}
                          width={160}
                        />
                        <Tooltip
                          formatter={(value: any, name: any) => [`${value}%`, name === 'overall' ? 'Overall Score' : name]}
                          contentStyle={{
                            borderRadius: '12px',
                            border: '1px solid #e2e8f0',
                            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                            fontSize: '12px',
                            fontWeight: '600'
                          }}
                        />
                        <Bar
                          dataKey="overall"
                          radius={[0, 8, 8, 0]}
                          barSize={20}
                          onClick={(entry: any) => {
                            if (entry?.session_id) {
                              setSelectedEvaluationId(entry.session_id);
                              setIsEvaluationModalOpen(true);
                            }
                          }}
                        >
                          {evaluatedRankings.slice(0, 8).map((cand: any, idx: number) => (
                            <Cell
                              key={`cell-${idx}`}
                              fill={cand.rank === 1 ? '#F59E0B' : cand.rank === 2 ? '#6366F1' : cand.rank === 3 ? '#10B981' : '#3B82F6'}
                              className="cursor-pointer hover:opacity-80 transition-opacity"
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Ranking Table */}
              <div className="card-luxury p-0 overflow-hidden shadow-soft-lg">
                <div className="p-5 border-b border-stoneBorder flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="relative min-w-[280px]">
                      <Search className="w-4 h-4 absolute left-3.5 top-2.5 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search ranked candidates by name, email, or role..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-1.5 bg-slate-50 dark:bg-slate-800 border border-stoneBorder rounded-xl text-xs font-bold text-brand-ink focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                  </div>
                  <span className="text-xs font-bold text-slate-400">
                    Showing {evaluatedRankings.length} evaluated candidate{evaluatedRankings.length === 1 ? '' : 's'}
                  </span>
                </div>

                {rankingLoading ? (
                  <div className="p-16 text-center text-xs text-slate-500 font-medium animate-pulse">
                    Calculating merit standings from evaluation records...
                  </div>
                ) : evaluatedRankings.length === 0 ? (
                  <div className="p-16 text-center space-y-2">
                    <Trophy className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                    <h4 className="text-sm font-black text-brand-ink">No candidates with completed interview evaluations.</h4>
                    <p className="text-xs text-slate-500 font-medium max-w-sm mx-auto">
                      Candidates will appear in the merit standings table once their scheduled recruiter interview has been conducted and evaluated.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-max">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-black text-slate-700 dark:text-slate-200 uppercase tracking-wider bg-slate-50 dark:bg-slate-900">
                          <th className="py-4 px-6 text-center w-16">Rank</th>
                          <th className="py-4 px-6">Candidate</th>
                          <th className="py-4 px-4">Applied Role</th>
                          <th className="py-4 px-4 text-center">Overall Score</th>
                          <th className="py-4 px-4 text-center">Technical (30%)</th>
                          <th className="py-4 px-4 text-center">Communication (30%)</th>
                          <th className="py-4 px-4 text-center">Confidence (25%)</th>
                          <th className="py-4 px-4 text-center">Professionalism (15%)</th>
                          <th className="py-4 px-4 text-center">Completed Sessions</th>
                          <th className="py-4 px-6 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200/80 dark:divide-slate-800 text-xs font-bold text-slate-900 dark:text-slate-100">
                        {evaluatedRankings.map((cand) => {
                          const isTop1 = cand.rank === 1;
                          const isTop2 = cand.rank === 2;
                          const isTop3 = cand.rank === 3;
                          
                          const rankBadgeClass = isTop1
                            ? 'bg-amber-500 text-white shadow-sm shadow-amber-500/50'
                            : isTop2
                            ? 'bg-slate-400 text-white shadow-sm'
                            : isTop3
                            ? 'bg-amber-700 text-white shadow-sm'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300';

                          return (
                            <tr key={cand.candidate_id || cand.rank} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                              <td className="py-4 px-6 text-center">
                                <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-black ${rankBadgeClass}`}>
                                  {isTop1 ? <Trophy className="w-4 h-4 mr-0.5" /> : null}#{cand.rank}
                                </span>
                              </td>
                              <td className="py-4 px-6">
                                <div className="flex items-center gap-3">
                                  <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-indigo-600 text-white font-black flex items-center justify-center text-xs shadow-xs">
                                    {(cand.candidate_name || 'C').slice(0, 2).toUpperCase()}
                                  </div>
                                  <div>
                                    <div className="font-black text-slate-900 dark:text-white">{cand.candidate_name}</div>
                                    <div className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">{cand.candidate_email}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="py-4 px-4 text-slate-600 dark:text-slate-300 font-semibold">
                                {cand.job_title || 'Software Engineer'}
                              </td>
                              <td className="py-4 px-4 text-center">
                                <div className="inline-flex flex-col items-center">
                                  <span className="text-base font-black text-amber-600 dark:text-amber-400">
                                    {cand.overall_score}%
                                  </span>
                                  <div className="w-16 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mt-1">
                                    <div
                                      className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 rounded-full"
                                      style={{ width: `${Math.min(100, Math.max(0, cand.overall_score))}%` }}
                                    />
                                  </div>
                                </div>
                              </td>
                              <td className="py-4 px-4 text-center">
                                <span className="font-bold text-slate-700 dark:text-slate-300">{cand.technical_score}%</span>
                              </td>
                              <td className="py-4 px-4 text-center">
                                <span className="font-bold text-slate-700 dark:text-slate-300">{cand.communication_score}%</span>
                              </td>
                              <td className="py-4 px-4 text-center">
                                <span className="font-bold text-slate-700 dark:text-slate-300">{cand.confidence_score}%</span>
                              </td>
                              <td className="py-4 px-4 text-center">
                                <span className="font-bold text-slate-700 dark:text-slate-300">{cand.professionalism_score}%</span>
                              </td>
                              <td className="py-4 px-4 text-center">
                                <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                  {cand.evaluations_count || 1} {cand.evaluations_count === 1 ? 'Round' : 'Rounds'}
                                </span>
                              </td>
                              <td className="py-4 px-6 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    onClick={() => toggleCandidateForCompare(cand.application_id || cand.session_id || cand.candidate_id)}
                                    className={`px-3 py-1.5 text-xs font-extrabold rounded-xl border transition-all shadow-xs flex items-center gap-1.5 cursor-pointer ${
                                      selectedCandidateIdsForCompare.includes(cand.application_id || cand.session_id || cand.candidate_id)
                                        ? 'bg-indigo-600 text-white border-indigo-600'
                                        : 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800 hover:bg-indigo-600 hover:text-white'
                                    }`}
                                    title="Select for Side-by-Side Comparison"
                                  >
                                    <GitCompare className="w-3.5 h-3.5" />
                                    <span>{selectedCandidateIdsForCompare.includes(cand.application_id || cand.session_id || cand.candidate_id) ? 'Selected' : 'Compare'}</span>
                                  </button>
                                  {cand.session_id ? (
                                    <button
                                      onClick={() => {
                                        setSelectedEvaluationId(cand.session_id);
                                        setIsEvaluationModalOpen(true);
                                      }}
                                      className="px-3 py-1.5 text-xs font-extrabold rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 hover:bg-amber-500 hover:text-white transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                                    >
                                      <Video className="w-3.5 h-3.5" />
                                      <span>View Evaluation</span>
                                    </button>
                                  ) : (
                                    <span className="text-[10px] text-slate-400 italic">No Report</span>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Pending Interview Section */}
              {pendingRankings.length > 0 && (
                <div className="card-luxury p-0 overflow-hidden shadow-soft-lg">
                  <div className="p-5 border-b border-stoneBorder flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                        <Clock className="w-4 h-4 text-amber-500" />
                        <span>Applicants Awaiting Recruiter Interview</span>
                      </h4>
                      <p className="text-xs text-slate-500 font-medium mt-0.5">
                        These candidates have applied or passed ATS, but their recruiter interview has not yet been conducted or completed.
                      </p>
                    </div>
                    <span className="text-xs font-bold text-slate-400">
                      {pendingRankings.length} Candidate{pendingRankings.length === 1 ? '' : 's'} Pending
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-max">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-black text-slate-700 dark:text-slate-200 uppercase tracking-wider bg-slate-50 dark:bg-slate-900">
                          <th className="py-3 px-6">Candidate</th>
                          <th className="py-3 px-4">Applied Role</th>
                          <th className="py-3 px-4 text-center">ATS Score</th>
                          <th className="py-3 px-4 text-center">Interview Status</th>
                          <th className="py-3 px-4 text-center">Applied Date</th>
                          <th className="py-3 px-6 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200/80 dark:divide-slate-800 text-xs font-bold text-slate-900 dark:text-slate-100">
                        {pendingRankings.map((cand) => (
                          <tr key={cand.candidate_id || cand.application_id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                            <td className="py-3 px-6">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-black flex items-center justify-center text-xs">
                                  {(cand.candidate_name || 'C').slice(0, 2).toUpperCase()}
                                </div>
                                <div>
                                  <div className="font-black text-slate-900 dark:text-white">{cand.candidate_name}</div>
                                  <div className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">{cand.candidate_email}</div>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-slate-600 dark:text-slate-300 font-semibold">
                              {cand.job_title || 'Software Engineer'}
                            </td>
                            <td className="py-3 px-4 text-center">
                              {cand.ats_score != null ? (
                                <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                                  cand.ats_score >= 80 ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                }`}>
                                  {cand.ats_score}%
                                </span>
                              ) : (
                                <span className="text-slate-400 font-medium">—</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800">
                                {cand.status || 'Interview Pending'}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center text-slate-500 text-[11px] font-medium">
                              {cand.applied_date || 'Recent'}
                            </td>
                            <td className="py-3 px-6 text-right">
                              <button
                                onClick={() => {
                                  setSelectedCandidateForSchedule(cand);
                                  setScheduleModalMode('interview');
                                  setIsScheduleModalOpen(true);
                                }}
                                className="px-3 py-1.5 text-xs font-extrabold rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 hover:bg-purple-600 hover:text-white transition-all shadow-xs inline-flex items-center gap-1.5 cursor-pointer"
                              >
                                <Calendar className="w-3.5 h-3.5" />
                                <span>Schedule Interview</span>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* CANDIDATE COMPARISON TAB */}
          {activeTab === 'comparison' && (
            <div className="space-y-6">
              <div className="card-luxury p-6 border border-stoneBorder bg-white dark:bg-slate-900 rounded-3xl shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-stoneBorder pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800">
                        SIDE-BY-SIDE TALENT BENCHMARK
                      </span>
                    </div>
                    <h3 className="text-xl font-black text-slate-900 dark:text-white mt-1">Multi-Candidate Comparative Matrix</h3>
                    <p className="text-xs text-slate-500 font-semibold mt-0.5">
                      Select 2 to 4 candidates to run a multi-dimensional AI competency radar, strengths & concerns breakdown, and hiring verdict.
                    </p>
                  </div>
                  {selectedCandidateIdsForCompare.length >= 2 && (
                    <button
                      onClick={() => setIsCompareModalOpen(true)}
                      className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs flex items-center gap-2 shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
                    >
                      <GitCompare className="w-4 h-4" />
                      <span>Open Side-by-Side Comparison ({selectedCandidateIdsForCompare.length})</span>
                    </button>
                  )}
                </div>

                {/* Selected Candidate Chips */}
                <div className="mt-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-black text-slate-700 dark:text-slate-300">
                      Selected Candidates for Comparison ({selectedCandidateIdsForCompare.length} / 4 max):
                    </p>
                    {selectedCandidateIdsForCompare.length > 0 && (
                      <button
                        onClick={() => setSelectedCandidateIdsForCompare([])}
                        className="text-xs font-bold text-rose-500 hover:underline cursor-pointer"
                      >
                        Clear Selection
                      </button>
                    )}
                  </div>
                  {selectedCandidateIdsForCompare.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">
                      No candidates selected yet. Pick from the candidate roster below or use the "Compare" buttons in Ranking and Pipeline tabs.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2.5">
                      {selectedCandidateIdsForCompare.map(cid => {
                        const cand = rankingList.find(c => (c.application_id || c.session_id || c.id || c.candidate_id) === cid) ||
                                     applications.find(a => (a.id || a.application_id || a.candidate_id) === cid);
                        const name = cand?.candidate_name || cand?.full_name || 'Candidate';
                        const role = cand?.job_title || cand?.role;
                        return (
                          <div key={cid} className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/80 border border-indigo-200 dark:border-indigo-800 text-indigo-900 dark:text-indigo-200 text-xs font-bold">
                            <div className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px]">
                              {name.slice(0, 1)}
                            </div>
                            <span>{name}{role ? ` (${role})` : ''}</span>
                            <button
                              onClick={() => toggleCandidateForCompare(cid)}
                              className="text-indigo-400 hover:text-rose-500 cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Candidate Selector Grid */}
                <div className="mt-6">
                  <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider mb-3">Available Candidates in Talent Pool</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {(rankingList.length > 0 ? rankingList : applications).slice(0, 12).map((cand: any) => {
                      const cid = cand.application_id || cand.session_id || cand.id || cand.candidate_id;
                      const isSelected = selectedCandidateIdsForCompare.includes(cid);
                      const name = cand.candidate_name || cand.full_name || 'Candidate';
                      return (
                        <div
                          key={cid}
                          onClick={() => toggleCandidateForCompare(cid)}
                          className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                            isSelected
                              ? 'bg-indigo-50/80 dark:bg-indigo-950/40 border-indigo-500 shadow-sm'
                              : 'bg-white dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 hover:border-indigo-300'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs ${
                              isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                            }`}>
                              {isSelected ? <Check className="w-4 h-4" /> : name.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div className="text-xs font-black text-slate-900 dark:text-white">{name}</div>
                              <div className="text-[11px] text-slate-400">{cand.job_title || 'Software Engineer'}</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-xs font-black text-indigo-600 dark:text-indigo-400">
                              {cand.overall_score != null ? `${cand.overall_score}%` : cand.ats_score != null ? `ATS ${cand.ats_score}%` : 'Pending'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SKILL-WISE ANALYTICS TAB */}
          {activeTab === 'skills' && (() => {
            const candidateSkillsList = recruiterSkillData?.candidate_skills || [];
            const filteredCandidateSkills = candidateSkillsList.filter((cand: any) => {
              const matchesSearch = !skillCandidateSearch ||
                cand.candidate_name?.toLowerCase().includes(skillCandidateSearch.toLowerCase()) ||
                cand.email?.toLowerCase().includes(skillCandidateSearch.toLowerCase()) ||
                cand.job_title?.toLowerCase().includes(skillCandidateSearch.toLowerCase());
              const matchesFilter =
                skillStatusFilter === 'all' ||
                (skillStatusFilter === 'evaluated' && cand.evaluated) ||
                (skillStatusFilter === 'pending' && !cand.evaluated);
              return matchesSearch && matchesFilter;
            });

            const currentSelectedCandidate =
              filteredCandidateSkills.find((c: any) => (c.application_id || c.id || c.candidate_id) === selectedSkillCandidateId) ||
              filteredCandidateSkills[0] ||
              null;

            const evaluatedCount = candidateSkillsList.filter((c: any) => c.evaluated).length;
            const pendingCount = candidateSkillsList.filter((c: any) => !c.evaluated).length;

            return (
              <div className="space-y-6">
                <div className="card-luxury p-6 border border-stoneBorder bg-white dark:bg-slate-900 rounded-3xl shadow-sm">
                  {/* Tab Header & View Switcher */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-stoneBorder pb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 border border-teal-200/60 dark:border-teal-800">
                          TALENT MASTERY & COMPETENCY INTELLIGENCE
                        </span>
                      </div>
                      <h3 className="text-xl font-black text-slate-900 dark:text-white mt-1">Skill-Wise Talent Analytics & Mastery</h3>
                      <p className="text-xs text-slate-500 font-semibold mt-0.5">
                        Individual candidate technical skill breakdowns (JavaScript, React, DSA, Python, SQL, System Design) and aggregate benchmark analytics.
                      </p>
                    </div>

                    {/* Mode Toggle Switcher */}
                    <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/80 p-1.5 rounded-2xl">
                      <button
                        onClick={() => setSkillViewMode('candidates')}
                        className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
                          skillViewMode === 'candidates'
                            ? 'bg-white dark:bg-slate-700 text-teal-600 dark:text-teal-400 shadow-xs'
                            : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                        }`}
                      >
                        <Users className="w-3.5 h-3.5" />
                        <span>Per-Candidate Breakdown</span>
                        <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-teal-100 dark:bg-teal-900/60 text-teal-700 dark:text-teal-300">
                          {candidateSkillsList.length}
                        </span>
                      </button>
                      <button
                        onClick={() => setSkillViewMode('matrix')}
                        className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
                          skillViewMode === 'matrix'
                            ? 'bg-white dark:bg-slate-700 text-teal-600 dark:text-teal-400 shadow-xs'
                            : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                        }`}
                      >
                        <BarChart3 className="w-3.5 h-3.5" />
                        <span>Requisition Benchmarks</span>
                      </button>
                    </div>
                  </div>

                  {/* PER-CANDIDATE SKILL ANALYTICS VIEW */}
                  {skillViewMode === 'candidates' && (
                    <div className="space-y-6 mt-6">
                      {/* Search & Filter Bar */}
                      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                        <div className="relative w-full sm:w-72">
                          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            placeholder="Filter candidates, email, or role..."
                            value={skillCandidateSearch}
                            onChange={(e) => setSkillCandidateSearch(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                          />
                        </div>

                        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
                          <button
                            onClick={() => setSkillStatusFilter('all')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                              skillStatusFilter === 'all'
                                ? 'bg-teal-600 text-white shadow-xs'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                            }`}
                          >
                            All ({candidateSkillsList.length})
                          </button>
                          <button
                            onClick={() => setSkillStatusFilter('evaluated')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                              skillStatusFilter === 'evaluated'
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                            }`}
                          >
                            Evaluated ({evaluatedCount})
                          </button>
                          <button
                            onClick={() => setSkillStatusFilter('pending')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                              skillStatusFilter === 'pending'
                                ? 'bg-amber-600 text-white shadow-xs'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                            }`}
                          >
                            Pending Interview ({pendingCount})
                          </button>
                        </div>
                      </div>

                      {filteredCandidateSkills.length === 0 ? (
                        <div className="p-12 text-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-2">
                          <Users className="w-10 h-10 text-teal-400 mx-auto opacity-60" />
                          <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">No Candidates Found</h4>
                          <p className="text-xs text-slate-400 max-w-sm mx-auto">
                            {candidateSkillsList.length === 0
                              ? 'No candidate applications or evaluations registered for this requisition scope yet.'
                              : 'No candidates matched your search or status filter criteria.'}
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-6">
                          {/* Candidate Selection Ribbon */}
                          <div>
                            <p className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2">
                              Select Candidate to View Individual Skill Mastery
                            </p>
                            <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-thin">
                              {filteredCandidateSkills.map((cand: any) => {
                                const cKey = cand.application_id || cand.id || cand.candidate_id;
                                const isSelected = (currentSelectedCandidate?.application_id || currentSelectedCandidate?.id || currentSelectedCandidate?.candidate_id) === cKey;
                                return (
                                  <button
                                    key={cKey}
                                    onClick={() => setSelectedSkillCandidateId(cKey)}
                                    className={`shrink-0 text-left p-3 rounded-2xl border transition-all cursor-pointer w-56 ${
                                      isSelected
                                        ? 'bg-teal-50/80 dark:bg-teal-950/40 border-teal-500 shadow-xs ring-2 ring-teal-500/20'
                                        : 'bg-slate-50/60 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between">
                                      <span className="font-bold text-xs text-slate-900 dark:text-white truncate max-w-[140px]">
                                        {cand.candidate_name}
                                      </span>
                                      {cand.evaluated ? (
                                        <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400">
                                          {cand.overall_score}%
                                        </span>
                                      ) : (
                                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400">
                                          Pending
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-[10px] text-slate-400 truncate mt-0.5">{cand.job_title}</p>
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {/* Selected Candidate Detailed Skill Profile */}
                          {currentSelectedCandidate && (
                            <div className="p-6 rounded-3xl border border-teal-200/60 dark:border-teal-900/60 bg-gradient-to-b from-teal-50/30 to-white dark:from-teal-950/20 dark:to-slate-900 space-y-6">
                              {/* Candidate Header */}
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-teal-100 dark:border-teal-900/50 pb-5">
                                <div className="flex items-center gap-3.5">
                                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-teal-500 to-indigo-600 flex items-center justify-center text-white font-black text-lg shadow-md shrink-0">
                                    {(currentSelectedCandidate.candidate_name || 'C').charAt(0).toUpperCase()}
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <h4 className="text-lg font-black text-slate-900 dark:text-white">
                                        {currentSelectedCandidate.candidate_name}
                                      </h4>
                                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                                        currentSelectedCandidate.evaluated
                                          ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800'
                                          : 'bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-800'
                                      }`}>
                                        {currentSelectedCandidate.evaluated ? '✓ Interview Evaluated' : '⏳ Pending Interview'}
                                      </span>
                                    </div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold mt-0.5">
                                      {currentSelectedCandidate.job_title} • {currentSelectedCandidate.email}
                                    </p>
                                  </div>
                                </div>

                                {/* Score Highlights */}
                                {currentSelectedCandidate.evaluated ? (
                                  <div className="flex items-center gap-3">
                                    <div className="p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center min-w-[95px]">
                                      <div className="text-[10px] font-bold text-slate-400 uppercase">Overall Score</div>
                                      <div className="text-xl font-black text-indigo-600 dark:text-indigo-400 mt-0.5">
                                        {currentSelectedCandidate.overall_score}%
                                      </div>
                                    </div>
                                    <div className="p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center min-w-[95px]">
                                      <div className="text-[10px] font-bold text-slate-400 uppercase">Technical Depth</div>
                                      <div className="text-xl font-black text-teal-600 dark:text-teal-400 mt-0.5">
                                        {currentSelectedCandidate.technical_score}%
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="px-4 py-2 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 text-amber-800 dark:text-amber-300 text-xs font-semibold">
                                    Awaiting interview session to score candidate competencies.
                                  </div>
                                )}
                              </div>

                              {/* Skills Grid */}
                              <div>
                                <div className="flex items-center justify-between mb-4">
                                  <h5 className="text-xs font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">
                                    Core Technology & Skill Mastery Scores
                                  </h5>
                                  <span className="text-xs font-bold text-slate-400">
                                    {currentSelectedCandidate.evaluated
                                      ? `${currentSelectedCandidate.evaluated_skills_count || currentSelectedCandidate.skills.length} Evaluated Skills`
                                      : '0 Evaluated Skills (Pending Interview)'}
                                  </span>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                                  {currentSelectedCandidate.skills.map((sk: any, sIdx: number) => {
                                    const isEval = sk.evaluated && sk.score !== null && sk.score > 0;
                                    const profBadgeStyle =
                                      sk.proficiency === 'Expert'
                                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300'
                                        : sk.proficiency === 'Proficient'
                                        ? 'bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300 border-teal-300'
                                        : sk.proficiency === 'Intermediate'
                                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300 border-amber-300'
                                        : sk.proficiency === 'Needs Practice'
                                        ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border-rose-300'
                                        : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 border-slate-200';

                                    const progressColor =
                                      !isEval ? 'bg-slate-200 dark:bg-slate-700' :
                                      sk.score >= 85 ? 'bg-gradient-to-r from-emerald-500 to-teal-400' :
                                      sk.score >= 70 ? 'bg-gradient-to-r from-teal-500 to-indigo-400' :
                                      sk.score >= 55 ? 'bg-gradient-to-r from-amber-500 to-yellow-400' :
                                      'bg-gradient-to-r from-rose-500 to-orange-400';

                                    return (
                                      <div
                                        key={sIdx}
                                        className="p-4 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/70 space-y-2.5 shadow-xs"
                                      >
                                        <div className="flex items-start justify-between gap-2">
                                          <div>
                                            <h6 className="text-xs font-black text-slate-900 dark:text-white">
                                              {sk.skill}
                                            </h6>
                                            <span className="text-[10px] text-slate-400 font-medium">
                                              {sk.category || 'Competency'}
                                            </span>
                                          </div>
                                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase border ${profBadgeStyle}`}>
                                            {isEval ? sk.proficiency : 'Pending'}
                                          </span>
                                        </div>

                                        <div className="space-y-1">
                                          <div className="flex items-center justify-between text-[11px] font-bold">
                                            <span className="text-slate-400 text-[10px]">Competency Score</span>
                                            <span className={isEval ? 'text-slate-900 dark:text-white font-black' : 'text-slate-400 italic font-medium'}>
                                              {isEval ? `${sk.score}%` : '—'}
                                            </span>
                                          </div>
                                          <div className="w-full bg-slate-100 dark:bg-slate-700/60 rounded-full h-2 overflow-hidden">
                                            <div
                                              style={{ width: `${isEval ? Math.max(8, sk.score) : 4}%` }}
                                              className={`h-full rounded-full transition-all duration-500 ${progressColor}`}
                                            />
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Multi-Candidate Comparative Skill Matrix Table */}
                          <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800">
                            <h4 className="text-sm font-black text-slate-900 dark:text-white mb-3">
                              Candidate Skill Comparison Matrix
                            </h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                              Side-by-side technical skill evaluation across all candidate profiles. Click any row to inspect individual mastery.
                            </p>

                            <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                              <table className="w-full text-left border-collapse min-w-max">
                                <thead>
                                  <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider bg-slate-50 dark:bg-slate-800/60">
                                    <th className="py-3 px-4">Candidate</th>
                                    <th className="py-3 px-4">Role / Requisition</th>
                                    <th className="py-3 px-4 text-center">Status</th>
                                    <th className="py-3 px-4 text-center">Overall</th>
                                    <th className="py-3 px-3 text-center">JavaScript</th>
                                    <th className="py-3 px-3 text-center">React</th>
                                    <th className="py-3 px-3 text-center">DSA</th>
                                    <th className="py-3 px-3 text-center">Python</th>
                                    <th className="py-3 px-3 text-center">SQL</th>
                                    <th className="py-3 px-3 text-center">System Design</th>
                                    <th className="py-3 px-4 text-center">Action</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200/80 dark:divide-slate-800 text-xs font-bold text-slate-900 dark:text-slate-100">
                                  {filteredCandidateSkills.map((cand: any) => {
                                    const getScore = (skillName: string) => {
                                      const found = cand.skills?.find((s: any) => s.skill.toLowerCase().includes(skillName.toLowerCase()));
                                      return found && found.evaluated && found.score !== null && found.score > 0 ? found.score : null;
                                    };

                                    const jsScore = getScore('JavaScript');
                                    const reactScore = getScore('React');
                                    const dsaScore = getScore('Data Structures') || getScore('DSA');
                                    const pyScore = getScore('Python');
                                    const sqlScore = getScore('SQL');
                                    const sysScore = getScore('System Design');

                                    const renderSkillCell = (score: number | null) => {
                                      if (score === null || score === undefined || score <= 0 || isNaN(score)) {
                                        return <span className="text-slate-400 dark:text-slate-500 font-normal">—</span>;
                                      }
                                      const badgeClass =
                                        score >= 80 ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800' :
                                        score >= 65 ? 'bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-400 border-teal-200 dark:border-teal-800' :
                                        'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800';
                                      return (
                                        <span className={`px-2 py-0.5 rounded-lg text-xs font-black border ${badgeClass}`}>
                                          {score}%
                                        </span>
                                      );
                                    };

                                    const candKey = cand.application_id || cand.id || cand.candidate_id;
                                    const isRowSelected = (currentSelectedCandidate?.application_id || currentSelectedCandidate?.id || currentSelectedCandidate?.candidate_id) === candKey;

                                    return (
                                      <tr
                                        key={candKey}
                                        onClick={() => setSelectedSkillCandidateId(candKey)}
                                        className={`cursor-pointer transition-colors ${
                                          isRowSelected
                                            ? 'bg-teal-50/60 dark:bg-teal-950/30'
                                            : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                                        }`}
                                      >
                                        <td className="py-3 px-4">
                                          <div className="font-black text-slate-900 dark:text-white">
                                            {cand.candidate_name}
                                          </div>
                                          <div className="text-[10px] text-slate-400 font-medium">
                                            {cand.email}
                                          </div>
                                        </td>
                                        <td className="py-3 px-4 text-slate-600 dark:text-slate-300 font-semibold">
                                          {cand.job_title}
                                        </td>
                                        <td className="py-3 px-4 text-center">
                                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                                            cand.evaluated
                                              ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400'
                                              : 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400'
                                          }`}>
                                            {cand.evaluated ? 'Evaluated' : 'Pending'}
                                          </span>
                                        </td>
                                        <td className="py-3 px-4 text-center">
                                          {cand.evaluated && cand.overall_score !== null && cand.overall_score > 0 ? (
                                            <span className="text-sm font-black text-indigo-600 dark:text-indigo-400">
                                              {cand.overall_score}%
                                            </span>
                                          ) : (
                                            <span className="text-slate-400">—</span>
                                          )}
                                        </td>
                                        <td className="py-3 px-3 text-center">{renderSkillCell(jsScore)}</td>
                                        <td className="py-3 px-3 text-center">{renderSkillCell(reactScore)}</td>
                                        <td className="py-3 px-3 text-center">{renderSkillCell(dsaScore)}</td>
                                        <td className="py-3 px-3 text-center">{renderSkillCell(pyScore)}</td>
                                        <td className="py-3 px-3 text-center">{renderSkillCell(sqlScore)}</td>
                                        <td className="py-3 px-3 text-center">{renderSkillCell(sysScore)}</td>
                                        <td className="py-3 px-4 text-center">
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setSelectedSkillCandidateId(candKey);
                                            }}
                                            className="px-2.5 py-1 rounded-lg text-xs font-bold bg-teal-50 hover:bg-teal-100 dark:bg-teal-950/60 dark:hover:bg-teal-900/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 cursor-pointer"
                                          >
                                            View
                                          </button>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* REQUISITION CAPABILITY MATRIX (AGGREGATE) VIEW */}
                  {skillViewMode === 'matrix' && (
                    <div className="space-y-6 mt-6">
                      {recruiterSkillData?.total_evaluations === 0 ? (
                        <div className="p-12 text-center rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-2">
                          <BarChart3 className="w-10 h-10 text-teal-400 mx-auto opacity-70" />
                          <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                            No Evaluated Interviews Yet
                          </h4>
                          <p className="text-xs text-slate-500 max-w-md mx-auto">
                            Aggregate competency benchmarks and talent deficits require completed interview evaluations. Once candidates complete their interview sessions, talent pool statistics will appear here.
                          </p>
                        </div>
                      ) : (
                        <>
                          {/* Overview Stat Cards */}
                          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                            <div className="p-4 rounded-2xl bg-teal-50/50 dark:bg-teal-950/30 border border-teal-200/60 dark:border-teal-800/40">
                              <p className="text-[10px] font-bold text-teal-700 dark:text-teal-300 uppercase">Tracked Skills</p>
                              <p className="text-2xl font-black text-teal-900 dark:text-white mt-1">
                                {recruiterSkillData?.total_skills_evaluated || recruiterSkillData?.skills?.length || 0}
                              </p>
                            </div>
                            <div className="p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200/60 dark:border-indigo-800/40">
                              <p className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 uppercase">Top Talent Core</p>
                              <p className="text-xl font-black text-indigo-900 dark:text-white mt-1 truncate">
                                {recruiterSkillData?.top_strengths?.[0]?.skill || (recruiterSkillData?.skills?.[0]?.skill ?? 'Evaluation in progress')}
                              </p>
                            </div>
                            <div className="p-4 rounded-2xl bg-amber-50/50 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40">
                              <p className="text-[10px] font-bold text-amber-700 dark:text-amber-300 uppercase">Talent Deficits</p>
                              <p className="text-2xl font-black text-amber-900 dark:text-white mt-1">
                                {recruiterSkillData?.talent_gaps?.length ?? 0} Identified
                              </p>
                            </div>
                            <div className="p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/40">
                              <p className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 uppercase">Proficient / Expert Ratio</p>
                              <p className="text-2xl font-black text-emerald-900 dark:text-white mt-1">
                                {recruiterSkillData?.expert_ratio || '0.0%'}
                              </p>
                            </div>
                          </div>

                          {/* Skill Distribution Table */}
                          <div>
                            <h4 className="text-sm font-black text-slate-900 dark:text-white mb-4">In-Demand Skill Breakdown & Benchmarks</h4>
                            <div className="overflow-x-auto">
                              <table className="w-full text-left border-collapse min-w-max">
                                <thead>
                                  <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider bg-slate-50 dark:bg-slate-800/50">
                                    <th className="py-3 px-4">Skill / Competency</th>
                                    <th className="py-3 px-4">Category</th>
                                    <th className="py-3 px-4 text-center">Avg Score</th>
                                    <th className="py-3 px-4">Talent Distribution</th>
                                    <th className="py-3 px-4 text-center">Supply Status</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200/80 dark:divide-slate-800 text-xs font-bold text-slate-900 dark:text-slate-100">
                                  {((recruiterSkillData?.skills || recruiterSkillData?.skill_benchmarks || [])).length === 0 ? (
                                    <tr>
                                      <td colSpan={5} className="py-8 text-center text-slate-400 font-medium italic">
                                        No skill evaluations recorded yet for this requisition scope.
                                      </td>
                                    </tr>
                                  ) : (
                                    (recruiterSkillData?.skills || recruiterSkillData?.skill_benchmarks).map((s: any, idx: number) => (
                                      <tr key={idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                                        <td className="py-3.5 px-4 font-black text-slate-900 dark:text-white">{s.skill}</td>
                                        <td className="py-3.5 px-4">
                                          <span className="px-2.5 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-bold">
                                            {s.category || 'Competency'}
                                          </span>
                                        </td>
                                        <td className="py-3.5 px-4 text-center">
                                          <span className="text-sm font-black text-indigo-600 dark:text-indigo-400">{s.average_score}%</span>
                                        </td>
                                        <td className="py-3.5 px-4">
                                          <div className="w-48 h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full flex overflow-hidden">
                                            <div style={{ width: `${s.distribution?.expert || 0}%` }} className="bg-emerald-500" title="Expert" />
                                            <div style={{ width: `${s.distribution?.proficient || 0}%` }} className="bg-indigo-500" title="Proficient" />
                                            <div style={{ width: `${s.distribution?.intermediate || 0}%` }} className="bg-amber-500" title="Intermediate" />
                                            <div style={{ width: `${s.distribution?.needs_practice || 0}%` }} className="bg-rose-500" title="Needs Practice" />
                                          </div>
                                        </td>
                                        <td className="py-3.5 px-4 text-center">
                                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-black ${
                                            (s.status || '').includes('Deficit') || (s.status || '').includes('Scarcity')
                                              ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                                              : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                                          }`}>
                                            {s.status || 'Strong Supply'}
                                          </span>
                                        </td>
                                      </tr>
                                    ))
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* PERFORMANCE TRENDS TAB */}
          {activeTab === 'trends' && (
            <div className="space-y-6">
              <div className="card-luxury p-6 border border-stoneBorder bg-white dark:bg-slate-900 rounded-3xl shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-stoneBorder pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 border border-purple-200/60 dark:border-purple-800">
                        HISTORICAL COHORT PROGRESSION
                      </span>
                    </div>
                    <h3 className="text-xl font-black text-slate-900 dark:text-white mt-1">Recruiter Candidate Performance Trends</h3>
                    <p className="text-xs text-slate-500 font-semibold mt-0.5">
                      Temporal score evolution across applicant evaluation batches, tracking scoring stability and quality velocity.
                    </p>
                  </div>
                </div>

                {/* Cohort Progression Dual-Wave Spline Chart (Matching Reference Image 3) */}
                <div className="mt-6 space-y-4">
                  {(() => {
                    const rawTrends = recruiterTrendData?.trends || recruiterTrendData?.timeline || [];
                    const recruiterDualWaves = rawTrends.length > 0
                      ? rawTrends.map((t: any) => ({
                          label: t.date || t.display_date || 'Batch',
                          primaryValue: t.overall ?? 78,
                          secondaryValue: t.technical ?? 65,
                        }))
                      : [
                          { label: 'Batch 1', primaryValue: 52, secondaryValue: 38 },
                          { label: 'Batch 2', primaryValue: 70, secondaryValue: 48 },
                          { label: 'Batch 3', primaryValue: 62, secondaryValue: 65 },
                          { label: 'Batch 4', primaryValue: 76, secondaryValue: 58 },
                          { label: 'Batch 5', primaryValue: 68, secondaryValue: 80 },
                          { label: 'Batch 6', primaryValue: 84, secondaryValue: 72 },
                          { label: 'Batch 7', primaryValue: 91, secondaryValue: 82 },
                        ];

                    return (
                      <DualWaveSplineChart
                        data={recruiterDualWaves}
                        title="Candidate Cohort Score & Pipeline Velocity Wave"
                        subtitle="Primary Wave: Candidate Overall Evaluation Score • Secondary Wave: Technical Mastery Threshold"
                        primaryLabel="Overall Score Velocity"
                        secondaryLabel="Technical Competency"
                        height={280}
                      />
                    );
                  })()}
                </div>

                {/* Scoring Stability Highlights */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8 pt-6 border-t border-stoneBorder">
                  <div className="p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200/60 dark:border-indigo-800/40">
                    <span className="text-[10px] font-black text-indigo-700 dark:text-indigo-300 uppercase">Scoring Velocity</span>
                    <p className="text-xl font-black text-slate-900 dark:text-white mt-1">{recruiterTrendData?.velocity || '+0.0% / Cycle'}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">Average improvement in incoming candidate match over evaluation cycles</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/40">
                    <span className="text-[10px] font-black text-emerald-700 dark:text-emerald-300 uppercase">Benchmark Pass Rate</span>
                    <p className="text-xl font-black text-slate-900 dark:text-white mt-1">{recruiterTrendData?.pass_rate || '0.0%'}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">Candidates achieving &gt;= 70% threshold on authoritative evaluations</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-amber-50/50 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40">
                    <span className="text-[10px] font-black text-amber-700 dark:text-amber-300 uppercase">Evaluation Consistency</span>
                    <p className="text-xl font-black text-slate-900 dark:text-white mt-1">
                      {(recruiterTrendData?.total_evaluations || 0) > 0 ? `${recruiterTrendData.overall_trend || 'Stable'} (${recruiterTrendData.total_evaluations} evaluated)` : 'No Data'}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">Real-time performance trend tracked across interview sessions</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SHORTLISTING INSIGHTS TAB */}
          {activeTab === 'insights' && (
            <div className="space-y-6">
              <div className="card-luxury p-6 border border-stoneBorder bg-white dark:bg-slate-900 rounded-3xl shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-stoneBorder pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200/60 dark:border-rose-800">
                        AI HIRING INTELLIGENCE
                      </span>
                    </div>
                    <h3 className="text-xl font-black text-slate-900 dark:text-white mt-1">Shortlisting Insights & Recommendations</h3>
                    <p className="text-xs text-slate-500 font-semibold mt-0.5">
                      Algorithmic shortlisting intelligence, qualification benchmark compliance, and top match recommendations.
                    </p>
                  </div>
                </div>

                {/* Top AI Recommendations */}
                <div className="mt-6">
                  {(() => {
                    const recList = (shortlistingInsightsData?.recommendations || shortlistingInsightsData?.top_recommendations || []);
                    return (
                      <>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                          <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider">Top AI Recommended Shortlist Candidates</h4>
                          {recList.length >= 2 && (
                            <button
                              onClick={() => {
                                const topIds = recList.slice(0, 4).map((r: any) => r.application_id || r.session_id || r.candidate_id);
                                setSelectedCandidateIdsForCompare(topIds);
                                setIsCompareModalOpen(true);
                              }}
                              className="px-3.5 py-1.5 rounded-xl text-xs font-black bg-indigo-600 hover:bg-indigo-500 text-white shadow-xs flex items-center gap-1.5 transition-all cursor-pointer w-fit"
                            >
                              <GitCompare className="w-3.5 h-3.5" />
                              <span>Compare Top Recommended ({Math.min(recList.length, 4)})</span>
                            </button>
                          )}
                        </div>

                        {(!shortlistingInsightsData?.has_data || recList.length === 0) ? (
                          <div className="p-8 text-center rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-2">
                            <Sparkles className="w-8 h-8 text-indigo-500 mx-auto opacity-80" />
                            <h5 className="text-sm font-bold text-slate-800 dark:text-slate-200">No Evaluated Candidates Yet</h5>
                            <p className="text-xs text-slate-500 max-w-md mx-auto">
                              Algorithmic shortlisting intelligence and qualification recommendations require completed candidate interview sessions. Once candidates undergo technical or mock assessments, AI shortlisting rankings will automatically generate here.
                            </p>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {recList.map((rec: any, idx: number) => {
                              const recId = rec.application_id || rec.session_id || rec.candidate_id;
                              const isSelected = selectedCandidateIdsForCompare.includes(recId);
                              return (
                                <div key={idx} className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-3">
                                  <div className="flex items-start justify-between">
                                    <div>
                                      <div className="flex items-center gap-2">
                                        <h5 className="font-black text-slate-900 dark:text-white text-sm">{rec.candidate_name}</h5>
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                                          (rec.fit_tier || '').includes('Top')
                                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                            : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300'
                                        }`}>
                                          {rec.fit_tier || 'Top Match'}
                                        </span>
                                      </div>
                                      <p className="text-[11px] text-slate-500 font-semibold">{rec.job_title}</p>
                                    </div>
                                    <div className="text-right">
                                      <span className="text-base font-black text-indigo-600 dark:text-indigo-400">{rec.overall_score}%</span>
                                      <div className="text-[10px] text-slate-400 font-bold">Overall Score</div>
                                    </div>
                                  </div>

                                  <p className="text-xs text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
                                    "{rec.recommendation_reason || rec.match_reason}"
                                  </p>

                                  <div className="flex flex-wrap gap-1.5 pt-1">
                                    {(rec.key_strengths || []).map((st: string, sIdx: number) => (
                                      <span key={sIdx} className="px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold">
                                        ✓ {st}
                                      </span>
                                    ))}
                                  </div>

                                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                                    <button
                                      onClick={() => {
                                        if (isSelected && selectedCandidateIdsForCompare.length >= 2) {
                                          setIsCompareModalOpen(true);
                                        } else {
                                          toggleCandidateForCompare(recId, true);
                                        }
                                      }}
                                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                                        isSelected
                                          ? 'bg-indigo-600 text-white shadow-xs'
                                          : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600'
                                      }`}
                                    >
                                      <GitCompare className="w-3.5 h-3.5" />
                                      <span>{isSelected ? (selectedCandidateIdsForCompare.length >= 2 ? 'View Comparison' : 'Selected (1/2)') : 'Compare'}</span>
                                    </button>
                                    <button
                                      onClick={() => handleShortlistCandidate(rec.candidate_id)}
                                      className="px-3.5 py-1.5 rounded-xl text-xs font-black bg-indigo-600 hover:bg-indigo-500 text-white shadow-xs cursor-pointer"
                                    >
                                      Shortlist Now
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Floating Side-by-Side Comparison Dock */}
        {selectedCandidateIdsForCompare.length > 0 && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900/95 dark:bg-indigo-950/95 backdrop-blur-md text-white px-6 py-3 rounded-2xl border border-indigo-500/40 shadow-2xl flex items-center gap-4 animate-in fade-in slide-in-from-bottom duration-200">
            <div className="flex items-center gap-2">
              <GitCompare className="w-4 h-4 text-indigo-400" />
              <span className="text-xs font-black">
                {selectedCandidateIdsForCompare.length} Candidate{selectedCandidateIdsForCompare.length > 1 ? 's' : ''} Selected for Comparison
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsCompareModalOpen(true)}
                disabled={selectedCandidateIdsForCompare.length < 2}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-black transition-all shadow-md cursor-pointer"
              >
                {selectedCandidateIdsForCompare.length < 2 ? 'Select 1 More' : `Compare Selected (${selectedCandidateIdsForCompare.length})`}
              </button>
              <button
                onClick={() => setSelectedCandidateIdsForCompare([])}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Clear
              </button>
            </div>
          </div>
        )}

      </main>

      {/* Modals & Dialogs */}
      <CandidateComparisonModal
        isOpen={isCompareModalOpen}
        onClose={() => setIsCompareModalOpen(false)}
        candidateIds={selectedCandidateIdsForCompare}
        jobId={rankingJobFilter !== 'all' ? rankingJobFilter : undefined}
        onShortlist={(cid) => handleShortlistCandidate(cid)}
        onSchedule={(cand) => {
          setSelectedCandidateForSchedule(cand);
          setScheduleModalMode('interview');
          setIsScheduleModalOpen(true);
        }}
        onViewProfile={(cid) => {
          setSelectedProfileCandidateId(cid);
          setIsProfileModalOpen(true);
        }}
        onViewReport={(sid) => {
          setSelectedEvaluationId(sid);
          setIsEvaluationModalOpen(true);
        }}
      />

      <CreateJobModal
        isOpen={isCreateModalOpen}
        onClose={() => { setIsCreateModalOpen(false); setSelectedJobForEdit(null); }}
        onSuccess={() => { fetchRecruiterData(); setIsCreateModalOpen(false); setSelectedJobForEdit(null); }}
        initialData={selectedJobForEdit}
      />

      <ScheduleInterviewModal
        isOpen={isScheduleModalOpen}
        onClose={() => setIsScheduleModalOpen(false)}
        onSuccess={() => { fetchRecruiterData(); setIsScheduleModalOpen(false); }}
        defaultMode={scheduleModalMode}
        defaultRoundType={scheduleModalRound}
        defaultJobId={selectedCandidateForSchedule?.job_id}
        defaultCandidateId={selectedCandidateForSchedule?.candidate_id || selectedCandidateForSchedule?.id}
      />

      <SendOfferModal
        isOpen={isOfferModalOpen}
        onClose={() => { setIsOfferModalOpen(false); setSelectedApplicationForOffer(null); }}
        onSuccess={() => { fetchRecruiterData(); setIsOfferModalOpen(false); setSelectedApplicationForOffer(null); }}
        application={selectedApplicationForOffer}
      />

      <EvaluationReportModal
        isOpen={isEvaluationModalOpen}
        onClose={() => { setIsEvaluationModalOpen(false); setSelectedEvaluationId(null); }}
        evaluationId={selectedEvaluationId}
        onPipelineUpdate={() => fetchRecruiterData()}
      />

      <CandidateProfileModal
        candidateId={selectedProfileCandidateId}
        isOpen={isProfileModalOpen}
        onClose={() => { setIsProfileModalOpen(false); setSelectedProfileCandidateId(null); }}
        onUpdate={() => fetchRecruiterData()}
      />

      <JobDetailsModal
        isOpen={!!selectedJobForView}
        onClose={() => setSelectedJobForView(null)}
        job={selectedJobForView}
      />

      {/* Send Message Dialog */}
      {isMessageModalOpen && messageCandidate && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-2xl w-full max-w-md space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-black text-slate-900">Send Message to Candidate</h3>
              <button onClick={() => setIsMessageModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer">
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-600 mb-1">To: {messageCandidate.candidate_name || messageCandidate.full_name || 'Candidate'} ({messageCandidate.candidate_email || messageCandidate.email})</p>
              <input
                type="text"
                value={messageSubject}
                onChange={(e) => setMessageSubject(e.target.value)}
                placeholder="Message Subject"
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 mb-3"
              />
              <textarea
                rows={4}
                value={messageBody}
                onChange={(e) => setMessageBody(e.target.value)}
                placeholder="Write your message here..."
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button onClick={() => setIsMessageModalOpen(false)} className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 cursor-pointer">
                Cancel
              </button>
              <button onClick={handleSendMessage} className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 cursor-pointer">
                Send Message
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
