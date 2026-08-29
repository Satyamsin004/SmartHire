import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Mic, MicOff, Send, Clock, Sparkles, AlertCircle, Video, VideoOff, Maximize, Minimize, Wifi, ShieldCheck, ShieldAlert } from 'lucide-react';
import api from '../../services/api';
import { integrityEngine, ActiveIncident } from '../../services/IntegrityEngine';
import { IntegrityWarningOverlay } from '../../components/interview/IntegrityWarningOverlay';
import { InterviewTerminatedScreen } from '../../components/interview/InterviewTerminatedScreen';

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
  const [isFinalizingReport, setIsFinalizingReport] = useState(false);
  const [autoSubmitCountdown, setAutoSubmitCountdown] = useState<number | null>(null);
  const initialDurationSec = (sessionData?.duration_minutes || sessionData?.duration || 15) * 60;
  const [timeRemaining, setTimeRemaining] = useState(initialDurationSec);
  const [questionIndex, setQuestionIndex] = useState(1);
  const [totalQuestions, setTotalQuestions] = useState(sessionData?.total_questions || sessionData?.question_count || 6);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [micEnabled, setMicEnabled] = useState(true);
  const [camEnabled, setCamEnabled] = useState(true);

  // Integrity & Proctoring State
  const [activeIncident, setActiveIncident] = useState<ActiveIncident | null>(null);
  const [terminatedReason, setTerminatedReason] = useState<string | null>(null);
  
  const startTimeRef = useRef<number>(Date.now());
  const recognitionRef = useRef<any>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);
  const speechTimerRef = useRef<NodeJS.Timeout | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const isInitializedRef = useRef<boolean>(false);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const hasGreetedRef = useRef<boolean>(false);
  const transcriptRef = useRef<string>('');
  const suppressQuestionSpeakRef = useRef<boolean>(false);
  const persistentVoiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const isSessionEndedRef = useRef<boolean>(false);

  // Persistent Soothing Female Voice Selector Helper
  const getSoothingVoice = (voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | undefined => {
    // If a soothing voice was already selected for this session, reuse it permanently
    if (persistentVoiceRef.current) {
      const stillAvailable = voices.find(v => v.name === persistentVoiceRef.current?.name);
      if (stillAvailable) return stillAvailable;
    }
    if (!voices || voices.length === 0) return undefined;
    
    // Strict Blacklist: Never use male or harsh default voices
    const maleBlacklist = ['david', 'mark', 'george', 'guy', 'male', 'richard', 'stefan', 'paul', 'james'];

    // High Priority: Natural, Neural, and Google Female Voices
    const soothingFemaleNames = [
      'Jenny Online (Natural)',
      'Aria Online (Natural)',
      'Microsoft Jenny',
      'Microsoft Aria',
      'Google US English',
      'Google UK English Female',
      'Microsoft Zira Desktop',
      'Microsoft Zira',
      'Samantha',
      'Victoria',
      'Karen',
      'Zira',
      'Jenny',
      'Aria'
    ];

    for (const name of soothingFemaleNames) {
      const match = voices.find(v => 
        v.name.toLowerCase().includes(name.toLowerCase()) && 
        v.lang.startsWith('en') &&
        !maleBlacklist.some(m => v.name.toLowerCase().includes(m))
      );
      if (match) {
        persistentVoiceRef.current = match;
        return match;
      }
    }

    // Tier 2: Any English voice with 'Natural', 'Female', or 'Google' and not male
    const naturalVoice = voices.find(v => 
      v.lang.startsWith('en') && 
      !maleBlacklist.some(m => v.name.toLowerCase().includes(m)) &&
      (v.name.toLowerCase().includes('google') || v.name.toLowerCase().includes('natural') || v.name.toLowerCase().includes('female'))
    );
    if (naturalVoice) {
      persistentVoiceRef.current = naturalVoice;
      return naturalVoice;
    }

    // Tier 3: Any English voice not in male blacklist
    const politeVoice = voices.find(v => v.lang.startsWith('en') && !maleBlacklist.some(m => v.name.toLowerCase().includes(m)));
    if (politeVoice) {
      persistentVoiceRef.current = politeVoice;
      return politeVoice;
    }

    const fallback = voices.find(v => v.lang.startsWith('en')) || voices[0];
    persistentVoiceRef.current = fallback;
    return fallback;
  };

  // 1. Initialize Session, Camera & MediaRecorder (guarded against re-runs)
  useEffect(() => {
    if (isInitializedRef.current) return;
    isInitializedRef.current = true;

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
    navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 } }, audio: true })
      .catch(() => {
        return navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      })
      .catch(() => {
        // Fallback to audio-only if camera is unavailable or denied
        return navigator.mediaDevices.getUserMedia({ audio: true });
      })
      .then((stream) => {
        mediaStreamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.muted = true;
          videoRef.current.setAttribute('playsinline', 'true');
          videoRef.current.setAttribute('autoplay', 'true');
          const playPromise = videoRef.current.play();
          if (playPromise !== undefined) {
            playPromise.catch((e) => console.warn("Live room video play notice:", e));
          }
          // Start automated vision & tab switch integrity monitoring
          if (sessionData.session_id) {
            integrityEngine.startMonitoring(
              videoRef.current,
              sessionData.session_id,
              (incident) => setActiveIncident(incident),
              async (reason) => {
                window.speechSynthesis?.cancel();
                if (recognitionRef.current) recognitionRef.current.stop();
                await finalizeAndUploadRecording();
                setTerminatedReason(reason);
              }
            );
          }
        }
        try {
          let mimeType = '';
          const candidateMimes = [
            'video/webm;codecs=vp9,opus',
            'video/webm;codecs=vp8,opus',
            'video/webm',
            'video/mp4;codecs=avc1,mp4a',
            'video/mp4',
            'audio/webm',
            'audio/mp4'
          ];
          for (const m of candidateMimes) {
            if (typeof MediaRecorder.isTypeSupported === 'function' && MediaRecorder.isTypeSupported(m)) {
              mimeType = m;
              break;
            }
          }
          const options = mimeType ? { mimeType } : undefined;
          const recorder = new MediaRecorder(stream, options);
          recordedChunksRef.current = [];
          recorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) {
              recordedChunksRef.current.push(e.data);
            }
          };
          recorder.start(1000); // Record chunks continuously every 1 second
          mediaRecorderRef.current = recorder;
        } catch (e) {
          console.warn("MediaRecorder init notice:", e);
        }
      })
      .catch((err) => console.warn("Media device access notice:", err));

    // Exit protection
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = 'Your interview is in progress. Are you sure you want to leave?';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      isSessionEndedRef.current = true;
      window.removeEventListener('beforeunload', handleBeforeUnload);
      integrityEngine.stopMonitoring();
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
      if (speechTimerRef.current) clearTimeout(speechTimerRef.current);
      // Clean up tracks on real unmount
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try { mediaRecorderRef.current.stop(); } catch(e) {}
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if ('speechSynthesis' in window) {
        window.speechSynthesis.onvoiceschanged = null;
        window.speechSynthesis.cancel();
      }
      if (recognitionRef.current) recognitionRef.current.stop();
    };
  }, [sessionData, navigate]);

  // 2. Initialize Speech Recognition with Synchronous Ref Tracking & Robust VAD Auto-Submit
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
        const cleanText = fullTranscript.trim();
        transcriptRef.current = cleanText;
        setTranscript(cleanText);

        // VAD: Reset silence timer on active verbal input
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
        setAutoSubmitCountdown(null);

        // Trigger Auto-Submit when candidate completes their answer (>= 8 characters spoken)
        if (cleanText.length >= 8) {
          silenceTimerRef.current = setTimeout(() => {
            let count = 3;
            setAutoSubmitCountdown(count);
            countdownTimerRef.current = setInterval(() => {
              count -= 1;
              if (count <= 0) {
                if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
                setAutoSubmitCountdown(null);
                const currentSpokenText = transcriptRef.current.trim();
                if (currentSpokenText) {
                  handleSubmitAnswer(currentSpokenText);
                }
              } else {
                setAutoSubmitCountdown(count);
              }
            }, 850);
          }, 2200);
        }
      };

      recognitionRef.current.onend = () => {
        if (isListening && !isAiSpeaking && !submitting && !isAiThinking) {
          try { recognitionRef.current.start(); } catch (e) {}
        }
      };
    } else {
      console.warn("Speech Recognition not supported in this browser.");
    }
  }, [isListening, isAiSpeaking, submitting, isAiThinking]);

  // 3. AI Speech Synthesis Engine (Handles Greeting & Question TTS)
  useEffect(() => {
    if (currentQuestion && !isAiThinking && !submitting) {
      if (suppressQuestionSpeakRef.current) {
        suppressQuestionSpeakRef.current = false;
        return;
      }

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
    if (isSessionEndedRef.current || isFinalizingReport) {
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      return;
    }
    if (!('speechSynthesis' in window)) {
      setIsAiSpeaking(false);
      startListening();
      return;
    }
    window.speechSynthesis.cancel();
    if (speechTimerRef.current) clearTimeout(speechTimerRef.current);
    
    setIsAiSpeaking(true);
    setIsListening(false);
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch(e) {}
    }

    const cleanText = text.replace(/[*_#`~]/g, '').trim();
    const utterance = new SpeechSynthesisUtterance(cleanText);
    
    // Soothing, natural interview pace & pitch
    utterance.rate = 0.96;
    utterance.pitch = 1.02;
    utterance.volume = 1.0;
    
    // Fallback safety timer
    const safeDurationMs = Math.max(3500, Math.min(25000, cleanText.length * 75));
    speechTimerRef.current = setTimeout(() => {
      setIsAiSpeaking(false);
      if (!isSessionEndedRef.current && !isFinalizingReport) {
        startListening();
      }
    }, safeDurationMs);

    const setVoiceAndSpeak = () => {
      if (isSessionEndedRef.current || isFinalizingReport) {
        if ('speechSynthesis' in window) window.speechSynthesis.cancel();
        return;
      }
      const voices = window.speechSynthesis.getVoices();
      const soothingVoice = getSoothingVoice(voices);
      if (soothingVoice) utterance.voice = soothingVoice;

      utterance.onend = () => {
        if (speechTimerRef.current) clearTimeout(speechTimerRef.current);
        setIsAiSpeaking(false);
        if (!isSessionEndedRef.current && !isFinalizingReport) {
          startListening();
        }
      };
      utterance.onerror = () => {
        if (speechTimerRef.current) clearTimeout(speechTimerRef.current);
        setIsAiSpeaking(false);
        if (!isSessionEndedRef.current && !isFinalizingReport) {
          startListening();
        }
      };

      try {
        if (!isSessionEndedRef.current && !isFinalizingReport) {
          window.speechSynthesis.speak(utterance);
        }
      } catch (e) {
        setIsAiSpeaking(false);
        if (!isSessionEndedRef.current && !isFinalizingReport) {
          startListening();
        }
      }
    };

    const currentVoices = window.speechSynthesis.getVoices();
    const hasSoothingVoiceReady = currentVoices.length > 0 && currentVoices.some(v => 
      !['david', 'mark', 'george', 'guy', 'male'].some(m => v.name.toLowerCase().includes(m))
    );

    if (hasSoothingVoiceReady) {
      setVoiceAndSpeak();
    } else {
      let isExecuted = false;
      const execute = () => {
        if (isExecuted) return;
        isExecuted = true;
        window.speechSynthesis.onvoiceschanged = null;
        setVoiceAndSpeak();
      };
      window.speechSynthesis.onvoiceschanged = execute;
      setTimeout(execute, 250);
    }
  };

  const handleSkipAiSpeech = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if (speechTimerRef.current) clearTimeout(speechTimerRef.current);
    setIsAiSpeaking(false);
    startListening();
  };

  const startListening = () => {
    if (!recognitionRef.current) return;
    setIsListening(true);
    try {
      recognitionRef.current.start();
    } catch (e) {}
  };

  const cancelAutoSubmit = () => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    setAutoSubmitCountdown(null);
  };

  const [interviewerRemark, setInterviewerRemark] = useState<string>('');

  const handleSubmitAnswer = async (manualText?: string) => {
    const textToSubmit = typeof manualText === 'string' && manualText.trim()
      ? manualText.trim()
      : (transcriptRef.current.trim() || transcript.trim());

    if (!sessionId || !currentQuestion || submitting) return;
    if (!textToSubmit) {
      alert("Please speak into your microphone or type your answer before submitting.");
      return;
    }
    
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    if (speechTimerRef.current) clearTimeout(speechTimerRef.current);
    window.speechSynthesis?.cancel();
    setAutoSubmitCountdown(null);
    if (recognitionRef.current) recognitionRef.current.stop();
    
    setIsListening(false);
    setIsAiSpeaking(false);
    setSubmitting(true);
    setIsAiThinking(true); // Triggers thinking animation

    try {
      const elapsedSec = Math.max(0, Math.round((Date.now() - startTimeRef.current) / 1000));
      const res = await api.post('/interview/submit-answer', {
        session_id: sessionId,
        question_id: currentQuestion?.question_id || currentQuestion?.id,
        transcript_text: textToSubmit,
        speech_duration_seconds: 45.0,
        elapsed_seconds: elapsedSec,
        vision_telemetry: {
          eye_contact_percentage: 92,
          attention_score: 95,
          dominant_emotion: "neutral",
          confidence_percentage: 88
        }
      }, { timeout: 45000 });

      setTranscript('');
      transcriptRef.current = '';
      const remark = res.data.interviewer_remark || res.data.evaluation_feedback || '';
      setInterviewerRemark(remark);
      
      if (res.data.next_question) {
        const nextQ = res.data.next_question;
        // Suppress redundant question speech in useEffect so full speech plays uninterrupted
        suppressQuestionSpeakRef.current = true;
        setCurrentQuestion(nextQ);
        setQuestionIndex(prev => prev + 1);
        
        // Speak AI evaluation feedback out loud first, followed by next question
        const fullSpeechText = remark 
          ? `${remark}. Let's move to the next question. ${nextQ.question_text}` 
          : nextQ.question_text;
        speakQuestion(fullSpeechText);
      } else {
        // Interview complete: stop recording, save blob, upload, and navigate
        if (remark) {
          speakQuestion(`${remark}. Thank you! You have completed all questions for this interview.`);
        }
        await handleCompleteSession();
      }
    } catch (err: any) {
      console.error('Submit answer error:', err);
      const msg = err.response?.data?.detail || err.message || 'Failed to submit answer.';
      alert(`Submission Notice: ${msg}. Please click Submit Answer again.`);
    } finally {
      setSubmitting(false);
      setIsAiThinking(false);
    }
  };

  const finalizeAndUploadRecording = async () => {
    if (!sessionId) return;
    try {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try { mediaRecorderRef.current.requestData(); } catch(e) {}
        await new Promise<void>((resolve) => {
          if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
            return resolve();
          }
          mediaRecorderRef.current.onstop = () => resolve();
          try {
            mediaRecorderRef.current.stop();
          } catch(e) {
            resolve();
          }
          setTimeout(resolve, 2000);
        });
      }

      await new Promise(r => setTimeout(r, 400));

      if (recordedChunksRef.current && recordedChunksRef.current.length > 0) {
        const mime = mediaRecorderRef.current?.mimeType || 'video/webm';
        const blob = new Blob(recordedChunksRef.current, { type: mime });
        console.log(`[Recording] Assembled ${recordedChunksRef.current.length} chunks totaling ${blob.size} bytes`);
        
        const localBlobUrl = URL.createObjectURL(blob);
        (window as any).__LAST_INTERVIEW_RECORDING_BLOB__ = {
          sessionId: sessionId,
          blobUrl: localBlobUrl,
          blob: blob
        };
        try {
          sessionStorage.setItem(`session_recording_url_${sessionId}`, localBlobUrl);
        } catch(e) {}

        const formData = new FormData();
        const ext = mime.includes('mp4') ? 'mp4' : 'webm';
        const durationSec = Math.max(1, Math.round((Date.now() - startTimeRef.current) / 1000));
        formData.append('file', blob, `recording_${sessionId}.${ext}`);
        formData.append('duration', String(durationSec));
        formData.append('recording_type', mime.startsWith('audio') ? 'AUDIO_ONLY' : 'VIDEO_AUDIO');
        
        await api.post(`/uploads/interview-sessions/${sessionId}/recordings`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 45000
        }).catch(e => console.warn("Recording upload notice:", e));
      }
    } catch(e) {
      console.warn("Recording finalize notice:", e);
    }
  };

  const handleCompleteSession = async () => {
    if (!sessionId) return;
    isSessionEndedRef.current = true;
    setIsFinalizingReport(true);
    setSubmitting(true);
    setIsAiSpeaking(false);
    setIsListening(false);
    if (speechTimerRef.current) clearTimeout(speechTimerRef.current);
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch(e) {}
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = null;
      window.speechSynthesis.cancel();
    }
    try {
      // If there is an unsubmitted answer in the transcript textarea, submit it now
      if (transcript && transcript.trim() && currentQuestion) {
        try {
          const elapsedSec = Math.max(0, Math.round((Date.now() - startTimeRef.current) / 1000));
          await api.post('/interview/submit-answer', {
            session_id: sessionId,
            question_id: currentQuestion?.question_id || currentQuestion?.id,
            transcript_text: transcript.trim(),
            speech_duration_seconds: 45.0,
            elapsed_seconds: elapsedSec,
            vision_telemetry: {
              eye_contact_percentage: 92,
              attention_score: 95,
              dominant_emotion: "neutral",
              confidence_percentage: 88
            }
          }, { timeout: 15000 });
        } catch (e) {
          console.warn("Auto-submit final answer notice:", e);
        }
      }
      await finalizeAndUploadRecording();
      await api.post(`/interview/finish/${sessionId}`, {}, { timeout: 30000 }).catch(() => {});
    } catch(e) {
      console.warn("Session finish notice:", e);
    } finally {
      setSubmitting(false);
    }
    navigate(`/interview/results?session=${sessionId}`, { replace: true });
  };

  // Timer
  useEffect(() => {
    if (!sessionId) return;
    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleCompleteSession();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [sessionId]);

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

  if (terminatedReason) {
    return <InterviewTerminatedScreen reason={terminatedReason} sessionId={sessionId} />;
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col text-white font-sans overflow-hidden select-none relative">
      
      {/* Integrity Real-Time Incident Warning Overlay */}
      <IntegrityWarningOverlay incident={activeIncident} />

      {/* Background Ambient Glows */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[600px] h-[400px] bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Top Navigation Bar */}
      <header className="h-16 border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-xl px-6 flex items-center justify-between relative z-20 shadow-md">
        <div className="flex items-center gap-3.5">
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-indigo-600 to-indigo-400 flex items-center justify-center shadow-lg shadow-indigo-500/20 border border-indigo-400/30">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-black text-white tracking-tight">SmartHire <span className="text-indigo-400">AI</span></h1>
              <span className="px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 text-[10px] font-extrabold uppercase tracking-wider border border-indigo-500/30">
                Live Assessment
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium truncate max-w-xs">{sessionData?.title || 'Technical Round'}</p>
          </div>
        </div>

        {/* Question Progress Indicator */}
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-1.5 p-1 bg-slate-950/80 rounded-full border border-slate-800/80 px-2.5">
            {Array.from({ length: totalQuestions }, (_, i) => (
              <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${
                i < questionIndex ? 'w-6 bg-emerald-400' : i === questionIndex - 1 ? 'w-6 bg-indigo-500 animate-pulse' : 'w-3 bg-slate-700'
              }`} />
            ))}
          </div>
          <span className="text-[11px] font-black text-slate-300 uppercase tracking-wider bg-slate-900 px-3 py-1 rounded-xl border border-slate-800">
            Question {questionIndex} / {totalQuestions}
          </span>
        </div>

        {/* Action Controls & Session Timer */}
        <div className="flex items-center gap-3">
          {/* Proctoring Shield Status Badge */}
          <div className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold shadow-inner ${
            activeIncident
              ? 'bg-rose-950/80 border-rose-500/40 text-rose-300 animate-pulse'
              : 'bg-indigo-950/70 border-indigo-500/30 text-indigo-300'
          }`}>
            {activeIncident ? <ShieldAlert className="w-3.5 h-3.5 text-rose-400" /> : <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />}
            <span className="text-[10px] font-bold uppercase tracking-wider">
              {activeIncident ? 'Violation Detected' : 'Proctoring Active'}
            </span>
          </div>

          {/* Connection Status Badge */}
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs font-bold text-emerald-400 shadow-inner">
            <Wifi className="w-3.5 h-3.5" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Online</span>
          </div>
          
          {/* Session Countdown Timer */}
          <div className="flex items-center gap-2 px-4 py-1.5 rounded-xl bg-slate-900/90 border border-slate-800 shadow-inner">
            <Clock className={`w-4 h-4 ${timeRemaining < 300 ? 'text-rose-500 animate-pulse' : 'text-emerald-400'}`} />
            <span className={`text-sm font-black font-mono tracking-wider ${timeRemaining < 300 ? 'text-rose-400' : 'text-white'}`}>
              {formatTime(timeRemaining)}
            </span>
          </div>

          <button 
            onClick={toggleFullscreen} 
            className="p-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white transition-all cursor-pointer shadow-xs"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </button>

          <button 
            onClick={() => { if(window.confirm('End interview early and view results?')) handleCompleteSession(); }}
            className="px-4 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-extrabold transition-all cursor-pointer shadow-xs active:scale-95"
          >
            End Interview
          </button>
        </div>
      </header>

      {/* Main Workspace Frame */}
      <main className="flex-1 flex p-6 gap-6 max-w-[1680px] mx-auto w-full h-[calc(100vh-4rem)] relative z-10">
        
        {/* LEFT COLUMN: AI Voice Avatar & Question Card */}
        <div className="flex-1 rounded-3xl bg-slate-900/70 backdrop-blur-md border border-slate-800/80 flex flex-col items-center justify-center relative overflow-hidden shadow-2xl p-8">
          
          {/* Radiant Halo & AI Avatar Orb */}
          <div className="relative mb-8">
            <div className={`absolute inset-0 rounded-full transition-all duration-700 ${
              isAiSpeaking ? 'bg-indigo-500/30 blur-3xl scale-150 opacity-100' : 
              isAiThinking ? 'bg-amber-500/30 blur-3xl scale-125 opacity-90' : 
              'bg-emerald-500/20 blur-2xl scale-100 opacity-60'
            }`} />
            
            <div className={`w-36 h-36 rounded-full border-4 flex items-center justify-center bg-slate-950/90 backdrop-blur-xl relative z-10 transition-all duration-500 shadow-2xl ${
              isAiSpeaking ? 'border-indigo-400 shadow-[0_0_60px_rgba(99,102,241,0.6)] scale-105' : 
              isAiThinking ? 'border-amber-400 shadow-[0_0_40px_rgba(245,158,11,0.5)] scale-100' : 
              'border-emerald-400/80 shadow-[0_0_30px_rgba(16,185,129,0.3)] scale-100'
            }`}>
              <Sparkles className={`w-14 h-14 transition-all duration-500 ${
                isAiSpeaking ? 'text-indigo-400 animate-pulse' : 
                isAiThinking ? 'text-amber-400 animate-spin-slow' : 
                'text-emerald-400'
              }`} />
            </div>
          </div>

          {/* AI Status Pill & Active Question Card */}
          <div className="w-full max-w-3xl text-center space-y-4">
            <div className="inline-flex items-center gap-3 px-4 py-1.5 rounded-full bg-slate-950/80 backdrop-blur-md border border-slate-800 shadow-inner">
              <div className={`w-2.5 h-2.5 rounded-full ${
                isAiSpeaking ? 'bg-indigo-400 animate-ping' : 
                isAiThinking ? 'bg-amber-400 animate-pulse' : 
                'bg-emerald-400 animate-pulse'
              }`} />
              <span className="text-xs font-black text-slate-200 tracking-wide uppercase">
                {isAiSpeaking ? 'AI Interviewer Speaking...' : 
                 isAiThinking ? 'AI Evaluating Response...' : 
                 'Listening To Candidate...'}
              </span>
              {isAiSpeaking && (
                <button
                  onClick={handleSkipAiSpeech}
                  className="ml-2 px-2.5 py-0.5 rounded-full bg-indigo-500/20 hover:bg-indigo-500/40 text-indigo-300 text-[10px] font-extrabold uppercase tracking-wider border border-indigo-500/40 transition-all cursor-pointer"
                >
                  Skip Audio ⏩
                </button>
              )}
            </div>

            {interviewerRemark && (
              <div className="max-w-2xl mx-auto px-4 py-2.5 rounded-2xl bg-indigo-950/70 border border-indigo-500/30 text-indigo-200 text-xs font-semibold shadow-lg flex items-center justify-center gap-2 animate-fade-in">
                <Sparkles className="w-4 h-4 text-indigo-400 shrink-0" />
                <span>Interviewer Remark: "{interviewerRemark}"</span>
              </div>
            )}

            {currentQuestion && (
              <div className="p-6 bg-slate-950/60 rounded-2xl border border-slate-800/80 shadow-xl backdrop-blur-sm">
                <h2 className="text-xl sm:text-2xl lg:text-3xl font-black text-slate-100 leading-snug tracking-tight">
                  "{currentQuestion.question_text}"
                </h2>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Candidate Webcam Feed & Live Transcript Box */}
        <div className="w-96 flex flex-col gap-5">
          
          {/* Candidate Camera Stream Preview */}
          <div className="h-64 rounded-3xl bg-slate-950 border border-slate-800/80 shadow-2xl overflow-hidden relative flex flex-col items-center justify-center group">
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              muted 
              className="absolute inset-0 w-full h-full object-cover mirror-mode bg-slate-950"
            />

            {/* REC Recording Status Badge */}
            <div className="absolute top-4 right-4 flex items-center gap-2 bg-slate-950/80 backdrop-blur-md px-3 py-1 rounded-full border border-slate-800 shadow-md">
              <div className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
              <span className="text-[10px] font-black text-white uppercase tracking-wider">REC • Live</span>
            </div>

            {/* Floating Glass Device Controls */}
            <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-2.5 z-10">
              <button 
                onClick={toggleMicLocal} 
                className={`p-2.5 rounded-2xl backdrop-blur-md transition-all shadow-lg cursor-pointer border ${
                  micEnabled 
                    ? 'bg-slate-900/80 text-emerald-400 border-slate-700/80 hover:bg-slate-800' 
                    : 'bg-rose-500/90 text-white border-rose-400 hover:bg-rose-600'
                }`}
                title={micEnabled ? 'Mute Microphone' : 'Unmute Microphone'}
              >
                {micEnabled ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
              </button>
              
              <button 
                onClick={toggleCam} 
                className={`p-2.5 rounded-2xl backdrop-blur-md transition-all shadow-lg cursor-pointer border ${
                  camEnabled 
                    ? 'bg-slate-900/80 text-emerald-400 border-slate-700/80 hover:bg-slate-800' 
                    : 'bg-rose-500/90 text-white border-rose-400 hover:bg-rose-600'
                }`}
                title={camEnabled ? 'Turn Camera Off' : 'Turn Camera On'}
              >
                {camEnabled ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Transcript / Spoken Response Card */}
          <div className="flex-1 rounded-3xl bg-slate-900/70 backdrop-blur-md border border-slate-800/80 shadow-2xl p-6 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${isListening ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
                  <h3 className="text-xs font-black text-white uppercase tracking-wider">Live Verbal Response</h3>
                </div>
                
                {/* Audio Waveform Meter */}
                <div className="flex items-end gap-0.5 h-4 px-2 py-0.5 rounded-lg bg-slate-950 border border-slate-800">
                  <span className={`w-1 bg-emerald-400 rounded-full transition-all ${isListening ? 'h-3 animate-pulse' : 'h-1'}`}></span>
                  <span className={`w-1 bg-teal-400 rounded-full transition-all ${isListening ? 'h-4 animate-bounce' : 'h-1.5'}`}></span>
                  <span className={`w-1 bg-emerald-400 rounded-full transition-all ${isListening ? 'h-2 animate-pulse' : 'h-1'}`}></span>
                </div>
              </div>
              
              <textarea
                disabled={submitting || isAiThinking}
                value={transcript}
                onChange={(e) => {
                  setTranscript(e.target.value);
                  transcriptRef.current = e.target.value;
                }}
                placeholder={
                  isAiThinking ? "AI is evaluating your response..." : 
                  "Speak into microphone or type your response here..."
                }
                className="w-full h-36 bg-slate-950/90 border border-slate-800/90 rounded-2xl p-4 text-xs sm:text-sm font-semibold text-emerald-300 focus:outline-none focus:border-indigo-500 resize-none disabled:opacity-50 disabled:text-slate-500 leading-relaxed shadow-inner"
              />

              {autoSubmitCountdown !== null && (
                <div className="flex items-center justify-between p-2 rounded-xl bg-amber-950/60 border border-amber-500/40 text-amber-300 text-xs animate-pulse">
                  <span className="font-bold">Auto-submitting in {autoSubmitCountdown}s...</span>
                  <button
                    onClick={cancelAutoSubmit}
                    className="px-2 py-0.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/40 text-amber-200 text-[10px] font-extrabold border border-amber-500/40 cursor-pointer"
                  >
                    Keep Speaking
                  </button>
                </div>
              )}
            </div>
            
            <div className="pt-4 space-y-2">
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => isListening ? recognitionRef.current?.stop() : startListening()}
                  disabled={submitting || isAiThinking}
                  className={`p-3.5 rounded-2xl transition-all disabled:opacity-50 cursor-pointer border shadow-md ${
                    !isListening 
                      ? 'bg-rose-500/20 border-rose-500/40 text-rose-400 hover:bg-rose-500/30' 
                      : 'bg-slate-800 border-slate-700 text-emerald-400 hover:bg-slate-700'
                  }`}
                  title="Toggle Speech Recognition"
                >
                  {!isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                </button>
                
                <button
                  onClick={() => handleSubmitAnswer(transcript)}
                  disabled={submitting || isAiThinking || !transcript.trim()}
                  className="flex-1 py-3.5 px-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-40 shadow-lg shadow-indigo-600/30 cursor-pointer active:scale-98"
                >
                  <span>{isAiThinking ? 'Analyzing Response...' : 'Submit Answer'}</span>
                  <Send className="w-4 h-4" />
                </button>
              </div>
              
              <p className="text-[10px] text-slate-400 text-center font-bold tracking-wide">
                Speak naturally or type • Click Submit Answer when ready
              </p>
            </div>
          </div>

        </div>
      </main>

      {/* Fullscreen Overlay when Finalizing Report & Telemetry */}
      {isFinalizingReport && (
        <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-2xl z-50 flex flex-col items-center justify-center p-6 space-y-6 text-center animate-fade-in">
          <div className="relative">
            <div className="w-28 h-28 rounded-full bg-indigo-500/20 blur-2xl animate-pulse absolute inset-0" />
            <div className="w-20 h-20 rounded-3xl bg-indigo-950/80 border-2 border-indigo-400/80 flex items-center justify-center mx-auto shadow-2xl relative z-10">
              <Sparkles className="w-10 h-10 text-indigo-400 animate-spin-slow" />
            </div>
          </div>
          <div className="space-y-2 max-w-md">
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">Compiling AI Evaluation Report...</h2>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed font-medium">
              Synchronizing recording telemetry, calculating multi-dimensional scores, and generating comprehensive insights.
            </p>
          </div>
          <div className="w-48 h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-indigo-500 via-teal-400 to-emerald-400 rounded-full animate-pulse" style={{ width: '100%' }} />
          </div>
        </div>
      )}

      <style>{`
        .mirror-mode {
          transform: scaleX(-1);
        }
        .animate-spin-slow {
          animation: spin 6s linear infinite;
        }
      `}</style>
    </div>
  );
};

