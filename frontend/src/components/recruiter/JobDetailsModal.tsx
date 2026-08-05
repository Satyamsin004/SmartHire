import React from 'react';
import { X, Briefcase, Building, MapPin, DollarSign, Clock, Users, CheckCircle2, ShieldCheck, Tag } from 'lucide-react';

interface JobDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  job: any;
  onEdit?: (job: any) => void;
  onApply?: (job: any) => void;
  isApplied?: boolean;
}

export const JobDetailsModal: React.FC<JobDetailsModalProps> = ({
  isOpen,
  onClose,
  job,
  onEdit,
  onApply,
  isApplied = false
}) => {
  if (!isOpen || !job) return null;

  const requiredSkills = Array.isArray(job.required_skills)
    ? job.required_skills
    : (job.required_skills || '').split(',').map((s: string) => s.trim()).filter(Boolean);

  const preferredSkills = Array.isArray(job.preferred_skills)
    ? job.preferred_skills
    : (job.preferred_skills || '').split(',').map((s: string) => s.trim()).filter(Boolean);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-ink/60 backdrop-blur-md overflow-y-auto font-sans">
      <div className="bg-white rounded-4xl border border-stoneBorder shadow-floating w-full max-w-3xl max-h-[90vh] overflow-y-auto my-8">
        
        {/* Header */}
        <div className="p-6 border-b border-stoneBorder flex items-center justify-between sticky top-0 bg-white/95 backdrop-blur-md z-10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-primary to-sb-800 text-white flex items-center justify-center font-extrabold shadow-luxury">
              <Briefcase className="w-6 h-6" />
            </div>
            <div>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                job.status === 'Published' ? 'bg-indigo-100 text-indigo-800' : 'bg-amber-100 text-amber-800'
              }`}>
                {job.status || 'Published'} Requisition
              </span>
              <h2 className="text-xl font-extrabold text-brand-ink mt-0.5">
                {job.title}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-2xl hover:bg-cream-200 text-slate-400 hover:text-brand-ink transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 lg:p-8 space-y-6">
          
          {/* Metadata Chips */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-3xl bg-cream-100 border border-stoneBorder text-xs font-bold text-brand-ink">
            <div className="flex items-center gap-2">
              <Building className="w-4 h-4 text-brand-primary" />
              <span>{job.company_name || 'SmartHire AI'}</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-brand-primary" />
              <span>{job.location || 'Remote'}</span>
            </div>
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-brand-primary" />
              <span>{job.salary_range || 'Competitive'}</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-brand-primary" />
              <span>{job.applicant_count || 0} Applicants</span>
            </div>
          </div>

          {/* Description */}
          <div>
            <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-2">Requisition Overview</h3>
            <p className="text-xs text-brand-ink font-medium leading-relaxed bg-cream-100 p-4 rounded-2xl border border-stoneBorder whitespace-pre-line">
              {job.description || 'No detailed description provided.'}
            </p>
          </div>

          {/* Responsibilities if present */}
          {job.responsibilities && (
            <div>
              <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-2">Core Responsibilities</h3>
              <p className="text-xs text-brand-ink font-medium leading-relaxed bg-cream-100 p-4 rounded-2xl border border-stoneBorder whitespace-pre-line">
                {job.responsibilities}
              </p>
            </div>
          )}

          {/* Required Skills Badges */}
          <div>
            <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-2">Required Skills</h3>
            <div className="flex flex-wrap gap-2">
              {requiredSkills.length > 0 ? requiredSkills.map((skill: string, idx: number) => (
                <span key={idx} className="px-3 py-1.5 rounded-xl bg-brand-primary/10 border border-brand-primary/20 text-brand-primary text-xs font-bold flex items-center gap-1.5">
                  <Tag className="w-3 h-3" />
                  {skill}
                </span>
              )) : <span className="text-xs text-slate-400">None specified</span>}
            </div>
          </div>

          {/* Preferred Skills */}
          {preferredSkills.length > 0 && (
            <div>
              <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-2">Preferred Skills</h3>
              <div className="flex flex-wrap gap-2">
                {preferredSkills.map((skill: string, idx: number) => (
                  <span key={idx} className="px-3 py-1 rounded-xl bg-cream-200 text-slate-600 text-xs font-bold">
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Benefits */}
          {job.benefits && (
            <div>
              <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-2">Benefits & Perks</h3>
              <p className="text-xs text-brand-ink font-medium bg-indigo-50 border border-indigo-200 p-4 rounded-2xl text-indigo-900">
                {job.benefits}
              </p>
            </div>
          )}

          {/* Footer Action */}
          <div className="pt-4 flex items-center justify-end gap-3 border-t border-stoneBorder">
            <button
              onClick={onClose}
              className="py-2.5 px-5 rounded-2xl bg-cream-200 hover:bg-stoneBorder text-brand-ink font-extrabold text-xs transition-all"
            >
              Close Window
            </button>
            {onEdit && (
              <button
                onClick={() => { onClose(); onEdit(job); }}
                className="py-2.5 px-6 rounded-2xl bg-brand-primary hover:bg-sb-700 text-white font-extrabold text-xs transition-all shadow-luxury"
              >
                Edit Requisition Specs
              </button>
            )}
            {onApply && (
              isApplied ? (
                <span className="py-2.5 px-6 rounded-2xl bg-emerald-100 text-emerald-800 border border-emerald-200 font-extrabold text-xs flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Applied to Position
                </span>
              ) : (
                <button
                  onClick={() => { onClose(); onApply(job); }}
                  className="py-2.5 px-6 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs transition-all shadow-luxury"
                >
                  Apply Now
                </button>
              )
            )}
          </div>

        </div>

      </div>
    </div>
  );
};

