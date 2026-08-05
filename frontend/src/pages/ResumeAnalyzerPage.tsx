import React, { useState, useRef, useCallback } from 'react';
import { FileText, Upload, X, CheckCircle2, AlertCircle, FileType, Trash2, RotateCw, Download, 
  User, Mail, Phone, Github, Linkedin, Globe, GraduationCap, Award, Code, Briefcase, 
  Target, Brain, TrendingUp, Star, ExternalLink } from 'lucide-react';
import api from '../services/api';

export const ResumeAnalyzerPage: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [parsed, setParsed] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const dropped = e.dataTransfer.files;
    if (dropped.length > 0) {
      validateAndSetFile(dropped[0]);
    }
  }, []);

  const validateAndSetFile = (f: File) => {
    const validTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    const validExtensions = ['.pdf', '.docx'];
    const ext = f.name.substring(f.name.lastIndexOf('.')).toLowerCase();
    
    if (!validTypes.includes(f.type) && !validExtensions.includes(ext)) {
      setError('Only PDF and DOCX files are supported.');
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      setError('File size must be under 10MB.');
      return;
    }
    setFile(f);
    setError(null);
    setParsed(null);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) validateAndSetFile(selected);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setUploadProgress(0);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await api.post('/uploads/resume', formData, {
        onUploadProgress: (progressEvent) => {
          const percent = progressEvent.total ? Math.round((progressEvent.loaded * 100) / progressEvent.total) : 0;
          setUploadProgress(percent);
        }
      });
      setParsed(res.data);
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      let msg = 'Failed to analyze resume. Please try again.';
      if (typeof detail === 'string') {
        msg = detail;
      } else if (Array.isArray(detail) && detail.length > 0) {
        msg = detail.map((d: any) => d.msg || d.detail || JSON.stringify(d)).join(', ');
      } else if (err.message) {
        msg = err.message;
      }
      setError(msg);
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = () => {
    setFile(null);
    setParsed(null);
    setError(null);
    setUploadProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleReplace = () => {
    handleRemove();
    fileInputRef.current?.click();
  };

  const getFieldValue = (val: any) => {
    if (!val || val === 'Not Available' || val === 'N/A' || (Array.isArray(val) && val.length === 0)) return null;
    if (Array.isArray(val) && val.length === 1 && (val[0] === 'Not Available' || val[0] === 'N/A')) return null;
    return val;
  };

  const InfoRow = ({ icon: Icon, label, value, isLink }: { icon: any; label: string; value: string; isLink?: boolean }) => (
    <div className="flex items-center gap-3 py-2.5 border-b border-slate-50 last:border-0">
      <Icon className="w-4 h-4 text-indigo-500 shrink-0" />
      <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider w-28 shrink-0">{label}</span>
      {isLink ? (
        <a href={value.startsWith('http') ? value : `https://${value}`} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 truncate flex items-center gap-1">
          {value} <ExternalLink className="w-3 h-3" />
        </a>
      ) : (
        <span className="text-xs font-semibold text-brand-ink truncate">{value}</span>
      )}
    </div>
  );

  return (
    <>
      <main className="p-6 lg:p-10 max-w-7xl mx-auto w-full space-y-8">
        <div>
          <h1 className="text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight">Resume Analyzer</h1>
          <p className="text-xs text-slate-500 font-medium mt-1">Upload your resume for AI-powered parsing, skill extraction, and ATS compatibility analysis.</p>
        </div>

        {/* Upload Zone */}
        {!parsed && (
          <div
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            className={`relative card-luxury p-10 flex flex-col items-center justify-center text-center transition-all cursor-pointer ${
              dragActive ? 'border-indigo-400 bg-indigo-50/50 scale-[1.01]' : 'border-stoneBorder hover:border-indigo-200'
            }`}
            onClick={() => !file && fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="hidden"
              onChange={handleFileSelect}
            />

            {!file ? (
              <>
                <div className="w-16 h-16 rounded-3xl bg-indigo-100 flex items-center justify-center mb-4">
                  <Upload className="w-8 h-8 text-indigo-500" />
                </div>
                <h3 className="text-sm font-extrabold text-brand-ink mb-1">Drop your resume here or click to browse</h3>
                <p className="text-xs text-slate-400 font-medium">Supports PDF and DOCX • Max 10MB</p>
              </>
            ) : (
              <div className="w-full max-w-md space-y-4">
                <div className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-100 flex items-center justify-center shrink-0">
                    <FileType className="w-6 h-6 text-indigo-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-extrabold text-brand-ink truncate">{file.name}</p>
                    <p className="text-[10px] text-slate-400 font-medium">{(file.size / 1024).toFixed(1)} KB</p>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); handleRemove(); }} className="p-2 rounded-lg hover:bg-slate-200 transition-colors">
                    <X className="w-4 h-4 text-slate-400" />
                  </button>
                </div>

                {uploading && (
                  <div className="space-y-2">
                    <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                    </div>
                    <p className="text-[10px] font-bold text-indigo-600 text-center">
                      {uploadProgress < 100 ? `Uploading... ${uploadProgress}%` : 'AI is analyzing your resume...'}
                    </p>
                  </div>
                )}

                {!uploading && (
                  <div className="flex items-center gap-3 justify-center" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={handleUpload}
                      className="px-6 py-3 rounded-2xl bg-brand-primary hover:bg-sb-700 text-white font-extrabold text-sm shadow-luxury transition-all flex items-center gap-2"
                    >
                      <Brain className="w-4 h-4" /> Analyze Resume
                    </button>
                    <button
                      onClick={handleReplace}
                      className="px-4 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-brand-ink font-extrabold text-sm transition-all flex items-center gap-2"
                    >
                      <RotateCw className="w-4 h-4" /> Replace
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="flex items-center gap-3 px-5 py-4 rounded-2xl bg-rose-50 border border-rose-200">
            <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
            <p className="text-xs font-bold text-rose-700">{error}</p>
          </div>
        )}

        {/* Parsed Results */}
        {parsed && (
          <div className="space-y-6">
            {/* Action Bar */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                <h3 className="text-sm font-extrabold text-emerald-700">Resume analyzed successfully</h3>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={handleReplace} className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-brand-ink font-extrabold text-[11px] transition-colors flex items-center gap-1.5">
                  <RotateCw className="w-3.5 h-3.5" /> Upload New
                </button>
                <button onClick={handleRemove} className="px-4 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 font-extrabold text-[11px] transition-colors flex items-center gap-1.5">
                  <Trash2 className="w-3.5 h-3.5" /> Remove
                </button>
              </div>
            </div>

            {/* ATS Score Card */}
            {parsed.ats_score != null && (
              <div className={`card-luxury p-8 text-center space-y-3 ${
                parsed.ats_score >= 80 ? 'bg-gradient-to-br from-emerald-900 to-slate-900' : 
                parsed.ats_score >= 60 ? 'bg-gradient-to-br from-amber-900 to-slate-900' : 
                'bg-gradient-to-br from-rose-900 to-slate-900'
              } text-white`}>
                <Target className="w-8 h-8 mx-auto opacity-60" />
                <p className="text-5xl font-black">{parsed.ats_score}%</p>
                <p className="text-xs font-bold uppercase tracking-wider opacity-70">ATS Compatibility Score</p>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 1. Personal Information */}
              <div className="card-luxury p-6 space-y-3 lg:col-span-2">
                <h3 className="text-xs font-extrabold text-brand-ink uppercase tracking-wider flex items-center gap-2">
                  <User className="w-4 h-4 text-indigo-500" /> 1. Personal Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <InfoRow icon={User} label="Full Name" value={parsed.personal_information?.full_name || parsed.candidate_name || parsed.name || "Not Available"} />
                  <InfoRow icon={Mail} label="Email" value={parsed.personal_information?.email || parsed.email || "Not Available"} />
                  <InfoRow icon={Phone} label="Phone" value={parsed.personal_information?.phone || parsed.phone || "Not Available"} />
                  <InfoRow icon={Globe} label="Location" value={parsed.personal_information?.location || parsed.location || "Not Available"} />
                  <InfoRow icon={Github} label="GitHub" value={parsed.personal_information?.github || parsed.github || "Not Available"} isLink={parsed.personal_information?.github !== "Not Available" && parsed.github !== "Not Available"} />
                  <InfoRow icon={Linkedin} label="LinkedIn" value={parsed.personal_information?.linkedin || parsed.linkedin || "Not Available"} isLink={parsed.personal_information?.linkedin !== "Not Available" && parsed.linkedin !== "Not Available"} />
                  <InfoRow icon={Globe} label="Portfolio" value={parsed.personal_information?.portfolio || parsed.portfolio || "Not Available"} isLink={parsed.personal_information?.portfolio !== "Not Available" && parsed.portfolio !== "Not Available"} />
                </div>
              </div>

              {/* 2. Professional Summary */}
              <div className="card-luxury p-6 space-y-3 lg:col-span-2">
                <h3 className="text-xs font-extrabold text-brand-ink uppercase tracking-wider flex items-center gap-2">
                  <FileText className="w-4 h-4 text-indigo-500" /> 2. Professional Summary
                </h3>
                <p className="text-sm font-medium text-slate-600 leading-relaxed">
                  {parsed.professional_summary?.summary || parsed.summary || "Not Available"}
                </p>
                <div className="flex items-center gap-4 text-xs font-semibold text-slate-500 pt-2">
                  <span>Experience Level: <strong className="text-brand-ink">{parsed.professional_summary?.experience_years || parsed.experience_years || "Not Available"}</strong></span>
                </div>
              </div>

              {/* 3. Education */}
              <div className="card-luxury p-6 space-y-3">
                <h3 className="text-xs font-extrabold text-brand-ink uppercase tracking-wider flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-amber-500" /> 3. Education
                </h3>
                {parsed.education && parsed.education.length > 0 ? (
                  <div className="space-y-3">
                    {parsed.education.map((edu: any, i: number) => (
                      <div key={i} className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                        <p className="text-xs font-extrabold text-brand-ink">{edu.degree || edu.branch || "Degree Not Available"}</p>
                        <p className="text-[11px] text-slate-500 font-medium">{edu.college || edu.university || "Institution Not Available"}</p>
                        <div className="flex items-center gap-3 text-[10px] text-slate-400 font-bold">
                          {edu.year && <span>Year: {edu.year}</span>}
                          {edu.cgpa && <span>CGPA: {edu.cgpa}</span>}
                          {edu.percentage && <span>Marks: {edu.percentage}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">Not Available</p>
                )}
              </div>

              {/* 4. Experience */}
              <div className="card-luxury p-6 space-y-3">
                <h3 className="text-xs font-extrabold text-brand-ink uppercase tracking-wider flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-indigo-500" /> 4. Work Experience
                </h3>
                {parsed.work_experience && parsed.work_experience.length > 0 ? (
                  <div className="space-y-3">
                    {parsed.work_experience.map((exp: any, i: number) => (
                      <div key={i} className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                        <p className="text-xs font-extrabold text-brand-ink">{exp.job_title || "Job Title Not Available"} @ {exp.company_name || "Company Not Available"}</p>
                        <p className="text-[10px] text-slate-400 font-bold">{exp.joining_date || "N/A"} - {exp.ending_date || "Present"} ({exp.duration || "Duration N/A"})</p>
                        {exp.responsibilities && exp.responsibilities.length > 0 && (
                          <ul className="list-disc list-inside text-[11px] text-slate-600 space-y-0.5 mt-1">
                            {exp.responsibilities.map((r: string, idx: number) => <li key={idx}>{r}</li>)}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">Not Available</p>
                )}
              </div>

              {/* 5. Internships */}
              <div className="card-luxury p-6 space-y-3">
                <h3 className="text-xs font-extrabold text-brand-ink uppercase tracking-wider flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-emerald-500" /> 5. Internships
                </h3>
                {parsed.internships && parsed.internships.length > 0 ? (
                  <div className="space-y-3">
                    {parsed.internships.map((intern: any, i: number) => (
                      <div key={i} className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                        <p className="text-xs font-extrabold text-brand-ink">{intern.role || "Intern"} @ {intern.company || "Company Not Available"}</p>
                        <p className="text-[10px] text-slate-400 font-bold">{intern.duration || "Duration Not Available"}</p>
                        {intern.description && <p className="text-[11px] text-slate-600 font-medium">{intern.description}</p>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">Not Available</p>
                )}
              </div>

              {/* 6. Projects */}
              <div className="card-luxury p-6 space-y-3">
                <h3 className="text-xs font-extrabold text-brand-ink uppercase tracking-wider flex items-center gap-2">
                  <Code className="w-4 h-4 text-cyan-500" /> 6. Projects
                </h3>
                {parsed.projects && parsed.projects.length > 0 ? (
                  <div className="space-y-3">
                    {parsed.projects.map((proj: any, i: number) => {
                      const projName = typeof proj === 'string' ? proj : proj.project_name || proj.name || "Untitled Project";
                      const projDesc = typeof proj === 'string' ? '' : proj.description;
                      return (
                        <div key={i} className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                          <p className="text-xs font-extrabold text-brand-ink">{projName}</p>
                          {projDesc && <p className="text-[11px] text-slate-600 font-medium">{projDesc}</p>}
                          {proj.github_link && proj.github_link !== 'Not Available' && (
                            <a href={proj.github_link} target="_blank" rel="noreferrer" className="text-[10px] font-bold text-indigo-600 hover:underline flex items-center gap-1">
                              GitHub Repo <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">Not Available</p>
                )}
              </div>

              {/* 7. Skills */}
              <div className="card-luxury p-6 space-y-3">
                <h3 className="text-xs font-extrabold text-brand-ink uppercase tracking-wider flex items-center gap-2">
                  <Code className="w-4 h-4 text-emerald-500" /> 7. Skills ({parsed.skills?.length || 0})
                </h3>
                {parsed.skills && parsed.skills.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {parsed.skills.map((sk: any, i: number) => {
                      const name = typeof sk === 'string' ? sk : sk.skill_name;
                      if (!name || name === 'Not Available') return null;
                      return (
                        <span key={i} className="px-3 py-1.5 rounded-full bg-slate-100 text-[11px] font-bold text-slate-700">
                          {name}
                        </span>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">Not Available</p>
                )}
              </div>

              {/* 8. Certifications */}
              <div className="card-luxury p-6 space-y-3">
                <h3 className="text-xs font-extrabold text-brand-ink uppercase tracking-wider flex items-center gap-2">
                  <Award className="w-4 h-4 text-violet-500" /> 8. Certifications
                </h3>
                {parsed.certifications && parsed.certifications.length > 0 ? (
                  <div className="space-y-2">
                    {parsed.certifications.map((cert: any, i: number) => {
                      const certName = typeof cert === 'string' ? cert : cert.certificate_name;
                      return (
                        <div key={i} className="flex items-center gap-2 text-xs font-medium text-slate-600">
                          <CheckCircle2 className="w-3.5 h-3.5 text-violet-500 shrink-0" /> {certName}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">Not Available</p>
                )}
              </div>

              {/* 9. Achievements */}
              <div className="card-luxury p-6 space-y-3">
                <h3 className="text-xs font-extrabold text-brand-ink uppercase tracking-wider flex items-center gap-2">
                  <Star className="w-4 h-4 text-amber-500" /> 9. Achievements
                </h3>
                {parsed.achievements && parsed.achievements.length > 0 ? (
                  <div className="space-y-2">
                    {parsed.achievements.map((ach: any, i: number) => {
                      const title = typeof ach === 'string' ? ach : ach.title || ach.description;
                      return (
                        <div key={i} className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-xs font-medium text-slate-700">
                          {title}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">Not Available</p>
                )}
              </div>

              {/* 10. Languages */}
              <div className="card-luxury p-6 space-y-3">
                <h3 className="text-xs font-extrabold text-brand-ink uppercase tracking-wider flex items-center gap-2">
                  <Globe className="w-4 h-4 text-blue-500" /> 10. Languages
                </h3>
                {parsed.languages && parsed.languages.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {parsed.languages.map((lang: any, i: number) => {
                      const name = typeof lang === 'string' ? lang : lang.language_name;
                      return (
                        <span key={i} className="px-3 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs font-bold border border-blue-100">
                          {name}
                        </span>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">Not Available</p>
                )}
              </div>

              {/* ATS Analytics & Suggestions */}
              {parsed.ats_analysis && (
                <div className="card-luxury p-6 space-y-3 lg:col-span-2 border-l-4 border-indigo-500">
                  <h3 className="text-xs font-extrabold text-brand-ink uppercase tracking-wider flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-indigo-500" /> ATS Compatibility Insights & Keyword Breakdown
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    <div>
                      <p className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider mb-2">Technical Keywords Found</p>
                      <div className="flex flex-wrap gap-1.5">
                        {(parsed.ats_analysis.technical_keywords || []).map((kw: string, i: number) => (
                          <span key={i} className="px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-md text-[10px] font-bold">
                            {kw}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider mb-2">Strengths</p>
                      <ul className="list-disc list-inside text-xs text-slate-600 font-medium space-y-1">
                        {(parsed.ats_analysis.strengths || ["Clean structure", "Relevant domain terminology"]).map((st: string, i: number) => (
                          <li key={i}>{st}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>

          </div>
        )}
      </main>
    </>
  );
};
