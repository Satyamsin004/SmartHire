import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  ShieldAlert, Clock, CheckCircle2, XCircle, AlertTriangle, Maximize, Camera,
  ArrowRight, ArrowLeft, Send, Sparkles, BookOpen, BarChart2, Award, History, Check,
  Loader2
} from 'lucide-react';
import api from '../../services/api';

export const AssessmentExamRoom: React.FC = () => {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session');
  const navigate = useNavigate();

  const [questions, setQuestions] = useState<any[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, number>>({});
  const [timeRemaining, setTimeRemaining] = useState<number>(900); // Default 15 mins
  const [violations, setViolations] = useState<number>(0);
  const [proctorWarning, setProctorWarning] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [result, setResult] = useState<any>(null);

  const videoRef = useRef<HTMLVideoElement>(null);

  // 1. Fetch Session Questions & Start Camera
  useEffect(() => {
    if (!sessionId) {
      alert("Missing assessment session ID.");
      navigate('/practice');
      return;
    }

    // 1. Fetch questions for the assessment
    setLoadingQuestions(true);
    setLoadError(null);
    api.get(`/aptitude/session/${sessionId}/questions`, { skipCache: true })
      .then((res) => {
        setQuestions(res.data || []);
        setLoadingQuestions(false);
      })
      .catch((err) => {
        console.error(err);
        const msg = err?.code === 'ECONNABORTED'
          ? 'Question generation timed out. The AI engine is busy — please try again.'
          : err?.response?.data?.detail || 'Failed to load assessment questions.';
        setLoadError(msg);
        setLoadingQuestions(false);
      });

    // 2. Check if session has a completed result (Review Test mode)
    api.get(`/aptitude/session/${sessionId}/result`)
      .then((res) => {
        if (res.data) {
          setResult(res.data);
        }
      })
      .catch(() => {
        // Session is still in progress (normal exam mode)
      });

    // 3. Start Webcam feed
    navigator.mediaDevices?.getUserMedia({ video: true })
      .then((stream) => {
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch(() => console.warn("Camera access denied or unavailable."));

    // 2. Proctoring Listeners: Tab Switch & Window Blur Detection
    const handleBlur = () => {
      setViolations((prev) => {
        const next = prev + 1;
        setProctorWarning(`⚠️ Warning #${next}: Window focus lost or tab switched! (Max 3 allowed)`);
        if (next >= 3) {
          alert("Maximum proctoring violations exceeded (3/3). Auto-submitting exam now.");
          handleSubmitExam();
        }
        return next;
      });
    };

    window.addEventListener('blur', handleBlur);
    return () => window.removeEventListener('blur', handleBlur);
  }, [sessionId]);

  // Timer
  useEffect(() => {
    if (result) return;
    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleSubmitExam();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [result]);

  const currentQ = questions[currentIndex];

  const handleSelectOption = (opIndex: number) => {
    if (!currentQ || result) return;
    setUserAnswers((prev) => ({
      ...prev,
      [currentQ.id]: opIndex
    }));
  };

  const handleSubmitExam = async () => {
    if (submitting || result) return;
    setSubmitting(true);

    const payloadAnswers = questions.map((q) => ({
      question_id: q.id,
      selected_option: userAnswers[q.id] !== undefined ? userAnswers[q.id] : null,
      time_taken_seconds: 30
    }));

    try {
      await api.post(`/aptitude/session/${sessionId}/submit`, {
        answers: payloadAnswers,
        proctoring_violations: violations
      });

      const resRes = await api.get(`/aptitude/session/${sessionId}/result`);
      setResult(resRes.data);
    } catch (err) {
      console.error(err);
      alert('Failed to evaluate assessment submission.');
    } finally {
      setSubmitting(false);
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // LOADING SCREEN — AI generating questions (can take 60-120s on Railway)
  if (loadingQuestions) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center space-y-6 max-w-md px-6">
          <div className="w-20 h-20 rounded-3xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center mx-auto">
            <Sparkles className="w-10 h-10 text-indigo-400 animate-pulse" />
          </div>
          <div>
            <h2 className="text-xl font-black text-white">Building Your Assessment</h2>
            <p className="text-slate-400 text-sm font-semibold mt-2">AI is generating unique questions for you.<br />This may take up to 2 minutes on first load.</p>
          </div>
          <Loader2 className="w-6 h-6 animate-spin text-indigo-400 mx-auto" />
        </div>
      </div>
    );
  }

  // ERROR SCREEN — failed to load questions
  if (loadError) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="bg-rose-950/40 border border-rose-800 rounded-2xl p-8 max-w-md text-center space-y-4">
          <AlertTriangle className="w-10 h-10 text-rose-400 mx-auto" />
          <p className="text-rose-300 font-bold text-sm">{loadError}</p>
          <div className="flex gap-3">
            <button
              onClick={() => window.location.reload()}
              className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-extrabold rounded-xl transition-all"
            >
              Retry
            </button>
            <button
              onClick={() => navigate('/practice')}
              className="flex-1 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white text-xs font-extrabold rounded-xl transition-all"
            >
              Back to Hub
            </button>
          </div>
        </div>
      </div>
    );
  }

  // IF EXAM IS COMPLETED -> SHOW COMPREHENSIVE RESULT SCREEN
  if (result) {
    return (
      <main className="p-6 lg:p-10 max-w-5xl mx-auto space-y-8">
        <div className="bg-white dark:bg-[#111827] rounded-3xl p-8 border border-slate-200 dark:border-slate-800 shadow-md space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-6">
            <div>
              <span className="px-3 py-1 bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 text-xs font-black rounded-lg uppercase">
                {result.hiring_recommendation === 'Pass' ? 'PASSED ✅' : 'FAILED ❌'}
              </span>
              <h1 className="text-2xl font-black text-slate-900 dark:text-white mt-2">{result.title} Report</h1>
            </div>

            <div className="text-right">
              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase block">Overall Score</span>
              <span className="text-4xl font-black text-indigo-600 dark:text-indigo-400">{result.overall_score}%</span>
            </div>
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-4 gap-4 p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-800">
            <div>
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase block">Correct</span>
              <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">{result.total_correct}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase block">Wrong</span>
              <span className="text-lg font-black text-rose-600 dark:text-rose-400">{result.total_wrong}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase block">Skipped</span>
              <span className="text-lg font-black text-slate-500 dark:text-slate-400">{result.total_skipped}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase block">Violations</span>
              <span className="text-lg font-black text-amber-600 dark:text-amber-400">{result.proctoring_violations}</span>
            </div>
          </div>

          {/* Detailed Question Review */}
          <div className="space-y-4 pt-4">
            <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">Question & Explanation Review</h3>
            {result.question_review?.map((q: any) => (
              <div key={q.question_id} className={`p-5 rounded-2xl border ${
                q.is_correct ? 'bg-emerald-50/50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800' : q.selected_option === null ? 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700' : 'bg-rose-50/50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800'
              } space-y-3`}>
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-slate-500 dark:text-slate-400">Q{q.order_index} · {q.category}</span>
                  <span className={q.is_correct ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}>
                    {q.is_correct ? '+1.0 Point' : q.selected_option === null ? '0.0 Point (Skipped)' : '-0.25 Point'}
                  </span>
                </div>
                <p className="text-sm font-bold text-slate-900 dark:text-white">{q.question_text}</p>
                {q.code_snippet && (
                  <pre className="p-3 bg-slate-900 text-indigo-300 font-mono text-xs rounded-xl overflow-x-auto border border-slate-800">
                    <code>{q.code_snippet}</code>
                  </pre>
                )}
                <div className="grid grid-cols-2 gap-2 text-xs font-semibold">
                  {q.options?.map((op: string, opIdx: number) => (
                    <div key={opIdx} className={`p-2.5 rounded-xl border ${
                      opIdx === q.correct_option ? 'bg-emerald-500 text-white border-emerald-600 font-extrabold' :
                      opIdx === q.selected_option ? 'bg-rose-500 text-white border-rose-600 font-extrabold' :
                      'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
                    }`}>
                      {opIdx === q.correct_option ? '✓ ' : opIdx === q.selected_option ? '✗ ' : ''}{op}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 bg-white/80 dark:bg-slate-800/80 p-3 rounded-xl border border-slate-200/80 dark:border-slate-700">
                  <strong className="text-slate-900 dark:text-white">Explanation:</strong> {q.explanation}
                </p>
              </div>
            ))}
          </div>

          <button
            onClick={() => navigate('/practice')}
            className="w-full py-4 bg-slate-900 hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white font-extrabold text-xs rounded-2xl transition-all"
          >
            Return to AI Practice Hub
          </button>
        </div>
      </main>
    );
  }

  // ACTIVE EXAM INTERFACE
  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between selection:bg-indigo-500 selection:text-white select-none">
      {/* Top Proctoring Bar */}
      <header className="h-16 border-b border-slate-800 bg-slate-900/80 backdrop-blur-md px-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-500/40 text-indigo-400 text-xs font-black">
            <ShieldAlert className="w-4 h-4" /> SECURE PROCTORED EXAM
          </div>
          {proctorWarning && (
            <span className="text-xs font-extrabold text-rose-400 animate-pulse">{proctorWarning}</span>
          )}
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-800 border border-slate-700">
            <Clock className="w-4 h-4 text-emerald-400" />
            <span className="text-sm font-black font-mono text-emerald-400">{formatTime(timeRemaining)}</span>
          </div>

          <button
            onClick={handleSubmitExam}
            disabled={submitting}
            className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-lg flex items-center gap-2 transition-all"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{submitting ? 'Submitting...' : 'Submit Exam'}</span>
          </button>
        </div>
      </header>

      {/* Main Exam Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Question Statement */}
        <div className="lg:col-span-8 bg-slate-900 border border-slate-800 rounded-3xl p-8 space-y-6 shadow-2xl">
          {currentQ ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <span className="text-xs font-extrabold text-indigo-400 uppercase tracking-wider">
                  Question {currentIndex + 1} of {questions.length} · {currentQ.category}
                </span>
                <span className="text-[11px] font-bold text-slate-400 bg-slate-800 px-3 py-1 rounded-full">
                  Negative Mark: -0.25
                </span>
              </div>

              <h2 className="text-lg lg:text-xl font-bold leading-relaxed text-white">
                {currentQ.question_text}
              </h2>

              {currentQ.code_snippet && (
                <pre className="p-4 bg-slate-950 border border-slate-800 text-indigo-300 font-mono text-xs rounded-2xl overflow-x-auto">
                  <code>{currentQ.code_snippet}</code>
                </pre>
              )}

              {/* Options */}
              <div className="space-y-3 pt-2">
                {currentQ.options?.map((op: string, idx: number) => {
                  const isSelected = userAnswers[currentQ.id] === idx;
                  return (
                    <button
                      key={idx}
                      onClick={() => handleSelectOption(idx)}
                      className={`w-full p-4 rounded-2xl text-xs font-extrabold text-left transition-all border flex items-center justify-between ${
                        isSelected
                          ? 'bg-indigo-600 text-white border-indigo-500 shadow-lg scale-[1.01]'
                          : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700 hover:bg-slate-800/50'
                      }`}
                    >
                      <span className="flex items-center gap-3">
                        <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black ${
                          isSelected ? 'bg-white text-indigo-600' : 'bg-slate-800 text-slate-400'
                        }`}>
                          {String.fromCharCode(65 + idx)}
                        </span>
                        {op}
                      </span>
                      {isSelected && <Check className="w-4 h-4 text-white" />}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="p-12 text-center text-slate-400">Loading questions...</div>
          )}

          {/* Navigation Controls */}
          <div className="flex items-center justify-between border-t border-slate-800 pt-6">
            <button
              onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
              disabled={currentIndex === 0}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 disabled:opacity-40 flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" /> Previous
            </button>

            <span className="text-xs font-bold text-slate-500">
              {Object.keys(userAnswers).length} / {questions.length} Answered
            </span>

            <button
              onClick={() => setCurrentIndex((prev) => Math.min(questions.length - 1, prev + 1))}
              disabled={currentIndex === questions.length - 1}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 disabled:opacity-40 flex items-center gap-2"
            >
              Next <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Right Column: Camera & Navigator */}
        <div className="lg:col-span-4 space-y-6">
          {/* WebCam Preview Box */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 space-y-3 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-slate-300 flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-emerald-400" /> WebCam Monitor
              </span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase">Active</span>
            </div>
            <div className="h-44 bg-slate-950 rounded-2xl overflow-hidden relative border border-slate-800">
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover mirror-mode"></video>
            </div>
          </div>

          {/* Question Grid Navigator */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
            <h4 className="text-xs font-extrabold text-slate-300 uppercase tracking-wider">Question Matrix</h4>
            <div className="grid grid-cols-5 gap-2">
              {questions.map((q, idx) => {
                const isAnswered = userAnswers[q.id] !== undefined;
                const isCurrent = idx === currentIndex;
                return (
                  <button
                    key={q.id}
                    onClick={() => setCurrentIndex(idx)}
                    className={`h-9 rounded-xl text-xs font-black transition-all ${
                      isCurrent ? 'ring-2 ring-indigo-400 bg-indigo-600 text-white' :
                      isAnswered ? 'bg-emerald-600/80 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                    }`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
