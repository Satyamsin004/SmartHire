import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navbar } from '../components/layout/Navbar';
import { Sidebar } from '../components/layout/Sidebar';
import { AIInterviewerStudioIllustration } from '../components/illustrations/Illustrations';
import { Mic, MicOff, Video, Clock, Send, Sparkles, AlertCircle, CheckCircle2, ShieldCheck, Play, ArrowRight, Upload } from 'lucide-react';
import api from '../services/api';

export const MockInterviewRoom: React.FC = () => {
  const navigate = useNavigate();

  // Workflow steps: 'config' | 'system_check' | 'interview'
  const [step, setStep] = useState<'config' | 'system_check' | 'interview'>('system_check');
  const [interviewMode, setInterviewMode] = useState<'MOCK' | 'RECRUITER'>('MOCK');
  const [scheduleId, setScheduleId] = useState<string | null>(null);

  // Recruiter pre-configured interview details
  const [scheduledDetails, setScheduledDetails] = useState<any>(null);

  // Candidate mock interview config (MODE 1 only)
  const [mockRole, setMockRole] = useState('Full Stack Engineer');
  const [mockRound, setMockRound] = useState('Technical');
  const [mockDifficulty, setMockDifficulty] = useState('Medium');
  const [mockDuration, setMockDuration] = useState(15);
  const [mockResumeText, setMockResumeText] = useState('');

  // Live Interview State
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(15 * 60);

  // Hardware System Check State
  const [micActive, setMicActive] = useState(true);
  const [videoActive, setVideoActive] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const schedId = params.get('schedule') || params.get('schedule_id');

    if (schedId) {
      // MODE 2: Recruiter Scheduled Interview -> Skip Config Screen completely
      setInterviewMode('RECRUITER');
      setScheduleId(schedId);
      setStep('system_check');

      api.get(`/scheduling/detail/${schedId}`)
        .then((res) => {
          setScheduledDetails(res.data);
          setMockRole(res.data.job_title || res.data.role_target || 'Software Engineer');
          setMockDuration(res.data.duration_minutes || 30);
        })
        .catch((err) => console.warn('Fetch schedule error:', err));
    } else {
      // MODE 1: Mock Practice Interview -> Config Screen required
      setInterviewMode('MOCK');
      setStep('config');
    }
  }, []);

  const handleStartInterviewFromSystemCheck = async () => {
    setLoading(true);
    setStep('interview');

    try {
      let res;
      if (interviewMode === 'RECRUITER' && scheduleId) {
        // MODE 2: Load DB recruiter configuration directly
        res = await api.post('/interview/start', {
          schedule_id: scheduleId
        });
      } else {
        // MODE 1: Candidate manual mock configuration
        res = await api.post('/interview/start', {
          role_target: mockRole,
          round_type: mockRound,
          difficulty: mockDifficulty,
          duration_minutes: mockDuration,
          resume_text: mockResumeText
        });
      }

      setSessionId(res.data.session_id);
      setQuestions(res.data.questions || []);
      const dur = res.data.duration_minutes || mockDuration || 15;
      setTimeRemaining(dur * 60);
    } catch (err) {
      console.error('Start interview error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Countdown Timer
  useEffect(() => {
    if (step !== 'interview' || loading || !sessionId) return;
    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          api.post(`/interview/finish/${sessionId}`)
            .then(() => navigate(`/reports?session=${sessionId}`))
            .catch(console.error);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [step, loading, sessionId]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleNextQuestion = async () => {
    if (!sessionId || !questions[currentIndex]) return;
    setSubmitting(true);
    try {
      await api.post('/interview/submit-answer', {
        session_id: sessionId,
        question_id: questions[currentIndex].id,
        transcript_text: transcript || 'Candidate provided structured verbal response.',
      });

      if (currentIndex + 1 < questions.length) {
        setCurrentIndex(currentIndex + 1);
        setTranscript('');
      } else {
        await api.post(`/interview/finish/${sessionId}`);
        navigate(`/reports?session=${sessionId}`);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const currentQ = questions[currentIndex];

  return (
    <div className="min-h-screen bg-brand-bg flex text-brand-ink">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <Navbar />

        <main className="p-6 lg:p-10 max-w-7xl mx-auto w-full space-y-8">

          {/* STEP 1: MOCK INTERVIEW CONFIGURATION PAGE (MODE 1 ONLY) */}
          {step === 'config' && interviewMode === 'MOCK' && (
            <div className="max-w-3xl mx-auto card-luxury p-8 lg:p-10 space-y-8">
              <div className="border-b border-stoneBorder pb-6">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-brand-accent/30 text-brand-primary text-xs font-extrabold mb-3">
                  <Sparkles className="w-4 h-4" /> Mode 1: Candidate AI Practice Room
                </div>
                <h1 className="text-2xl font-extrabold text-brand-ink">Configure AI Practice Session</h1>
                <p className="text-xs text-slate-500 font-semibold mt-1">
                  Customize your role target, difficulty, duration, and resume context for tailored AI questions.
                </p>
              </div>

              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                      <option>System Design</option>
                      <option>Coding</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="text-xs font-extrabold text-brand-ink uppercase tracking-wider block mb-2">Difficulty Level</label>
                    <select
                      value={mockDifficulty}
                      onChange={(e) => setMockDifficulty(e.target.value)}
                      className="w-full p-3.5 bg-cream-100 border border-stoneBorder rounded-2xl text-xs font-bold text-brand-ink focus:outline-none focus:border-brand-primary"
                    >
                      <option>Easy</option>
                      <option>Medium</option>
                      <option>Hard</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-extrabold text-brand-ink uppercase tracking-wider block mb-2">Duration</label>
                    <select
                      value={mockDuration}
                      onChange={(e) => setMockDuration(Number(e.target.value))}
                      className="w-full p-3.5 bg-cream-100 border border-stoneBorder rounded-2xl text-xs font-bold text-brand-ink focus:outline-none focus:border-brand-primary"
                    >
                      <option value={15}>15 Minutes (4 Questions)</option>
                      <option value={30}>30 Minutes (6 Questions)</option>
                      <option value={45}>45 Minutes (8 Questions)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-extrabold text-brand-ink uppercase tracking-wider block mb-2">Resume Context (Optional)</label>
                  <textarea
                    rows={4}
                    value={mockResumeText}
                    onChange={(e) => setMockResumeText(e.target.value)}
                    placeholder="Paste resume summary or key skills to generate resume-specific questions..."
                    className="w-full p-3.5 bg-cream-100 border border-stoneBorder rounded-2xl text-xs font-semibold text-brand-ink focus:outline-none focus:border-brand-primary resize-none"
                  />
                </div>

                <button
                  onClick={() => setStep('system_check')}
                  className="w-full py-4 bg-brand-primary hover:bg-sb-700 text-white font-extrabold text-xs rounded-2xl flex items-center justify-center gap-2 shadow-luxury transition-all"
                >
                  <span>Proceed to System Check</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: SYSTEM HARDWARE CHECK & RECRUITER INVITATION SUMMARY */}
          {step === 'system_check' && (
            <div className="max-w-3xl mx-auto card-luxury p-8 lg:p-10 space-y-8">
              <div className="border-b border-stoneBorder pb-6">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-emerald-100 text-emerald-800 text-xs font-extrabold mb-3">
                  <ShieldCheck className="w-4 h-4" /> Hardware Verification & Entry Check
                </div>
                <h1 className="text-2xl font-extrabold text-brand-ink">
                  {interviewMode === 'RECRUITER' ? 'Recruiter Scheduled Live Interview' : 'System Hardware Readiness Check'}
                </h1>
                <p className="text-xs text-slate-500 font-semibold mt-1">
                  {interviewMode === 'RECRUITER'
                    ? 'Your configuration has been pre-set by the recruiter. Verify camera & microphone before entering.'
                    : 'Verify your microphone and audio device prior to starting practice.'}
                </p>
              </div>

              {/* Recruiter Configuration Badge */}
              {interviewMode === 'RECRUITER' && scheduledDetails && (
                <div className="p-5 bg-brand-ink text-white rounded-3xl space-y-3 shadow-luxury">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-brand-accent uppercase tracking-wider">Job Requisition Details</span>
                    <span className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-sb-800 text-slate-300">
                      Duration: {scheduledDetails.duration_minutes || 30} Mins
                    </span>
                  </div>
                  <h3 className="text-lg font-extrabold text-white">{scheduledDetails.job_title || 'Software Developer'}</h3>
                  <div className="grid grid-cols-2 gap-4 text-xs text-slate-300 pt-2 border-t border-sb-800">
                    <div><strong className="text-slate-400">Round Type:</strong> {scheduledDetails.round_type || 'Technical'}</div>
                    <div><strong className="text-slate-400">Difficulty:</strong> {scheduledDetails.difficulty || 'Medium'}</div>
                    <div><strong className="text-slate-400">Scheduled Date:</strong> {scheduledDetails.scheduled_date ? new Date(scheduledDetails.scheduled_date).toLocaleString() : 'Now'}</div>
                    <div><strong className="text-slate-400">Status:</strong> Pre-Configured by Recruiter</div>
                  </div>
                </div>
              )}

              {/* Hardware Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="p-5 bg-cream-100 rounded-3xl border border-stoneBorder flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-brand-primary text-white flex items-center justify-center font-bold">
                      <Mic className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs font-extrabold text-brand-ink">Microphone Input</p>
                      <p className="text-[11px] text-emerald-700 font-bold">Active & Ready</p>
                    </div>
                  </div>
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                </div>

                <div className="p-5 bg-cream-100 rounded-3xl border border-stoneBorder flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-brand-primary text-white flex items-center justify-center font-bold">
                      <Video className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs font-extrabold text-brand-ink">Camera & Vision</p>
                      <p className="text-[11px] text-emerald-700 font-bold">Active & Ready</p>
                    </div>
                  </div>
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                </div>
              </div>

              <button
                onClick={handleStartInterviewFromSystemCheck}
                disabled={loading}
                className="w-full py-4 bg-brand-primary hover:bg-sb-700 text-white font-extrabold text-xs rounded-2xl flex items-center justify-center gap-2 shadow-luxury transition-all disabled:opacity-50"
              >
                {loading ? (
                  <span>Generating AI Questions...</span>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-white" />
                    <span>Join Interview Room Now</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* STEP 3: LIVE INTERVIEW ROOM SESSION */}
          {step === 'interview' && (
            <div className="space-y-8">
              {/* Header Status Bar */}
              <div className="flex items-center justify-between bg-white p-4 rounded-3xl border border-stoneBorder shadow-soft">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-rose-500 animate-ping" />
                  <span className="text-xs font-extrabold text-brand-ink uppercase tracking-wider">
                    {interviewMode === 'RECRUITER' ? 'Recruiter Scheduled Live Interview' : 'Live AI Practice Round'}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs font-bold text-slate-500">
                  <span className="flex items-center gap-1.5"><Clock className="w-4 h-4 text-brand-primary" /> {formatTime(timeRemaining)} Remaining</span>
                  <span className="px-3 py-1 rounded-xl bg-brand-accent text-brand-ink font-extrabold">Question {currentIndex + 1} of {questions.length || 1}</span>
                </div>
              </div>

              {loading ? (
                <div className="py-24 text-center card-luxury">
                  <Sparkles className="w-10 h-10 text-brand-secondary animate-spin mx-auto mb-4" />
                  <p className="text-sm font-extrabold text-brand-ink">Generating Unique Interview Questions via AI Engine...</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                  {/* Left Column: Holographic AI Interviewer */}
                  <div className="lg:col-span-6 space-y-6">
                    <div className="card-luxury p-6 bg-brand-ink text-white relative overflow-hidden flex flex-col justify-between min-h-[380px]">
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-xs font-extrabold text-brand-accent flex items-center gap-2">
                          <Sparkles className="w-4 h-4" /> Gemini AI Examiner Active
                        </span>
                        <span className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-sb-800 text-slate-300">Voice Synthesis On</span>
                      </div>

                      <AIInterviewerStudioIllustration className="w-full h-48 mx-auto" />

                      <div className="pt-4 flex items-center justify-center gap-4 border-t border-sb-800">
                        <button
                          onClick={() => setIsRecording(!isRecording)}
                          className={`p-4 rounded-full font-extrabold transition-all shadow-luxury ${
                            isRecording ? 'bg-rose-600 text-white animate-pulse' : 'bg-brand-secondary text-white hover:bg-sb-500'
                          }`}
                        >
                          {isRecording ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
                        </button>
                        <span className="text-xs font-bold text-slate-300">
                          {isRecording ? 'Listening to speech...' : 'Click to Speak Response'}
                        </span>
                      </div>
                    </div>

                    <div className="card-luxury p-6 border-l-8 border-brand-primary">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Current Question</span>
                      <h3 className="text-base font-extrabold text-brand-ink mt-1">
                        {currentQ?.question_text || 'Loading question...'}
                      </h3>
                    </div>
                  </div>

                  {/* Right Column: Transcript & Action */}
                  <div className="lg:col-span-6 space-y-6">
                    <div className="card-luxury p-6 flex flex-col justify-between min-h-[460px]">
                      <div>
                        <h4 className="text-xs font-extrabold text-brand-ink uppercase tracking-wider mb-2">Live Speech Transcript</h4>
                        <textarea
                          rows={8}
                          value={transcript}
                          onChange={(e) => setTranscript(e.target.value)}
                          placeholder="Your spoken response will automatically transcribe here, or you may type technical explanations..."
                          className="w-full bg-cream-100 border border-stoneBorder rounded-2xl p-4 text-xs font-semibold text-brand-ink focus:outline-none focus:border-brand-primary transition-all resize-none"
                        />
                      </div>

                      <button
                        onClick={handleNextQuestion}
                        disabled={submitting}
                        className="w-full py-4 rounded-2xl bg-brand-primary hover:bg-sb-700 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-luxury transition-all mt-4"
                      >
                        {submitting ? (
                          <span>Saving Telemetry...</span>
                        ) : (
                          <>
                            <span>{currentIndex + 1 === questions.length ? 'Submit Final Round & View Report' : 'Submit Answer & Proceed'}</span>
                            <Send className="w-4 h-4" />
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

        </main>
      </div>
    </div>
  );
};
