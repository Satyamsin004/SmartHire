import React, { useState } from 'react';
import { Navbar } from '../components/layout/Navbar';
import { Sidebar } from '../components/layout/Sidebar';
import { ResumeUploadIllustration } from '../components/illustrations/Illustrations';
import { Upload, FileText, CheckCircle2, Award, Sparkles } from 'lucide-react';
import api from '../services/api';

export const ResumeAnalyzerPage: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [resumeData, setResumeData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await api.post('/uploads/resume', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResumeData(res.data?.resume);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.detail || 'Resume parsing failed. Please upload a valid PDF file.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-bg flex text-brand-ink">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <Navbar />

        <main className="p-6 lg:p-10 max-w-7xl mx-auto w-full space-y-8">
          
          {/* Hero Header */}
          <div className="bg-gradient-to-r from-brand-primary via-sb-800 to-brand-ink rounded-5xl p-8 lg:p-12 text-white relative overflow-hidden shadow-floating">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">
              <div className="lg:col-span-7 space-y-4">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-2xl bg-brand-accent/20 border border-brand-accent/30 text-brand-accent text-xs font-extrabold">
                  <Sparkles className="w-4 h-4" />
                  <span>AI PDF Skill Extraction</span>
                </div>
                <h1 className="text-3xl lg:text-5xl font-extrabold tracking-tight text-white">
                  Resume ATS Scanner Studio
                </h1>
                <p className="text-sm text-slate-300 font-medium max-w-lg">
                  Extract technical skills, experience years, education background, and ATS keyword density using pdfplumber and Gemini 1.5 Pro.
                </p>
              </div>

              <div className="lg:col-span-5 hidden lg:block">
                <ResumeUploadIllustration className="w-full h-auto drop-shadow-2xl" />
              </div>
            </div>
          </div>

          {error && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold">
              {error}
            </div>
          )}

          {/* Upload Area & Parsed View */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            <div className="lg:col-span-5 card-luxury p-8 flex flex-col justify-between items-center text-center">
              <div className="w-full border-2 border-dashed border-stoneBorder rounded-3xl p-8 bg-cream-100/80 hover:bg-cream-200 transition-colors">
                <Upload className="w-12 h-12 text-brand-primary mx-auto mb-4" />
                <h4 className="text-sm font-extrabold text-brand-ink">Upload Your PDF Resume</h4>
                <p className="text-xs text-slate-400 mt-1 mb-4">Supported format: PDF (.pdf), Max 10MB</p>

                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="hidden"
                  id="resume-file-input"
                />
                <label
                  htmlFor="resume-file-input"
                  className="px-6 py-2.5 rounded-2xl bg-white border border-stoneBorder text-brand-ink text-xs font-extrabold cursor-pointer hover:bg-cream-200 inline-block shadow-soft"
                >
                  {file ? file.name : 'Select PDF File'}
                </label>
              </div>

              <button
                onClick={handleUpload}
                disabled={!file || uploading}
                className="w-full mt-6 py-3.5 rounded-2xl bg-brand-primary hover:bg-sb-700 text-white font-extrabold text-xs shadow-luxury transition-all disabled:opacity-50"
              >
                {uploading ? 'Parsing PDF Text...' : 'Parse Resume & Audit ATS'}
              </button>
            </div>

            {/* Parsed Results Card */}
            <div className="lg:col-span-7 card-luxury p-8 space-y-6">
              <h3 className="text-lg font-extrabold text-brand-ink flex items-center gap-2">
                <FileText className="w-5 h-5 text-brand-primary" /> Parsed Resume Intelligence
              </h3>

              {!resumeData ? (
                <div className="py-16 text-center border-2 border-dashed border-stoneBorder rounded-3xl bg-cream-100">
                  <p className="text-xs font-extrabold text-slate-500">No resume parsed yet.</p>
                  <p className="text-[11px] text-slate-400 mt-1">Upload a PDF to view extracted experience, education, and skills.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="p-4 rounded-2xl bg-cream-100 border border-stoneBorder">
                    <h5 className="text-xs font-extrabold text-brand-ink uppercase tracking-wider mb-1">Executive Summary</h5>
                    <p className="text-xs text-slate-600 font-semibold">{resumeData.summary}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-2xl bg-cream-100 border border-stoneBorder">
                      <h5 className="text-[11px] font-extrabold text-slate-400 uppercase">Experience</h5>
                      <p className="text-sm font-extrabold text-brand-ink">{resumeData.experience_years}</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-cream-100 border border-stoneBorder">
                      <h5 className="text-[11px] font-extrabold text-slate-400 uppercase">Education</h5>
                      <p className="text-sm font-extrabold text-brand-ink">{resumeData.education_level}</p>
                    </div>
                  </div>

                  <div>
                    <h5 className="text-xs font-extrabold text-brand-ink uppercase tracking-wider mb-2">Extracted Skills</h5>
                    <div className="flex flex-wrap gap-2">
                      {resumeData.skills?.map((sk: string, i: number) => (
                        <span key={i} className="px-3 py-1 rounded-xl text-xs font-extrabold bg-brand-accent text-brand-ink">
                          {sk}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

          </div>

        </main>
      </div>
    </div>
  );
};
