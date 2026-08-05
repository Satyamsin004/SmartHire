import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles, CheckSquare, Video, History, Award, BookOpen, Clock, BarChart2,
  CheckCircle2, ArrowRight, Play, Filter, TrendingUp, ShieldCheck, Code, Layers, FileText,
  Upload, X, Loader2
} from 'lucide-react';
import api from '../../services/api';

import { useLocation } from 'react-router-dom';

export const PracticeHubPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Read initial tab from URL query param (e.g. ?tab=progress or ?tab=reports)
  const getInitialTab = () => {
    const searchParams = new URLSearchParams(location.search);
    const tabParam = searchParams.get('tab');
    if (tabParam === 'progress' || tabParam === 'reports' || tabParam === 'history' || tabParam === 'analytics') {
      return 'progress';
    }
    if (tabParam === 'interview') return 'interview';
    return 'assessment';
  };

  const [activeTab, setActiveTab] = useState<'assessment' | 'interview' | 'progress'>(getInitialTab);

  // Assessment Config State
  const [selectedTopics, setSelectedTopics] = useState<string[]>(['Quantitative Aptitude', 'Logical Reasoning', 'React']);
  const [assessDifficulty, setAssessDifficulty] = useState<string>('Medium');
  const [assessQCount, setAssessQCount] = useState<number>(10);
  const [assessDuration, setAssessDuration] = useState<number>(15);
  const [launchingAssess, setLaunchingAssess] = useState<boolean>(false);
  const [launchStep, setLaunchStep] = useState<number>(1);
  const [launchPercent, setLaunchPercent] = useState<number>(20);
  const [launchElapsed, setLaunchElapsed] = useState<number>(0);

  // Interview Config State
  const [interviewRole, setInterviewRole] = useState<string>('Senior Software Engineer');
  const [interviewRound, setInterviewRound] = useState<string>('Technical');
  const [interviewDiff, setInterviewDiff] = useState<string>('Medium');
  const [interviewDuration, setInterviewDuration] = useState<number>(15);
  const [interviewResumeText, setInterviewResumeText] = useState<string>('');
  const [interviewParsedData, setInterviewParsedData] = useState<any>(null);
  const [uploadingResume, setUploadingResume] = useState<boolean>(false);
  const [uploadedFileName, setUploadedFileName] = useState<string>('');

  // Progress State
  const [assessHistory, setAssessHistory] = useState<any[]>([]);
  const [interviewHistory, setInterviewHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);

  const topicsList = [
    "Quantitative Aptitude", "Logical Reasoning", "Verbal Ability", "Reading Comprehension",
    "Data Interpretation", "DBMS & SQL", "Operating Systems", "Computer Networks",
    "OOP & Design Patterns", "SQL & Indexing", "Java", "Python", "JavaScript & TypeScript",
    "React", "Node.js", "Spring Boot", "Cloud & DevOps", "AI & Machine Learning",
    "System Design Basics", "Code Snippets", "Programming Concepts", "Debugging & Output", "Mixed Assessment"
  ];

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const tabParam = searchParams.get('tab');
    if (tabParam === 'progress' || tabParam === 'reports' || tabParam === 'history' || tabParam === 'analytics') {
      setActiveTab('progress');
    }
  }, [location.search]);

  useEffect(() => {
    if (activeTab === 'progress') {
      setLoadingHistory(true);
      Promise.all([
        api.get('/aptitude/history').catch(() => ({ data: [] })),
        api.get('/interview/history').catch(() => ({ data: [] }))
      ]).then(([resA, resI]) => {
        setAssessHistory(Array.isArray(resA.data) ? resA.data : []);
        setInterviewHistory(Array.isArray(resI.data) ? resI.data : []);
      }).finally(() => setLoadingHistory(false));
    }
  }, [activeTab]);

  const toggleTopic = (topic: string) => {
    if (selectedTopics.includes(topic)) {
      if (selectedTopics.length > 1) {
        setSelectedTopics(selectedTopics.filter(t => t !== topic));
      }
    } else {
      setSelectedTopics([...selectedTopics, topic]);
    }
  };

  const handleStartMockAssessment = async () => {
    setLaunchingAssess(true);
    setLaunchStep(1);
    setLaunchPercent(20);
    setLaunchElapsed(0);

    const timer = setInterval(() => {
      setLaunchElapsed(prev => prev + 1);
    }, 1000);

    const stepInterval = setInterval(() => {
      setLaunchStep(prev => {
        const next = Math.min(prev + 1, 4);
        setLaunchPercent(next * 20);
        return next;
      });
    }, 1800);

    try {
      const res = await api.post('/aptitude/start', {
        title: `AI Practice Assessment - ${selectedTopics[0]}`,
        topics: selectedTopics,
        difficulty: assessDifficulty,
        question_count: assessQCount,
        duration_minutes: assessDuration,
        passing_score: 70.0,
        negative_marking: 0.25,
        proctoring_enabled: true
      });

      setLaunchStep(5);
      setLaunchPercent(100);
      setTimeout(() => {
        navigate(`/assessment/exam?session=${res.data.session_id}`);
      }, 400);
    } catch (err: any) {
      console.error("Launch practice assessment error:", err);
      const status = err?.response?.status ? `HTTP ${err.response.status}` : 'Network Error';
      const endpoint = `${api.defaults.baseURL || ''}/aptitude/start`;
      const detail = err?.response?.data?.detail || (err?.response?.data ? JSON.stringify(err.response.data) : err?.message) || 'Unknown Error';
      alert(`🚨 Assessment Launch Error\n\nEndpoint: ${endpoint}\nStatus: ${status}\nDetail: ${detail}`);
    } finally {
      clearInterval(timer);
      clearInterval(stepInterval);
      setLaunchingAssess(false);
    }
  };

  const handleResumeUpload = async (file: File) => {
    if (!file) return;
    const name = file.name.toLowerCase();
    const isPdf = name.endsWith('.pdf') || file.type === 'application/pdf';
    const isDocx = name.endsWith('.docx') || name.endsWith('.doc') || file.type.includes('word');
    if (!isPdf && !isDocx) {
      alert("Please upload a valid PDF (.pdf) or Word (.docx) file.");
      return;
    }
    setUploadingResume(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await api.post('/interview/parse-resume', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 8000
      });
      setInterviewResumeText(res.data.resume_text || '');
      setInterviewParsedData(res.data.parsed_data || null);
      setUploadedFileName(file.name);
    } catch (err) {
      console.warn("Parse resume error or timeout:", err);
      setUploadedFileName(file.name);
      setInterviewResumeText(file.name);
      setInterviewParsedData({ skills: ["General Technical Skills"], summary: "Uploaded candidate resume" });
    } finally {
      setUploadingResume(false);
    }
  };

  const handleStartMockInterview = () => {
    const params = new URLSearchParams({
      role: interviewRole,
      round: interviewRound,
      difficulty: interviewDiff,
      duration: interviewDuration.toString()
    });
    navigate(`/interview/lobby?${params.toString()}`, {
      state: {
        resumeText: interviewResumeText,
        parsedResume: interviewParsedData
      }
    });
  };

  return (
    <main className="p-6 lg:p-10 max-w-7xl mx-auto w-full space-y-8">
      {/* Top Banner Header */}
      <div className="bg-gradient-to-r from-indigo-900 via-brand-primary to-slate-900 rounded-3xl p-8 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6 border border-indigo-500/20">
        <div className="space-y-2 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-brand-accent/20 border border-brand-accent/40 text-brand-accent text-xs font-black">
            <Sparkles className="w-4 h-4" /> Single Unified AI Practice Engine
          </div>
          <h1 className="text-3xl lg:text-4xl font-black tracking-tight">AI Practice Hub</h1>
          <p className="text-xs lg:text-sm text-indigo-100 font-medium leading-relaxed">
            Master online aptitude tests, technical MCQs, system design, and live HR/Technical interviews with real-time AI evaluation.
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex bg-slate-950/60 p-1.5 rounded-2xl border border-indigo-400/20 shrink-0">
          <button
            onClick={() => setActiveTab('assessment')}
            className={`px-5 py-2.5 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 ${
              activeTab === 'assessment' ? 'bg-brand-accent text-brand-ink shadow-md' : 'text-slate-300 hover:text-white'
            }`}
          >
            <CheckSquare className="w-4 h-4" />
            Mock Assessment
          </button>
          <button
            onClick={() => setActiveTab('interview')}
            className={`px-5 py-2.5 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 ${
              activeTab === 'interview' ? 'bg-brand-accent text-brand-ink shadow-md' : 'text-slate-300 hover:text-white'
            }`}
          >
            <Video className="w-4 h-4" />
            Mock Interview
          </button>
          <button
            onClick={() => setActiveTab('progress')}
            className={`px-5 py-2.5 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 ${
              activeTab === 'progress' ? 'bg-brand-accent text-brand-ink shadow-md' : 'text-slate-300 hover:text-white'
            }`}
          >
            <BarChart2 className="w-4 h-4" />
            Progress & Reports
          </button>
        </div>
      </div>

      {/* TAB 1: MOCK ASSESSMENT */}
      {activeTab === 'assessment' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Config Card */}
          <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200 p-8 space-y-6 shadow-xs">
            <div>
              <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Configure Practice Assessment</h2>
              <p className="text-xs text-slate-500 font-semibold mt-1">Select target topics to generate dynamic MCQs using Gemini AI.</p>
            </div>

            {/* Topics Selection Grid */}
            <div className="space-y-3">
              <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider block">Target Topics ({selectedTopics.length} selected)</label>
              <div className="flex flex-wrap gap-2 max-h-56 overflow-y-auto p-3 bg-slate-50 rounded-2xl border border-slate-200/80">
                {topicsList.map((t) => {
                  const isSelected = selectedTopics.includes(t);
                  return (
                    <button
                      key={t}
                      onClick={() => toggleTopic(t)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                        isSelected
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'bg-white text-slate-600 border border-slate-200 hover:border-indigo-400'
                      }`}
                    >
                      {isSelected && <CheckCircle2 className="w-3.5 h-3.5" />}
                      {t}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Assessment Options */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2">
              <div>
                <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider block mb-2">Difficulty</label>
                <select
                  value={assessDifficulty}
                  onChange={(e) => setAssessDifficulty(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-600"
                >
                  <option>Easy</option>
                  <option>Medium</option>
                  <option>Hard</option>
                  <option>Expert</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider block mb-2">Questions</label>
                <select
                  value={assessQCount}
                  onChange={(e) => setAssessQCount(parseInt(e.target.value))}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-600"
                >
                  <option value={10}>10 Questions</option>
                  <option value={20}>20 Questions</option>
                  <option value={30}>30 Questions</option>
                  <option value={40}>40 Questions</option>
                  <option value={50}>50 Questions</option>
                  <option value={75}>75 Questions</option>
                  <option value={100}>100 Questions</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider block mb-2">Time Limit</label>
                <select
                  value={assessDuration}
                  onChange={(e) => setAssessDuration(parseInt(e.target.value))}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-600"
                >
                  <option value={15}>15 Minutes</option>
                  <option value={30}>30 Minutes</option>
                  <option value={45}>45 Minutes</option>
                  <option value={60}>60 Minutes (1 Hour)</option>
                  <option value={90}>90 Minutes (1.5 Hours)</option>
                  <option value={120}>120 Minutes (2 Hours)</option>
                  <option value={180}>180 Minutes (3 Hours)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider block mb-2">Custom Minutes</label>
                <input
                  type="number"
                  min={5}
                  max={180}
                  value={assessDuration}
                  onChange={(e) => {
                    const value = Number(e.target.value);
                    if (Number.isFinite(value)) setAssessDuration(Math.min(180, Math.max(5, value)));
                  }}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-600"
                  aria-label="Custom assessment duration in minutes"
                />
                <p className="mt-1 text-[10px] text-slate-500">5–180 minutes</p>
              </div>
            </div>

            {/* Launch Button */}
            <button
              onClick={handleStartMockAssessment}
              disabled={launchingAssess}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-sm rounded-2xl shadow-lg flex items-center justify-center gap-2 transition-all transform active:scale-98"
            >
              <Play className="w-5 h-5 fill-current" />
              <span>{launchingAssess ? 'Generating AI MCQs...' : 'Start Secure Practice Exam Now'}</span>
            </button>
          </div>

          {/* Right Info Box */}
          <div className="lg:col-span-5 bg-gradient-to-br from-slate-900 to-indigo-950 rounded-3xl p-8 text-white space-y-6 border border-slate-800 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-extrabold tracking-tight">Enterprise Proctoring Environment</h3>
              <p className="text-xs text-slate-300 font-medium leading-relaxed">
                Practice in the same secure exam interface used by enterprise recruiters:
              </p>

              <ul className="space-y-2 text-xs font-bold text-slate-200">
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> Fullscreen Enforcement</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> Live WebCam Feed Monitor</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> Tab Switch & Window Blur Detection</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> Negative Marking (-0.25 per wrong answer)</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> Instant Step-by-Step Explanations</li>
              </ul>
            </div>

            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-xs text-slate-300">
              <span className="font-bold text-white block mb-1">💡 Recruiter Reusable Engine</span>
              The recruiter online assessment workflow uses this identical AI Engine with custom job passing thresholds.
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: MOCK INTERVIEW */}
      {activeTab === 'interview' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200 p-8 space-y-6 shadow-xs">
            <div>
              <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Configure Live AI Mock Interview</h2>
              <p className="text-xs text-slate-500 font-semibold mt-1">Select your target role and round type for dynamic human-like questioning.</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider block mb-2">Target Job Role</label>
                <input
                  type="text"
                  value={interviewRole}
                  onChange={(e) => setInterviewRole(e.target.value)}
                  className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-600"
                  placeholder="e.g. Senior Frontend Engineer"
                />
              </div>

              <div>
                <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider block mb-2">Interview Round Type</label>
                <select
                  value={interviewRound}
                  onChange={(e) => setInterviewRound(e.target.value)}
                  className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-600"
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

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider block mb-2">Difficulty</label>
                  <select
                    value={interviewDiff}
                    onChange={(e) => setInterviewDiff(e.target.value)}
                    className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-600"
                  >
                    <option>Easy</option>
                    <option>Medium</option>
                    <option>Hard</option>
                    <option>Expert</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider block mb-2">Duration (Mins)</label>
                  <input
                    type="number"
                    value={interviewDuration}
                    onChange={(e) => setInterviewDuration(parseInt(e.target.value) || 15)}
                    min={5}
                    max={60}
                    className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-600"
                  />
                </div>
              </div>

              {/* Optional Resume Upload Section */}
              <div className="pt-1">
                <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider block mb-2 flex items-center justify-between">
                  <span>Upload Resume (Optional)</span>
                  <span className="text-[10px] text-indigo-600 font-extrabold">AI asks tailored resume questions</span>
                </label>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={(e) => e.target.files && e.target.files[0] && handleResumeUpload(e.target.files[0])}
                  accept=".pdf,.docx,.doc"
                  className="hidden"
                />
                
                {uploadedFileName ? (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between shadow-2xs">
                    <div className="flex items-center gap-2 text-xs font-bold text-emerald-800">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span className="truncate max-w-[200px]">{uploadedFileName}</span>
                      <span className="text-[10px] bg-emerald-200/60 px-2 py-0.5 rounded-full text-emerald-900 font-extrabold">
                        {interviewParsedData?.skills?.length || 0} skills parsed
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setUploadedFileName('');
                        setInterviewResumeText('');
                        setInterviewParsedData(null);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                      className="text-slate-400 hover:text-slate-600 p-1 transition-colors"
                      title="Remove resume"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingResume}
                    className="w-full p-4 border-2 border-dashed border-slate-200 hover:border-indigo-500 rounded-2xl bg-slate-50 hover:bg-indigo-50/40 transition-all flex items-center justify-center gap-3 group text-left cursor-pointer"
                  >
                    {uploadingResume ? (
                      <>
                        <Loader2 className="w-5 h-5 text-indigo-600 animate-spin shrink-0" />
                        <div>
                          <span className="text-xs font-bold text-indigo-600 block">Parsing Resume & Extracting Skills...</span>
                          <span className="text-[10px] text-slate-400 block font-medium">Extracting tech stack, projects & work experience</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <Upload className="w-5 h-5 text-slate-400 group-hover:text-indigo-600 transition-colors shrink-0" />
                        <div>
                          <span className="text-xs font-bold text-slate-700 group-hover:text-indigo-600 block">Click to upload PDF / DOCX resume</span>
                          <span className="text-[10px] text-slate-400 block font-medium">Max 5MB • Enables personalized AI interviewer questions from your resume</span>
                        </div>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

            <button
              onClick={handleStartMockInterview}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-sm rounded-2xl shadow-lg flex items-center justify-center gap-2 transition-all transform active:scale-98"
            >
              <Video className="w-5 h-5" />
              <span>Enter Live AI Interview Room</span>
            </button>
          </div>

          <div className="lg:col-span-5 bg-slate-900 rounded-3xl p-8 text-white space-y-6 border border-slate-800 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-brand-primary/20 text-brand-primary border border-brand-primary/30 flex items-center justify-center">
                <Sparkles className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-extrabold tracking-tight">Conversational AI Features</h3>
              <ul className="space-y-3 text-xs font-bold text-slate-300">
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> Non-repetitive questions across sessions</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> Live 1-2 sentence interviewer micro-remarks</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> Audio VAD auto-submit (2-second silence)</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> Context-aware follow-up probing</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: PROGRESS & REPORTS */}
      {activeTab === 'progress' && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Assessments Completed</span>
              <span className="text-2xl font-black text-slate-900 mt-1 block">{assessHistory.length}</span>
            </div>
            <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Interviews Completed</span>
              <span className="text-2xl font-black text-indigo-600 mt-1 block">{interviewHistory.length}</span>
            </div>
            <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Avg Assessment Score</span>
              <span className="text-2xl font-black text-emerald-600 mt-1 block">
                {assessHistory.length > 0
                  ? `${Math.round(assessHistory.reduce((acc, curr) => acc + (curr.overall_score || 0), 0) / assessHistory.length)}%`
                  : 'N/A'}
              </span>
            </div>
            <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Avg Interview Score</span>
              <span className="text-2xl font-black text-purple-600 mt-1 block">
                {interviewHistory.length > 0
                  ? `${Math.round(interviewHistory.reduce((acc, curr) => acc + (curr.overall_score || 0), 0) / interviewHistory.length)}%`
                  : 'N/A'}
              </span>
            </div>
          </div>

          {/* AI Interview Reports & History */}
          <div className="bg-white p-8 rounded-3xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                  <Video className="w-5 h-5 text-indigo-600" />
                  AI Interview Reports ({interviewHistory.length})
                </h3>
                <p className="text-xs text-slate-500 font-medium">Detailed evaluations, sub-metrics, interviewer remarks, and downloadable PDF reports.</p>
              </div>
            </div>

            {loadingHistory ? (
              <div className="py-8 text-center text-xs font-bold text-slate-400">Loading interview evaluation reports...</div>
            ) : interviewHistory.length === 0 ? (
              <div className="p-6 rounded-2xl border border-dashed border-slate-200 text-center space-y-2">
                <p className="text-xs text-slate-500 font-semibold">No AI interview sessions completed yet.</p>
                <button
                  onClick={() => setActiveTab('interview')}
                  className="px-4 py-2 rounded-xl bg-indigo-50 text-indigo-600 text-xs font-extrabold hover:bg-indigo-100 transition-colors"
                >
                  Start Your First Mock Interview
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {interviewHistory.map((i: any) => (
                  <div key={i.session_id || i.id} className="p-5 rounded-2xl border border-slate-200 bg-slate-50/50 flex flex-col justify-between space-y-4 hover:border-indigo-300 transition-all">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded-md bg-indigo-100 text-indigo-800 text-[10px] font-extrabold uppercase">
                            {i.round_type || 'Technical'}
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-slate-200 text-slate-700 text-[10px] font-bold">
                            {i.difficulty || 'Medium'}
                          </span>
                        </div>
                        <h4 className="text-sm font-extrabold text-slate-900 mt-2">{i.title || 'AI Technical Interview'}</h4>
                        <p className="text-[11px] text-slate-500 font-medium">{i.role_target} · {i.date || 'Recent'}</p>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-xl font-black text-indigo-600 block">
                          {i.overall_score !== undefined && i.overall_score !== null ? `${i.overall_score}%` : 'Pending'}
                        </span>
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-black uppercase mt-1 ${
                          (i.recommendation || '').toLowerCase().includes('shortlist') || (i.recommendation || '').toLowerCase().includes('hire') || (i.recommendation || '').toLowerCase().includes('pass')
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {i.recommendation || 'Evaluated'}
                        </span>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-200/80 flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" /> {i.duration_minutes || 15} Mins
                      </span>
                      <button
                        onClick={() => navigate(`/reports?session=${i.session_id || i.id}`)}
                        className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold flex items-center gap-1.5 transition-colors shadow-xs"
                      >
                        <FileText className="w-3.5 h-3.5" /> View Report & PDF
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Assessment History */}
          <div className="bg-white p-8 rounded-3xl border border-slate-200 space-y-4">
            <h3 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <CheckSquare className="w-5 h-5 text-emerald-600" />
              Assessment History ({assessHistory.length})
            </h3>
            {loadingHistory ? (
              <div className="py-8 text-center text-xs font-bold text-slate-400">Loading assessment history...</div>
            ) : assessHistory.length === 0 ? (
              <p className="text-xs text-slate-500">No mock assessment sessions completed yet.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {assessHistory.map((a) => (
                  <div key={a.session_id} className="p-5 rounded-2xl border border-slate-200 bg-slate-50/50 flex items-center justify-between">
                    <div>
                      <span className="px-2.5 py-0.5 rounded-md bg-indigo-100 text-indigo-800 text-[10px] font-extrabold uppercase">
                        {a.difficulty}
                      </span>
                      <h4 className="text-sm font-bold text-slate-900 mt-1">{a.title}</h4>
                      <p className="text-[11px] text-slate-500">{a.date || 'Recent'} · {a.duration_minutes} Mins</p>
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-black text-slate-900 block">
                        {a.overall_score !== undefined && a.overall_score !== null ? `${a.overall_score}%` : 'N/A'}
                      </span>
                      <button
                        onClick={() => navigate(`/assessment/exam?session=${a.session_id}`)}
                        className="text-[11px] font-extrabold text-indigo-600 hover:underline mt-1 block"
                      >
                        Review Test
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      {/* Launch Progress Modal */}
      {launchingAssess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 max-w-md w-full shadow-2xl space-y-6 text-center">
            <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/60 text-brand-primary dark:text-indigo-400 flex items-center justify-center mx-auto shadow-inner">
              <Sparkles className="w-8 h-8 animate-pulse" />
            </div>

            <div className="space-y-1">
              <h3 className="text-xl font-black text-slate-900 dark:text-white">Building Your Custom Assessment</h3>
              <p className="text-xs text-slate-500 font-semibold">Single Unified AI Practice Engine</p>
            </div>

            {/* Step Indicators */}
            <div className="space-y-2 text-left bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/80 text-xs font-bold">
              <div className={`flex items-center gap-2.5 ${launchStep >= 1 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                <span>{launchStep > 1 ? '✅' : '⚡'}</span> <span>Preparing assessment...</span>
              </div>
              <div className={`flex items-center gap-2.5 ${launchStep >= 2 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                <span>{launchStep > 2 ? '✅' : launchStep === 2 ? '⚡' : '⏳'}</span> <span>Generating AI questions...</span>
              </div>
              <div className={`flex items-center gap-2.5 ${launchStep >= 3 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                <span>{launchStep > 3 ? '✅' : launchStep === 3 ? '🔍' : '⏳'}</span> <span>Validating uniqueness...</span>
              </div>
              <div className={`flex items-center gap-2.5 ${launchStep >= 4 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                <span>{launchStep > 4 ? '✅' : launchStep === 4 ? '📄' : '⏳'}</span> <span>Building question paper...</span>
              </div>
              <div className={`flex items-center gap-2.5 ${launchStep >= 5 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                <span>{launchStep === 5 ? '🚀' : '⏳'}</span> <span>Launching assessment...</span>
              </div>
            </div>

            {/* Animated Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs font-black text-slate-700 dark:text-slate-300">
                <span>Progress</span>
                <span className="text-indigo-600 dark:text-indigo-400 font-mono">{launchPercent}%</span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-3 overflow-hidden p-0.5 border border-slate-300/50">
                <div
                  className="bg-gradient-to-r from-indigo-600 via-brand-primary to-emerald-500 h-full rounded-full transition-all duration-500 ease-out shadow-sm"
                  style={{ width: `${launchPercent}%` }}
                />
              </div>
            </div>

            {/* Friendly message if elapsed >= 8 seconds */}
            {launchElapsed >= 8 && (
              <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl text-amber-800 dark:text-amber-300 text-xs font-bold animate-in fade-in duration-300 flex items-center gap-2">
                <span className="text-base">✨</span>
                <span>Creating a unique question paper for you. This may take a few more seconds.</span>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
};
