import React, { useState, useEffect } from 'react';
import { Briefcase, MapPin, DollarSign, Search, CheckCircle2 } from 'lucide-react';
import api from '../services/api';
import { JobApplicationModal } from '../components/candidate/JobApplicationModal';
import { JobDetailsModal } from '../components/recruiter/JobDetailsModal';
import { useWebSocket } from '../context/WebSocketContext';

export const JobsPage: React.FC = () => {
  const [jobs, setJobs] = useState<any[]>([]);
  const [filteredJobs, setFilteredJobs] = useState<any[]>([]);
  const [appliedJobIds, setAppliedJobIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedJobForApply, setSelectedJobForApply] = useState<any | null>(null);
  const [selectedJobForView, setSelectedJobForView] = useState<any | null>(null);
  const { lastMessage } = useWebSocket();

  const fetchJobsData = async () => {
    try {
      const [resPublic, resMyApps] = await Promise.allSettled([
        api.get('/jobs/public'),
        api.get('/jobs/my-applications')
      ]);

      if (resPublic.status === 'fulfilled' && resPublic.value?.data) {
        setJobs(resPublic.value.data);
        setFilteredJobs(resPublic.value.data);
      }
      if (resMyApps.status === 'fulfilled' && resMyApps.value?.data) {
        const ids = resMyApps.value.data.map((a: any) => a.job_id);
        setAppliedJobIds(ids);
      }
    } catch (err) {
      console.warn('Fetch jobs error:', err);
    }
  };

  useEffect(() => {
    fetchJobsData();
  }, []);

  // Listen for realtime job or application updates
  useEffect(() => {
    if (lastMessage) {
      fetchJobsData();
    }
  }, [lastMessage]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredJobs(jobs);
    } else {
      const lowerQ = searchQuery.toLowerCase();
      setFilteredJobs(jobs.filter(j => 
        (j.title && j.title.toLowerCase().includes(lowerQ)) ||
        (j.company_name && j.company_name.toLowerCase().includes(lowerQ))
      ));
    }
  }, [searchQuery, jobs]);

  return (
    <>
      <main className="p-6 lg:p-10 max-w-7xl mx-auto w-full space-y-8">
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Job Requisitions</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">Browse open roles and submit your application.</p>
          </div>
          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search jobs or companies..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-stoneBorder dark:border-slate-800 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-brand-accent focus:outline-none shadow-sm"
            />
          </div>
        </div>

        <div className="space-y-4">
          {filteredJobs.length === 0 ? (
            <div className="p-12 text-center bg-cream-100 dark:bg-slate-900/60 rounded-3xl border border-stoneBorder dark:border-slate-800">
              <Briefcase className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <h4 className="text-sm font-extrabold text-brand-ink dark:text-white">No Job Requisitions Found</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1">
                Check back soon for newly published roles.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredJobs.map((job) => {
                const isApplied = appliedJobIds.includes(job.id);
                return (
                  <div key={job.id} className="card-luxury p-6 flex flex-col justify-between space-y-4 hover:border-brand-primary transition-all bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-cream-200 dark:bg-slate-800 text-brand-primary dark:text-indigo-400 flex items-center justify-center font-extrabold text-lg border border-stoneBorder dark:border-slate-700">
                          {job.company_name ? job.company_name.charAt(0).toUpperCase() : 'C'}
                        </div>
                        <div>
                          <h4 className="text-sm font-extrabold text-brand-ink dark:text-white">{job.title}</h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">{job.company_name || 'Enterprise Client'}</p>
                        </div>
                      </div>
                      {isApplied && (
                        <span className="px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-[10px] font-extrabold flex items-center gap-1 border border-emerald-200 dark:border-emerald-800">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                          Applied
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-3 text-xs text-slate-600 dark:text-slate-300 font-medium">
                      <span className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800/80 px-2.5 py-1 rounded-xl">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        {job.location || 'Remote'}
                      </span>
                      <span className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800/80 px-2.5 py-1 rounded-xl">
                        <DollarSign className="w-3.5 h-3.5 text-slate-400" />
                        {job.salary_range || '$120k - $160k'}
                      </span>
                    </div>

                    <div className="pt-4 border-t border-stoneBorder dark:border-slate-800 flex items-center justify-between">
                      <button
                        onClick={() => setSelectedJobForView(job)}
                        className="text-xs font-extrabold text-brand-primary dark:text-indigo-400 hover:underline"
                      >
                        View Specs
                      </button>

                      {isApplied ? (
                        <button
                          disabled
                          className="px-5 py-2.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-extrabold text-xs border border-emerald-200 dark:border-emerald-800 cursor-not-allowed flex items-center gap-1"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          Applied
                        </button>
                      ) : (
                        <button
                          onClick={() => setSelectedJobForApply(job)}
                          className="px-5 py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white font-extrabold text-xs shadow-soft transition-colors"
                        >
                          Apply Now
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {selectedJobForApply && (
        <JobApplicationModal
          isOpen={!!selectedJobForApply}
          job={selectedJobForApply}
          onClose={() => setSelectedJobForApply(null)}
          onSuccess={() => {
            setSelectedJobForApply(null);
            fetchJobsData();
          }}
        />
      )}

      {selectedJobForView && (
        <JobDetailsModal
          isOpen={!!selectedJobForView}
          job={selectedJobForView}
          isApplied={appliedJobIds.includes(selectedJobForView.id)}
          onApply={(jobToApply) => {
            setSelectedJobForView(null);
            setSelectedJobForApply(jobToApply);
          }}
          onClose={() => setSelectedJobForView(null)}
        />
      )}
    </>
  );
};

