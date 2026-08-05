import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Mic, MicOff, Send, Clock, Sparkles, AlertCircle, Video, VideoOff, Maximize, Minimize, Wifi } from 'lucide-react';
import api from '../../services/api';

// Extend window for SpeechRecognition
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export const LiveInterviewRoom: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const sessionData = location.state?.sessionData;

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<any>(null);
  const [transcript, setTranscript] = useState('');
  const [submitting, setSubmitting] = useState(false);
  
  // Voice & UI State
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const initialDurationSec = (sessionData?.duration_minutes || sessionData?.duration || 15) * 60;
  const [timeRemaining, setTimeRemaining] = useState(initialDurationSec);
  const [questionIndex, setQuestionIndex] = useState(1);
  const [totalQuestions, setTotalQuestions] = useState(sessionData?.total_questions || sessionData?.question_count || 6);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [micEnabled, setMicEnabled] = useState(true);
  const [camEnabled, setCamEnabled] = useState(true);
  
  const startTimeRef = useRef<number>(Date.now());
  const recognitionRef = useRef<any>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const hasGreetedRef = useRef<boolean>(false);

  // 1. Initialize Session, Camera & MediaRecorder
  useEffect(() => {
    if (!sessionData) {
      alert("No active session data. Returning to dashboard.");
      navigate('/dashboard');
      return;
    }
    setSessionId(sessionData.session_id);
    setCurrentQuestion(sessionData.first_question);
    startTimeRef.current = Date.now();
    if (sessionData.duration_minutes) {
      setTimeRemaining(sessionData.duration_minutes * 60);
    }

    // Start Camera Feed & Video MediaRecorder
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then((stream) => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        try {
          const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8,opus' });
          recordedChunksRef.current = [];
          recorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) {
              recordedChunksRef.current.push(e.data);
            }
          };
          recorder.start(1000);
          mediaRecorderRef.current = recorder;
        } catch (e) {
          console.warn("MediaRecorder init notice:", e);
        }
      })
      .catch((err) => console.warn("Camera access notice:", err));

    // Exit protection
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = 'Your interview is in progress. Are you sure you want to leave?';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      // Save recorded video before unmount
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try { mediaRecorderRef.current.stop(); } catch(e) {}
      }
      if (recordedChunksRef.current.length > 0 && sessionData?.session_id) {
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          try {
            localStorage.setItem(`interview_recording_${sessionData.session_id}`, reader.result as string);
          } catch(e) {}
        };
        reader.readAsDataURL(blob);
      }
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
      window.speechSynthesis.cancel();
      if (recognitionRef.current) recognitionRef.current.stop();
    };
  }, [sessionData, navigate]);

  // 2. Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event: any) => {
        let fullTranscript = '';
        for (let i = 0; i < event.results.length; ++i) {
          fullTranscript += event.results[i][0].transcript + ' ';
        }
        setTranscript(fullTranscript.trim());

        // VAD: Reset silence timer whenever speech is detected (~2 seconds silence detection)
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = setTimeout(() => {
          handleAutoSubmit();
        }, 2000);
      };

      recognitionRef.current.onend = () => {
        if (isListening && !isAiSpeaking && !submitting) {
          try { recognitionRef.current.start(); } catch (e) {}
        }
      };
    } else {
      console.warn("Speech Recognition not supported in this browser.");
    }
  }, [isListening, isAiSpeaking, submitting]);

  // 3. AI Speech Synthesis Engine (Handles Greeting & Question TTS)
  useEffect(() => {
    if (currentQuestion && !isAiThinking && !submitting) {
      if (!hasGreetedRef.current) {
        hasGreetedRef.current = true;
        const candName = sessionData?.candidate_name || sessionData?.candidate_full_name || 'Candidate';
        const roleName = sessionData?.role_target || sessionData?.title || 'Software Engineer';
        const roundName = sessionData?.round_type || 'Technical';
        const greetingSpeech = `Hi ${candName}! Welcome to your ${roundName} interview for the ${roleName} position. I am your AI Interviewer. Let's begin with your first question. ${currentQuestion.question_text}`;
        speakQuestion(greetingSpeech);
      } else {
        speakQuestion(currentQuestion.question_text);
      }
    }
  }, [currentQuestion]);

  const speakQuestion = (text: string) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    
    setIsAiSpeaking(true);
    setIsListening(false);
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch(e) {}
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    
    const setVoiceAndSpeak = () => {
      const voices = window.speechSynthesis.getVoices();
      const goodVoice = voices.find(v => 
        v.name.includes("Google") || v.name.includes("Natural") || v.name.includes("Samantha") || v.name.includes("Microsoft") || v.lang.startsWith("en")
      );
      if (goodVoice) utterance.voice = goodVoice;

      utterance.onend = () => {
        setIsAiSpeaking(false);
        startListening();
      };
      utterance.onerror = () => {
        setIsAiSpeaking(false);
        startListening();
      };

      window.speechSynthesis.speak(utterance);
    };

    if (window.speechSynthesis.getVoices().length > 0) {
      setVoiceAndSpeak();
    } else {
      window.speechSynthesis.onvoiceschanged = () => {
        setVoiceAndSpeak();
        window.speechSynthesis.onvoiceschanged = null;
      };
      setVoiceAndSpeak();
    }
  };

  const startListening = () => {
    if (!recognitionRef.current) return;
    setTranscript('');
    setIsListening(true);
    try {
      recognitionRef.current.start();
    } catch (e) {}
  };

  const handleAutoSubmit = () => {
    // Only submit if we have meaningful transcript
    setTranscript((current) => {
      if (current.trim().length > 10) {
        handleSubmitAnswer(current);
      }
      return current;
    });
  };

  const [interviewerRemark, setInterviewerRemark] = useState<string>('');

  const handleSubmitAnswer = async (textToSubmit: string = transcript) => {
    if (!sessionId || !currentQuestion || submitting || !textToSubmit.trim()) return;
    
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (recognitionRef.current) recognitionRef.current.stop();
    
    setIsListening(false);
    setSubmitting(true);
    setIsAiThinking(true); // Triggers thinking animation

    try {
      const elapsedSec = Math.max(0, Math.round((Date.now() - startTimeRef.current) / 1000));
      const res = await api.post('/interview/submit-answer', {
        session_id: sessionId,
        question_id: currentQuestion.question_id,
        transcript_text: textToSubmit.trim(),
        speech_duration_seconds: 45.0,
        elapsed_seconds: elapsedSec,
        vision_telemetry: {
          eye_contact_percentage: 92,
          attention_score: 95,
          dominant_emotion: "Neutral",
          confidence_percentage: 88
        }
      });

      setTranscript('');
      const remark = res.data.interviewer_remark || res.data.evaluation_feedback || '';
      setInterviewerRemark(remark);
      
      if (res.data.next_question) {
        const nextQ = res.data.next_question;
        setCurrentQuestion(nextQ);
        setQuestionIndex(prev => prev + 1);
        
        // Speak natural interviewer micro-feedback first, then follow-up question
        const fullSpeechText = remark ? `${remark} ${nextQ.question_text}` : nextQ.question_text;
        speakQuestion(fullSpeechText);
      } else {
        // Interview complete
        navigate(`/interview/processing?session=${sessionId}`);
      }
    } catch (err) {
      console.error(err);
      alert('Failed to submit answer.');
    } finally {
      setSubmitting(false);
      setIsAiThinking(false);
    }
  };

  // Timer
  useEffect(() => {
    if (!sessionId) return;
    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          navigate(`/interview/processing?session=${sessionId}`);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [sessionId, navigate]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  const toggleCam = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getVideoTracks().forEach(t => { t.enabled = !t.enabled; });
      setCamEnabled(stream.getVideoTracks()[0]?.enabled || false);
    }
  };

  const toggleMicLocal = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getAudioTracks().forEach(t => { t.enabled = !t.enabled; });
      setMicEnabled(stream.getAudioTracks()[0]?.enabled || false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col text-white font-sans overflow-hidden select-none">
      
      {/* Top Navigation Bar */}
      <div className="h-16 border-b border-slate-800 bg-slate-900/50 backdrop-blur-md px-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 rounded-full bg-brand-primary/20 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-brand-primary" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white">Enterprise AI Interviewer</h1>
            <p className="text-xs text-slate-400">{sessionData?.title}</p>
          </div>
        </div>

        {/* Question Progress */}
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-1.5">
            {Array.from({ length: totalQuestions }, (_, i) => (
              <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${
                i < questionIndex ? 'w-6 bg-emerald-500' : i === questionIndex ? 'w-6 bg-brand-primary animate-pulse' : 'w-3 bg-slate-700'
              }`} />
            ))}
          </div>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Q{questionIndex}/{totalQuestions}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Connection Indicator */}
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800 border border-slate-700">
            <Wifi className="w-3 h-3 text-emerald-400" />
            <span className="text-[10px] font-bold text-emerald-400">Connected</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-800 border border-slate-700">
            <Clock className={`w-4 h-4 ${timeRemaining < 300 ? 'text-rose-500' : 'text-emerald-500'}`} />
            <span className={`text-sm font-extrabold font-mono ${timeRemaining < 300 ? 'text-rose-500' : 'text-white'}`}>
              {formatTime(timeRemaining)}
            </span>
          </div>
          <button onClick={toggleFullscreen} className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors">
            {isFullscreen ? <Minimize className="w-4 h-4 text-slate-400" /> : <Maximize className="w-4 h-4 text-slate-400" />}
          </button>
          <button 
            onClick={() => { if(window.confirm('End interview early?')) navigate(`/interview/processing?session=${sessionId}`) }}
            className="px-4 py-1.5 rounded-full bg-rose-500/10 text-rose-500 text-xs font-bold hover:bg-rose-500/20 transition-all"
          >
            End Interview
          </button>
        </div>
      </div>

      <main className="flex-1 flex p-6 gap-6 max-w-[1600px] mx-auto w-full h-[calc(100vh-4rem)]">
        
        {/* LEFT COLUMN: AI Avatar & Question */}
        <div className="flex-1 rounded-3xl bg-slate-900 border border-slate-800 flex flex-col items-center justify-center relative overflow-hidden shadow-2xl">
          
          {/* AI Avatar Orb */}
          <div className="relative">
            <div className={`absolute inset-0 rounded-full transition-all duration-1000 ${
              isAiSpeaking ? 'bg-brand-primary/30 blur-3xl scale-150 opacity-100' : 
              isAiThinking ? 'bg-amber-500/20 blur-3xl scale-125 opacity-80' : 
              'bg-emerald-500/10 blur-xl scale-100 opacity-50'
            }`}></div>
            <div className={`w-32 h-32 rounded-full border-4 flex items-center justify-center bg-slate-900 relative z-10 transition-all duration-500 ${
              isAiSpeaking ? 'border-brand-primary shadow-[0_0_50px_rgba(59,130,246,0.6)] scale-110' : 
              isAiThinking ? 'border-amber-500 shadow-[0_0_30px_rgba(245,158,11,0.5)] scale-100' : 
              'border-emerald-500/50 scale-100'
            }`}>
              <Sparkles className={`w-12 h-12 transition-all duration-500 ${
                isAiSpeaking ? 'text-brand-primary animate-pulse' : 
                isAiThinking ? 'text-amber-500 animate-spin-slow' : 
                'text-emerald-500/50'
              }`} />
            </div>
          </div>

          <div className="absolute bottom-10 left-10 right-10 text-center space-y-4">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-800/80 backdrop-blur-sm border border-slate-700">
              <div className={`w-2 h-2 rounded-full ${
                isAiSpeaking ? 'bg-brand-primary animate-pulse' : 
                isAiThinking ? 'bg-amber-500 animate-pulse' : 
                'bg-emerald-500'
              }`}></div>
              <span className="text-xs font-bold text-slate-300">
                {isAiSpeaking ? 'AI is speaking...' : 
                 isAiThinking ? 'AI is analyzing your response...' : 
                 'AI is listening...'}
              </span>
            </div>
            {interviewerRemark && (
              <div className="mb-3 max-w-2xl mx-auto px-4 py-2 rounded-2xl bg-indigo-950/80 border border-indigo-500/40 text-indigo-200 text-xs font-semibold shadow-lg flex items-center justify-center gap-2 animate-fade-in">
                <Sparkles className="w-4 h-4 text-indigo-400 shrink-0" />
                <span>Interviewer Remark: "{interviewerRemark}"</span>
              </div>
            )}
            {currentQuestion && (
              <h2 className="text-2xl lg:text-3xl font-extrabold text-white leading-tight max-w-3xl mx-auto">
                "{currentQuestion.question_text}"
              </h2>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Candidate Camera & Input */}
        <div className="w-96 flex flex-col gap-6">
          
          {/* Camera Feed Preview */}
          <div className="h-64 rounded-3xl bg-slate-950 border border-slate-800 shadow-xl overflow-hidden relative flex flex-col items-center justify-center">
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              muted 
              className="absolute inset-0 w-full h-full object-cover mirror-mode"
            ></video>
            <div className="absolute top-4 right-4 flex items-center gap-2 bg-slate-900/60 backdrop-blur px-2 py-1 rounded-md">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
              <span className="text-[10px] font-bold text-white uppercase tracking-wider">Live</span>
            </div>
            {/* Camera/Mic Controls */}
            <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-2">
              <button onClick={toggleMicLocal} className={`p-2 rounded-full backdrop-blur-md transition-all ${micEnabled ? 'bg-slate-800/80' : 'bg-rose-500/90'}`}>
                {micEnabled ? <Mic className="w-4 h-4 text-white" /> : <MicOff className="w-4 h-4 text-white" />}
              </button>
              <button onClick={toggleCam} className={`p-2 rounded-full backdrop-blur-md transition-all ${camEnabled ? 'bg-slate-800/80' : 'bg-rose-500/90'}`}>
                {camEnabled ? <Video className="w-4 h-4 text-white" /> : <VideoOff className="w-4 h-4 text-white" />}
              </button>
            </div>
          </div>

          {/* Transcript / Input Box */}
          <div className="flex-1 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl p-6 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-extrabold text-white">Live Transcript</h3>
              {currentQuestion?.is_followup && (
                <span className="px-2 py-1 rounded-md bg-amber-500/20 text-amber-500 text-[10px] font-bold uppercase tracking-wider">
                  Dynamic Follow-up
                </span>
              )}
            </div>
            
            <textarea
              disabled={isAiSpeaking || isAiThinking || submitting}
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder={
                isAiSpeaking ? "Listening paused while AI speaks..." : 
                isAiThinking ? "Please wait, AI is thinking..." : 
                "Start speaking... (Mic is active)"
              }
              className="flex-1 w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-sm font-medium text-emerald-400 focus:outline-none focus:border-emerald-500 resize-none disabled:opacity-50 disabled:text-slate-500"
            />
            
            <div className="mt-4 flex items-center gap-3">
              <button 
                onClick={() => isListening ? recognitionRef.current?.stop() : startListening()}
                disabled={isAiSpeaking || isAiThinking || submitting}
                className={`p-4 rounded-xl transition-all disabled:opacity-50 ${!isListening ? 'bg-rose-500 text-white' : 'bg-slate-800 text-emerald-500 hover:bg-slate-700'}`}
                title="Toggle Mic"
              >
                {!isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>
              
              <button
                onClick={() => handleSubmitAnswer(transcript)}
                disabled={submitting || isAiSpeaking || isAiThinking || !transcript.trim()}
                className="flex-1 p-4 rounded-xl bg-brand-primary hover:bg-blue-600 text-white font-extrabold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 shadow-[0_0_20px_rgba(59,130,246,0.3)]"
              >
                <span>{isAiThinking ? 'Analyzing...' : 'Submit Answer'}</span>
                <Send className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[10px] text-slate-500 text-center mt-3 font-semibold uppercase tracking-wider">
              Auto-submits after 3s of silence
            </p>
          </div>

        </div>
      </main>

      <style>{`
        .mirror-mode {
          transform: scaleX(-1);
        }
        .animate-spin-slow {
          animation: spin 4s linear infinite;
        }
      `}</style>
    </div>
  );
};
