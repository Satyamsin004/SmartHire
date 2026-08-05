import React, { useState, useEffect } from 'react';
import { X, Briefcase, Building, MapPin, DollarSign, Clock, Award, Users, CheckCircle2, Sparkles, AlertCircle } from 'lucide-react';
import api from '../../services/api';

interface CreateJobModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: any;
}

export const CreateJobModal: React.FC<CreateJobModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialData
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [title, setTitle] = useState('');
  const [companyName, setCompanyName] = useState('SmartHire Enterprise');
  const [companyLogo, setCompanyLogo] = useState('');
  const [department, setDepartment] = useState('Engineering');
  const [employmentType, setEmploymentType] = useState('Full Time');
  const [workMode, setWorkMode] = useState('Remote');
  const [location, setLocation] = useState('San Francisco, CA / Remote');
  const [salaryRange, setSalaryRange] = useState('$130,000 - $170,000');
  const [experienceRequired, setExperienceRequired] = useState('3-5 Years');
  const [educationRequired, setEducationRequired] = useState("Bachelor's Degree in CS / Engineering");
  const [requiredSkillsStr, setRequiredSkillsStr] = useState('React, TypeScript, FastAPI, PostgreSQL');
  const [preferredSkillsStr, setPreferredSkillsStr] = useState('Docker, Redis, System Design');
  const [description, setDescription] = useState('');
  const [responsibilities, setResponsibilities] = useState('');
  const [benefits, setBenefits] = useState('Health, Vision, Dental, 401(k) matching, Unlimited PTO');
  const [openings, setOpenings] = useState(2);
  const [status, setStatus] = useState<'Published' | 'Draft'>('Published');

  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title || '');
      setCompanyName(initialData.company_name || 'SmartHire Enterprise');
      setCompanyLogo(initialData.company_logo || '');
      setDepartment(initialData.department || 'Engineering');
      setEmploymentType(initialData.employment_type || 'Full Time');
      setWorkMode(initialData.work_mode || 'Remote');
      setLocation(initialData.location || 'San Francisco, CA / Remote');
      setSalaryRange(initialData.salary_range || '$130,000 - $170,000');
      setExperienceRequired(initialData.experience_required || '3-5 Years');
      setEducationRequired(initialData.education_required || '');
      setRequiredSkillsStr(Array.isArray(initialData.required_skills) ? initialData.required_skills.join(', ') : initialData.required_skills || '');
      setPreferredSkillsStr(Array.isArray(initialData.preferred_skills) ? initialData.preferred_skills.join(', ') : initialData.preferred_skills || '');
      setDescription(initialData.description || '');
      setResponsibilities(initialData.responsibilities || '');
      setBenefits(initialData.benefits || '');
      setOpenings(initialData.openings || 2);
      setStatus(initialData.status || 'Published');
    } else {
      // Clear form
      setTitle('');
      setDescription('');
      setResponsibilities('');
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      setError('Job Title and Job Description are mandatory fields.');
      return;
    }

    setLoading(true);
    setError(null);

    const requiredSkills = requiredSkillsStr.split(',').map(s => s.trim()).filter(Boolean);
    const preferredSkills = preferredSkillsStr.split(',').map(s => s.trim()).filter(Boolean);

    const payload = {
      title,
      company_name: companyName,
      company_logo: companyLogo || null,
      department,
      employment_type: employmentType,
      work_mode: workMode,
      location,
      salary_range: salaryRange,
      experience_required: experienceRequired,
      education_required: educationRequired,
      required_skills: requiredSkills,
      preferred_skills: preferredSkills,
      description,
      responsibilities,
      benefits,
      openings: Number(openings),
      status
    };

    try {
      if (initialData?.id) {
        await api.put(`/jobs/${initialData.id}`, payload);
      } else {
        await api.post('/jobs/create', payload);
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.detail || 'Failed to save job requisition.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-ink/60 backdrop-blur-md overflow-y-auto font-sans">
      <div className="bg-white rounded-4xl border border-stoneBorder shadow-floating w-full max-w-4xl max-h-[90vh] overflow-y-auto my-8">
        
        {/* Header */}
        <div className="p-6 border-b border-stoneBorder flex items-center justify-between sticky top-0 bg-white/95 backdrop-blur-md z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-brand-primary/10 text-brand-primary flex items-center justify-center font-extrabold">
              <Briefcase className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-brand-ink">
                {initialData ? 'Edit Job Requisition' : 'Create Job Requisition'}
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Enterprise ATS Hiring Specification (LinkedIn / Greenhouse Format)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-2xl hover:bg-cream-200 text-slate-400 hover:text-brand-ink transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} className="p-6 lg:p-8 space-y-6">
          
          {error && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Basic Requisition Specs */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-extrabold text-brand-ink mb-1.5 uppercase">Job Title *</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Senior Full Stack Engineer"
                className="w-full bg-cream-100 border border-stoneBorder rounded-2xl px-4 py-3 text-xs font-bold text-brand-ink focus:outline-none focus:border-brand-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-extrabold text-brand-ink mb-1.5 uppercase">Department</label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full bg-cream-100 border border-stoneBorder rounded-2xl px-4 py-3 text-xs font-bold text-brand-ink focus:outline-none focus:border-brand-primary"
              >
                <option value="Engineering">Engineering</option>
                <option value="Product">Product Management</option>
                <option value="Design">UI/UX Design</option>
                <option value="Data & AI">Data & AI Systems</option>
                <option value="DevOps & Infra">DevOps & Cloud Infra</option>
                <option value="Marketing & Sales">Marketing & Sales</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-extrabold text-brand-ink mb-1.5 uppercase">Company Name</label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full bg-cream-100 border border-stoneBorder rounded-2xl px-4 py-3 text-xs font-bold text-brand-ink focus:outline-none focus:border-brand-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-extrabold text-brand-ink mb-1.5 uppercase">Employment Type</label>
              <select
                value={employmentType}
                onChange={(e) => setEmploymentType(e.target.value)}
                className="w-full bg-cream-100 border border-stoneBorder rounded-2xl px-4 py-3 text-xs font-bold text-brand-ink focus:outline-none focus:border-brand-primary"
              >
                <option value="Full Time">Full Time</option>
                <option value="Part Time">Part Time</option>
                <option value="Internship">Internship</option>
                <option value="Contract">Contract</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-extrabold text-brand-ink mb-1.5 uppercase">Work Mode</label>
              <select
                value={workMode}
                onChange={(e) => setWorkMode(e.target.value)}
                className="w-full bg-cream-100 border border-stoneBorder rounded-2xl px-4 py-3 text-xs font-bold text-brand-ink focus:outline-none focus:border-brand-primary"
              >
                <option value="Remote">Remote</option>
                <option value="Hybrid">Hybrid</option>
                <option value="On-site">On-site</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-extrabold text-brand-ink mb-1.5 uppercase">Location</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="San Francisco, CA / Remote"
                className="w-full bg-cream-100 border border-stoneBorder rounded-2xl px-4 py-3 text-xs font-bold text-brand-ink focus:outline-none focus:border-brand-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-extrabold text-brand-ink mb-1.5 uppercase">Salary Range</label>
              <input
                type="text"
                value={salaryRange}
                onChange={(e) => setSalaryRange(e.target.value)}
                placeholder="$130,000 - $170,000"
                className="w-full bg-cream-100 border border-stoneBorder rounded-2xl px-4 py-3 text-xs font-bold text-brand-ink focus:outline-none focus:border-brand-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-extrabold text-brand-ink mb-1.5 uppercase">Experience Required</label>
              <input
                type="text"
                value={experienceRequired}
                onChange={(e) => setExperienceRequired(e.target.value)}
                placeholder="3-5 Years"
                className="w-full bg-cream-100 border border-stoneBorder rounded-2xl px-4 py-3 text-xs font-bold text-brand-ink focus:outline-none focus:border-brand-primary"
              />
            </div>
          </div>

          {/* Required Skills */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-extrabold text-brand-ink mb-1.5 uppercase">Required Skills (Comma Separated)</label>
              <input
                type="text"
                value={requiredSkillsStr}
                onChange={(e) => setRequiredSkillsStr(e.target.value)}
                placeholder="React, TypeScript, FastAPI, PostgreSQL"
                className="w-full bg-cream-100 border border-stoneBorder rounded-2xl px-4 py-3 text-xs font-bold text-brand-ink focus:outline-none focus:border-brand-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-extrabold text-brand-ink mb-1.5 uppercase">Preferred Skills</label>
              <input
                type="text"
                value={preferredSkillsStr}
                onChange={(e) => setPreferredSkillsStr(e.target.value)}
                placeholder="Docker, Redis, System Design"
                className="w-full bg-cream-100 border border-stoneBorder rounded-2xl px-4 py-3 text-xs font-bold text-brand-ink focus:outline-none focus:border-brand-primary"
              />
            </div>
          </div>

          {/* Description & Responsibilities */}
          <div>
            <label className="block text-xs font-extrabold text-brand-ink mb-1.5 uppercase">Job Description *</label>
            <textarea
              rows={4}
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detailed summary of role, team objectives, tech stack, and impact..."
              className="w-full bg-cream-100 border border-stoneBorder rounded-2xl px-4 py-3 text-xs font-bold text-brand-ink focus:outline-none focus:border-brand-primary"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-extrabold text-brand-ink mb-1.5 uppercase">Responsibilities</label>
              <textarea
                rows={3}
                value={responsibilities}
                onChange={(e) => setResponsibilities(e.target.value)}
                placeholder="Design scalable API endpoints, optimize DB queries..."
                className="w-full bg-cream-100 border border-stoneBorder rounded-2xl px-4 py-3 text-xs font-bold text-brand-ink focus:outline-none focus:border-brand-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-extrabold text-brand-ink mb-1.5 uppercase">Benefits & Perks</label>
              <textarea
                rows={3}
                value={benefits}
                onChange={(e) => setBenefits(e.target.value)}
                placeholder="Health insurance, equity grants, remote stipend..."
                className="w-full bg-cream-100 border border-stoneBorder rounded-2xl px-4 py-3 text-xs font-bold text-brand-ink focus:outline-none focus:border-brand-primary"
              />
            </div>
          </div>

          {/* Openings & Status */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-stoneBorder">
            <div>
              <label className="block text-xs font-extrabold text-brand-ink mb-1.5 uppercase">Open Positions Count</label>
              <input
                type="number"
                min={1}
                value={openings}
                onChange={(e) => setOpenings(Number(e.target.value))}
                className="w-full bg-cream-100 border border-stoneBorder rounded-2xl px-4 py-3 text-xs font-bold text-brand-ink focus:outline-none focus:border-brand-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-extrabold text-brand-ink mb-1.5 uppercase">Requisition Status</label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStatus('Published')}
                  className={`flex-1 py-3 rounded-2xl text-xs font-extrabold border transition-all ${
                    status === 'Published'
                      ? 'bg-brand-primary text-white border-brand-primary shadow-soft'
                      : 'bg-cream-100 text-brand-ink border-stoneBorder hover:bg-cream-200'
                  }`}
                >
                  Publish Immediately
                </button>
                <button
                  type="button"
                  onClick={() => setStatus('Draft')}
                  className={`flex-1 py-3 rounded-2xl text-xs font-extrabold border transition-all ${
                    status === 'Draft'
                      ? 'bg-amber-600 text-white border-amber-600 shadow-soft'
                      : 'bg-cream-100 text-brand-ink border-stoneBorder hover:bg-cream-200'
                  }`}
                >
                  Save as Draft
                </button>
              </div>
            </div>
          </div>

          {/* Action Footer */}
          <div className="pt-4 flex items-center justify-end gap-3 border-t border-stoneBorder">
            <button
              type="button"
              onClick={onClose}
              className="py-3 px-6 rounded-2xl bg-cream-200 hover:bg-stoneBorder text-brand-ink font-extrabold text-xs transition-all"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={loading}
              className="py-3.5 px-8 rounded-2xl bg-brand-primary hover:bg-sb-700 text-white font-extrabold text-xs flex items-center gap-2 shadow-luxury transition-all"
            >
              {loading ? (
                <span>Saving Requisition...</span>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{initialData ? 'Save Changes' : 'Confirm & Publish Requisition'}</span>
                </>
              )}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};

