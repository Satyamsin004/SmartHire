import React, { useState, useEffect } from 'react';
import { Navbar } from '../components/layout/Navbar';
import { Sidebar } from '../components/layout/Sidebar';
import { RecruiterHiringTeamIllustration } from '../components/illustrations/Illustrations';
import { Users, FileText, CheckCircle2, Plus, Send, Briefcase, Eye, Edit3, Copy, XCircle, Trash2, Globe, Clock, ChevronRight } from 'lucide-react';
import api from '../services/api';
import { CreateJobModal } from '../components/recruiter/CreateJobModal';
import { JobDetailsModal } from '../components/recruiter/JobDetailsModal';
import { ScheduleInterviewModal } from '../components/recruiter/ScheduleInterviewModal';
import { SendOfferModal } from '../components/recruiter/SendOfferModal';
import { EvaluationReportModal } from '../components/recruiter/EvaluationReportModal';

export const RecruiterDashboard: React.FC = () => {
  const [recruiterName, setRecruiterName] = useState('Recruiter');
  const [applications, setApplications] = useState<any[]>([]);
  const [evaluations, setEvaluations] = useState<any[]>([]);
  const [atsRejected, setAtsRejected] = useState<any[]>([]);
  const [myJobs, setMyJobs] = useState<any[]>([]);
  const [jobAnalytics, setJobAnalytics] = useState<any>({ total_jobs: 0, active_jobs: 0, draft_jobs: 0, closed_jobs: 0, total_applications: 0 });
  
  const [activeTab, setActiveTab] = useState<'requisitions' | 'applications' | 'evaluations' | 'rejected'>('requisitions');
  
  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedJobForEdit, setSelectedJobForEdit] = useState<any>(null);
  const [selectedJobForView, setSelectedJobForView] = useState<any>(null);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isOfferModalOpen, setIsOfferModalOpen] = useState(false);
  const [selectedApplicationForOffer, setSelectedApplicationForOffer] = useState<any>(null);
  const [selectedEvaluationId, setSelectedEvaluationId] = useState<string | null>(null);
  const [isEvaluationModalOpen, setIsEvaluationModalOpen] = useState(false);

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

  const fetchRecruiterData = () => {
    // Fetch recruiter posted jobs & analytics
    api.get('/jobs/my-jobs')
      .then((res) => {
        setMyJobs(res.data?.jobs || []);
        setJobAnalytics(res.data?.analytics || {});
      })
      .catch((err) => console.warn('Fetch my jobs error:', err));

    // Fetch live DB records for recruiter applications
    api.get('/recruiter/applications')
      .then((res) => setApplications(res.data || []))
      .catch((err) => console.warn('Fetch applications error:', err));

    api.get('/recruiter/evaluations')
      .then((res) => setEvaluations(res.data || []))
      .catch((err) => console.warn('Fetch evaluations error:', err));

    api.get('/recruiter/ats-rejected')
      .then((res) => setAtsRejected(res.data || []))
      .catch((err) => console.warn('Fetch rejected error:', err));
  };

  const handleDuplicateJob = async (jobId: string) => {
    try {
      await api.post(`/jobs/${jobId}/duplicate`);
      fetchRecruiterData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleCloseJob = async (jobId: string) => {
    if (!window.confirm('Are you sure you want to close this job requisition?')) return;
    try {
      await api.post(`/jobs/${jobId}/close`);
      fetchRecruiterData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteJob = async (jobId: string) => {
    if (!window.confirm('Are you sure you want to permanently delete this job requisition?')) return;
    try {
      await api.delete(`/jobs/${jobId}`);
      fetchRecruiterData();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="min-h-screen bg-brand-bg flex text-brand-ink font-sans">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <Navbar />

        <main className="p-6 lg:p-10 max-w-7xl mx-auto w-full space-y-8">
          
          {/* Recruiter Hero Header */}
          <div className="bg-gradient-to-r from-brand-primary via-sb-800 to-brand-ink rounded-5xl p-8 lg:p-12 text-white relative overflow-hidden shadow-floating">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">
              
              <div className="lg:col-span-7 space-y-4">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-2xl bg-brand-accent/20 border border-brand-accent/30 text-brand-accent text-xs font-extrabold">
                  <Users className="w-4 h-4" />
                  <span>Enterprise Talent Pipeline</span>
                </div>

                <h1 className="text-3xl lg:text-5xl font-extrabold tracking-tight text-white leading-tight">
                  Welcome back, <br />
                  <span className="text-brand-accent">{recruiterName}</span>
                </h1>

                <p className="text-sm text-slate-300 font-medium leading-relaxed max-w-lg">
                  Automated candidate sourcing, AI ATS score screening, deterministic mock evaluation reports, and offer letter generation.
                </p>

                <div className="pt-2 flex flex-wrap gap-4">
                  <button
                    onClick={() => { setSelectedJobForEdit(null); setIsCreateModalOpen(true); }}
                    className="px-6 py-3.5 rounded-2xl bg-brand-secondary hover:bg-sb-500 text-white font-extrabold text-xs flex items-center gap-2 shadow-luxury transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Create Job Requisition</span>
                  </button>

                  <button
                    onClick={() => setIsOfferModalOpen(true)}
                    className="px-6 py-3.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-extrabold text-xs flex items-center gap-2 border border-white/20 transition-all"
                  >
                    <Send className="w-4 h-4 text-brand-accent" />
                    <span>Send Offer Letter</span>
                  </button>
                </div>
              </div>

              <div className="lg:col-span-5 hidden lg:block">
                <RecruiterHiringTeamIllustration className="w-full h-auto drop-shadow-2xl" />
              </div>

            </div>
          </div>

          {/* Hiring Funnel Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="card-luxury p-6 flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-brand-primary/10 text-brand-primary flex items-center justify-center font-extrabold text-lg">
                <Briefcase className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Active Jobs</p>
                <h3 className="text-xl font-extrabold text-brand-ink">{jobAnalytics.active_jobs || 0} Requisitions</h3>
              </div>
            </div>

            <div className="card-luxury p-6 flex items-center gap-4">
              <div className="w-12 h-12 rounded-3xl bg-brand-accent/30 text-brand-primary flex items-center justify-center font-extrabold text-lg">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Applications</p>
                <h3 className="text-xl font-extrabold text-brand-ink">{applications.length} Applicants</h3>
              </div>
            </div>

            <div className="card-luxury p-6 flex items-center gap-4">
              <div className="w-12 h-12 rounded-3xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-extrabold text-lg">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Passed ATS (≥80%)</p>
                <h3 className="text-xl font-extrabold text-brand-ink">{evaluations.length} Qualified</h3>
              </div>
            </div>

            <div className="card-luxury p-6 flex items-center gap-4">
              <div className="w-12 h-12 rounded-3xl bg-amber-100 text-amber-800 flex items-center justify-center font-extrabold text-lg">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Draft Requisitions</p>
                <h3 className="text-xl font-extrabold text-brand-ink">{jobAnalytics.draft_jobs || 0} Pending</h3>
              </div>
            </div>
          </div>

          {/* Pipeline Data Tabs */}
          <div className="card-luxury p-6">
            <div className="flex bg-cream-200 p-1.5 rounded-3xl mb-6 max-w-2xl border border-stoneBorder">
              <button
                onClick={() => setActiveTab('requisitions')}
                className={`flex-1 py-2.5 text-xs font-extrabold rounded-2xl transition-all ${
                  activeTab === 'requisitions' ? 'bg-brand-primary text-white shadow-soft' : 'text-brand-ink'
                }`}
              >
                My Requisitions ({myJobs.length})
              </button>

              <button
                onClick={() => setActiveTab('applications')}
                className={`flex-1 py-2.5 text-xs font-extrabold rounded-2xl transition-all ${
                  activeTab === 'applications' ? 'bg-brand-primary text-white shadow-soft' : 'text-brand-ink'
                }`}
              >
                Applications ({applications.length})
              </button>

              <button
                onClick={() => setActiveTab('evaluations')}
                className={`flex-1 py-2.5 text-xs font-extrabold rounded-2xl transition-all ${
                  activeTab === 'evaluations' ? 'bg-brand-primary text-white shadow-soft' : 'text-brand-ink'
                }`}
              >
                Passed ATS ({evaluations.length})
              </button>

              <button
                onClick={() => setActiveTab('rejected')}
                className={`flex-1 py-2.5 text-xs font-extrabold rounded-2xl transition-all ${
                  activeTab === 'rejected' ? 'bg-brand-primary text-white shadow-soft' : 'text-brand-ink'
                }`}
              >
                Rejected ATS ({atsRejected.length})
              </button>
            </div>

            {/* Requisitions View */}
            {activeTab === 'requisitions' && (
              <div className="overflow-x-auto">
                {myJobs.length === 0 ? (
                  <div className="p-12 text-center space-y-3">
                    <Briefcase className="w-12 h-12 text-slate-300 mx-auto" />
                    <h3 className="text-base font-extrabold text-brand-ink">No Jobs Posted Yet</h3>
                    <p className="text-xs text-slate-500 max-w-md mx-auto font-medium">
                      Create your first hiring requisition to start receiving applications and automated ATS scores.
                    </p>
                    <button
                      onClick={() => { setSelectedJobForEdit(null); setIsCreateModalOpen(true); }}
                      className="px-6 py-2.5 rounded-2xl bg-brand-primary text-white font-extrabold text-xs inline-flex items-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Post Requisition Now</span>
                    </button>
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-stoneBorder text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">
                        <th className="pb-3 px-4">Requisition Title</th>
                        <th className="pb-3 px-4">Department & Mode</th>
                        <th className="pb-3 px-4">Applicants</th>
                        <th className="pb-3 px-4">Status</th>
                        <th className="pb-3 px-4 text-right">Requisition Controls</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stoneBorder/60 text-xs font-bold text-brand-ink">
                      {myJobs.map((j) => (
                        <tr key={j.id} className="hover:bg-cream-100/80 transition-colors">
                          <td className="py-4 px-4">
                            <div className="font-extrabold text-brand-ink">{j.title}</div>
                            <div className="text-[11px] text-slate-400 font-semibold">{j.company_name} • {j.location}</div>
                          </td>
                          <td className="py-4 px-4">
                            <div>{j.department}</div>
                            <div className="text-[11px] text-slate-400 font-semibold">{j.employment_type} ({j.work_mode})</div>
                          </td>
                          <td className="py-4 px-4">
                            <span className="px-2.5 py-1 rounded-xl text-xs font-extrabold bg-brand-accent/30 text-brand-primary">
                              {j.applicant_count || 0} Applicants
                            </span>
                          </td>
                          <td className="py-4 px-4">
                            <span className={`px-2.5 py-1 rounded-xl text-[11px] font-extrabold ${
                              j.status === 'Published' ? 'bg-emerald-100 text-emerald-800' :
                              j.status === 'Draft' ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-800'
                            }`}>
                              {j.status}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => setSelectedJobForView(j)}
                                title="View Requisition Specs"
                                className="p-2 rounded-xl bg-cream-200 hover:bg-stoneBorder text-brand-ink"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => { setSelectedJobForEdit(j); setIsCreateModalOpen(true); }}
                                title="Edit Requisition Specs"
                                className="p-2 rounded-xl bg-cream-200 hover:bg-stoneBorder text-brand-primary"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDuplicateJob(j.id)}
                                title="Duplicate Requisition"
                                className="p-2 rounded-xl bg-cream-200 hover:bg-stoneBorder text-slate-600"
                              >
                                <Copy className="w-4 h-4" />
                              </button>
                              {j.status === 'Published' && (
                                <button
                                  onClick={() => handleCloseJob(j.id)}
                                  title="Close Requisition"
                                  className="p-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-700"
                                >
                                  <XCircle className="w-4 h-4" />
                                </button>
                              )}
                              <button
                                onClick={() => handleDeleteJob(j.id)}
                                title="Delete Requisition"
                                className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* Candidate Table Views */}
            {activeTab !== 'requisitions' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-stoneBorder text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">
                      <th className="pb-3 px-4">Candidate & Email</th>
                      <th className="pb-3 px-4">Requisition & Company</th>
                      <th className="pb-3 px-4">ATS Match</th>
                      {activeTab === 'evaluations' && (
                        <>
                          <th className="pb-3 px-4">Interview Date</th>
                          <th className="pb-3 px-4">Interview Score</th>
                          <th className="pb-3 px-4">Tech / Comm / Conf</th>
                          <th className="pb-3 px-4">Grammar / Prob Solving</th>
                          <th className="pb-3 px-4">AI Recommendation</th>
                        </>
                      )}
                      <th className="pb-3 px-4">Pipeline Stage</th>
                      <th className="pb-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stoneBorder/60 text-xs font-bold text-brand-ink">
                    {(activeTab === 'applications' ? applications : activeTab === 'evaluations' ? evaluations : atsRejected).map((c) => (
                      <tr key={c.id} className="hover:bg-cream-100/80 transition-colors">
                        <td className="py-4 px-4">
                          <div className="font-extrabold text-brand-ink">{c.candidate_name}</div>
                          <div className="text-[11px] text-slate-400 font-semibold">{c.candidate_email}</div>
                        </td>
                        <td className="py-4 px-4">
                          <div>{c.role || c.job_title}</div>
                          <div className="text-[11px] text-slate-400 font-semibold">{c.company || 'SmartHire AI'}</div>
                        </td>
                        <td className="py-4 px-4">
                          <span className={`px-2.5 py-1 rounded-xl text-xs font-extrabold ${
                            (c.ats_score || 0) >= 80 ? 'bg-brand-accent text-brand-ink' : 'bg-rose-100 text-rose-800'
                          }`}>
                            {c.ats_score != null ? `${c.ats_score}%` : 'Pending'}
                          </span>
                        </td>
                        {activeTab === 'evaluations' && (
                          <>
                            <td className="py-4 px-4 text-slate-600 font-medium">
                              {c.interview_date || 'Scheduled'}
                            </td>
                            <td className="py-4 px-4">
                              <span className="px-2.5 py-1 rounded-xl text-xs font-extrabold bg-brand-primary text-white">
                                {c.overall_score != null ? `${c.overall_score}%` : (c.interview_score != null ? `${c.interview_score}%` : 'Pending')}
                              </span>
                            </td>
                            <td className="py-4 px-4 text-[11px] font-semibold text-slate-600">
                              <div>Tech: <strong className="text-brand-ink">{c.technical_score || 85}%</strong></div>
                              <div>Comm: <strong className="text-brand-ink">{c.communication_score || 88}%</strong> | Conf: <strong className="text-brand-ink">{c.confidence_score || 90}%</strong></div>
                            </td>
                            <td className="py-4 px-4 text-[11px] font-semibold text-slate-600">
                              <div>Grammar: <strong className="text-brand-ink">{c.grammar_score || 90}%</strong></div>
                              <div>Problem Solving: <strong className="text-brand-ink">{c.problem_solving_score || 85}%</strong></div>
                            </td>
                            <td className="py-4 px-4">
                              <span className="px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-800 text-[11px] font-extrabold">
                                {c.recommendation || 'Shortlist'}
                              </span>
                            </td>
                          </>
                        )}
                        <td className="py-4 px-4">
                          <span className="px-2.5 py-1 rounded-xl text-[11px] font-extrabold bg-stone-200 text-stone-800">
                            {c.pipeline_stage || c.status || 'Applied'}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {activeTab === 'evaluations' ? (
                              <button
                                onClick={() => {
                                  setSelectedEvaluationId(c.session_id || c.application_id || c.id);
                                  setIsEvaluationModalOpen(true);
                                }}
                                className="px-3.5 py-2 rounded-xl bg-brand-primary text-white text-xs font-extrabold hover:bg-sb-700 shadow-luxury transition-all flex items-center gap-1.5"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>View Evaluation</span>
                              </button>
                            ) : (
                              <button
                                onClick={() => setIsScheduleModalOpen(true)}
                                className="px-3 py-1.5 rounded-xl bg-brand-primary text-white text-xs font-bold hover:bg-sb-700"
                              >
                                Schedule Interview
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

          </div>

        </main>
      </div>

      {/* Modals */}
      <CreateJobModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={fetchRecruiterData}
        initialData={selectedJobForEdit}
      />

      <JobDetailsModal
        isOpen={!!selectedJobForView}
        onClose={() => setSelectedJobForView(null)}
        job={selectedJobForView}
        onEdit={(jobToEdit) => { setSelectedJobForEdit(jobToEdit); setIsCreateModalOpen(true); }}
      />

      <ScheduleInterviewModal
        isOpen={isScheduleModalOpen}
        onClose={() => setIsScheduleModalOpen(false)}
        onSuccess={fetchRecruiterData}
      />

      <SendOfferModal
        application={selectedApplicationForOffer || applications[0] || null}
        isOpen={isOfferModalOpen}
        onClose={() => setIsOfferModalOpen(false)}
        onSuccess={fetchRecruiterData}
      />

      <EvaluationReportModal
        isOpen={isEvaluationModalOpen}
        onClose={() => setIsEvaluationModalOpen(false)}
        evaluationId={selectedEvaluationId}
        onPipelineUpdate={fetchRecruiterData}
        onSendOffer={(appId) => {
          const matchedApp = applications.find(a => a.id === appId) || { id: appId };
          setSelectedApplicationForOffer(matchedApp);
          setIsOfferModalOpen(true);
        }}
      />
    </div>
  );
};
