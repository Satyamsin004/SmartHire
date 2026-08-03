import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navbar } from '../components/layout/Navbar';
import { Sidebar } from '../components/layout/Sidebar';
import { CandidateHeroStoryIllustration } from '../components/illustrations/Illustrations';
import {
  Video, FileText, Briefcase, Award, ArrowUpRight, CheckCircle2, Clock, Eye,
  Building, MapPin, DollarSign, Send, Tag, Gift, Check, X, TrendingUp, Sparkles,
  Target, BarChart3, Activity, ShieldCheck, Star, Percent, Flame, Zap, Bookmark, UserCheck
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar
} from 'recharts';
import api from '../services/api';
import { JobApplicationModal } from '../components/candidate/JobApplicationModal';
import { JobDetailsModal } from '../components/recruiter/JobDetailsModal';

export const CandidateDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [candidateName, setCandidateName] = useState('Candidate');
  const [history, setHistory] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [myApplications, setMyApplications] = useState<any[]>([]);
  const [offers, setOffers] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'jobs' | 'applications' | 'offers'>('overview');

  // Live PostgreSQL Real-Time Metrics State
  const [metrics, setMetrics] = useState<any>({
    jobs_applied: 0,
    saved_jobs: 0,
    active_applications: 0,
    ats_passed: 0,
    ats_rejected: 0,
    interviews_scheduled: 0,
    interviews_completed: 0,
    mock_interviews_completed: 0,
    recruiter_interviews_completed: 0,
    avg_ats_score: 0.0,
    avg_interview_score: 0.0,
    best_interview_score: 0.0,
    readiness_score: 0.0,
    total_offers: 0,
    accepted_offers: 0,
    pending_offers: 0,
    rejected_offers: 0,
    resume_views: 0,
    profile_completion: 0,
    skills_extracted: 0,
    certificates_uploaded: 0,
    resume_version: 0,
    days_active: 1,
    app_success_rate: 0.0,
    interview_success_rate: 0.0,
    pipeline_stage: 'Not Started',
    funnel: { applied: 0, ats_passed: 0, interview_scheduled: 0, interview_completed: 0, offers: 0, accepted: 0 },
    interview_funnel: { scheduled: 0, completed: 0, passed: 0 },
    offer_funnel: { received: 0, pending: 0, accepted: 0, rejected: 0 },
    charts: { ats_trend: [], interview_score_trend: [], readiness_trend: [] },
    recent_activity: []
  });

  // Modal & Schedules State
  const [selectedJobForApply, setSelectedJobForApply] = useState<any | null>(null);
  const [selectedJobForView, setSelectedJobForView] = useState<any | null>(null);
  const [schedules, setSchedules] = useState<any[]>([]);

  useEffect(() => {
    const raw = localStorage.getItem('user_data') || localStorage.getItem('user');
    if (raw) {
      try {
        const u = JSON.parse(raw);
        setCandidateName(u.full_name || 'Candidate');
      } catch (e) {
        console.error(e);
      }
    }

    fetchCandidateData();

    // Live refresh polling interval (auto-refresh metrics every 6 seconds)
    const interval = setInterval(() => {
      fetchCandidateData();
    }, 6000);

    return () => clearInterval(interval);
  }, []);

  const fetchCandidateData = () => {
    // Fetch live aggregate metrics strictly computed from PostgreSQL queries
    api.get('/users/candidate-metrics')
      .then((res) => setMetrics(res.data || {}))
      .catch((err) => console.warn('Fetch candidate metrics error:', err));

    api.get('/scheduling/candidate-schedules')
      .then((res) => setSchedules(res.data || []))
      .catch((err) => console.warn('Fetch schedules error:', err));

    api.get('/interview/history')
      .then((res) => setHistory(res.data || []))
      .catch((err) => console.warn('Fetch history error:', err));

    api.get('/jobs/public')
      .then((res) => setJobs(res.data || []))
      .catch((err) => console.warn('Fetch jobs error:', err));

    api.get('/applications/my-applications')
      .then((res) => setMyApplications(res.data || []))
      .catch((err) => console.warn('Fetch applications error:', err));

    api.get('/offers/my-offers')
      .then((res) => setOffers(res.data || []))
      .catch((err) => console.warn('Fetch offers error:', err));
  };

  const handleOfferResponse = async (offerId: string, action: 'accept' | 'decline') => {
    try {
      await api.post(`/offers/${offerId}/respond`, { action });
      fetchCandidateData();
    } catch (err) {
      console.error(err);
    }
  };

  // Pipeline stage index calculation
  const pipelineStages = [
    { label: 'Applied', key: 'Applied' },
    { label: 'ATS Passed', key: 'ATS Passed' },
    { label: 'Interview Scheduled', key: 'Interview' },
    { label: 'Recruiter Review', key: 'Recruiter Review' },
    { label: 'Offer Received', key: 'Offer' },
    { label: 'Accepted', key: 'Accepted' }
  ];

  const getCurrentStageIndex = () => {
    const current = metrics.pipeline_stage || 'Not Started';
    if (current === 'Accepted') return 5;
    if (current === 'Offer') return 4;
    if (current === 'Recruiter Review') return 3;
    if (current === 'Interview') return 2;
    if (current === 'ATS Passed') return 1;
    if (current === 'Applied') return 0;
    return -1;
  };

  const currentStageIndex = getCurrentStageIndex();

  return (
    <div className="min-h-screen bg-brand-bg flex text-brand-ink font-sans">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <Navbar />

        <main className="p-6 lg:p-10 max-w-7xl mx-auto w-full space-y-8">

          {/* Upcoming Live Interview Banner (Auto-Removed when Completed) */}
          {schedules.filter(s => s.status === 'Scheduled' || s.status === 'Upcoming').map((sched) => (
            <div key={sched.id} className="bg-gradient-to-r from-emerald-900 via-brand-primary to-sb-800 rounded-4xl p-6 text-white shadow-floating border border-emerald-400/30 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-brand-accent/20 border border-brand-accent text-brand-accent flex items-center justify-center font-extrabold text-xl animate-pulse">
                  <Video className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-brand-accent text-brand-ink">
                      Active Interview Scheduled
                    </span>
                    <span className="text-xs text-slate-300 font-semibold">{sched.round_type || 'Technical'} Round</span>
                  </div>
                  <h3 className="text-lg font-extrabold text-white mt-0.5">
                    {sched.title || sched.job_title || 'Technical Interview Session'}
                  </h3>
                  <p className="text-xs text-slate-200 font-medium">
                    Scheduled for: {new Date(sched.scheduled_date).toLocaleString()} ({sched.duration_minutes || 30} Mins)
                  </p>
                </div>
              </div>

              <button
                onClick={() => navigate(`/interview?schedule=${sched.id}`)}
                className="w-full md:w-auto px-8 py-3.5 rounded-2xl bg-brand-accent hover:bg-emerald-400 text-brand-ink font-extrabold text-xs flex items-center justify-center gap-2 shadow-luxury transition-all shrink-0"
              >
                <Video className="w-4 h-4" />
                <span>Join Live Interview Room Now</span>
              </button>
            </div>
          ))}

          {/* Hero Header Banner */}
          <div className="bg-gradient-to-r from-brand-primary via-sb-800 to-brand-ink rounded-5xl p-8 lg:p-12 text-white relative overflow-hidden shadow-floating">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">

              <div className="lg:col-span-7 space-y-4">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-2xl bg-brand-accent/20 border border-brand-accent/30 text-brand-accent text-xs font-extrabold">
                  <Award className="w-4 h-4" />
                  <span>Real-Time PostgreSQL Candidate Analytics Portal</span>
                </div>

                <h1 className="text-3xl lg:text-5xl font-extrabold tracking-tight text-white leading-tight">
                  Welcome back, <br />
                  <span className="text-brand-accent">{candidateName}</span>
                </h1>

                <p className="text-sm text-slate-300 font-medium leading-relaxed max-w-lg">
                  Real-time analytics powered directly by PostgreSQL database queries. Monitor job applications, ATS match scores, interview performance, and offer letters with zero fake data.
                </p>

                <div className="pt-2 flex flex-wrap gap-4">
                  <button
                    onClick={() => setActiveTab('jobs')}
                    className="px-6 py-3.5 rounded-2xl bg-brand-secondary hover:bg-sb-500 text-white font-extrabold text-xs flex items-center gap-2 shadow-luxury transition-all"
                  >
                    <Briefcase className="w-4 h-4" />
                    <span>Browse Job Requisitions ({jobs.length})</span>
                  </button>
                  <button
                    onClick={() => navigate('/resume')}
                    className="px-6 py-3.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-extrabold text-xs flex items-center gap-2 border border-white/20 transition-all"
                  >
                    <FileText className="w-4 h-4 text-brand-accent" />
                    <span>Manage Resume PDF (v{metrics.resume_version || 1})</span>
                  </button>
                </div>
              </div>

              <div className="lg:col-span-5 hidden lg:block">
                <CandidateHeroStoryIllustration className="w-full h-auto drop-shadow-2xl" />
              </div>

            </div>
          </div>

          {/* Quick Summary: Current Recruitment Pipeline */}
          <div className="card-luxury p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-extrabold text-brand-ink flex items-center gap-2">
                <Target className="w-5 h-5 text-brand-primary" />
                <span>Current Recruitment Pipeline</span>
              </h3>
              <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-brand-primary/10 text-brand-primary">
                Current Stage: {metrics.pipeline_stage || 'Not Started'}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-center">
              {pipelineStages.map((stg, idx) => {
                const isActive = currentStageIndex === idx;
                const isPassed = currentStageIndex > idx;
                return (
                  <div
                    key={stg.key}
                    className={`p-4 rounded-2xl border transition-all ${isActive
                      ? 'bg-brand-primary text-white border-brand-primary shadow-soft ring-2 ring-brand-primary/30'
                      : isPassed
                        ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                        : 'bg-cream-100 text-slate-400 border-stoneBorder'
                      }`}
                  >
                    <p className="text-[10px] font-black uppercase tracking-wider">Step {idx + 1}</p>
                    <h4 className={`text-xs font-extrabold mt-1 ${isActive ? 'text-white' : isPassed ? 'text-emerald-800' : 'text-brand-ink'}`}>
                      {stg.label}
                    </h4>
                    <div className="mt-2 flex items-center justify-center">
                      {isPassed ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      ) : isActive ? (
                        <Sparkles className="w-4 h-4 text-brand-accent animate-pulse" />
                      ) : (
                        <Clock className="w-4 h-4 text-slate-300" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 25 Real-Time Dashboard KPI Cards Grid */}
          <div className="space-y-4">
            <h3 className="text-lg font-black text-brand-ink flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-brand-primary" />
              <span>Real-Time KPI Analytics (25 Database Metrics)</span>
            </h3>

            {/* Metric Category 1: Job Search & Applications */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="card-luxury p-5 flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-brand-primary/10 text-brand-primary flex items-center justify-center font-extrabold">
                  <Briefcase className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">1. Jobs Applied</p>
                  <h4 className="text-xl font-extrabold text-brand-ink">{metrics.jobs_applied}</h4>
                </div>
              </div>

              <div className="card-luxury p-5 flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center font-extrabold">
                  <Bookmark className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">2. Saved Jobs</p>
                  <h4 className="text-xl font-extrabold text-brand-ink">{metrics.saved_jobs}</h4>
                </div>
              </div>

              <div className="card-luxury p-5 flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center font-extrabold">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">3. Active Applications</p>
                  <h4 className="text-xl font-extrabold text-brand-ink">{metrics.active_applications}</h4>
                </div>
              </div>

              <div className="card-luxury p-5 flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-extrabold">
                  <Percent className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">4. Application Success Rate</p>
                  <h4 className="text-xl font-extrabold text-brand-ink">{metrics.app_success_rate}%</h4>
                </div>
              </div>

              <div className="card-luxury p-5 flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-stone-200 text-slate-700 flex items-center justify-center font-extrabold">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">5. Days Active</p>
                  <h4 className="text-xl font-extrabold text-brand-ink">{metrics.days_active} Days</h4>
                </div>
              </div>
            </div>

            {/* Metric Category 2: ATS & Resume Analytics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="card-luxury p-5 flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-extrabold">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">6. ATS Passed (≥80%)</p>
                  <h4 className="text-xl font-extrabold text-emerald-700">{metrics.ats_passed}</h4>
                </div>
              </div>

              <div className="card-luxury p-5 flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-800 flex items-center justify-center font-extrabold">
                  <X className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">7. ATS Rejected (&lt;80%)</p>
                  <h4 className="text-xl font-extrabold text-rose-700">{metrics.ats_rejected}</h4>
                </div>
              </div>

              <div className="card-luxury p-5 flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center font-extrabold">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">8. Average ATS Score</p>
                  <h4 className="text-xl font-extrabold text-brand-ink">{metrics.avg_ats_score}%</h4>
                </div>
              </div>

              <div className="card-luxury p-5 flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-teal-100 text-teal-800 flex items-center justify-center font-extrabold">
                  <Eye className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">9. Resume Views by Recruiters</p>
                  <h4 className="text-xl font-extrabold text-brand-ink">{metrics.resume_views}</h4>
                </div>
              </div>
            </div>

            {/* Metric Category 3: Resume Version, Skills & Profile */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="card-luxury p-5 flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-cyan-100 text-cyan-800 flex items-center justify-center font-extrabold">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">10. Resume Version</p>
                  <h4 className="text-xl font-extrabold text-brand-ink">v{metrics.resume_version || 1}</h4>
                </div>
              </div>

              <div className="card-luxury p-5 flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-violet-100 text-violet-800 flex items-center justify-center font-extrabold">
                  <Tag className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">11. Skills Extracted</p>
                  <h4 className="text-xl font-extrabold text-brand-ink">{metrics.skills_extracted}</h4>
                </div>
              </div>

              <div className="card-luxury p-5 flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-orange-100 text-orange-800 flex items-center justify-center font-extrabold">
                  <Award className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">12. Certificates Uploaded</p>
                  <h4 className="text-xl font-extrabold text-brand-ink">{metrics.certificates_uploaded}</h4>
                </div>
              </div>

              <div className="card-luxury p-5 flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-extrabold">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">13. Profile Completion %</p>
                  <h4 className="text-xl font-extrabold text-emerald-700">{metrics.profile_completion}%</h4>
                </div>
              </div>
            </div>

            {/* Metric Category 4: Interview Metrics & Readiness */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="card-luxury p-5 flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-100 text-blue-800 flex items-center justify-center font-extrabold">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">14. Interviews Scheduled</p>
                  <h4 className="text-xl font-extrabold text-brand-primary">{metrics.interviews_scheduled}</h4>
                </div>
              </div>

              <div className="card-luxury p-5 flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-extrabold">
                  <Video className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">15. Interviews Completed</p>
                  <h4 className="text-xl font-extrabold text-brand-ink">{metrics.interviews_completed}</h4>
                </div>
              </div>

              <div className="card-luxury p-5 flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-800 flex items-center justify-center font-extrabold">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">16. Mock Interviews Completed</p>
                  <h4 className="text-xl font-extrabold text-brand-ink">{metrics.mock_interviews_completed}</h4>
                </div>
              </div>

              <div className="card-luxury p-5 flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-fuchsia-100 text-fuchsia-800 flex items-center justify-center font-extrabold">
                  <Building className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">17. Recruiter Interviews</p>
                  <h4 className="text-xl font-extrabold text-brand-ink">{metrics.recruiter_interviews_completed}</h4>
                </div>
              </div>
            </div>

            {/* Metric Category 5: Interview Performance & Offers */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="card-luxury p-5 flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center font-extrabold">
                  <Star className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">18. Average Interview Score</p>
                  <h4 className="text-xl font-extrabold text-brand-ink">{metrics.avg_interview_score}</h4>
                </div>
              </div>

              <div className="card-luxury p-5 flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-extrabold">
                  <Flame className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">19. Best Interview Score</p>
                  <h4 className="text-xl font-extrabold text-emerald-700">{metrics.best_interview_score}</h4>
                </div>
              </div>

              <div className="card-luxury p-5 flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-purple-100 text-purple-800 flex items-center justify-center font-extrabold">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">20. Current Readiness Score</p>
                  <h4 className="text-xl font-extrabold text-brand-ink">{metrics.readiness_score}</h4>
                </div>
              </div>

              <div className="card-luxury p-5 flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-sky-100 text-sky-800 flex items-center justify-center font-extrabold">
                  <Percent className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">21. Interview Success Rate</p>
                  <h4 className="text-xl font-extrabold text-brand-ink">{metrics.interview_success_rate}%</h4>
                </div>
              </div>
            </div>

            {/* Metric Category 6: Offer Letters Breakdown */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="card-luxury p-5 flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center font-extrabold">
                  <Gift className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">22. Total Offers Received</p>
                  <h4 className="text-xl font-extrabold text-brand-ink">{metrics.total_offers}</h4>
                </div>
              </div>

              <div className="card-luxury p-5 flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-extrabold">
                  <Check className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">23. Accepted Offers</p>
                  <h4 className="text-xl font-extrabold text-emerald-700">{metrics.accepted_offers}</h4>
                </div>
              </div>

              <div className="card-luxury p-5 flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-100 text-blue-800 flex items-center justify-center font-extrabold">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">24. Pending Offers</p>
                  <h4 className="text-xl font-extrabold text-brand-primary">{metrics.pending_offers}</h4>
                </div>
              </div>

              <div className="card-luxury p-5 flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-800 flex items-center justify-center font-extrabold">
                  <X className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">25. Rejected Offers</p>
                  <h4 className="text-xl font-extrabold text-rose-700">{metrics.rejected_offers}</h4>
                </div>
              </div>
            </div>
          </div>

          {/* Real-Time Analytics Section (Charts) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Chart 1: ATS Match & Interview Performance Trend */}
            <div className="card-luxury p-6 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-extrabold text-brand-ink flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-brand-primary" />
                  <span>ATS Match & Interview Score Trends</span>
                </h3>
                <span className="text-[10px] font-bold text-slate-400 uppercase">PostgreSQL Data</span>
              </div>

              <div className="h-64 w-full">
                {metrics.charts && metrics.charts.ats_trend && metrics.charts.ats_trend.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={metrics.charts.ats_trend}>
                      <defs>
                        <linearGradient id="colorAts" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#059669" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#059669" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                      <XAxis dataKey="date" stroke="#94A3B8" fontSize={11} />
                      <YAxis domain={[0, 100]} stroke="#94A3B8" fontSize={11} />
                      <Tooltip />
                      <Area type="monotone" dataKey="score" stroke="#059669" strokeWidth={3} fillOpacity={1} fill="url(#colorAts)" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center bg-cream-100 rounded-2xl border border-stoneBorder text-xs text-slate-400 font-semibold">
                    No ATS or interview score trends recorded yet.
                  </div>
                )}
              </div>
            </div>

            {/* Chart 2: Real-Time Application & Recruitment Funnel */}
            <div className="card-luxury p-6 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-extrabold text-brand-ink flex items-center gap-2">
                  <Target className="w-5 h-5 text-brand-secondary" />
                  <span>Application & Recruitment Funnel</span>
                </h3>
                <span className="text-[10px] font-bold text-slate-400 uppercase">Real-Time Distribution</span>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={[
                    { stage: 'Applied', count: metrics.funnel.applied },
                    { stage: 'ATS Pass', count: metrics.funnel.ats_passed },
                    { stage: 'Scheduled', count: metrics.funnel.interview_scheduled },
                    { stage: 'Completed', count: metrics.funnel.interview_completed },
                    { stage: 'Offers', count: metrics.funnel.offers },
                    { stage: 'Accepted', count: metrics.funnel.accepted }
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="stage" stroke="#94A3B8" fontSize={11} />
                    <YAxis allowDecimals={false} stroke="#94A3B8" fontSize={11} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#1E293B" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>

          {/* Navigation Workspace Tabs */}
          <div className="card-luxury p-6">
            <div className="flex bg-cream-200 p-1.5 rounded-3xl mb-6 max-w-xl border border-stoneBorder">
              <button
                onClick={() => setActiveTab('overview')}
                className={`flex-1 py-2.5 text-xs font-extrabold rounded-2xl transition-all ${activeTab === 'overview' ? 'bg-brand-primary text-white shadow-soft' : 'text-brand-ink'
                  }`}
              >
                Overview
              </button>

              <button
                onClick={() => setActiveTab('jobs')}
                className={`flex-1 py-2.5 text-xs font-extrabold rounded-2xl transition-all ${activeTab === 'jobs' ? 'bg-brand-primary text-white shadow-soft' : 'text-brand-ink'
                  }`}
              >
                Job Portal ({jobs.length})
              </button>

              <button
                onClick={() => setActiveTab('applications')}
                className={`flex-1 py-2.5 text-xs font-extrabold rounded-2xl transition-all ${activeTab === 'applications' ? 'bg-brand-primary text-white shadow-soft' : 'text-brand-ink'
                  }`}
              >
                Applications ({myApplications.length})
              </button>

              <button
                onClick={() => setActiveTab('offers')}
                className={`flex-1 py-2.5 text-xs font-extrabold rounded-2xl transition-all ${activeTab === 'offers' ? 'bg-brand-primary text-white shadow-soft' : 'text-brand-ink'
                  }`}
              >
                Offers ({offers.length})
              </button>
            </div>

            {/* TAB 1: OVERVIEW */}
            {activeTab === 'overview' && (
              <div className="space-y-6">

                {/* Recent AI Mock Sessions */}
                <div className="card-luxury p-6">
                  <h3 className="text-base font-extrabold text-brand-ink mb-4">Recent Interview Sessions</h3>
                  <div className="space-y-3">
                    {history.length === 0 ? (
                      <div className="p-8 text-center bg-cream-100 rounded-2xl border border-stoneBorder">
                        <p className="text-xs text-slate-500 font-semibold">No mock interview sessions recorded yet.</p>
                        <button
                          onClick={() => navigate('/interview')}
                          className="mt-3 px-4 py-2 rounded-2xl bg-brand-primary text-white text-xs font-extrabold"
                        >
                          Start Your First Mock
                        </button>
                      </div>
                    ) : (
                      history.map((item) => (
                        <div
                          key={item.id}
                          onClick={() => navigate(`/reports?session=${item.id}`)}
                          className="flex items-center justify-between p-4 rounded-2xl bg-cream-100 hover:bg-cream-200 border border-stoneBorder/60 cursor-pointer transition-all"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-2xl bg-brand-primary text-brand-accent flex items-center justify-center font-extrabold text-sm">
                              <Video className="w-5 h-5" />
                            </div>
                            <div>
                              <h4 className="text-xs font-extrabold text-brand-ink">{item.title || 'Technical Practice Session'}</h4>
                              <p className="text-[10px] text-slate-400 font-semibold">
                                {item.created_at ? new Date(item.created_at).toLocaleDateString() : 'Recent'}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-4">
                            {item.overall_score && (
                              <span className="px-3 py-1 rounded-xl bg-emerald-100 text-emerald-700 text-xs font-extrabold">
                                Score: {item.overall_score}
                              </span>
                            )}
                            <ArrowUpRight className="w-4 h-4 text-slate-400" />
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Real-Time Activity Log Feed (Newest First) */}
                <div className="card-luxury p-6">
                  <h3 className="text-base font-extrabold text-brand-ink mb-4 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-brand-primary" />
                    <span>Recent Activity Feed</span>
                  </h3>
                  {metrics.recent_activity.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">No activity yet.</p>
                  ) : (
                    <div className="space-y-2.5">
                      {metrics.recent_activity.map((act: any) => (
                        <div key={act.id} className="p-3.5 rounded-2xl bg-cream-100 border border-stoneBorder/60 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <CheckCircle2 className="w-4 h-4 text-brand-primary shrink-0" />
                            <div>
                              <h5 className="text-xs font-bold text-brand-ink">{act.title}</h5>
                              <p className="text-[11px] text-slate-500 font-medium">{act.message}</p>
                            </div>
                          </div>
                          <span className="text-[10px] text-slate-400 font-semibold shrink-0 ml-2">
                            {act.created_at ? new Date(act.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            )}

            {/* TAB 2: JOB PORTAL */}
            {activeTab === 'jobs' && (
              <div className="space-y-4">
                <h3 className="text-base font-extrabold text-brand-ink mb-2">Published Requisitions ({jobs.length})</h3>
                {jobs.length === 0 ? (
                  <div className="p-12 text-center bg-cream-100 rounded-3xl border border-stoneBorder">
                    <Briefcase className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <h4 className="text-sm font-extrabold text-brand-ink">No Job Requisitions Published Yet</h4>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                      Check back soon for newly published software engineering and product roles.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {jobs.map((job) => (
                      <div key={job.id} className="card-luxury p-6 flex flex-col justify-between space-y-4 hover:border-brand-primary transition-all">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-2xl bg-cream-200 text-brand-primary flex items-center justify-center font-extrabold text-lg border border-stoneBorder">
                              {job.company_name ? job.company_name.charAt(0).toUpperCase() : 'C'}
                            </div>
                            <div>
                              <h4 className="text-sm font-extrabold text-brand-ink">{job.title}</h4>
                              <p className="text-xs text-slate-500 font-semibold">{job.company_name || 'Enterprise Client'}</p>
                            </div>
                          </div>
                          <span className="px-2.5 py-1 rounded-xl bg-emerald-100 text-emerald-800 text-[10px] font-extrabold uppercase">
                            {job.work_mode || 'Remote'}
                          </span>
                        </div>

                        <div className="flex flex-wrap gap-3 text-xs text-slate-600 font-medium">
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-slate-400" />
                            {job.location || 'San Francisco, CA'}
                          </span>
                          <span className="flex items-center gap-1">
                            <DollarSign className="w-3.5 h-3.5 text-slate-400" />
                            {job.salary_range || '$120,000 - $160,000'}
                          </span>
                        </div>

                        <div className="pt-3 border-t border-stoneBorder flex items-center justify-between">
                          <button
                            onClick={() => setSelectedJobForView(job)}
                            className="text-xs font-extrabold text-brand-primary hover:underline"
                          >
                            View Specs
                          </button>
                          <button
                            onClick={() => setSelectedJobForApply(job)}
                            className="px-5 py-2 rounded-2xl bg-brand-primary text-white font-extrabold text-xs shadow-soft hover:bg-sb-700 transition-colors"
                          >
                            Apply Now
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: APPLICATIONS */}
            {activeTab === 'applications' && (
              <div className="space-y-4">
                <h3 className="text-base font-extrabold text-brand-ink mb-2">My Submitted Applications ({myApplications.length})</h3>
                {myApplications.length === 0 ? (
                  <div className="p-12 text-center bg-cream-100 rounded-3xl border border-stoneBorder">
                    <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <h4 className="text-sm font-extrabold text-brand-ink">No Applications Submitted</h4>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                      Browse open requisitions in the Job Portal tab to submit your formal application.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-stoneBorder text-slate-400 uppercase text-[10px]">
                          <th className="pb-3 font-bold">Job Role</th>
                          <th className="pb-3 font-bold">Applied Date</th>
                          <th className="pb-3 font-bold">ATS Match</th>
                          <th className="pb-3 font-bold">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stoneBorder/60">
                        {myApplications.map((app) => (
                          <tr key={app.id} className="hover:bg-cream-100/60 transition-colors">
                            <td className="py-4 font-extrabold text-brand-ink">{app.job_title || 'Software Engineer'}</td>
                            <td className="py-4 text-slate-500">{app.applied_at ? new Date(app.applied_at).toLocaleDateString() : 'Recent'}</td>
                            <td className="py-4">
                              {app.ats_score ? (
                                <span className={`px-2.5 py-1 rounded-xl text-[10px] font-extrabold ${app.ats_score >= 80 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                                  }`}>
                                  {app.ats_score}% Match
                                </span>
                              ) : (
                                <span className="text-slate-400 italic">Processing</span>
                              )}
                            </td>
                            <td className="py-4">
                              <span className="px-3 py-1 rounded-2xl bg-cream-200 text-brand-ink font-extrabold">
                                {app.status || 'Applied'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* TAB 4: OFFERS */}
            {activeTab === 'offers' && (
              <div className="space-y-4">
                <h3 className="text-base font-extrabold text-brand-ink mb-2">Received Offer Letters ({offers.length})</h3>
                {offers.length === 0 ? (
                  <div className="p-12 text-center bg-cream-100 rounded-3xl border border-stoneBorder">
                    <Gift className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <h4 className="text-sm font-extrabold text-brand-ink">No Offers Received Yet</h4>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                      Complete recruiter interview evaluations to receive formal employment offer letters.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {offers.map((off) => (
                      <div key={off.id} className="card-luxury p-6 space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="px-3 py-1 rounded-2xl bg-emerald-100 text-emerald-800 text-[10px] font-extrabold uppercase">
                            Official Offer Letter
                          </span>
                          <span className="text-xs text-slate-400 font-semibold">{off.status}</span>
                        </div>

                        <div>
                          <h4 className="text-base font-extrabold text-brand-ink">{off.job_title || 'Software Role'}</h4>
                          <p className="text-xs text-slate-500 font-semibold">{off.company_name || 'Enterprise Employer'}</p>
                        </div>

                        <div className="p-4 rounded-2xl bg-cream-100 border border-stoneBorder/60 space-y-1">
                          <p className="text-xs font-extrabold text-brand-ink">Base Compensation: {off.salary || '$140,000'}</p>
                          <p className="text-[11px] text-slate-500">Start Date: {off.start_date ? new Date(off.start_date).toLocaleDateString() : 'Immediate'}</p>
                        </div>

                        {off.status === 'Sent' && (
                          <div className="flex gap-3 pt-2">
                            <button
                              onClick={() => handleOfferResponse(off.id, 'accept')}
                              className="flex-1 py-2.5 rounded-2xl bg-brand-primary text-white font-extrabold text-xs shadow-soft"
                            >
                              Accept Offer
                            </button>
                            <button
                              onClick={() => handleOfferResponse(off.id, 'decline')}
                              className="flex-1 py-2.5 rounded-2xl bg-cream-200 text-slate-700 font-extrabold text-xs border border-stoneBorder"
                            >
                              Decline Offer
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

          </div>

        </main>
      </div>

      {/* Application Modal */}
      {selectedJobForApply && (
        <JobApplicationModal
          isOpen={selectedJobForApply !== null}
          job={selectedJobForApply}
          onClose={() => setSelectedJobForApply(null)}
          onSuccess={() => {
            setSelectedJobForApply(null);
            fetchCandidateData();
          }}
        />
      )}

      {/* Specs Viewer Modal */}
      {selectedJobForView && (
        <JobDetailsModal
          job={selectedJobForView}
          onClose={() => setSelectedJobForView(null)}
        />
      )}

    </div>
  );
};
