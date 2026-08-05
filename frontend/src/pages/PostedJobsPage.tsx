import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Briefcase, Building2, MapPin, DollarSign, Calendar, Users, Star, Video, Eye, Edit3, XCircle, Trash2, Plus, RefreshCw, CheckCircle, Search } from 'lucide-react';
import api from '../services/api';
import { CreateJobModal } from '../components/recruiter/CreateJobModal';

export const PostedJobsPage: React.FC = () => {
  const location = useLocation();
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [selectedJob, setSelectedJob] = useState<any>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState<boolean>(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [actionMsg, setActionMsg] = useState<string>('');

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const res = await api.get('/recruiter/posted-jobs');
      setJobs(res.data || []);
    } catch (err) {
      console.error('Failed to fetch posted jobs:', err);
    } finally {
      setLoading(false);
    }
  };

  // Re-fetch every time user navigates to this page
  useEffect(() => {
    fetchJobs();
  }, [location.key]);

  const handleCloseJob = async (jobId: string) => {
    if (!window.confirm('Are you sure you want to close this job posting requisition?')) return;
    try {
      await api.patch(`/recruiter/jobs/${jobId}/close`);
      setActionMsg('Job posting requisition closed successfully.');
      fetchJobs();
      setTimeout(() => setActionMsg(''), 4000);
    } catch (err) {
      console.error('Close job error:', err);
    }
  };

  const handleDeleteJob = async (jobId: string) => {
    if (!window.confirm('Are you sure you want to permanently delete this job posting requisition?')) return;
    try {
      await api.delete(`/recruiter/jobs/${jobId}`);
      setActionMsg('Job posting requisition deleted successfully.');
      fetchJobs();
      setTimeout(() => setActionMsg(''), 4000);
    } catch (err) {
      console.error('Delete job error:', err);
    }
  };

  const filteredJobs = jobs.filter((j) => {
    const matchesSearch = (j.title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (j.department || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'All' || j.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
            <Briefcase className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900">Posted Jobs Requisitions</h1>
            <p className="text-xs font-semibold text-slate-500">Recruiter Ownership Dashboard · Single Source of Truth</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchJobs}
            className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all font-bold text-xs flex items-center gap-1.5"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="py-2.5 px-5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-2 transition-all transform active:scale-95"
          >
            <Plus className="w-4 h-4" />
            Post New Job
          </button>
        </div>
      </div>

      {actionMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600" />
          {actionMsg}
        </div>
      )}

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search jobs by title or department..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs font-bold text-slate-500">Filter Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="All">All Statuses</option>
            <option value="Published">Published</option>
            <option value="Draft">Draft</option>
            <option value="Closed">Closed</option>
          </select>
        </div>
      </div>

      {/* Jobs Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 font-semibold text-sm">
            Loading recruiter job requisitions from PostgreSQL...
          </div>
        ) : filteredJobs.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
              <Briefcase className="w-6 h-6" />
            </div>
            <h3 className="text-base font-extrabold text-slate-800">No Posted Jobs Found</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Only job requisitions created by your logged-in recruiter account appear here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Job Title & Company</th>
                  <th className="py-3.5 px-4">Dept & Mode</th>
                  <th className="py-3.5 px-4">Location & Salary</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Published Date</th>
                  <th className="py-3.5 px-4 text-center">Apps</th>
                  <th className="py-3.5 px-4 text-center">Shortlisted</th>
                  <th className="py-3.5 px-4 text-center">Interviews</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
                {filteredJobs.map((job) => (
                  <tr key={job.id} className="hover:bg-slate-50/80 transition-all">
                    <td className="py-4 px-4">
                      <p className="font-extrabold text-slate-900 text-sm">{job.title}</p>
                      <p className="text-[11px] text-slate-500 font-medium">{job.company || job.company_name}</p>
                    </td>

                    <td className="py-4 px-4">
                      <p className="font-bold text-slate-800">{job.department}</p>
                      <p className="text-[11px] text-slate-400 font-medium">{job.employment_type} · {job.work_mode}</p>
                    </td>

                    <td className="py-4 px-4">
                      <p className="font-bold text-slate-800">{job.location}</p>
                      <p className="text-[11px] text-indigo-600 font-bold">{job.salary || job.salary_range}</p>
                    </td>

                    <td className="py-4 px-4">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        job.status === 'Published' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                        job.status === 'Closed' ? 'bg-slate-100 text-slate-600 border border-slate-200' :
                        'bg-amber-100 text-amber-800 border border-amber-200'
                      }`}>
                        {job.status}
                      </span>
                    </td>

                    <td className="py-4 px-4 text-slate-600 font-medium">
                      {job.published_date}
                    </td>

                    <td className="py-4 px-4 text-center">
                      <span className="px-2.5 py-1 bg-slate-100 text-slate-800 rounded-lg font-black text-xs">
                        {job.applications_count || 0}
                      </span>
                    </td>

                    <td className="py-4 px-4 text-center">
                      <span className="px-2.5 py-1 bg-indigo-100 text-indigo-800 rounded-lg font-black text-xs">
                        {job.shortlisted_count || 0}
                      </span>
                    </td>

                    <td className="py-4 px-4 text-center">
                      <span className="px-2.5 py-1 bg-purple-100 text-purple-800 rounded-lg font-black text-xs">
                        {job.interview_count || 0}
                      </span>
                    </td>

                    <td className="py-4 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => { setSelectedJob(job); setIsViewModalOpen(true); }}
                          title="View Requisition Details"
                          className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {job.status === 'Published' && (
                          <button
                            onClick={() => handleCloseJob(job.id)}
                            title="Close Requisition"
                            className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteJob(job.id)}
                          title="Delete Requisition"
                          className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* View Job Requisition Modal */}
      {isViewModalOpen && selectedJob && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-7 border border-slate-200 shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-lg font-extrabold text-slate-900">{selectedJob.title}</h3>
                <p className="text-xs text-slate-400 font-semibold">{selectedJob.company} · {selectedJob.department}</p>
              </div>
              <button onClick={() => setIsViewModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 rounded-lg">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3 text-xs bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <div>
                <span className="text-slate-400 font-medium block">Total Applications</span>
                <span className="font-extrabold text-slate-900 text-sm">{selectedJob.applications_count}</span>
              </div>
              <div>
                <span className="text-slate-400 font-medium block">Shortlisted (ATS ≥80%)</span>
                <span className="font-extrabold text-indigo-600 text-sm">{selectedJob.shortlisted_count}</span>
              </div>
              <div>
                <span className="text-slate-400 font-medium block">Scheduled Interviews</span>
                <span className="font-extrabold text-purple-600 text-sm">{selectedJob.interview_count}</span>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <h4 className="font-extrabold text-slate-900 mb-1">Job Description</h4>
                <p className="text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">
                  {selectedJob.description || 'No detailed description provided.'}
                </p>
              </div>

              {selectedJob.required_skills && selectedJob.required_skills.length > 0 && (
                <div>
                  <h4 className="font-extrabold text-slate-900 mb-1.5">Required Skills</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedJob.required_skills.map((s: string, idx: number) => (
                      <span key={idx} className="px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-md font-bold text-[11px]">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                onClick={() => setIsViewModalOpen(false)}
                className="px-5 py-2 bg-slate-900 text-white rounded-xl font-bold text-xs hover:bg-slate-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Job Requisition Modal */}
      <CreateJobModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={() => {
          setActionMsg('New job requisition created successfully in PostgreSQL.');
          fetchJobs();
          setTimeout(() => setActionMsg(''), 4000);
        }}
      />
    </div>
  );
};
