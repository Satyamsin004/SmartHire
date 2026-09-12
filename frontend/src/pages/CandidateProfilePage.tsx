import React, { useState, useEffect, useRef } from 'react';
import { User, Mail, MapPin, Briefcase, FileText, Edit3, Camera, Upload, Globe, Phone, Linkedin, Github, 
  GraduationCap, Award, Code, CheckCircle2, AlertCircle, Save, X, Building2, DollarSign, Clock } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useWebSocket } from '../context/WebSocketContext';

interface ProfileData {
  full_name: string;
  email: string;
  profile_image: string | null;
  target_role: string;
  experience_level: string;
  phone: string;
  bio: string;
  headline: string;
  location: string;
  preferred_location: string;
  expected_salary: string;
  employment_preference: string;
  work_authorization: string;
  github_url: string;
  linkedin_url: string;
  portfolio_url: string;
  languages: string[];
  status: string;
  password?: string;
  resume_url?: string | null;
  resume_filename?: string | null;
}

interface ResumeData {
  id: string;
  file_name: string;
  version: number;
  summary: string;
  skills: any[];
  experience_years: string;
  education_level: string;
  projects: any[];
  certifications: string[];
  languages: string[];
}

export const CandidateProfilePage: React.FC = () => {
  const { user } = useAuth();
  const { lastMessage } = useWebSocket();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [resume, setResume] = useState<ResumeData | null>(null);
  const [metrics, setMetrics] = useState<any>(null);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<ProfileData>>({});
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  
  const resumeInputRef = useRef<HTMLInputElement>(null);
  const [uploadingResume, setUploadingResume] = useState(false);
  const [resumeUploadProgress, setResumeUploadProgress] = useState(0);
  const [resumeError, setResumeError] = useState<string | null>(null);
  const [resumeSuccess, setResumeSuccess] = useState<string | null>(null);

  const handleResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validExtensions = ['.pdf', '.docx'];
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    if (!validExtensions.includes(ext)) {
      setResumeError('Only PDF (.pdf) and Word (.docx) files are supported.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setResumeError('File size exceeds maximum limit of 10 MB.');
      return;
    }

    setUploadingResume(true);
    setResumeUploadProgress(0);
    setResumeError(null);
    setResumeSuccess(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await api.post('/uploads/resume', formData, {
        onUploadProgress: (progressEvent) => {
          const percent = progressEvent.total ? Math.round((progressEvent.loaded * 100) / progressEvent.total) : 0;
          setResumeUploadProgress(percent);
        }
      });
      setResumeSuccess(`Resume "${file.name}" uploaded and parsed successfully!`);
      await fetchProfile();
      await fetchMetrics();
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      let msg = 'Failed to analyze resume. Please try again.';
      if (typeof detail === 'string') {
        msg = detail;
      } else if (Array.isArray(detail) && detail.length > 0) {
        msg = detail.map((d: any) => d.msg || d.detail || JSON.stringify(d)).join(', ');
      } else if (err.message && err.message !== 'Network Error') {
        msg = err.message;
      } else if (!err.response) {
        msg = 'Server connection failed. Please ensure the backend container is running and try again.';
      }
      setResumeError(msg);
    } finally {
      setUploadingResume(false);
      if (resumeInputRef.current) resumeInputRef.current.value = '';
    }
  };

  useEffect(() => {
    fetchProfile();
    fetchMetrics();
  }, []);

  // Listen for realtime updates
  useEffect(() => {
    if (lastMessage) {
      fetchProfile();
      fetchMetrics();
    }
  }, [lastMessage]);

  const fetchProfile = async () => {
    try {
      const res = await api.get('/users/me');
      setProfile(res.data);
    } catch (err) {
      console.warn('Fetch profile error:', err);
    }
  };

  const fetchMetrics = async () => {
    try {
      const res = await api.get('/users/candidate-metrics');
      setMetrics(res.data);
      if (res.data.latest_resume) {
        setResume(res.data.latest_resume);
      }
    } catch (err) {
      console.warn('Fetch metrics error:', err);
    }
  };

  const handleEdit = () => {
    if (profile) {
      setEditForm({
        full_name: profile.full_name,
        target_role: profile.target_role,
        experience_level: profile.experience_level,
        phone: profile.phone,
        bio: profile.bio,
        headline: profile.headline,
        location: profile.location,
        preferred_location: profile.preferred_location,
        expected_salary: profile.expected_salary,
        employment_preference: profile.employment_preference,
        work_authorization: profile.work_authorization,
        github_url: profile.github_url,
        linkedin_url: profile.linkedin_url,
        portfolio_url: profile.portfolio_url,
      });
      setEditing(true);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.patch('/users/me', editForm);
      await fetchProfile();
      setEditing(false);
    } catch (err) {
      console.warn('Save profile error:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingAvatar(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await api.post('/uploads/avatar', formData);
      const newUrl = res.data?.profile_image || res.data?.avatar_url || res.data?.url;
      if (newUrl) {
        setProfile(prev => prev ? { ...prev, profile_image: newUrl } : null);
        const raw = localStorage.getItem('user_data') || localStorage.getItem('user');
        const curr = raw ? JSON.parse(raw) : {};
        const updated = { ...curr, profile_image: newUrl, avatar_url: newUrl };
        localStorage.setItem('user_data', JSON.stringify(updated));
        localStorage.setItem('user', JSON.stringify(updated));
        window.dispatchEvent(new Event('user_profile_updated'));
      }
    } catch (err) {
      console.warn('Avatar upload error:', err);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U';

  const profileChecks = profile ? [
    { label: 'Full Name', done: !!profile.full_name },
    { label: 'Email', done: !!profile.email },
    { label: 'Profile Photo', done: !!profile.profile_image },
    { label: 'Phone', done: !!profile.phone },
    { label: 'Bio / Summary', done: !!profile.bio },
    { label: 'Target Role', done: !!profile.target_role },
    { label: 'Experience Level', done: !!profile.experience_level },
    { label: 'Resume Uploaded', done: !!resume },
    { label: 'Skills Extracted', done: (resume?.skills?.length || 0) > 0 },
    { label: 'Location', done: !!profile.location },
  ] : [];
  const completedCount = profileChecks.filter(c => c.done).length;
  const completionPercent = profileChecks.length > 0 ? Math.round((completedCount / profileChecks.length) * 100) : 0;

  if (!profile) {
    return (
      <main className="p-6 lg:p-10 max-w-7xl mx-auto w-full flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin mx-auto" />
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400">Loading profile...</p>
        </div>
      </main>
    );
  }

  return (
    <>
      <main className="p-6 lg:p-10 max-w-7xl mx-auto w-full space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl lg:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Candidate Profile</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">Manage your personal information and recruitment profile.</p>
          </div>
          {!editing && (
            <button
              onClick={handleEdit}
              className="px-5 py-2.5 rounded-full bg-brand-primary dark:bg-indigo-600 text-white font-extrabold text-xs shadow-soft hover:bg-slate-800 dark:hover:bg-indigo-500 transition-colors flex items-center gap-2"
            >
              <Edit3 className="w-3.5 h-3.5" /> Edit Profile
            </button>
          )}
        </div>

        {/* Profile Header Card */}
        <div className="card-luxury p-8 bg-white dark:bg-slate-900 rounded-4xl border border-stoneBorder dark:border-slate-800">
          <div className="flex flex-col md:flex-row items-start gap-8">
            {/* Avatar */}
            <div className="relative group shrink-0">
              <div className="w-28 h-28 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/30 text-white text-3xl font-extrabold border-4 border-white dark:border-slate-800 overflow-hidden">
                {profile.profile_image ? (
                  <img src={profile.profile_image} alt={profile.full_name} className="w-full h-full object-cover" />
                ) : (
                  initials
                )}
              </div>
              <button
                onClick={() => avatarInputRef.current?.click()}
                className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-white dark:bg-slate-800 shadow-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
              >
                {uploadingAvatar ? <div className="w-4 h-4 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin" /> : <Camera className="w-4 h-4" />}
              </button>
              <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
            </div>

            {/* Info */}
            <div className="flex-1 space-y-3">
              {editing ? (
                <div className="space-y-3">
                  <input
                    value={editForm.full_name || ''}
                    onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                    className="text-2xl font-black text-brand-ink dark:text-white bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 w-full focus:outline-none focus:border-indigo-400"
                    placeholder="Full Name"
                  />
                  <input
                    value={editForm.headline || ''}
                    onChange={(e) => setEditForm({ ...editForm, headline: e.target.value })}
                    className="text-sm font-semibold text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 w-full focus:outline-none focus:border-indigo-400"
                    placeholder="Headline (e.g., Senior Software Engineer)"
                  />
                </div>
              ) : (
                <div>
                  <h2 className="text-2xl font-black text-brand-ink dark:text-white">{profile.full_name}</h2>
                  {profile.headline && <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 mt-0.5">{profile.headline}</p>}
                </div>
              )}

              <div className="flex flex-wrap gap-4">
                <span className="flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400">
                  <Mail className="w-4 h-4 text-brand-primary dark:text-indigo-400" /> {profile.email}
                </span>
                {(profile.phone || editing) && (
                  editing ? (
                    <input
                      value={editForm.phone || ''}
                      onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                      className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg px-2 py-1 w-36 focus:outline-none focus:border-indigo-400"
                      placeholder="Phone"
                    />
                  ) : (
                    <span className="flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400">
                      <Phone className="w-4 h-4 text-brand-primary dark:text-indigo-400" /> {profile.phone}
                    </span>
                  )
                )}
                {(profile.location || editing) && (
                  editing ? (
                    <input
                      value={editForm.location || ''}
                      onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                      className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg px-2 py-1 w-40 focus:outline-none focus:border-indigo-400"
                      placeholder="City, State"
                    />
                  ) : (
                    <span className="flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400">
                      <MapPin className="w-4 h-4 text-brand-primary dark:text-indigo-400" /> {profile.location}
                    </span>
                  )
                )}
                {profile.employment_preference && !editing && (
                  <span className="flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400">
                    <Briefcase className="w-4 h-4 text-brand-primary dark:text-indigo-400" /> {profile.employment_preference}
                  </span>
                )}
              </div>

              {/* Social Links */}
              <div className="flex flex-wrap gap-3 pt-1">
                {editing ? (
                  <>
                    <input
                      value={editForm.github_url || ''}
                      onChange={(e) => setEditForm({ ...editForm, github_url: e.target.value })}
                      className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg px-2 py-1 w-52 focus:outline-none focus:border-indigo-400"
                      placeholder="GitHub URL"
                    />
                    <input
                      value={editForm.linkedin_url || ''}
                      onChange={(e) => setEditForm({ ...editForm, linkedin_url: e.target.value })}
                      className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg px-2 py-1 w-52 focus:outline-none focus:border-indigo-400"
                      placeholder="LinkedIn URL"
                    />
                    <input
                      value={editForm.portfolio_url || ''}
                      onChange={(e) => setEditForm({ ...editForm, portfolio_url: e.target.value })}
                      className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg px-2 py-1 w-52 focus:outline-none focus:border-indigo-400"
                      placeholder="Portfolio URL"
                    />
                  </>
                ) : (
                  <>
                    {profile.github_url && (
                      <a href={profile.github_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                        <Github className="w-3.5 h-3.5" /> GitHub
                      </a>
                    )}
                    {profile.linkedin_url && (
                      <a href={profile.linkedin_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/50 text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors">
                        <Linkedin className="w-3.5 h-3.5" /> LinkedIn
                      </a>
                    )}
                    {profile.portfolio_url && (
                      <a href={profile.portfolio_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors">
                        <Globe className="w-3.5 h-3.5" /> Portfolio
                      </a>
                    )}
                  </>
                )}
              </div>

              {editing && (
                <div className="flex gap-3 pt-3">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-5 py-2.5 rounded-full bg-brand-primary dark:bg-indigo-600 text-white font-extrabold text-xs shadow-soft hover:bg-slate-800 dark:hover:bg-indigo-500 transition-colors flex items-center gap-2 disabled:opacity-50"
                  >
                    <Save className="w-3.5 h-3.5" /> {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button
                    onClick={() => setEditing(false)}
                    className="px-5 py-2.5 rounded-full bg-white dark:bg-slate-800 border border-stoneBorder dark:border-slate-700 text-brand-ink dark:text-white font-extrabold text-xs hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center gap-2"
                  >
                    <X className="w-3.5 h-3.5" /> Cancel
                  </button>
                </div>
              )}
            </div>

            {/* Profile Completion */}
            <div className="shrink-0 text-center">
              <div className="relative w-20 h-20 mx-auto">
                <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                  <circle cx="40" cy="40" r="36" fill="none" stroke="currentColor" className="text-slate-200 dark:text-slate-800" strokeWidth="6" />
                  <circle cx="40" cy="40" r="36" fill="none" stroke="#4F46E5" strokeWidth="6"
                    strokeDasharray={`${(completionPercent / 100) * 226.2} 226.2`}
                    strokeLinecap="round" />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-lg font-black text-brand-ink dark:text-white">{completionPercent}%</span>
              </div>
              <p className="text-[10px] font-bold text-slate-400 mt-2">Profile Complete</p>
            </div>
          </div>
        </div>

        {/* Edit Form Details */}
        {editing && (
          <div className="card-luxury p-8 space-y-6 bg-white dark:bg-slate-900 rounded-4xl border border-stoneBorder dark:border-slate-800">
            <h3 className="text-sm font-extrabold text-brand-ink dark:text-white uppercase tracking-wider">Additional Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Target Role</label>
                <input
                  value={editForm.target_role || ''}
                  onChange={(e) => setEditForm({ ...editForm, target_role: e.target.value })}
                  className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl px-3 py-2.5 w-full focus:outline-none focus:border-indigo-400"
                  placeholder="e.g., Senior Software Engineer"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Experience Level</label>
                <select
                  value={editForm.experience_level || ''}
                  onChange={(e) => setEditForm({ ...editForm, experience_level: e.target.value })}
                  className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl px-3 py-2.5 w-full focus:outline-none focus:border-indigo-400"
                >
                  <option value="">Select...</option>
                  <option value="Entry Level">Entry Level (0-2 years)</option>
                  <option value="Mid Level">Mid Level (3-5 years)</option>
                  <option value="Senior">Senior (5-8 years)</option>
                  <option value="Staff">Staff (8-12 years)</option>
                  <option value="Principal">Principal (12+ years)</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Employment Preference</label>
                <select
                  value={editForm.employment_preference || ''}
                  onChange={(e) => setEditForm({ ...editForm, employment_preference: e.target.value })}
                  className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl px-3 py-2.5 w-full focus:outline-none focus:border-indigo-400"
                >
                  <option value="">Select...</option>
                  <option value="Full Time">Full Time</option>
                  <option value="Part Time">Part Time</option>
                  <option value="Contract">Contract</option>
                  <option value="Freelance">Freelance</option>
                  <option value="Internship">Internship</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Expected Salary</label>
                <input
                  value={editForm.expected_salary || ''}
                  onChange={(e) => setEditForm({ ...editForm, expected_salary: e.target.value })}
                  className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl px-3 py-2.5 w-full focus:outline-none focus:border-indigo-400"
                  placeholder="e.g., $120,000 - $160,000"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Work Authorization</label>
                <input
                  value={editForm.work_authorization || ''}
                  onChange={(e) => setEditForm({ ...editForm, work_authorization: e.target.value })}
                  className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl px-3 py-2.5 w-full focus:outline-none focus:border-indigo-400"
                  placeholder="e.g., US Citizen, H1B, etc."
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Preferred Location</label>
                <input
                  value={editForm.preferred_location || ''}
                  onChange={(e) => setEditForm({ ...editForm, preferred_location: e.target.value })}
                  className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl px-3 py-2.5 w-full focus:outline-none focus:border-indigo-400"
                  placeholder="e.g., Remote / San Francisco / Hybrid"
                />
              </div>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Professional Summary</label>
              <textarea
                value={editForm.bio || ''}
                onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                rows={3}
                className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl px-3 py-2.5 w-full focus:outline-none focus:border-indigo-400 resize-none"
                placeholder="Write a brief professional summary..."
              />
            </div>
          </div>
        )}

        {/* Bio/Summary */}
        {!editing && profile.bio && (
          <div className="card-luxury p-6 bg-white dark:bg-slate-900 rounded-3xl border border-stoneBorder dark:border-slate-800">
            <h3 className="text-xs font-extrabold text-brand-ink dark:text-white uppercase tracking-wider mb-3">About</h3>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300 leading-relaxed">{profile.bio}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Resume Section */}
          <div className="card-luxury p-6 space-y-4 bg-white dark:bg-slate-900 rounded-3xl border border-stoneBorder dark:border-slate-800">
            <input
              ref={resumeInputRef}
              type="file"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="hidden"
              onChange={handleResumeUpload}
            />

            <div className="flex items-center justify-between">
              <h3 className="text-xs font-extrabold text-brand-ink dark:text-white uppercase tracking-wider flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-500" /> Resume
              </h3>
              <div className="flex items-center gap-2">
                {resume && (
                  <span className="px-2 py-0.5 rounded-lg bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold border border-indigo-200 dark:border-indigo-800">
                    v{resume.version}
                  </span>
                )}
                <button
                  onClick={() => resumeInputRef.current?.click()}
                  disabled={uploadingResume}
                  className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold flex items-center gap-1.5 transition-colors shadow-xs"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{resume ? 'Update Resume' : 'Upload Resume'}</span>
                </button>
              </div>
            </div>

            {uploadingResume && (
              <div className="p-4 rounded-2xl bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/50 space-y-2 text-center">
                <div className="flex items-center justify-center gap-2 text-xs font-extrabold text-indigo-600 dark:text-indigo-400">
                  <div className="w-4 h-4 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin" />
                  <span>Uploading & Extracting Skills with AI... ({resumeUploadProgress}%)</span>
                </div>
                <div className="w-full h-1.5 bg-indigo-200 dark:bg-indigo-900 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-600 transition-all duration-300" style={{ width: `${resumeUploadProgress}%` }} />
                </div>
              </div>
            )}

            {resumeSuccess && (
              <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{resumeSuccess}</span>
              </div>
            )}

            {resumeError && (
              <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs font-bold text-rose-700 dark:text-rose-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{resumeError}</span>
              </div>
            )}

            {resume ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3.5 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-100 dark:border-slate-700/80">
                  <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-extrabold text-brand-ink dark:text-white truncate">{resume.file_name}</p>
                    <p className="text-[10px] text-slate-400 font-medium">
                      Version {resume.version} • {resume.experience_years ? `${resume.experience_years} experience` : 'Verified'}
                    </p>
                  </div>
                  {profile.resume_url && (
                    <a
                      href={profile.resume_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors"
                    >
                      View
                    </a>
                  )}
                </div>
                {resume.summary && resume.summary !== 'Not Available' && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed bg-slate-50/50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-700">{resume.summary}</p>
                )}
              </div>
            ) : (
              <div
                onClick={() => resumeInputRef.current?.click()}
                className="border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-500 rounded-2xl p-6 text-center cursor-pointer hover:bg-indigo-50/30 dark:hover:bg-indigo-950/30 transition-all space-y-2"
              >
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs font-extrabold text-slate-900 dark:text-white">Click or Drag PDF / DOCX Resume Here</p>
                  <p className="text-[10px] font-semibold text-slate-400 mt-0.5">Supports PDF and Word (.docx) up to 10MB</p>
                </div>
                <button
                  type="button"
                  className="px-4 py-2 rounded-xl bg-brand-primary dark:bg-indigo-600 text-white text-xs font-extrabold shadow-xs hover:bg-slate-800 dark:hover:bg-indigo-500 transition-colors inline-block mt-1"
                >
                  Browse Resume File
                </button>
              </div>
            )}
          </div>

          {/* Skills Section */}
          <div className="card-luxury p-6 space-y-4 bg-white dark:bg-slate-900 rounded-3xl border border-stoneBorder dark:border-slate-800">
            <h3 className="text-xs font-extrabold text-brand-ink dark:text-white uppercase tracking-wider flex items-center gap-2">
              <Code className="w-4 h-4 text-emerald-500" /> Skills ({resume?.skills?.length || 0})
            </h3>
            {(resume?.skills?.length || 0) > 0 ? (
              <div className="flex flex-wrap gap-2">
                {resume!.skills.map((sk: any, i: number) => {
                  const name = typeof sk === 'string' ? sk : sk.skill_name;
                  return (
                    <span key={i} className="px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-slate-700 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors border border-transparent dark:border-slate-700">
                      {name}
                    </span>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-slate-400 font-medium">Upload a resume to extract skills automatically.</p>
            )}
          </div>

          {/* Education & Certifications */}
          <div className="card-luxury p-6 space-y-4 bg-white dark:bg-slate-900 rounded-3xl border border-stoneBorder dark:border-slate-800">
            <h3 className="text-xs font-extrabold text-brand-ink dark:text-white uppercase tracking-wider flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-amber-500" /> Education
            </h3>
            {resume?.education_level && resume.education_level !== 'Not Available' ? (
              <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                <GraduationCap className="w-6 h-6 text-amber-500" />
                <p className="text-xs font-bold text-brand-ink dark:text-white">{resume.education_level}</p>
              </div>
            ) : (
              <p className="text-xs text-slate-400 font-medium">Education details will be extracted from your resume.</p>
            )}
            {(resume?.certifications?.length || 0) > 0 && resume!.certifications[0] !== 'Not Available' && (
              <>
                <h4 className="text-xs font-extrabold text-brand-ink dark:text-white uppercase tracking-wider flex items-center gap-2 pt-2">
                  <Award className="w-4 h-4 text-indigo-500" /> Certifications
                </h4>
                <div className="space-y-2">
                  {resume!.certifications.map((cert: string, i: number) => (
                    <div key={i} className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> {cert}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Quick Stats */}
          <div className="card-luxury p-6 space-y-4 bg-white dark:bg-slate-900 rounded-3xl border border-stoneBorder dark:border-slate-800">
            <h3 className="text-xs font-extrabold text-brand-ink dark:text-white uppercase tracking-wider">Quick Stats</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 text-center border border-slate-100 dark:border-slate-700">
                <p className="text-2xl font-black text-brand-primary dark:text-indigo-400">{metrics?.jobs_applied || 0}</p>
                <p className="text-[10px] font-bold text-slate-400 mt-0.5">Jobs Applied</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 text-center border border-slate-100 dark:border-slate-700">
                <p className="text-2xl font-black text-emerald-500">{metrics?.interviews_completed || 0}</p>
                <p className="text-[10px] font-bold text-slate-400 mt-0.5">Interviews Done</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 text-center border border-slate-100 dark:border-slate-700">
                <p className="text-2xl font-black text-amber-500">{metrics?.avg_interview_score || 0}%</p>
                <p className="text-[10px] font-bold text-slate-400 mt-0.5">Avg Score</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 text-center border border-slate-100 dark:border-slate-700">
                <p className="text-2xl font-black text-indigo-500 dark:text-indigo-400">{metrics?.readiness_score ? Math.round(metrics.readiness_score) : 0}%</p>
                <p className="text-[10px] font-bold text-slate-400 mt-0.5">Readiness</p>
              </div>
            </div>
          </div>

          {/* Projects */}
          {(resume?.projects?.length || 0) > 0 && resume!.projects[0] !== 'Not Available' && (
            <div className="card-luxury p-6 space-y-4 lg:col-span-2 bg-white dark:bg-slate-900 rounded-3xl border border-stoneBorder dark:border-slate-800">
              <h3 className="text-xs font-extrabold text-brand-ink dark:text-white uppercase tracking-wider flex items-center gap-2">
                <Code className="w-4 h-4 text-violet-500" /> Projects
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {resume!.projects.map((proj: any, i: number) => {
                  const text = typeof proj === 'string' ? proj : proj.name || JSON.stringify(proj);
                  return (
                    <div key={i} className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                      <p className="text-xs font-bold text-brand-ink dark:text-white">{text}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Account Settings & Preferences Section */}
          <div className="card-luxury p-6 space-y-6 lg:col-span-2 bg-white dark:bg-slate-900 rounded-3xl border border-stoneBorder dark:border-slate-800">
            <h3 className="text-sm font-extrabold text-brand-ink dark:text-white uppercase tracking-wider">Account Settings & Preferences</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Change Password */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-100 dark:border-slate-700 space-y-3">
                <h4 className="text-xs font-extrabold text-brand-ink dark:text-white uppercase tracking-wider">Account Password</h4>
                <p className="text-[10px] text-slate-400 font-medium">Update your login security password.</p>
                <div className="space-y-2">
                  <input
                    type="password"
                    placeholder="New Password (min 6 chars)"
                    value={editForm.password || ''}
                    onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                    className="text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl px-3 py-2 w-full focus:outline-none focus:border-indigo-400"
                  />
                  <button
                    onClick={handleSave}
                    disabled={saving || !editForm.password}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs transition-colors disabled:opacity-50"
                  >
                    Update Password
                  </button>
                </div>
              </div>

              {/* Notification Settings */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-100 dark:border-slate-700 space-y-3">
                <h4 className="text-xs font-extrabold text-brand-ink dark:text-white uppercase tracking-wider">Notification Preferences</h4>
                <div className="space-y-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" defaultChecked className="rounded text-indigo-600 focus:ring-indigo-500 dark:bg-slate-900 dark:border-slate-700" />
                    <span>Email Notifications for Interview Results</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" defaultChecked className="rounded text-indigo-600 focus:ring-indigo-500 dark:bg-slate-900 dark:border-slate-700" />
                    <span>Recruiter Message Alerts</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" defaultChecked className="rounded text-indigo-600 focus:ring-indigo-500 dark:bg-slate-900 dark:border-slate-700" />
                    <span>Job Application Updates</span>
                  </label>
                </div>
              </div>

              {/* Interview Preferences */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-100 dark:border-slate-700 space-y-3">
                <h4 className="text-xs font-extrabold text-brand-ink dark:text-white uppercase tracking-wider">Interview Preferences</h4>
                <div className="space-y-2 text-xs text-slate-700 dark:text-slate-300">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Default Difficulty</label>
                    <select className="w-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl p-2 font-semibold">
                      <option value="Medium">Medium</option>
                      <option value="Easy">Easy</option>
                      <option value="Hard">Hard</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase">AI Speech Speed</label>
                    <select className="w-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl p-2 font-semibold">
                      <option value="1.0">Normal (1.0x)</option>
                      <option value="0.9">Slower (0.9x)</option>
                      <option value="1.1">Faster (1.1x)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Assessment Preferences */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-100 dark:border-slate-700 space-y-3">
                <h4 className="text-xs font-extrabold text-brand-ink dark:text-white uppercase tracking-wider">Assessment Preferences</h4>
                <div className="space-y-2 text-xs text-slate-700 dark:text-slate-300">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Default Duration</label>
                    <select className="w-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl p-2 font-semibold">
                      <option value="15">15 Minutes</option>
                      <option value="30">30 Minutes</option>
                      <option value="45">45 Minutes</option>
                    </select>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer pt-1 font-semibold text-slate-600 dark:text-slate-300">
                    <input type="checkbox" defaultChecked className="rounded text-indigo-600 focus:ring-indigo-500 dark:bg-slate-900 dark:border-slate-700" />
                    <span>Enable AI Proctoring Telemetry</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Profile Completion Checklist */}
          <div className="card-luxury p-6 space-y-4 lg:col-span-2 bg-white dark:bg-slate-900 rounded-3xl border border-stoneBorder dark:border-slate-800">
            <h3 className="text-xs font-extrabold text-brand-ink dark:text-white uppercase tracking-wider">
              Profile Completion ({completedCount}/{profileChecks.length})
            </h3>
            <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-500" style={{ width: `${completionPercent}%` }} />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {profileChecks.map((check, i) => (
                <div key={i} className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] font-bold ${
                  check.done ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-transparent dark:border-emerald-800/40' : 'bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-transparent dark:border-slate-700'
                }`}>
                  {check.done ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                  {check.label}
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </>
  );
};
