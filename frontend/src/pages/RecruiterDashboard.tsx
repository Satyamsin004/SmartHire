import React, { useState, useEffect } from 'react';
import { RecruiterHiringTeamIllustration } from '../components/illustrations/Illustrations';
import {
  Users, FileText, CheckCircle2, Plus, Send, Briefcase, Eye, Edit3, Copy, XCircle,
  Trash2, Globe, Clock, ChevronRight, Search, Filter, MessageSquare, Star,
  ExternalLink, UserCheck, Download, MapPin, Phone, GraduationCap, Award, Check, Gift
} from 'lucide-react';
import api from '../services/api';
import { useWebSocket } from '../context/WebSocketContext';
import { CreateJobModal } from '../components/recruiter/CreateJobModal';
import { JobDetailsModal } from '../components/recruiter/JobDetailsModal';
import { ScheduleInterviewModal } from '../components/recruiter/ScheduleInterviewModal';
import { SendOfferModal } from '../components/recruiter/SendOfferModal';
import { EvaluationReportModal } from '../components/recruiter/EvaluationReportModal';
import { CandidateProfileModal } from '../components/recruiter/CandidateProfileModal';

export type RecruiterTabType = 'requisitions' | 'candidates' | 'shortlisted' | 'applications' | 'evaluations' | 'rejected' | 'offers';

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
  const [registeredCandidates, setRegisteredCandidates] = useState<any[]>([]);
  const [shortlistedCandidates, setShortlistedCandidates] = useState<any[]>([]);
  const [issuedOffers, setIssuedOffers] = useState<any[]>([]);
  const [recruiterStats, setRecruiterStats] = useState<any>({ total_candidates: 0, jobs_posted: 0, applications_received: 0 });
  
  const [activeTab, setActiveTab] = useState<RecruiterTabType>(defaultTab || 'requisitions');
  
  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [expFilter, setExpFilter] = useState('');
  const [eduFilter, setEduFilter] = useState('');
  const [skillsFilter, setSkillsFilter] = useState('');
  const [resumeFilter, setResumeFilter] = useState('all'); // all, yes, no
  const [statusFilter, setStatusFilter] = useState('all'); // all, active, inactive
  const [locationFilter, setLocationFilter] = useState('');
  const [minCompletionFilter, setMinCompletionFilter] = useState('');
  
  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedJobForEdit, setSelectedJobForEdit] = useState<any>(null);
  const [selectedJobForView, setSelectedJobForView] = useState<any>(null);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
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
  
  const [isCandidateAppsModalOpen, setIsCandidateAppsModalOpen] = useState(false);
  const [candidateAppsData, setCandidateAppsData] = useState<any[]>([]);
  const [candidateAppsName, setCandidateAppsName] = useState('');

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
    if (lastMessage?.event === 'CANDIDATE_REGISTERED' || lastMessage?.event === 'CANDIDATE_SHORTLISTED' || lastMessage?.event === 'STATUS_CHANGED') {
      fetchRecruiterData();
    }
  }, [lastMessage]);

  const fetchRecruiterData = async () => {
    const results = await Promise.allSettled([
      api.get('/jobs/my-jobs'),
      api.get('/recruiter/applications'),
      api.get('/recruiter/evaluations'),
      api.get('/recruiter/ats-rejected'),
      api.get('/recruiter/registered-candidates'),
      api.get('/recruiter/shortlisted-candidates'),
      api.get('/recruiter/stats'),
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
      setRegisteredCandidates(results[4].value.data || []);
    }

    if (results[5].status === 'fulfilled' && results[5].value?.data) {
      setShortlistedCandidates(results[5].value.data || []);
    }

    if (results[6].status === 'fulfilled' && results[6].value?.data) {
      setRecruiterStats(results[6].value.data || {});
    }

    if (results[7].status === 'fulfilled' && results[7].value?.data) {
      setIssuedOffers(results[7].value.data || []);
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
      alert(`Message dispatched to ${messageCandidate.full_name || messageCandidate.name} successfully.`);
      setIsMessageModalOpen(false);
      setMessageBody('');
    } catch (err) {
      console.error('Send message error:', err);
    }
  };

  const handleViewCandidateApps = async (cand: any) => {
    setCandidateAppsName(cand.full_name || cand.name || 'Candidate');
    try {
      const res = await api.get(`/recruiter/candidate/${cand.id}/applications`);
      setCandidateAppsData(res.data || []);
    } catch (err) {
      setCandidateAppsData([]);
    }
    setIsCandidateAppsModalOpen(true);
  };

  // Filter candidates client side
  const filteredCandidates = registeredCandidates.filter((cand) => {
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      const matchName = (cand.full_name || cand.name || '').toLowerCase().includes(s);
      const matchEmail = (cand.email || '').toLowerCase().includes(s);
      const matchPhone = (cand.phone || '').toLowerCase().includes(s);
      const matchSkill = cand.skills?.some((sk: string) => sk.toLowerCase().includes(s));
      const matchEdu = (cand.education || '').toLowerCase().includes(s);
      const matchExp = (cand.experience_years || '').toLowerCase().includes(s) || (cand.current_role || '').toLowerCase().includes(s);
      const matchLoc = (cand.location || '').toLowerCase().includes(s);
      if (!matchName && !matchEmail && !matchPhone && !matchSkill && !matchEdu && !matchExp && !matchLoc) return false;
    }
    if (expFilter && !(cand.experience_years || '').toLowerCase().includes(expFilter.toLowerCase())) return false;
    if (eduFilter && !(cand.education || '').toLowerCase().includes(eduFilter.toLowerCase())) return false;
    if (skillsFilter && !cand.skills?.some((sk: string) => sk.toLowerCase().includes(skillsFilter.toLowerCase()))) return false;
    if (resumeFilter === 'yes' && !cand.has_resume) return false;
    if (resumeFilter === 'no' && cand.has_resume) return false;
    if (statusFilter === 'active' && cand.account_status !== 'Active') return false;
    if (statusFilter === 'inactive' && cand.account_status !== 'Inactive') return false;
    if (locationFilter && !(cand.location || '').toLowerCase().includes(locationFilter.toLowerCase())) return false;
    if (minCompletionFilter && (cand.profile_completion || 0) < Number(minCompletionFilter)) return false;
    return true;
  });

  return (
    <>
      <main className="p-6 lg:p-10 max-w-7xl mx-auto w-full space-y-8">
        
        {/* Recruiter Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-1">
              Recruiter Workspace
            </p>
            <h1 className="text-3xl font-black text-brand-ink">
              Recruiter Overview & Talent Directory
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => { setSelectedCandidateForSchedule(null); setIsScheduleModalOpen(true); }}
              className="px-5 py-2.5 rounded-xl bg-brand-ink hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-2 transition-all shadow-md"
            >
              <Plus className="w-4 h-4" />
              <span>Schedule Interview</span>
            </button>
            <button
              onClick={() => { setSelectedJobForEdit(null); setIsCreateModalOpen(true); }}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-2 transition-all shadow-md shadow-indigo-600/30"
            >
              <Plus className="w-4 h-4" />
              <span>Post New Job</span>
            </button>
          </div>
        </div>

        {/* Hiring Funnel Metric Cards - Strictly Separated Candidates vs Applications */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="card-luxury p-5 border border-stoneBorder">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Total Candidates</p>
            <h3 className="text-2xl font-black text-brand-ink">{registeredCandidates.length || recruiterStats.total_candidates || 0}</h3>
          </div>
          <div className="card-luxury p-5 border border-stoneBorder">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Job Applications</p>
            <h3 className="text-2xl font-black text-indigo-600">{applications.length}</h3>
          </div>
          <div className="card-luxury p-5 border border-stoneBorder">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">ATS Screened</p>
            <h3 className="text-2xl font-black text-violet-600">{evaluations.length + atsRejected.length}</h3>
          </div>
          <div className="card-luxury p-5 border border-stoneBorder">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Shortlisted</p>
            <h3 className="text-2xl font-black text-emerald-600">{shortlistedCandidates.length}</h3>
          </div>
          <div className="card-luxury p-5 border border-stoneBorder">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Offers Issued</p>
            <h3 className="text-2xl font-black text-amber-600">
              {applications.filter(a => a.status === 'Offer Sent' || a.status === 'Hired').length}
            </h3>
          </div>
        </div>

        {/* Workspace Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-stoneBorder pb-3 overflow-x-auto">
          <button
            onClick={() => setActiveTab('requisitions')}
            className={`px-4 py-2.5 rounded-xl font-extrabold text-xs flex items-center gap-2 transition-all shrink-0 ${
              activeTab === 'requisitions' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-slate-600 hover:bg-slate-50 border border-stoneBorder'
            }`}
          >
            <Briefcase className="w-4 h-4" />
            <span>Job Requisitions ({myJobs.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('candidates')}
            className={`px-4 py-2.5 rounded-xl font-extrabold text-xs flex items-center gap-2 transition-all shrink-0 ${
              activeTab === 'candidates' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-slate-600 hover:bg-slate-50 border border-stoneBorder'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>👥 Candidates Directory ({registeredCandidates.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('shortlisted')}
            className={`px-4 py-2.5 rounded-xl font-extrabold text-xs flex items-center gap-2 transition-all shrink-0 ${
              activeTab === 'shortlisted' ? 'bg-emerald-600 text-white shadow-md' : 'bg-white text-slate-600 hover:bg-slate-50 border border-stoneBorder'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Shortlisted Candidates ({shortlistedCandidates.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('applications')}
            className={`px-4 py-2.5 rounded-xl font-extrabold text-xs flex items-center gap-2 transition-all shrink-0 ${
              activeTab === 'applications' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-slate-600 hover:bg-slate-50 border border-stoneBorder'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Applications ({applications.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('evaluations')}
            className={`px-4 py-2.5 rounded-xl font-extrabold text-xs flex items-center gap-2 transition-all shrink-0 ${
              activeTab === 'evaluations' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-slate-600 hover:bg-slate-50 border border-stoneBorder'
            }`}
          >
            <Eye className="w-4 h-4" />
            <span>Evaluations ({evaluations.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('rejected')}
            className={`px-4 py-2.5 rounded-xl font-extrabold text-xs flex items-center gap-2 transition-all shrink-0 ${
              activeTab === 'rejected' ? 'bg-rose-600 text-white shadow-md' : 'bg-white text-slate-600 hover:bg-slate-50 border border-stoneBorder'
            }`}
          >
            <XCircle className="w-4 h-4" />
            <span>ATS Rejected ({atsRejected.length})</span>
          </button>
        </div>

        {/* Matrix & Directory Container */}
        <div className="card-luxury p-0 overflow-hidden shadow-soft-lg">
          
          {/* Header & Controls */}
          <div className="p-6 border-b border-stoneBorder space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-black text-brand-ink">
                  {activeTab === 'candidates' ? 'Candidates Directory' :
                   activeTab === 'shortlisted' ? 'Shortlisted Candidates Pipeline' :
                   activeTab === 'applications' ? 'Job Applications' :
                   activeTab === 'evaluations' ? 'AI Evaluation Reports' :
                   activeTab === 'rejected' ? 'ATS Rejected Candidates' :
                   'Job Requisitions'}
                </h3>
                {activeTab === 'candidates' && (
                  <p className="text-xs text-slate-500 font-semibold mt-0.5">
                    Directory of all registered candidate accounts across the system.
                  </p>
                )}
              </div>
            </div>

            {/* Candidates Search & Filtering Bar */}
            {activeTab === 'candidates' && (
              <div className="space-y-3 pt-2">
                <div className="flex flex-col md:flex-row items-center gap-3">
                  <div className="relative flex-1 w-full">
                    <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search candidates by Name, Email, Phone, Skill, College, Experience, Location..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-stoneBorder rounded-xl text-xs font-bold text-brand-ink focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                    <select
                      value={expFilter}
                      onChange={(e) => setExpFilter(e.target.value)}
                      className="px-3 py-2 bg-slate-50 border border-stoneBorder rounded-xl text-xs font-bold text-slate-700"
                    >
                      <option value="">All Experience</option>
                      <option value="Fresher">Fresher / Graduate</option>
                      <option value="1">1+ Years</option>
                      <option value="3">3+ Years</option>
                      <option value="5">5+ Years</option>
                    </select>

                    <select
                      value={resumeFilter}
                      onChange={(e) => setResumeFilter(e.target.value)}
                      className="px-3 py-2 bg-slate-50 border border-stoneBorder rounded-xl text-xs font-bold text-slate-700"
                    >
                      <option value="all">Resume: All</option>
                      <option value="yes">Uploaded Only</option>
                      <option value="no">No Resume</option>
                    </select>

                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="px-3 py-2 bg-slate-50 border border-stoneBorder rounded-xl text-xs font-bold text-slate-700"
                    >
                      <option value="all">Account: All</option>
                      <option value="active">Active Only</option>
                      <option value="inactive">Inactive Only</option>
                    </select>

                    {(searchTerm || expFilter || eduFilter || skillsFilter || resumeFilter !== 'all' || statusFilter !== 'all' || locationFilter) && (
                      <button
                        onClick={() => {
                          setSearchTerm('');
                          setExpFilter('');
                          setEduFilter('');
                          setSkillsFilter('');
                          setResumeFilter('all');
                          setStatusFilter('all');
                          setLocationFilter('');
                          setMinCompletionFilter('');
                        }}
                        className="px-3 py-2 rounded-xl bg-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-300"
                      >
                        Reset Filters
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
          
          <div className="overflow-x-auto">
            {activeTab === 'candidates' ? (
              filteredCandidates.length === 0 ? (
                <div className="p-16 text-center text-xs text-slate-500 font-medium">
                  {registeredCandidates.length === 0
                    ? 'No candidate accounts registered yet.'
                    : 'No candidates match your active search filter criteria.'}
                </div>
              ) : (
                <table className="w-full text-left border-collapse min-w-max">
                  <thead>
                    <tr className="border-b border-stoneBorder text-[10px] font-extrabold text-slate-400 uppercase tracking-wider bg-slate-50/50">
                      <th className="py-4 px-6">Candidate</th>
                      <th className="py-4 px-4">Contact & Location</th>
                      <th className="py-4 px-4">Role & Experience</th>
                      <th className="py-4 px-4">Education</th>
                      <th className="py-4 px-4">Skills</th>
                      <th className="py-4 px-4">Resume</th>
                      <th className="py-4 px-4">Completion</th>
                      <th className="py-4 px-4">Registered Date</th>
                      <th className="py-4 px-4">Status</th>
                      <th className="py-4 px-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stoneBorder/60 text-xs font-bold text-brand-ink">
                    {filteredCandidates.map((cand, i) => (
                      <tr key={cand.id || i} className="hover:bg-slate-50/50 transition-colors">
                        
                        {/* Profile Photo & Name */}
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3">
                            {cand.profile_image ? (
                              <img src={cand.profile_image} alt={cand.full_name} className="w-9 h-9 rounded-full object-cover shadow-sm border border-stoneBorder" />
                            ) : (
                              <div className="w-9 h-9 rounded-full bg-indigo-600 text-white font-black text-xs flex items-center justify-center shadow-sm">
                                {(cand.full_name || cand.name || 'SK').substring(0, 2).toUpperCase()}
                              </div>
                            )}
                            <div>
                              <div className="font-black text-brand-ink">{cand.full_name || cand.name}</div>
                              <div className="text-[11px] text-slate-400 font-semibold">{cand.email}</div>
                            </div>
                          </div>
                        </td>

                        {/* Phone & Location */}
                        <td className="py-4 px-4">
                          <div className="text-slate-700 font-semibold flex items-center gap-1">
                            <Phone className="w-3 h-3 text-slate-400 inline" />
                            <span>{cand.phone}</span>
                          </div>
                          <div className="text-[11px] text-slate-400 font-semibold flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-slate-400 inline" />
                            <span>{cand.location}</span>
                          </div>
                        </td>

                        {/* Current Role & Experience */}
                        <td className="py-4 px-4">
                          <div className="font-extrabold text-slate-800">{cand.current_role}</div>
                          <div className="text-[11px] text-indigo-600 font-bold">{cand.experience_years}</div>
                        </td>

                        {/* Education */}
                        <td className="py-4 px-4 max-w-xs truncate text-slate-600 font-semibold">
                          {cand.education}
                        </td>

                        {/* Skills */}
                        <td className="py-4 px-4 max-w-xs">
                          <div className="flex flex-wrap gap-1">
                            {cand.skills && cand.skills.length > 0 ? (
                              cand.skills.slice(0, 3).map((sk: string, idx: number) => (
                                <span key={idx} className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-100">
                                  {sk}
                                </span>
                              ))
                            ) : (
                              <span className="text-[11px] text-slate-400 font-normal">None Listed</span>
                            )}
                            {cand.skills && cand.skills.length > 3 && (
                              <span className="text-[10px] text-slate-400 font-bold">+{cand.skills.length - 3}</span>
                            )}
                          </div>
                        </td>

                        {/* Resume Status */}
                        <td className="py-4 px-4">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold flex items-center gap-1 w-fit ${
                            cand.has_resume ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {cand.has_resume ? 'Yes' : 'No'}
                          </span>
                        </td>

                        {/* Profile Completion % */}
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2">
                            <div className="w-16 bg-slate-100 rounded-full h-1.5 overflow-hidden border border-stoneBorder">
                              <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${cand.profile_completion}%` }} />
                            </div>
                            <span className="text-[11px] font-extrabold text-slate-700">{cand.profile_completion}%</span>
                          </div>
                        </td>

                        {/* Registration Date */}
                        <td className="py-4 px-4 text-slate-400 font-semibold">
                          {cand.registered_date}
                        </td>

                        {/* Account Status & Candidate Status */}
                        <td className="py-4 px-4">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold ${
                            cand.account_status === 'Active' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}>
                            {cand.account_status}
                          </span>
                        </td>

                        {/* Actions: View Profile, View Resume, View Applications, Shortlist, Schedule, Send Message */}
                        <td className="py-4 px-6 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* View Profile */}
                            <button
                              onClick={() => { setSelectedProfileCandidateId(cand.id); setIsProfileModalOpen(true); }}
                              title="View Full Profile"
                              className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] flex items-center gap-1"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Profile</span>
                            </button>

                            {/* View Resume */}
                            <button
                              onClick={() => {
                                if (cand.resume_url) {
                                  window.open(cand.resume_url, '_blank');
                                } else {
                                  alert('Candidate has not uploaded a resume document yet.');
                                }
                              }}
                              title="View Resume Document"
                              className="px-2 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[11px] flex items-center gap-1"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              <span>Resume</span>
                            </button>

                            {/* View Applications */}
                            <button
                              onClick={() => handleViewCandidateApps(cand)}
                              title="View Candidate Applications"
                              className="px-2 py-1 rounded-lg bg-violet-50 hover:bg-violet-100 text-violet-700 font-bold text-[11px]"
                            >
                              Apps ({cand.application_count})
                            </button>

                            {/* Shortlist */}
                            <button
                              onClick={() => handleShortlistCandidate(cand.id)}
                              title="Shortlist Candidate"
                              className="p-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs"
                            >
                              <Star className="w-3.5 h-3.5" />
                            </button>

                            {/* Schedule Interview */}
                            <button
                              onClick={() => { setSelectedCandidateForSchedule(cand); setIsScheduleModalOpen(true); }}
                              title="Schedule Interview"
                              className="p-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs"
                            >
                              <Clock className="w-3.5 h-3.5" />
                            </button>

                            {/* Send Message */}
                            <button
                              onClick={() => { setMessageCandidate(cand); setIsMessageModalOpen(true); }}
                              title="Send Message"
                              className="p-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 font-bold text-xs"
                            >
                              <Send className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            ) : activeTab === 'shortlisted' ? (
              shortlistedCandidates.length === 0 ? (
                <div className="p-16 text-center text-xs text-slate-500 font-medium">
                  No candidates currently shortlisted. Candidates meeting ATS screening threshold (&ge;80%) appear here automatically.
                </div>
              ) : (
                <table className="w-full text-left border-collapse min-w-max">
                  <thead>
                    <tr className="border-b border-stoneBorder text-[10px] font-extrabold text-slate-400 uppercase tracking-wider bg-slate-50/50">
                      <th className="py-4 px-6">Candidate</th>
                      <th className="py-4 px-4">Applied Job</th>
                      <th className="py-4 px-4">Company</th>
                      <th className="py-4 px-4">ATS Match</th>
                      <th className="py-4 px-4">Interview Score</th>
                      <th className="py-4 px-4">AI Recommendation</th>
                      <th className="py-4 px-4">Hiring Stage</th>
                      <th className="py-4 px-6 text-right">Quick Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stoneBorder/60 text-xs font-bold text-brand-ink">
                    {shortlistedCandidates.map((sh, i) => (
                      <tr key={sh.id || i} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-4 px-6">
                          <div className="font-black text-brand-ink">{sh.candidate_name}</div>
                          <div className="text-[11px] text-slate-400 font-semibold">{sh.candidate_email}</div>
                        </td>
                        <td className="py-4 px-4 text-slate-600 font-semibold">{sh.job_title}</td>
                        <td className="py-4 px-4 text-slate-500 font-semibold">{sh.company_name}</td>
                        <td className="py-4 px-4">
                          <span className="font-black text-emerald-600">{sh.ats_score}%</span>
                        </td>
                        <td className="py-4 px-4 text-indigo-600 font-black">
                          {sh.interview_score ? `${sh.interview_score}%` : 'N/A'}
                        </td>
                        <td className="py-4 px-4">
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800">
                            {sh.ai_recommendation}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-indigo-100 text-indigo-800">
                            {sh.status}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-right flex items-center justify-end gap-2">
                          <button
                            onClick={() => { setSelectedApplicationForOffer(sh); setIsOfferModalOpen(true); }}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-[11px]"
                          >
                            Generate Offer
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            ) : activeTab === 'offers' ? (
              issuedOffers.length === 0 ? (
                <div className="p-12 text-center bg-[#FDFBF7] rounded-3xl border border-stoneBorder">
                  <Gift className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <h4 className="text-sm font-extrabold text-brand-ink">No Offer Letters Generated Yet</h4>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                    Candidates who complete interview evaluations and reach 'Selected' status can receive official offer letters.
                  </p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-stoneBorder text-[11px] font-black uppercase text-slate-400">
                      <th className="py-4 px-6">Candidate</th>
                      <th className="py-4 px-4">Position</th>
                      <th className="py-4 px-4">Offered Salary</th>
                      <th className="py-4 px-4">Start Date</th>
                      <th className="py-4 px-4">Offer Status</th>
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
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            ) : (
              <>
                {(evaluations.length === 0 && applications.length === 0) ? (
                  <div className="p-16 text-center space-y-2">
                    <p className="text-xs text-slate-500 font-medium">
                      No active candidate applications in database. Post a new job or schedule an interview to populate the matrix.
                    </p>
                  </div>
                ) : (
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
                        <th className="py-4 px-4">Status</th>
                        <th className="py-4 px-6 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stoneBorder/60 text-xs font-bold text-brand-ink">
                      {(evaluations.length > 0 ? evaluations : applications).map((item, i) => (
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
                              <span className="text-[10px] text-slate-400 italic font-semibold">Interview Pending</span>
                            )}
                          </td>
                          <td className="py-4 px-4 text-slate-600 font-semibold">{item.communication_score != null ? `${item.communication_score}%` : 'N/A'}</td>
                          <td className="py-4 px-4 text-slate-600 font-semibold">{item.confidence_score != null ? `${item.confidence_score}%` : 'N/A'}</td>
                          <td className="py-4 px-4 text-slate-600 font-semibold">{item.technical_score != null ? `${item.technical_score}%` : 'N/A'}</td>
                          <td className="py-4 px-4">
                            <span className="font-black text-emerald-600">{item.ats_score != null ? `${item.ats_score}%` : 'N/A'}</span>
                          </td>
                          <td className="py-4 px-4">
                            <span className="px-3 py-1 rounded-full text-[10px] font-extrabold bg-slate-100 text-slate-600">
                              {item.status || 'Applied'}
                            </span>
                          </td>
                          <td className="py-4 px-6 text-right">
                             <button 
                               onClick={() => {
                                 setSelectedEvaluationId(item.session_id || item.id);
                                 setIsEvaluationModalOpen(true);
                               }}
                               className="p-1.5 text-slate-400 hover:text-indigo-600 transition-colors"
                             >
                               <Eye className="w-4 h-4" />
                             </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </>
            )}
          </div>
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
              <button onClick={() => setIsMessageModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-600">
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-600 mb-1">To: {messageCandidate.full_name || messageCandidate.name} ({messageCandidate.email})</p>
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
              <button onClick={() => setIsMessageModalOpen(false)} className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200">
                Cancel
              </button>
              <button onClick={handleSendMessage} className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500">
                Send Message
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Candidate Applications Dialog */}
      {isCandidateAppsModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-2xl w-full max-w-lg space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-black text-slate-900">Candidate Job Applications</h3>
                <p className="text-xs text-slate-500 font-semibold">{candidateAppsName}</p>
              </div>
              <button onClick={() => setIsCandidateAppsModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-600">
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {candidateAppsData.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500 font-medium">
                  This candidate has registered but has not applied for any job requisitions yet.
                </div>
              ) : (
                candidateAppsData.map((app: any, idx: number) => (
                  <div key={app.id || idx} className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-black text-slate-900">{app.job_title}</p>
                      <p className="text-[11px] font-semibold text-slate-500">{app.company_name} · Applied: {app.applied_date}</p>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-indigo-100 text-indigo-800">
                      {app.status}
                    </span>
                  </div>
                ))
              )}
            </div>
            <div className="flex items-center justify-end pt-2">
              <button onClick={() => setIsCandidateAppsModalOpen(false)} className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
