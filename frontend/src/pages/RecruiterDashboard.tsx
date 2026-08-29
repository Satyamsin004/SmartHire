import React, { useState, useEffect } from 'react';
import { RecruiterHiringTeamIllustration } from '../components/illustrations/Illustrations';
import {
  Users, FileText, CheckCircle2, Plus, Send, Briefcase, Eye, Edit3, Copy, XCircle,
  Trash2, Globe, Clock, ChevronRight, Search, Filter, MessageSquare, Star,
  ExternalLink, UserCheck, Download, MapPin, Phone, GraduationCap, Award, Check, Gift, Video,
  Paperclip, BookOpen, ShieldCheck, ShieldAlert, ShieldX, LayoutGrid, List, Sparkles, X
} from 'lucide-react';
import api from '../services/api';
import { useWebSocket } from '../context/WebSocketContext';
import { CreateJobModal } from '../components/recruiter/CreateJobModal';
import { JobDetailsModal } from '../components/recruiter/JobDetailsModal';
import { ScheduleInterviewModal } from '../components/recruiter/ScheduleInterviewModal';
import { SendOfferModal } from '../components/recruiter/SendOfferModal';
import { EvaluationReportModal } from '../components/recruiter/EvaluationReportModal';
import { CandidateProfileModal } from '../components/recruiter/CandidateProfileModal';

export type RecruiterTabType = 'requisitions' | 'applications' | 'shortlisted' | 'evaluations' | 'rejected' | 'offers';

interface RecruiterDashboardProps {
  defaultTab?: RecruiterTabType;
}

export const RecruiterDashboard: React.FC<RecruiterDashboardProps> = ({ defaultTab }) => {
  const { lastMessage } = useWebSocket();
  const [recruiterName, setRecruiterName] = useState('Recruiter');
  const [applications, setApplications] = useState<any[]>([]);
  const [evaluations, setEvaluations] = useState<any[]>([]);
  const [atsRejected, setAtsRejected] = useState<any[]>([]);
  const [myJobs, setMyJobs] = useState<any[]>([]);
  const [jobAnalytics, setJobAnalytics] = useState<any>({ total_jobs: 0, active_jobs: 0, draft_jobs: 0, closed_jobs: 0, total_applications: 0 });
  const [shortlistedCandidates, setShortlistedCandidates] = useState<any[]>([]);
  const [issuedOffers, setIssuedOffers] = useState<any[]>([]);
  
  const [activeTab, setActiveTab] = useState<RecruiterTabType>(defaultTab || 'requisitions');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  
  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [stageFilter, setStageFilter] = useState<string>('all');
  
  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedJobForEdit, setSelectedJobForEdit] = useState<any>(null);
  const [selectedJobForView, setSelectedJobForView] = useState<any>(null);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [scheduleModalMode, setScheduleModalMode] = useState<'assessment' | 'interview'>('assessment');
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
    const raw = localStorage.getItem('user_data') || localStorage.getItem('user');
    if (raw) {
      try {
        const u = JSON.parse(raw);
        setRecruiterName(u.full_name || 'Recruiter');
      } catch (e) {
        console.error(e);
      }
    }

    fetchRecruiterData();
  }, []);

  useEffect(() => {
    if (defaultTab) setActiveTab(defaultTab);
  }, [defaultTab]);

  // Real-time synchronization upon WebSocket message
  useEffect(() => {
    if (lastMessage) {
      fetchRecruiterData();
    }
  }, [lastMessage]);

  const fetchRecruiterData = async () => {
    const results = await Promise.allSettled([
      api.get('/jobs/my-jobs'),
      api.get('/recruiter/applications'),
      api.get('/recruiter/evaluations'),
      api.get('/recruiter/ats-rejected'),
      api.get('/recruiter/shortlisted-candidates'),
      api.get('/recruiter/offers')
    ]);

    if (results[0].status === 'fulfilled' && results[0].value?.data) {
      setMyJobs(results[0].value.data.jobs || []);
      setJobAnalytics(results[0].value.data.analytics || {});
    }

    if (results[1].status === 'fulfilled' && results[1].value?.data) {
      setApplications(results[1].value.data || []);
    }

    if (results[2].status === 'fulfilled' && results[2].value?.data) {
      setEvaluations(results[2].value.data || []);
    }

    if (results[3].status === 'fulfilled' && results[3].value?.data) {
      setAtsRejected(results[3].value.data || []);
    }

    if (results[4].status === 'fulfilled' && results[4].value?.data) {
      setShortlistedCandidates(results[4].value.data || []);
    }

    if (results[5].status === 'fulfilled' && results[5].value?.data) {
      setIssuedOffers(results[5].value.data || []);
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
    const atsScore = app.ats_score !== null && app.ats_score !== undefined ? app.ats_score : 85;
    const isAtsPassed = atsScore >= 80;
    const recAssess = app.recruiter_assessment;
    const recInt = app.recruiter_interview;
    const offer = app.offer_details;

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

    // If ATS Failed
    if (!isAtsPassed) {
      return { text: 'Pipeline Stopped', color: 'bg-slate-100 text-slate-400 border-slate-200', isUpcoming: true };
    }

    const isAssessmentPassed = status.includes('assessment passed') || status.includes('interview') || (recAssess && recAssess.score !== null && recAssess.score >= 70);
    const isAssessmentFailed = status.includes('assessment failed') || (recAssess && recAssess.score !== null && recAssess.score < 70);

    // Stage 3: Online Assessment
    if (stageIdx === 2) {
      if (isAssessmentFailed) {
        return { text: 'Failed (<70%)', color: 'bg-rose-500 text-white border-rose-500', isFailed: true };
      }
      if (isAssessmentPassed) {
        return { text: 'Passed (>=70%)', color: 'bg-emerald-500 text-white border-emerald-500', isDone: true };
      }
      if (status.includes('assessment scheduled')) {
        return { text: 'Assessment Scheduled', color: 'bg-blue-600 text-white border-blue-600 animate-pulse', isCurrent: true };
      }
      return { text: 'Assessment Pending', color: 'bg-amber-500 text-white border-amber-500 animate-pulse', isCurrent: true };
    }

    if (!isAssessmentPassed) {
      if (isAssessmentFailed) {
        return { text: 'Pipeline Stopped', color: 'bg-slate-100 text-slate-400 border-slate-200', isUpcoming: true };
      }
      return { text: 'Upcoming (Assessment Required)', color: 'bg-slate-100 text-slate-400 border-slate-200', isUpcoming: true };
    }

    const isInterviewPassed = status.includes('interview passed') || status.includes('selected') || (recInt && recInt.technical_score !== null && recInt.technical_score >= 70) || (app.overall_score !== null && app.overall_score !== undefined && app.overall_score >= 70);
    const isInterviewFailed = status.includes('interview failed') || (recInt && recInt.technical_score !== null && recInt.technical_score < 70) || (app.overall_score !== null && app.overall_score !== undefined && app.overall_score < 70);

    // Stage 4: Technical Interview
    if (stageIdx === 3) {
      if (isInterviewFailed) {
        return { text: 'Failed (<70%)', color: 'bg-rose-500 text-white border-rose-500', isFailed: true };
      }
      if (isInterviewPassed) {
        return { text: 'Passed (>=70%)', color: 'bg-emerald-500 text-white border-emerald-500', isDone: true };
      }
      if (status.includes('interview scheduled')) {
        return { text: 'Interview Scheduled', color: 'bg-purple-600 text-white border-purple-600 animate-pulse', isCurrent: true };
      }
      return { text: 'Interview Pending', color: 'bg-amber-500 text-white border-amber-500 animate-pulse', isCurrent: true };
    }

    if (!isInterviewPassed) {
      if (isInterviewFailed) {
        return { text: 'Pipeline Stopped', color: 'bg-slate-100 text-slate-400 border-slate-200', isUpcoming: true };
      }
      return { text: 'Upcoming (Interview Required)', color: 'bg-slate-100 text-slate-400 border-slate-200', isUpcoming: true };
    }

    // Stage 5: Behavioral Interview
    if (stageIdx === 4) {
      if (status.includes('behavioral') && (status.includes('passed') || status.includes('completed'))) {
        return { text: 'Completed', color: 'bg-emerald-500 text-white border-emerald-500', isDone: true };
      }
      if (status.includes('behavioral')) {
        return { text: 'Scheduled', color: 'bg-blue-600 text-white border-blue-600 animate-pulse', isCurrent: true };
      }
      return { text: 'Upcoming', color: 'bg-slate-100 text-slate-400 border-slate-200', isUpcoming: true };
    }

    // Stage 6: HR Interview
    if (stageIdx === 5) {
      if (status.includes('hr') && (status.includes('passed') || status.includes('completed'))) {
        return { text: 'Completed', color: 'bg-emerald-500 text-white border-emerald-500', isDone: true };
      }
      if (status.includes('hr')) {
        return { text: 'Scheduled', color: 'bg-blue-600 text-white border-blue-600 animate-pulse', isCurrent: true };
      }
      return { text: 'Upcoming', color: 'bg-slate-100 text-slate-400 border-slate-200', isUpcoming: true };
    }

    // Stage 7: Offer Letter
    if (stageIdx === 6) {
      if (!offer && !status.includes('offer')) {
        return { text: 'Upcoming', color: 'bg-slate-100 text-slate-400 border-slate-200', isUpcoming: true };
      }
      if (offer?.status === 'Accepted' || status.includes('accepted') || status.includes('hired')) {
        return { text: 'Offer Accepted', color: 'bg-emerald-500 text-white border-emerald-500', isDone: true };
      }
      if (offer?.status === 'Rejected' || offer?.status === 'Declined' || status.includes('declined')) {
        return { text: 'Offer Declined', color: 'bg-rose-500 text-white border-rose-500', isFailed: true };
      }
      return { text: 'Offer Released', color: 'bg-amber-500 text-white border-amber-500 animate-pulse', isCurrent: true };
    }

    // Stage 8: Candidate Decision
    if (stageIdx === 7) {
      if (offer?.status === 'Accepted' || status.includes('accepted') || status.includes('hired')) {
        return { text: 'Hired', color: 'bg-emerald-600 text-white border-emerald-600', isDone: true };
      }
      return { text: 'Pending Decision', color: 'bg-slate-100 text-slate-400 border-slate-200', isUpcoming: true };
    }

    return { text: 'Pending', color: 'bg-slate-100 text-slate-400 border-slate-200', isUpcoming: true };
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
    if (stageFilter === 'stage_assess_sched') return st.includes('assessment scheduled');
    if (stageFilter === 'stage_assess_pass') return st.includes('assessment passed');
    if (stageFilter === 'stage_int_sched') return st.includes('interview scheduled');
    if (stageFilter === 'stage_int_pass') return st.includes('interview passed') || st.includes('selected') || item.overall_score != null;
    if (stageFilter === 'stage_rejected') return st.includes('fail') || st.includes('reject');
    return true;
  });

  return (
    <>
      <main className="p-6 lg:p-10 max-w-7xl mx-auto w-full space-y-8 transition-colors duration-300">
        
        {/* Recruiter Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800">
                RECRUITER ENTERPRISE TALENT SUITE
              </span>
            </div>
            <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight mt-2">
              Candidate Pipeline & Talent Management
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => { setSelectedCandidateForSchedule(null); setScheduleModalMode('assessment'); setIsScheduleModalOpen(true); }}
              className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-2 transition-all shadow-md shadow-indigo-600/30 cursor-pointer active:scale-95 hover:scale-105"
            >
              <Plus className="w-4 h-4" />
              <span>Schedule Assessment</span>
            </button>
            <button
              onClick={() => { setSelectedCandidateForSchedule(null); setScheduleModalMode('interview'); setIsScheduleModalOpen(true); }}
              className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center gap-2 transition-all shadow-md shadow-purple-600/30 cursor-pointer active:scale-95 hover:scale-105"
            >
              <Plus className="w-4 h-4" />
              <span>Schedule Interview</span>
            </button>
            <button
              onClick={() => { setSelectedJobForEdit(null); setIsCreateModalOpen(true); }}
              className="px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-indigo-600 hover:bg-slate-800 dark:hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-2 transition-all shadow-md cursor-pointer active:scale-95 hover:scale-105"
            >
              <Plus className="w-4 h-4" />
              <span>Post New Job</span>
            </button>
          </div>
        </div>

        {/* Big Tech Hiring Funnel Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-white dark:bg-[#111827] p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs hover:-translate-y-0.5 transition-all">
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Job Requisitions</p>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white">{myJobs.length}</h3>
          </div>
          <div className="bg-white dark:bg-[#111827] p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs hover:-translate-y-0.5 transition-all">
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Job Applications</p>
            <h3 className="text-2xl font-black text-indigo-600 dark:text-indigo-400">{applications.length}</h3>
          </div>
          <div className="bg-white dark:bg-[#111827] p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs hover:-translate-y-0.5 transition-all">
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">ATS Screened</p>
            <h3 className="text-2xl font-black text-violet-600 dark:text-violet-400">{evaluations.length + atsRejected.length}</h3>
          </div>
          <div className="bg-white dark:bg-[#111827] p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs hover:-translate-y-0.5 transition-all">
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Shortlisted</p>
            <h3 className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{shortlistedCandidates.length}</h3>
          </div>
          <div className="bg-white dark:bg-[#111827] p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs hover:-translate-y-0.5 transition-all">
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Offers Issued</p>
            <h3 className="text-2xl font-black text-amber-600 dark:text-amber-400">
              {issuedOffers.length || applications.filter(a => a.status === 'Offer Sent' || a.status === 'Hired').length}
            </h3>
          </div>
        </div>

        {/* Workspace Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-slate-200/80 dark:border-slate-800 pb-3 overflow-x-auto">
          <button
            onClick={() => setActiveTab('requisitions')}
            className={`px-4 py-2.5 rounded-xl font-extrabold text-xs flex items-center gap-2 transition-all shrink-0 cursor-pointer ${
              activeTab === 'requisitions' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white dark:bg-[#111827] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
            }`}
          >
            <Briefcase className="w-4 h-4" />
            <span>Job Requisitions ({myJobs.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('applications')}
            className={`px-4 py-2.5 rounded-xl font-extrabold text-xs flex items-center gap-2 transition-all shrink-0 cursor-pointer ${
              activeTab === 'applications' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white dark:bg-[#111827] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Applications & Pipeline ({applications.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('shortlisted')}
            className={`px-4 py-2.5 rounded-xl font-extrabold text-xs flex items-center gap-2 transition-all shrink-0 cursor-pointer ${
              activeTab === 'shortlisted' ? 'bg-emerald-600 text-white shadow-md' : 'bg-white dark:bg-[#111827] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Shortlisted Candidates ({shortlistedCandidates.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('evaluations')}
            className={`px-4 py-2.5 rounded-xl font-extrabold text-xs flex items-center gap-2 transition-all shrink-0 cursor-pointer ${
              activeTab === 'evaluations' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white dark:bg-[#111827] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
            }`}
          >
            <Eye className="w-4 h-4" />
            <span>Evaluations & Reports ({evaluations.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('rejected')}
            className={`px-4 py-2.5 rounded-xl font-extrabold text-xs flex items-center gap-2 transition-all shrink-0 cursor-pointer ${
              activeTab === 'rejected' ? 'bg-rose-600 text-white shadow-md' : 'bg-white dark:bg-[#111827] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
            }`}
          >
            <XCircle className="w-4 h-4" />
            <span>ATS Rejected ({atsRejected.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('offers')}
            className={`px-4 py-2.5 rounded-xl font-extrabold text-xs flex items-center gap-2 transition-all shrink-0 cursor-pointer ${
              activeTab === 'offers' ? 'bg-amber-600 text-white shadow-md' : 'bg-white dark:bg-[#111827] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
            }`}
          >
            <Gift className="w-4 h-4" />
            <span>Offer Letters ({issuedOffers.length})</span>
          </button>
        </div>

        {/* Content Section */}
        <div className="space-y-6">
          
          {/* Requisitions Tab */}
          {activeTab === 'requisitions' && (
            <div className="card-luxury p-0 overflow-hidden shadow-soft-lg">
              <div className="p-6 border-b border-stoneBorder flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-black text-brand-ink">Job Requisitions</h3>
                  <p className="text-xs text-slate-500 font-semibold mt-0.5">Manage live job requisitions, requirements, and candidate pipelines.</p>
                </div>
                <button
                  onClick={() => { setSelectedJobForEdit(null); setIsCreateModalOpen(true); }}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create Requisition</span>
                </button>
              </div>

              <div className="overflow-x-auto">
                {myJobs.length === 0 ? (
                  <div className="p-16 text-center text-xs text-slate-500 font-medium">
                    No job requisitions created yet. Click "Post New Job" to create your first requisition.
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse min-w-max">
                    <thead>
                      <tr className="border-b border-stoneBorder text-[10px] font-extrabold text-slate-400 uppercase tracking-wider bg-slate-50/50">
                        <th className="py-4 px-6">Position & Title</th>
                        <th className="py-4 px-4">Department</th>
                        <th className="py-4 px-4">Type & Location</th>
                        <th className="py-4 px-4">Experience</th>
                        <th className="py-4 px-4">Applications</th>
                        <th className="py-4 px-4">Status</th>
                        <th className="py-4 px-6 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stoneBorder/60 text-xs font-bold text-brand-ink">
                      {myJobs.map((job) => (
                        <tr key={job.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-4 px-6">
                            <div className="font-black text-brand-ink">{job.title}</div>
                            <div className="text-[11px] text-slate-400 font-semibold">{job.company_name}</div>
                          </td>
                          <td className="py-4 px-4 text-slate-600">{job.department || 'Engineering'}</td>
                          <td className="py-4 px-4 text-slate-500">
                            <span className="px-2 py-0.5 rounded bg-slate-100 text-[10px] font-bold mr-1.5">{job.job_type}</span>
                            {job.location || 'Remote'}
                          </td>
                          <td className="py-4 px-4 text-slate-600">{job.experience_level || 'Mid-Senior'}</td>
                          <td className="py-4 px-4">
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-200">
                              {job.applications_count || 0} Applied
                            </span>
                          </td>
                          <td className="py-4 px-4">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold ${
                              job.status === 'Active' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600'
                            }`}>
                              {job.status}
                            </span>
                          </td>
                          <td className="py-4 px-6 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => setSelectedJobForView(job)}
                                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs"
                                title="View Requisition Details"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => { setSelectedJobForEdit(job); setIsCreateModalOpen(true); }}
                                className="p-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs"
                                title="Edit Requisition"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
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

          {/* Applications / Pipeline / Evaluations / Rejected Tabs */}
          {(activeTab === 'applications' || activeTab === 'evaluations' || activeTab === 'shortlisted' || activeTab === 'rejected') && (
            <div className="space-y-6">
              
              {/* Filter & View Switcher Bar */}
              <div className="card-luxury p-5 border border-stoneBorder flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative min-w-[280px]">
                    <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search candidates by name, email, or role..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-stoneBorder rounded-xl text-xs font-bold text-brand-ink focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  {activeTab === 'applications' && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        onClick={() => setStageFilter('all')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${stageFilter === 'all' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                      >
                        All ({applications.length})
                      </button>
                      <button
                        onClick={() => setStageFilter('stage_ats')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${stageFilter === 'stage_ats' ? 'bg-amber-600 text-white shadow-xs' : 'bg-amber-50 text-amber-800 hover:bg-amber-100'}`}
                      >
                        Stage 2: ATS Passed
                      </button>
                      <button
                        onClick={() => setStageFilter('stage_assess_sched')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${stageFilter === 'stage_assess_sched' ? 'bg-blue-600 text-white shadow-xs' : 'bg-blue-50 text-blue-800 hover:bg-blue-100'}`}
                      >
                        Stage 3: Assessment
                      </button>
                      <button
                        onClick={() => setStageFilter('stage_int_sched')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${stageFilter === 'stage_int_sched' ? 'bg-purple-600 text-white shadow-xs' : 'bg-purple-50 text-purple-800 hover:bg-purple-100'}`}
                      >
                        Stage 4: Interview
                      </button>
                      <button
                        onClick={() => setStageFilter('stage_int_pass')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${stageFilter === 'stage_int_pass' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'}`}
                      >
                        Passed / Selected
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
                  <button
                    onClick={() => setViewMode('cards')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all ${
                      viewMode === 'cards' ? 'bg-white shadow-xs text-brand-ink' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                    <span>Pipeline Cards</span>
                  </button>
                  <button
                    onClick={() => setViewMode('table')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all ${
                      viewMode === 'table' ? 'bg-white shadow-xs text-brand-ink' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <List className="w-3.5 h-3.5" />
                    <span>Compact Table</span>
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
                    const recAssess = app.recruiter_assessment;
                    const recInt = app.recruiter_interview;
                    const offer = app.offer_details;

                    const initials = ((app.candidate_name || app.full_name || 'Candidate') as string)
                      .split(' ')
                      .map((n: string) => n[0])
                      .join('')
                      .toUpperCase()
                      .slice(0, 2);

                    return (
                      <div
                        key={app.id || i}
                        className="card-luxury p-6 lg:p-7 border border-slate-200/80 bg-white rounded-3xl space-y-6 shadow-sm hover:shadow-md transition-all"
                      >
                        {/* 1. Header: Candidate Info & Job Title */}
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-stoneBorder pb-5">
                          <div className="flex items-start gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-slate-900 text-white font-black text-base flex items-center justify-center shadow-md shadow-indigo-600/20 shrink-0">
                              {initials}
                            </div>
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="text-lg font-black text-brand-ink">
                                  {app.candidate_name || app.full_name || 'Candidate'}
                                </h3>
                                <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-extrabold uppercase">
                                  {app.target_role || app.job_title || 'Software Engineer'}
                                </span>
                                <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-extrabold">
                                  Remote
                                </span>
                              </div>
                              <p className="text-xs text-slate-500 font-semibold flex flex-wrap items-center gap-3">
                                <span>{app.candidate_email || app.email || 'candidate@smarthire.ai'}</span>
                                <span>•</span>
                                <span>{app.company_name || 'SmartHire Enterprise'}</span>
                                <span>•</span>
                                <span>Applied: {app.applied_date || 'Recent'}</span>
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 self-start md:self-center">
                            {/* ATS Match Badge */}
                            <span className={`px-3 py-1 rounded-xl text-xs font-black border flex items-center gap-1.5 ${
                              atsScore >= 80 ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'
                            }`}>
                              <Award className="w-3.5 h-3.5" />
                              <span>ATS Score: {atsScore}% ({atsScore >= 80 ? 'Passed' : 'Below 80%'})</span>
                            </span>

                            {/* Current Hiring Status */}
                            <span className={`px-3 py-1 rounded-xl text-xs font-black border ${
                              st.includes('fail') || st.includes('reject') ? 'bg-rose-50 text-rose-800 border-rose-200' :
                              st.includes('pass') || st.includes('selected') || st.includes('hired') ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                              st.includes('schedule') ? 'bg-indigo-50 text-indigo-800 border-indigo-200' :
                              'bg-purple-50 text-purple-800 border-purple-200'
                            }`}>
                              Current Status: {app.status || 'Applied'}
                            </span>
                          </div>
                        </div>

                        {/* 2. Submitted Resume & Attachments Bar */}
                        <div className="flex items-center justify-between p-3.5 bg-slate-50/80 rounded-2xl border border-slate-100 text-xs font-medium text-slate-600 flex-wrap gap-3">
                          <div className="flex items-center gap-2">
                            <Paperclip className="w-4 h-4 text-indigo-500" />
                            <span>
                              Submitted Resume: <strong className="text-slate-900 font-extrabold">{app.resume_url ? 'Candidate_Resume.pdf' : 'Application_Resume.pdf'}</strong>
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            {app.resume_url && (
                              <a
                                href={app.resume_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-3 py-1 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-extrabold flex items-center gap-1.5 transition-colors cursor-pointer"
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
                              className="px-3 py-1 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-extrabold flex items-center gap-1.5 transition-colors cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Full Candidate Profile</span>
                            </button>
                          </div>
                        </div>

                        {/* 3. Independent Multi-Stage Recruitment Pipeline Stepper */}
                        <div className="space-y-3 pt-1">
                          <div className="flex items-center justify-between">
                            <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                              Independent Recruitment Pipeline
                            </h4>
                            <span className="text-[11px] font-bold text-slate-400">8 Recruiter Stages</span>
                          </div>

                          <div className="overflow-x-auto pb-2 pt-1">
                            <div className="flex items-center gap-2 min-w-[980px]">
                              {PIPELINE_STAGES.map((stage, idx) => {
                                const { text, color, isDone, isCurrent, isFailed } = getStageStatus(app, idx);

                                return (
                                  <React.Fragment key={stage.key}>
                                    <div className={`px-3.5 py-2.5 rounded-2xl text-xs font-black flex items-center gap-2 transition-all whitespace-nowrap border ${color}`}>
                                      <div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0">
                                        {isDone ? <CheckCircle2 className="w-4 h-4" /> :
                                         isFailed ? <X className="w-4 h-4" /> :
                                         isCurrent ? <Clock className="w-4 h-4 animate-spin" /> :
                                         <span className="text-[10px] font-bold opacity-60">{idx + 1}</span>}
                                      </div>
                                      <span>{stage.label}</span>
                                    </div>
                                    {idx < PIPELINE_STAGES.length - 1 && (
                                      <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
                                    )}
                                  </React.Fragment>
                                );
                              })}
                            </div>
                          </div>
                        </div>

                        {/* 4. Stage Telemetry & Recruiter Action Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-1">
                          
                          {/* ONLINE ASSESSMENT (Stage 3) */}
                          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3 flex flex-col justify-between">
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <h5 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                                  <BookOpen className="w-4 h-4 text-indigo-500" /> Online Assessment
                                </h5>
                                <span className="px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-700 text-[10px] font-bold">Stage 3</span>
                              </div>

                              {recAssess ? (
                                <div className="space-y-1.5 text-xs">
                                  <div className="flex justify-between items-center text-slate-600 font-medium">
                                    <span>Status:</span>
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-black ${recAssess.status === 'Completed' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'}`}>
                                      {recAssess.status}
                                    </span>
                                  </div>
                                  {recAssess.score !== null && recAssess.score !== undefined && (
                                    <div className="flex justify-between items-center text-slate-600 font-medium">
                                      <span>Score:</span>
                                      <strong className="text-emerald-600 font-black text-sm">{recAssess.score}%</strong>
                                    </div>
                                  )}
                                  <div className="flex justify-between items-center text-slate-500 text-[11px] font-semibold">
                                    <span>Duration:</span>
                                    <span>{recAssess.duration_minutes || 30} Mins</span>
                                  </div>
                                </div>
                              ) : (
                                <div className="space-y-1 py-1">
                                  <p className="text-xs font-extrabold text-slate-500">Not Scheduled</p>
                                  <p className="text-[11px] text-slate-400 font-medium leading-relaxed">
                                    Aptitude / technical assessment test.
                                  </p>
                                </div>
                              )}
                            </div>

                            <button
                              onClick={() => {
                                setSelectedCandidateForSchedule(app);
                                setScheduleModalMode('assessment');
                                setIsScheduleModalOpen(true);
                              }}
                              className="w-full py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-extrabold transition-all shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>{recAssess ? 'Re-Schedule Assessment' : 'Schedule Assessment'}</span>
                            </button>
                          </div>

                          {/* TECHNICAL INTERVIEW (Stage 4) */}
                          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3 flex flex-col justify-between">
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <h5 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                                  <Video className="w-4 h-4 text-purple-500" /> Technical Interview
                                </h5>
                                <span className="px-2 py-0.5 rounded-md bg-purple-100 text-purple-700 text-[10px] font-bold">Stage 4</span>
                              </div>

                              {app.overall_score !== null && app.overall_score !== undefined ? (
                                <div className="space-y-1.5 text-xs">
                                  <div className="flex justify-between items-center text-slate-600 font-medium">
                                    <span>Overall Score:</span>
                                    <strong className="text-indigo-600 font-black text-sm">{app.overall_score}%</strong>
                                  </div>
                                  <div className="grid grid-cols-3 gap-1 text-[10px] font-bold text-center">
                                    <div className="p-1 bg-white rounded border border-slate-200">
                                      <span className="text-slate-400 block text-[9px]">COMM</span>
                                      <span>{app.communication_score ?? 85}%</span>
                                    </div>
                                    <div className="p-1 bg-white rounded border border-slate-200">
                                      <span className="text-slate-400 block text-[9px]">CONF</span>
                                      <span>{app.confidence_score ?? 85}%</span>
                                    </div>
                                    <div className="p-1 bg-white rounded border border-slate-200">
                                      <span className="text-slate-400 block text-[9px]">TECH</span>
                                      <span>{app.technical_score ?? 85}%</span>
                                    </div>
                                  </div>
                                </div>
                              ) : recInt ? (
                                <div className="space-y-1 text-xs">
                                  <div className="flex justify-between items-center text-slate-600 font-medium">
                                    <span>Status:</span>
                                    <span className="px-2 py-0.5 rounded text-[10px] font-black bg-purple-100 text-purple-800">
                                      {recInt.status || 'Scheduled'}
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-slate-500 font-semibold">
                                    Date: {recInt.scheduled_date || 'Pending'}
                                  </p>
                                </div>
                              ) : (
                                <div className="space-y-1 py-1">
                                  <p className="text-xs font-extrabold text-slate-500">Not Scheduled</p>
                                  <p className="text-[11px] text-slate-400 font-medium leading-relaxed">
                                    AI Technical simulation round.
                                  </p>
                                </div>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => {
                                  setSelectedCandidateForSchedule(app);
                                  setScheduleModalMode('interview');
                                  setIsScheduleModalOpen(true);
                                }}
                                className="flex-1 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-extrabold transition-all shadow-xs cursor-pointer text-center"
                              >
                                {app.overall_score != null ? 'Re-Schedule' : '+ Schedule'}
                              </button>

                              <button
                                onClick={() => {
                                  setSelectedEvaluationId(app.session_id || app.id);
                                  setIsEvaluationModalOpen(true);
                                }}
                                className="p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-indigo-600 font-extrabold transition-all shadow-2xs cursor-pointer"
                                title="Watch Video & Evaluation Report"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          {/* INTEGRITY AUDIT PROCTORING */}
                          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3 flex flex-col justify-between">
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <h5 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                                  <ShieldCheck className="w-4 h-4 text-emerald-600" /> Integrity Audit
                                </h5>
                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase ${
                                  app.integrity_status === 'CLEAN' ? 'bg-emerald-100 text-emerald-800' :
                                  app.integrity_status === 'FLAGGED' ? 'bg-amber-100 text-amber-800' :
                                  app.integrity_status === 'CRITICAL' ? 'bg-rose-100 text-rose-800' :
                                  'bg-slate-200 text-slate-700'
                                }`}>
                                  {app.integrity_status || 'Clean'}
                                </span>
                              </div>

                              <div className="space-y-1 text-xs">
                                <div className="flex justify-between items-center text-slate-600 font-medium">
                                  <span>Integrity Score:</span>
                                  <strong className="text-emerald-600 font-black">{app.integrity_score ?? 100}/100</strong>
                                </div>
                                <div className="flex justify-between items-center text-slate-500 text-[11px] font-semibold">
                                  <span>Logged Incidents:</span>
                                  <span>{app.total_integrity_incidents || 0} violations</span>
                                </div>
                              </div>
                            </div>

                            <button
                              onClick={() => {
                                setSelectedEvaluationId(app.session_id || app.id);
                                setIsEvaluationModalOpen(true);
                              }}
                              className="w-full py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-extrabold transition-all shadow-2xs cursor-pointer flex items-center justify-center gap-1"
                            >
                              <ShieldAlert className="w-3.5 h-3.5 text-indigo-500" />
                              <span>Audit Telemetry</span>
                            </button>
                          </div>

                          {/* OFFER LETTER STATUS (Stage 7) */}
                          <div className="p-4 rounded-2xl bg-amber-50/50 border border-amber-200/80 space-y-3 flex flex-col justify-between">
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <h5 className="text-xs font-black text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
                                  <Gift className="w-4 h-4 text-amber-600" /> Offer Status
                                </h5>
                                <span className="px-2 py-0.5 rounded-md bg-amber-200 text-amber-900 text-[10px] font-bold">Stage 7</span>
                              </div>

                              {offer || st.includes('offer') ? (
                                <div className="space-y-1 text-xs text-amber-950 font-medium">
                                  <div className="flex justify-between items-center">
                                    <span>Status:</span>
                                    <span className="font-extrabold text-emerald-700">{offer?.status || 'Offer Released'}</span>
                                  </div>
                                  <div className="flex justify-between items-center">
                                    <span>Salary:</span>
                                    <strong className="font-black">{offer?.salary_offered || '$120,000'}</strong>
                                  </div>
                                </div>
                              ) : (
                                <div className="space-y-1 py-1">
                                  <p className="text-xs font-extrabold text-amber-800">Not Released</p>
                                  <p className="text-[11px] text-amber-700/80 font-medium leading-relaxed">
                                    Generate official offer upon round completion.
                                  </p>
                                </div>
                              )}
                            </div>

                            <button
                              onClick={() => {
                                setSelectedApplicationForOffer(app);
                                setIsOfferModalOpen(true);
                              }}
                              className="w-full py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-extrabold transition-all shadow-xs cursor-pointer flex items-center justify-center gap-1"
                            >
                              <Gift className="w-3.5 h-3.5" />
                              <span>{offer || st.includes('offer') ? 'Update Offer' : 'Release Offer Letter'}</span>
                            </button>
                          </div>

                        </div>

                        {/* 5. Quick Recruiter Actions Footer */}
                        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-stoneBorder text-xs">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                setMessageCandidate(app);
                                setIsMessageModalOpen(true);
                              }}
                              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold flex items-center gap-1.5 transition-colors cursor-pointer"
                            >
                              <Send className="w-3.5 h-3.5 text-slate-500" />
                              <span>Send Message</span>
                            </button>
                            <button
                              onClick={() => handleShortlistCandidate(app.candidate_id || app.id)}
                              className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-extrabold flex items-center gap-1.5 transition-colors cursor-pointer"
                            >
                              <Star className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Shortlist</span>
                            </button>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                setSelectedEvaluationId(app.session_id || app.id);
                                setIsEvaluationModalOpen(true);
                              }}
                              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                            >
                              <Video className="w-3.5 h-3.5" />
                              <span>Watch Video & View Evaluation Report</span>
                            </button>
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
                      <tr className="border-b border-stoneBorder text-[10px] font-extrabold text-slate-400 uppercase tracking-wider bg-slate-50/50">
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
                    <tbody className="divide-y divide-stoneBorder/60 text-xs font-bold text-brand-ink">
                      {currentList.map((item, i) => {
                        const st = (item.status || 'Applied').toLowerCase();
                        const statusBadgeClass =
                          st.includes('fail') || st.includes('reject') ? 'bg-rose-100 text-rose-800 border border-rose-200' :
                          st.includes('pass') || st.includes('shortlist') || st.includes('selected') || st.includes('hired') ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                          st.includes('schedule') ? 'bg-indigo-100 text-indigo-800 border border-indigo-200' :
                          'bg-slate-100 text-slate-700 border border-slate-200';

                        return (
                          <tr key={item.id || i} className="hover:bg-slate-50/50 transition-colors">
                            <td className="py-4 px-6">
                              <div className="font-black text-brand-ink">{item.candidate_name || item.full_name || 'Candidate'}</div>
                              <div className="text-[11px] text-slate-400 font-semibold">{item.candidate_email || item.email || 'candidate@smarthire.ai'}</div>
                            </td>
                            <td className="py-4 px-4 text-slate-500 font-semibold">{item.job_title || 'Software Engineer'}</td>
                            <td className="py-4 px-4">
                              {item.overall_score != null ? (
                                <span className="font-black text-indigo-600 text-sm">{item.overall_score}%</span>
                              ) : (
                                <span className="text-[10px] text-slate-400 italic font-semibold">Not Evaluated</span>
                              )}
                            </td>
                            <td className="py-4 px-4 text-slate-600 font-semibold">{item.communication_score != null ? `${item.communication_score}%` : 'N/A'}</td>
                            <td className="py-4 px-4 text-slate-600 font-semibold">{item.confidence_score != null ? `${item.confidence_score}%` : 'N/A'}</td>
                            <td className="py-4 px-4 text-slate-600 font-semibold">{item.technical_score != null ? `${item.technical_score}%` : 'N/A'}</td>
                            <td className="py-4 px-4">
                              <span className="font-black text-emerald-600">{item.ats_score != null ? `${item.ats_score}%` : '80%'}</span>
                            </td>
                            <td className="py-4 px-4">
                              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                                item.integrity_status === 'CLEAN' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
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
                                  className="px-2.5 py-1 text-[10px] font-extrabold rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-200 hover:bg-indigo-600 hover:text-white transition-all shadow-xs flex items-center gap-1 cursor-pointer"
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
                  <h3 className="text-lg font-black text-brand-ink">Official Offer Letters Released</h3>
                  <p className="text-xs text-slate-500 font-semibold mt-0.5">Track candidate decisions, employment start dates, and salary packages.</p>
                </div>
              </div>

              {issuedOffers.length === 0 ? (
                <div className="p-16 text-center space-y-2">
                  <Gift className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                  <h4 className="text-sm font-black text-brand-ink">No Offer Letters Released Yet</h4>
                  <p className="text-xs text-slate-500 font-medium max-w-sm mx-auto">
                    Candidates who complete evaluation rounds and reach 'Selected' status can receive official offer letters.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-max">
                    <thead>
                      <tr className="border-b border-stoneBorder text-[10px] font-extrabold text-slate-400 uppercase tracking-wider bg-slate-50/50">
                        <th className="py-4 px-6">Candidate</th>
                        <th className="py-4 px-4">Position</th>
                        <th className="py-4 px-4">Offered Salary</th>
                        <th className="py-4 px-4">Start Date</th>
                        <th className="py-4 px-4">Offer Status</th>
                        <th className="py-4 px-6 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stoneBorder/60 text-xs font-bold text-brand-ink">
                      {issuedOffers.map((off, i) => (
                        <tr key={off.id || i} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-4 px-6">
                            <div className="font-black text-brand-ink">{off.candidate_name}</div>
                            <div className="text-[11px] text-slate-400 font-semibold">{off.candidate_email}</div>
                          </td>
                          <td className="py-4 px-4 text-slate-600 font-semibold">{off.job_title}</td>
                          <td className="py-4 px-4 text-emerald-600 font-black">{off.salary_offered}</td>
                          <td className="py-4 px-4 text-slate-500 font-semibold">{off.start_date}</td>
                          <td className="py-4 px-4">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold ${
                              off.status === 'Accepted' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
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
                              className="px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-extrabold text-[11px] cursor-pointer"
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

        </div>

      </main>

      {/* Modals & Dialogs */}
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
