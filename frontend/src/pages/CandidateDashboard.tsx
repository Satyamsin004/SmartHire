import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Video, FileText, Briefcase, Award, ArrowUpRight, CheckCircle2,
  Clock, MapPin, DollarSign, Activity, Star, Percent, ChevronRight
} from 'lucide-react';
import api from '../services/api';
import { useWebSocket } from '../context/WebSocketContext';
import { JobApplicationModal } from '../components/candidate/JobApplicationModal';
import { JobDetailsModal } from '../components/recruiter/JobDetailsModal';

export const CandidateDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { lastMessage } = useWebSocket();
  const [candidateName, setCandidateName] = useState('Candidate');
  const [history, setHistory] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [myApplications, setMyApplications] = useState<any[]>([]);
  const [offers, setOffers] = useState<any[]>([]);

  // Live PostgreSQL Real-Time Metrics State
  const [metrics, setMetrics] = useState<any>({
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
    const interval = setInterval(() => fetchCandidateData(), 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (lastMessage) {
      fetchCandidateData();
    }
  }, [lastMessage]);

  const fetchCandidateData = async () => {
    // Independent Non-Blocking Widget Fetching via Promise.allSettled
    const results = await Promise.allSettled([
      api.get('/users/candidate-metrics'),
      api.get('/scheduling/candidate-schedules'),
      api.get('/interview/history'),
      api.get('/jobs/public'),
      api.get('/jobs/my-applications'),
      api.get('/offers/my-offers')
    ]);

    // 1. Candidate Metrics
    if (results[0].status === 'fulfilled' && results[0].value?.data) {
      const data = results[0].value.data;
      setMetrics(data);
      if (data.full_name) setCandidateName(data.full_name);
    }

    // 2. Candidate Schedules
    if (results[1].status === 'fulfilled' && results[1].value?.data) {
      setSchedules(results[1].value.data);
    }

    // 3. Interview History
    if (results[2].status === 'fulfilled' && results[2].value?.data) {
      setHistory(results[2].value.data);
    }

    // 4. Public Jobs Requisitions
    if (results[3].status === 'fulfilled' && results[3].value?.data) {
      setJobs(results[3].value.data);
    }

    // 5. Candidate Applications
    if (results[4].status === 'fulfilled' && results[4].value?.data) {
      setMyApplications(results[4].value.data);
    }

    // 6. Candidate Offers
    if (results[5].status === 'fulfilled' && results[5].value?.data) {
      setOffers(results[5].value.data);
    }
  };

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
    <>
      <main className="p-6 lg:p-10 max-w-7xl mx-auto w-full space-y-8 transition-colors duration-300">
        
        {/* Active Interview Banner */}
        {schedules.filter(s => s.status === 'Scheduled' || s.status === 'Upcoming').map((sched) => (
          <div key={sched.id} className="relative overflow-hidden bg-gradient-to-r from-indigo-900 via-indigo-950 to-purple-950 rounded-3xl p-6 text-white shadow-xl border border-indigo-500/30 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="absolute right-0 top-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="flex items-center gap-4 relative z-10">
              <div className="w-14 h-14 rounded-2xl bg-indigo-500/20 border border-indigo-400 text-indigo-300 flex items-center justify-center font-extrabold text-xl animate-pulse shadow-lg">
                <Video className="w-7 h-7" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-400 text-slate-950 shadow-xs">
                    Active Interview Scheduled
                  </span>
                  <span className="text-xs text-indigo-200 font-semibold">{sched.round_type || 'Technical'} Round</span>
                </div>
                <h3 className="text-xl font-black text-white mt-1">
                  {sched.title || sched.job_title || 'Technical Interview Session'}
                </h3>
                <p className="text-xs text-slate-300 font-medium mt-0.5">
                  Scheduled for: {new Date(sched.scheduled_date).toLocaleString()} ({sched.duration_minutes || 30} Mins)
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate(`/interview/lobby?schedule=${sched.id}`)}
              className="relative z-10 w-full md:w-auto px-8 py-3.5 rounded-2xl bg-gradient-to-r from-indigo-400 to-indigo-300 hover:from-indigo-300 hover:to-indigo-200 text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-indigo-900/50 hover:scale-105 transition-all shrink-0 cursor-pointer"
            >
              <Video className="w-4 h-4" />
              <span>Join Live Interview Room Now</span>
            </button>
          </div>
        ))}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Welcome & Quick Actions */}
          <div className="lg:col-span-8 bg-white dark:bg-[#111827] rounded-3xl border border-slate-200/80 dark:border-slate-800 p-8 flex flex-col justify-between shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800">
                  CANDIDATE INTELLIGENCE PORTAL
                </span>
              </div>
              <h1 className="text-2xl lg:text-3xl font-black text-slate-900 dark:text-white tracking-tight mt-2">
                Welcome back, {candidateName}
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-2 leading-relaxed max-w-xl">
                Browse matched enterprise job requisitions, monitor your 8-stage recruitment pipeline in real time, and sharpen your technical skills with AI mock simulations.
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  onClick={() => navigate('/interview/config')}
                  className="px-5 py-2.5 rounded-full bg-slate-900 hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white font-extrabold text-xs flex items-center gap-2 shadow-sm transition-all cursor-pointer hover:scale-105"
                >
                  <Video className="w-4 h-4 text-indigo-400 dark:text-white" />
                  <span>Practice Mock Interview</span>
                </button>
                <button
                  onClick={() => navigate('/jobs')}
                  className="px-5 py-2.5 rounded-full bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-extrabold text-xs flex items-center gap-2 border border-slate-200 dark:border-slate-700 shadow-xs transition-all cursor-pointer hover:scale-105"
                >
                  <Briefcase className="w-4 h-4 text-slate-400" />
                  <span>Browse Jobs</span>
                </button>
                <button
                  onClick={() => navigate('/practice')}
                  className="px-5 py-2.5 rounded-full bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-extrabold text-xs flex items-center gap-2 border border-slate-200 dark:border-slate-700 shadow-xs transition-all cursor-pointer hover:scale-105"
                >
                  <FileText className="w-4 h-4 text-slate-400" />
                  <span>AI Practice Hub</span>
                </button>
              </div>
            </div>
          </div>

          {/* Key Score Cards */}
          <div className="lg:col-span-4 flex flex-col gap-4">
            <div className="bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-900 rounded-3xl p-6 text-white shadow-md relative overflow-hidden h-full flex flex-col justify-center border border-indigo-800/40">
              <div className="absolute -right-4 -top-4 w-32 h-32 bg-indigo-500/20 rounded-full blur-2xl"></div>
              <Star className="w-8 h-8 text-amber-400 mb-3" />
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-200">Readiness Score</p>
              <h2 className="text-4xl font-black mt-1 tracking-tight">{metrics.readiness_score || 0}%</h2>
              <p className="text-xs font-medium text-indigo-200/80 mt-2">Aggregated from mock interviews, speech clarity & ATS ratings.</p>
            </div>
            <div className="bg-white dark:bg-[#111827] rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">Profile Completion</p>
                <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-0.5">{metrics.profile_completion || 0}%</h3>
              </div>
              <div className="w-12 h-12 rounded-full border-4 border-emerald-100 dark:border-emerald-950 flex items-center justify-center relative shadow-inner">
                <span className="text-emerald-600 dark:text-emerald-400 font-black text-xs">{metrics.profile_completion || 0}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Essential Core Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          {[
            { label: 'Jobs Applied', value: metrics.jobs_applied },
            { label: 'Under Review', value: metrics.active_applications, color: 'text-amber-500 dark:text-amber-400' },
            { label: 'ATS Passed', value: metrics.ats_passed, color: 'text-emerald-600 dark:text-emerald-400' },
            { label: 'ATS Rejected', value: metrics.ats_rejected, color: 'text-rose-500 dark:text-rose-400' },
            { label: 'Upcoming', value: metrics.interviews_scheduled, color: 'text-indigo-600 dark:text-indigo-400' },
            { label: 'Completed', value: metrics.interviews_completed, color: 'text-slate-800 dark:text-slate-200' },
            { label: 'Total Offers', value: metrics.total_offers, color: 'text-emerald-600 dark:text-emerald-400' }
          ].map((stat, i) => (
            <div key={i} className="bg-white dark:bg-[#111827] p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col items-center justify-center text-center hover:-translate-y-0.5 transition-all">
              <p className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">{stat.label}</p>
              <h4 className={`text-2xl font-black ${stat.color || 'text-slate-800 dark:text-slate-200'}`}>{stat.value || 0}</h4>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent AI Mock Sessions */}
          <div className="bg-white dark:bg-[#111827] rounded-3xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-xs h-[400px] flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">Recent Evaluation Reports</h3>
              <button onClick={() => navigate('/practice')} className="text-xs text-indigo-600 dark:text-indigo-400 font-bold hover:underline cursor-pointer">View All</button>
            </div>
            <div className="space-y-3 overflow-y-auto custom-scrollbar flex-1 pr-2">
              {history.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400 dark:text-slate-600">
                  <Award className="w-10 h-10 mb-2 opacity-40 text-indigo-400" />
                  <p className="text-xs font-semibold">No evaluation reports generated yet.</p>
                  <p className="text-[11px] text-slate-400 mt-1">Complete an interview session to review your full scorecard.</p>
                </div>
              ) : (
                history.slice(0, 6).map((item) => (
                  <div
                    key={item.session_id || item.id}
                    onClick={() => navigate(`/reports?session=${item.session_id || item.id}`)}
                    className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-100 dark:border-slate-800 cursor-pointer transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                        <Video className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">{item.role_target || item.title || 'Practice Session'}</h4>
                          {item.has_recording && (
                            <span className="px-1.5 py-0.2 rounded bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 text-[9px] font-black uppercase border border-emerald-300 dark:border-emerald-800">
                              🎥 Video
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                          {item.started_at || item.created_at
                            ? new Date(item.started_at || item.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                            : 'Recent'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {item.overall_score !== null && item.overall_score !== undefined && (
                        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black ${item.overall_score >= 80 ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400' : item.overall_score >= 60 ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-400' : 'bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-400'}`}>
                          {item.overall_score}%
                        </span>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/reports?session=${item.session_id || item.id}`);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/80 hover:bg-indigo-100 dark:hover:bg-indigo-900 text-indigo-600 dark:text-indigo-400 text-[10px] font-extrabold flex items-center gap-1 border border-indigo-200 dark:border-indigo-800 transition-colors cursor-pointer"
                      >
                        <Video className="w-3 h-3" />
                        <span>Watch Video & Transcript</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Real-Time Activity Log */}
          <div className="bg-white dark:bg-[#111827] rounded-3xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-xs h-[400px] flex flex-col">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider mb-4 flex items-center gap-2">
              <Activity className="w-4 h-4 text-indigo-500" />
              <span>Real-Time Activity Feed</span>
            </h3>
            <div className="space-y-3 overflow-y-auto custom-scrollbar flex-1 pr-2">
              {metrics.recent_activity?.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400 dark:text-slate-600">
                  <Activity className="w-10 h-10 mb-2 opacity-40 text-indigo-400" />
                  <p className="text-xs font-semibold">No recent activity detected.</p>
                  <p className="text-[11px] text-slate-400 mt-1">Actions you perform will stream here live.</p>
                </div>
              ) : (
                metrics.recent_activity?.map((act: any) => (
                  <div key={act.id} className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 flex items-start gap-3">
                    <div className="mt-0.5"><CheckCircle2 className="w-4 h-4 text-indigo-500" /></div>
                    <div className="flex-1">
                      <h5 className="text-xs font-bold text-slate-800 dark:text-slate-200">{act.title}</h5>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mt-0.5 leading-relaxed">{act.message}</p>
                      <span className="text-[9px] text-slate-400 dark:text-slate-500 font-bold mt-1 block">
                        {act.created_at ? new Date(act.created_at).toLocaleString() : ''}
                      </span>
                    </div>
                  </div>
                ))
              )}
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
