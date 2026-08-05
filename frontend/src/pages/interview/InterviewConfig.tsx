import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, ArrowRight, Upload, FileText, CheckCircle2, Loader2, X } from 'lucide-react';
import api from '../../services/api';

export const InterviewConfig: React.FC = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [mockRole, setMockRole] = useState('Software Engineer');
  const [mockRound, setMockRound] = useState('Technical');
  const [mockDifficulty, setMockDifficulty] = useState('Medium');
  const [mockLanguage, setMockLanguage] = useState('English');
  const [mockDuration, setMockDuration] = useState(15);
  const [mockResumeText, setMockResumeText] = useState('');
  
  const [uploading, setUploading] = useState(false);
  const [parsedData, setParsedData] = useState<any>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileUpload = async (file: File) => {
    if (!file) return;
    const name = file.name.toLowerCase();
    const isPdf = name.endsWith('.pdf') || file.type === 'application/pdf';
    const isDocx = name.endsWith('.docx') || name.endsWith('.doc') || file.type.includes('word');
    if (!isPdf && !isDocx) {
      alert("Please upload a valid PDF (.pdf) or Word (.docx) file.");
      return;
    }
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await api.post('/interview/parse-resume', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setMockResumeText(res.data.resume_text);
      setParsedData(res.data.parsed_data);
    } catch (err) {
      console.error(err);
      alert("Failed to parse resume.");
    } finally {
      setUploading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleProceed = () => {
    const params = new URLSearchParams({
      role: mockRole,
      round: mockRound,
      difficulty: mockDifficulty,
      language: mockLanguage,
      duration: mockDuration.toString()
    });
    navigate(`/interview/lobby?${params.toString()}`, {
      state: {
        resumeText: mockResumeText,
        parsedResume: parsedData,
        language: mockLanguage
      }
    });
  };

  return (
    <>
        <main className="p-6 lg:p-10 max-w-7xl mx-auto w-full space-y-8">
          <div className="max-w-4xl mx-auto card-luxury p-8 lg:p-10 space-y-8">
            <div className="border-b border-stoneBorder pb-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-brand-accent/30 text-brand-primary text-xs font-extrabold mb-3">
                <Sparkles className="w-4 h-4" /> AI Practice Room
              </div>
              <h1 className="text-2xl lg:text-3xl font-extrabold text-brand-ink tracking-tight">Configure Interview</h1>
              <p className="text-sm text-slate-500 font-semibold mt-1">
                The AI will use your configuration and parsed resume to dynamically generate questions in real-time.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Left Column: Configuration */}
              <div className="space-y-6">
                <div>
                  <label className="text-xs font-extrabold text-brand-ink uppercase tracking-wider block mb-2">Target Job Role</label>
                  <input
                    type="text"
                    value={mockRole}
                    onChange={(e) => setMockRole(e.target.value)}
                    placeholder="e.g. Senior Frontend Engineer"
                    className="w-full p-3.5 bg-cream-100 border border-stoneBorder rounded-2xl text-xs font-bold text-brand-ink focus:outline-none focus:border-brand-primary"
                  />
                </div>
                <div>
                  <label className="text-xs font-extrabold text-brand-ink uppercase tracking-wider block mb-2">Interview Round Type</label>
                  <select
                    value={mockRound}
                    onChange={(e) => setMockRound(e.target.value)}
                    className="w-full p-3.5 bg-cream-100 border border-stoneBorder rounded-2xl text-xs font-bold text-brand-ink focus:outline-none focus:border-brand-primary"
                  >
                    <option>Technical</option>
                    <option>HR</option>
                    <option>Behavioral</option>
                    <option>Managerial</option>
                    <option>System Design</option>
                    <option>DSA & Problem Solving</option>
                    <option>Frontend Engineering</option>
                    <option>Backend Engineering</option>
                    <option>Full Stack Engineering</option>
                    <option>Cloud & DevOps</option>
                    <option>AI & Machine Learning</option>
                  </select>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-extrabold text-brand-ink uppercase tracking-wider block mb-2">Difficulty</label>
                    <select
                      value={mockDifficulty}
                      onChange={(e) => setMockDifficulty(e.target.value)}
                      className="w-full p-3.5 bg-cream-100 border border-stoneBorder rounded-2xl text-xs font-bold text-brand-ink focus:outline-none focus:border-brand-primary"
                    >
                      <option>Easy</option>
                      <option>Medium</option>
                      <option>Hard</option>
                      <option>Expert</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-extrabold text-brand-ink uppercase tracking-wider block mb-2">Language</label>
                    <select
                      value={mockLanguage}
                      onChange={(e) => setMockLanguage(e.target.value)}
                      className="w-full p-3.5 bg-cream-100 border border-stoneBorder rounded-2xl text-xs font-bold text-brand-ink focus:outline-none focus:border-brand-primary"
                    >
                      <option>English</option>
                      <option>Spanish</option>
                      <option>French</option>
                      <option>German</option>
                      <option>Hindi</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-extrabold text-brand-ink uppercase tracking-wider block mb-2">Minutes</label>
                    <input
                      type="number"
                      value={mockDuration}
                      onChange={(e) => setMockDuration(parseInt(e.target.value) || 15)}
                      min={5}
                      max={60}
                      className="w-full p-3.5 bg-cream-100 border border-stoneBorder rounded-2xl text-xs font-bold text-brand-ink focus:outline-none focus:border-brand-primary"
                    />
                  </div>
                </div>

              </div>

              {/* Right Column: Resume Upload & Parser */}
              <div className="flex flex-col h-full">
                <label className="text-xs font-extrabold text-brand-ink uppercase tracking-wider block mb-2">Resume Context</label>
                
                {!parsedData && !uploading && (
                  <div 
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`flex-1 border-2 border-dashed rounded-3xl flex flex-col items-center justify-center p-8 text-center cursor-pointer transition-all ${
                      isDragging ? 'border-brand-primary bg-brand-primary/5' : 'border-stoneBorder hover:bg-cream-100'
                    }`}
                  >
                    <div className="w-12 h-12 rounded-2xl bg-white shadow-luxury flex items-center justify-center mb-4">
                      <Upload className="w-6 h-6 text-brand-primary" />
                    </div>
                    <span className="text-sm font-extrabold text-brand-ink mb-1">Upload Resume (Optional - PDF or DOCX)</span>
                    <span className="text-xs font-medium text-slate-500">Drag & drop or click to browse</span>
                    <input 
                      type="file" 
                      accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" 
                      className="hidden" 
                      ref={fileInputRef} 
                      onChange={(e) => e.target.files && handleFileUpload(e.target.files[0])}
                    />
                  </div>
                )}

                {uploading && (
                  <div className="flex-1 border border-stoneBorder bg-cream-100 rounded-3xl flex flex-col items-center justify-center p-8 text-center">
                    <Loader2 className="w-8 h-8 text-brand-primary animate-spin mb-4" />
                    <span className="text-sm font-bold text-brand-ink">Parsing Document...</span>
                    <span className="text-xs text-slate-500 mt-1">Extracting skills & projects</span>
                  </div>
                )}

                {parsedData && !uploading && (
                  <div className="flex-1 border border-brand-primary/30 bg-white rounded-3xl p-6 shadow-sm flex flex-col relative overflow-hidden">
                    <div className="absolute top-0 right-0 bg-emerald-500 text-white px-3 py-1 rounded-bl-xl text-[10px] font-extrabold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> PARSED
                    </div>
                    
                    <button 
                      onClick={() => { setParsedData(null); setMockResumeText(''); }}
                      className="absolute top-4 right-4 w-6 h-6 rounded-full bg-slate-100 hover:bg-rose-100 text-slate-400 hover:text-rose-500 flex items-center justify-center transition-colors"
                      title="Remove Resume"
                    >
                      <X className="w-3 h-3" />
                    </button>

                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-xl bg-brand-primary/10 flex items-center justify-center shrink-0">
                        <FileText className="w-5 h-5 text-brand-primary" />
                      </div>
                      <div>
                        <h4 className="text-sm font-extrabold text-brand-ink truncate pr-8">Context Acquired</h4>
                        <p className="text-xs text-emerald-600 font-bold">{parsedData.experience || 'Experience extracted'}</p>
                      </div>
                    </div>

                    <div className="space-y-4 overflow-y-auto pr-2 custom-scrollbar flex-1 max-h-[220px]">
                      <div>
                        <h5 className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-1.5">Top Skills</h5>
                        <div className="flex flex-wrap gap-1.5">
                          {parsedData.skills?.slice(0, 8).map((sk: any, i: number) => (
                            <span key={i} className="px-2 py-0.5 rounded-md bg-cream-200 text-brand-ink text-xs font-semibold">
                              {sk.skill_name || sk}
                            </span>
                          ))}
                        </div>
                      </div>
                      
                      {parsedData.projects?.length > 0 && (
                        <div>
                          <h5 className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-1">Detected Projects</h5>
                          <ul className="text-xs text-slate-600 font-medium space-y-1">
                            {parsedData.projects.slice(0, 2).map((proj: any, i: number) => (
                              <li key={i} className="line-clamp-1 truncate">• {typeof proj === 'string' ? proj : JSON.stringify(proj)}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-6 border-t border-stoneBorder">
              <button
                onClick={handleProceed}
                className="w-full py-4 rounded-2xl bg-brand-primary hover:bg-sb-700 text-white font-extrabold text-sm flex items-center justify-center gap-2 transition-all shadow-luxury"
              >
                <span>Proceed to Interview Lobby</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

          </div>
        </main>
      </>
  );
};

