import React, { useState, useEffect } from 'react';
import { X, Send, FileText, CheckCircle2, FileUp, AlertTriangle, Download, RefreshCw } from 'lucide-react';
import api from '../../services/api';

interface JobApplicationModalProps {
  job: any | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const JobApplicationModal: React.FC<JobApplicationModalProps> = ({ job, isOpen, onClose, onSuccess }) => {
  const [existingResume, setExistingResume] = useState<any | null>(null);
  const [loadingResume, setLoadingResume] = useState<boolean>(true);
  const [uploadingResume, setUploadingResume] = useState<boolean>(false);

  const [coverLetter, setCoverLetter] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [githubUrl, setGithubUrl] = useState('');
  const [portfolioUrl, setPortfolioUrl] = useState('');
  const [currentCtc, setCurrentCtc] = useState('');
  const [expectedCtc, setExpectedCtc] = useState('');
  const [noticePeriod, setNoticePeriod] = useState('2 Weeks');
  const [workAuth, setWorkAuth] = useState('Authorized to work in US');
  const [availability, setAvailability] = useState('Immediate');
  const [declaration, setDeclaration] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [appliedSuccess, setAppliedSuccess] = useState(false);

  const fetchCandidateResume = async () => {
    setLoadingResume(true);
    try {
      const res = await api.get('/resume/my-resume');
      if (res.data && res.data.file_path) {
        setExistingResume(res.data);
      } else {
        setExistingResume(null);
      }
    } catch (err) {
      setExistingResume(null);
    } finally {
      setLoadingResume(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchCandidateResume();
    }
  }, [isOpen]);

  if (!isOpen || !job) return null;

  const handleResumeFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const formData = new FormData();
      formData.append('file', e.target.files[0]);
      setUploadingResume(true);
      try {
        const res = await api.post('/uploads/resume', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        setExistingResume(res.data.resume);
      } catch (err: any) {
        alert(err.response?.data?.detail || 'Resume upload failed. Please ensure file is PDF format.');
      } finally {
        setUploadingResume(false);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!existingResume) {
      setErrorMsg('A PDF resume must be uploaded before submitting your application.');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');

    try {
      await api.post(`/jobs/${job.id}/apply`, {
        cover_letter: coverLetter,
        phone,
        address,
        linkedin_url: linkedinUrl,
        github_url: githubUrl,
        portfolio_url: portfolioUrl,
        current_ctc: currentCtc,
        expected_ctc: expectedCtc,
        expected_salary: expectedCtc,
        notice_period: noticePeriod,
        work_authorization: workAuth,
        availability,
        declaration
      });

      setAppliedSuccess(true);
      setTimeout(() => {
        setAppliedSuccess(false);
        onSuccess();
        onClose();
      }, 2000);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || 'Failed to submit application. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-100">
              OFFICIAL ATS APPLICATION FORM
            </span>
            <h2 className="text-xl font-extrabold text-slate-900 mt-1">{job.title}</h2>
            <p className="text-xs text-slate-500 font-medium">{job.company_name} · {job.location} ({job.work_mode || 'Remote'})</p>
          </div>

          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-xl">
            <X className="w-5 h-5" />
          </button>
        </div>

        {appliedSuccess ? (
          <div className="py-12 text-center space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center mx-auto shadow-sm">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-black text-slate-900">Application Submitted Successfully!</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Your resume and application details have been saved. AI Resume Screening is evaluating your profile against the job description.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            
            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-xl">
                {errorMsg}
              </div>
            )}

            {/* MANDATORY RESUME PROFILE SELECTION */}
            <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-indigo-600" />
                  Candidate Resume Profile (Mandatory)
                </span>
                {existingResume && (
                  <span className="text-[11px] font-extrabold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                    ✓ Resume Stored
                  </span>
                )}
              </div>

              {loadingResume ? (
                <div className="text-xs font-bold text-slate-400">Checking stored resume...</div>
              ) : existingResume ? (
                <div className="flex items-center justify-between bg-white p-3.5 rounded-xl border border-slate-200">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-extrabold text-slate-900">{existingResume.file_name || 'My_Resume.pdf'}</h4>
                      <span className="text-[11px] font-medium text-slate-500">Active PDF profile for ATS matching</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <a
                      href={existingResume.file_path}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold rounded-lg flex items-center gap-1"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download
                    </a>
                    <label className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[11px] font-bold rounded-lg cursor-pointer flex items-center gap-1">
                      <RefreshCw className="w-3.5 h-3.5" />
                      Replace
                      <input type="file" accept=".pdf" onChange={handleResumeFileUpload} className="hidden" />
                    </label>
                  </div>
                </div>
              ) : (
                <div className="bg-amber-50/60 p-4 rounded-xl border border-amber-200/80 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-amber-800 text-xs font-bold">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>No Resume Uploaded. Upload a PDF resume to enable submission.</span>
                  </div>
                  <label className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl cursor-pointer shadow-sm flex items-center gap-1.5">
                    <FileUp className="w-3.5 h-3.5 text-indigo-400" />
                    {uploadingResume ? 'Uploading...' : 'Upload Resume'}
                    <input type="file" accept=".pdf" onChange={handleResumeFileUpload} className="hidden" />
                  </label>
                </div>
              )}
            </div>

            {/* Application Form Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-semibold text-slate-700">
              <div>
                <label className="block mb-1 font-bold">Phone Number *</label>
                <input
                  type="text"
                  required
                  placeholder="+1 (555) 019-2834"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div>
                <label className="block mb-1 font-bold">Location / Address</label>
                <input
                  type="text"
                  placeholder="City, State, Country"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div>
                <label className="block mb-1 font-bold">Current CTC / Salary</label>
                <input
                  type="text"
                  placeholder="e.g. $110,000 / yr"
                  value={currentCtc}
                  onChange={(e) => setCurrentCtc(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div>
                <label className="block mb-1 font-bold">Expected CTC / Salary</label>
                <input
                  type="text"
                  placeholder="e.g. $140,000 / yr"
                  value={expectedCtc}
                  onChange={(e) => setExpectedCtc(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div>
                <label className="block mb-1 font-bold">Notice Period</label>
                <input
                  type="text"
                  placeholder="e.g. Immediate / 15 Days"
                  value={noticePeriod}
                  onChange={(e) => setNoticePeriod(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div>
                <label className="block mb-1 font-bold">Availability to Start</label>
                <input
                  type="text"
                  placeholder="e.g. Immediately"
                  value={availability}
                  onChange={(e) => setAvailability(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div>
                <label className="block mb-1 font-bold">LinkedIn Profile URL</label>
                <input
                  type="url"
                  placeholder="https://linkedin.com/in/username"
                  value={linkedinUrl}
                  onChange={(e) => setLinkedinUrl(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div>
                <label className="block mb-1 font-bold">GitHub / Portfolio URL</label>
                <input
                  type="url"
                  placeholder="https://github.com/username"
                  value={githubUrl}
                  onChange={(e) => setGithubUrl(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Cover Letter / Statement of Interest</label>
              <textarea
                rows={3}
                placeholder="Explain why your technical experience matches this job description..."
                value={coverLetter}
                onChange={(e) => setCoverLetter(e.target.value)}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer pt-2">
              <input
                type="checkbox"
                checked={declaration}
                onChange={(e) => setDeclaration(e.target.checked)}
                className="w-4 h-4 accent-slate-900 rounded"
              />
              <span>I hereby declare that all information submitted in this application is accurate and complete.</span>
            </label>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !declaration || !existingResume}
                className="py-3 px-6 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-2 transition-all transform active:scale-95 disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                {submitting ? 'Screening & Submitting...' : 'Submit Official Application'}
              </button>
            </div>

          </form>
        )}

      </div>
    </div>
  );
};

