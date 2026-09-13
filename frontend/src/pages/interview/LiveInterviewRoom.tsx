import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Mic, MicOff, Send, Clock, Sparkles, AlertCircle, Video, VideoOff, Maximize, Minimize, Wifi, ShieldCheck, ShieldAlert, Volume2, VolumeX } from 'lucide-react';
import api from '../../services/api';
import { integrityEngine, ActiveIncident } from '../../services/IntegrityEngine';
import { IntegrityWarningOverlay } from '../../components/interview/IntegrityWarningOverlay';
import { InterviewTerminatedScreen } from '../../components/interview/InterviewTerminatedScreen';
import { storeSessionRecordingBlob, uploadSessionRecordingWithRetry } from '../../services/recordingStorage';

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
  const [activeSessionState, setActiveSessionState] = useState<any>(sessionData || null);

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
  const [autoplayBlocked, setAutoplayBlocked] = useState<boolean>(false);
  const [isFetchingTts, setIsFetchingTts] = useState<boolean>(false);
  const initialDurationSec = (sessionData?.duration_minutes || sessionData?.duration || 15) * 60;
  const [timeRemaining, setTimeRemaining] = useState(initialDurationSec);
  const [questionIndex, setQuestionIndex] = useState(1);
  const [totalQuestions, setTotalQuestions] = useState(sessionData?.total_questions || sessionData?.question_count || 6);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [micEnabled, setMicEnabled] = useState(true);
  const [camEnabled, setCamEnabled] = useState(true);
  const [showEndModal, setShowEndModal] = useState(false);

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
  const persistentVoiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const isSessionEndedRef = useRef<boolean>(false);
  const lastSpokenQuestionIdRef = useRef<string | null>(null);
  const chromeResumeIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const activeUtterancesRef = useRef<SpeechSynthesisUtterance[]>([]);
  
  // High-Fidelity Audio Player & State Refs
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const currentAudioUrlRef = useRef<string | null>(null);
  const audioAbortControllerRef = useRef<AbortController | null>(null);
  const ttsCacheRef = useRef<Map<string, string>>(new Map());
  const isAiSpeakingRef = useRef<boolean>(false);
  const isListeningRef = useRef<boolean>(false);
  const submittingRef = useRef<boolean>(false);
  const isAiThinkingRef = useRef<boolean>(false);

  // Keep state refs in sync on every render
  useEffect(() => {
    isAiSpeakingRef.current = isAiSpeaking;
    isListeningRef.current = isListening;
    submittingRef.current = submitting;
    isAiThinkingRef.current = isAiThinking;
  }, [isAiSpeaking, isListening, submitting, isAiThinking]);

  // Subtle melodic AI chime that unlocks Web Audio and signals interviewer speaking
  const playAiChime = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(659.25, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.26);
      setTimeout(() => ctx.close().catch(() => {}), 400);
    } catch (e) {}
  };

  // Fetch Studio Neural Audio from Backend
  const fetchNeuralAudio = async (text: string, signal?: AbortSignal): Promise<string> => {
    const cleanText = text.replace(/[*_#`~]/g, '').trim();
    if (ttsCacheRef.current.has(cleanText)) {
      return ttsCacheRef.current.get(cleanText)!;
    }
    const res = await api.post('/interview/tts',
      { text: cleanText, voice: 'en-US-AriaNeural' },
      { responseType: 'blob', timeout: 2200, signal }
    );
    if (!res.data || (res.data.type && res.data.type.includes('application/json'))) {
      throw new Error("Invalid audio response received from TTS service.");
    }
    const blob = new Blob([res.data], { type: 'audio/mpeg' });
    const objectUrl = URL.createObjectURL(blob);
    ttsCacheRef.current.set(cleanText, objectUrl);
    return objectUrl;
  };

  // Persistent Soothing Female Voice Selector Helper (Prioritizes reliable local offline voices)
  const getSoothingVoice = (voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | undefined => {
    if (persistentVoiceRef.current) {
      const stillAvailable = voices.find(v => v.name === persistentVoiceRef.current?.name);
      if (stillAvailable) return stillAvailable;
    }
    if (!voices || voices.length === 0) return undefined;
    
    // Filter out Edge Online (Natural) voices that fail over WebSockets on localhost
    const reliableVoices = voices.filter(v => !v.name.includes('Online (Natural)'));
    const pool = reliableVoices.length > 0 ? reliableVoices : voices;

    const maleBlacklist = ['david', 'mark', 'george', 'guy', 'male', 'richard', 'stefan', 'paul', 'james'];

    // High Priority: Local female offline voices
    const soothingFemaleNames = [
      'Microsoft Zira Desktop',
      'Microsoft Zira',
      'Google US English',
      'Google UK English Female',
      'Samantha',
      'Victoria',
      'Karen',
      'Zira',
      'Jenny',
      'Aria'
    ];

    for (const name of soothingFemaleNames) {
      const match = pool.find(v => 
        v.name.toLowerCase().includes(name.toLowerCase()) && 
        v.lang.startsWith('en') &&
        !maleBlacklist.some(m => v.name.toLowerCase().includes(m))
      );
      if (match) {
        persistentVoiceRef.current = match;
        return match;
      }
    }

    const naturalVoice = pool.find(v => 
      v.lang.startsWith('en') && 
      !maleBlacklist.some(m => v.name.toLowerCase().includes(m)) &&
      (v.name.toLowerCase().includes('female') || v.name.toLowerCase().includes('google'))
    );
    if (naturalVoice) {
      persistentVoiceRef.current = naturalVoice;
      return naturalVoice;
    }

    const politeVoice = pool.find(v => v.lang.startsWith('en') && !maleBlacklist.some(m => v.name.toLowerCase().includes(m)));
    if (politeVoice) {
      persistentVoiceRef.current = politeVoice;
      return politeVoice;
    }

    const fallback = pool.find(v => v.lang.startsWith('en')) || pool[0];
    persistentVoiceRef.current = fallback;
    return fallback;
  };

  // 1. Initialize Session, Camera & MediaRecorder (guarded against re-runs)
  useEffect(() => {
    isSessionEndedRef.current = false;
    if (isInitializedRef.current) return;
    isInitializedRef.current = true;

    const initLiveRoom = async () => {
      isSessionEndedRef.current = false;
      let activeSession = sessionData;
      const searchParams = new URLSearchParams(location.search);
      const qSessionId = searchParams.get('session');

      if (qSessionId) {
        try {
          const res = await api.get(`/interview/session/${qSessionId}`);
          if (res.data) {
            activeSession = res.data;
          }
        } catch (e) {
          console.warn("Failed to fetch session by ID:", e);
        }
      }

      if (!activeSession) {
        const stored = sessionStorage.getItem('active_interview_session');
        if (stored) {
          try { activeSession = JSON.parse(stored); } catch(e) {}
        }
      }

      if (!activeSession) {
        alert("No active session data. Returning to dashboard.");
        navigate('/dashboard');
        return;
      }

      setActiveSessionState(activeSession);
      try {
        sessionStorage.setItem('active_interview_session', JSON.stringify(activeSession));
      } catch (e) {}

      setSessionId(activeSession.session_id);
      setCurrentQuestion(activeSession.current_question || activeSession.first_question);
      startTimeRef.current = Date.now();
      if (activeSession.duration_minutes) {
        setTimeRemaining(activeSession.duration_minutes * 60);
      }
      if (activeSession.total_questions) {
        setTotalQuestions(activeSession.total_questions);
      }

      // Start Camera Feed & Video MediaRecorder
      navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 } }, audio: true })
        .catch(() => {
          return navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        })
        .catch(() => {
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
            if (activeSession.session_id) {
              integrityEngine.startMonitoring(
                videoRef.current,
                activeSession.session_id,
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
    };
    initLiveRoom();

    // Exit protection
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = 'Your interview is in progress. Are you sure you want to leave?';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
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
      if (audioPlayerRef.current) {
        try {
          audioPlayerRef.current.pause();
          audioPlayerRef.current.currentTime = 0;
        } catch(e) {}
      }
      if (audioAbortControllerRef.current) {
        audioAbortControllerRef.current.abort();
      }
      ttsCacheRef.current.forEach(url => {
        try { URL.revokeObjectURL(url); } catch(e) {}
      });
      ttsCacheRef.current.clear();
      if ('speechSynthesis' in window) {
        window.speechSynthesis.onvoiceschanged = null;
        window.speechSynthesis.cancel();
      }
      if (chromeResumeIntervalRef.current) clearInterval(chromeResumeIntervalRef.current);
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch(e) {}
      }
    };
  }, [sessionData, navigate]);

  // 2. Initialize Speech Recognition ONCE on mount with synchronous ref guards
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        // Drop any microphone audio captured while AI interviewer is speaking
        if (isAiSpeakingRef.current) return;

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

      recognition.onend = () => {
        // Automatically restart only if candidate is supposed to be listening
        if (isListeningRef.current && !isAiSpeakingRef.current && !submittingRef.current && !isAiThinkingRef.current && !isSessionEndedRef.current) {
          try { recognition.start(); } catch (e) {}
        }
      };

      recognition.onerror = (event: any) => {
        if (event.error !== 'no-speech' && event.error !== 'aborted') {
          console.warn("[SpeechRecognition] Notice:", event.error);
        }
      };

      recognitionRef.current = recognition;
    } else {
      console.warn("Speech Recognition not supported in this browser.");
    }

    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch(e) {}
        recognitionRef.current = null;
      }
    };
  }, []);

  // Pre-load and cache SpeechSynthesis voices for fallback
  useEffect(() => {
    if (!('speechSynthesis' in window)) return;
    const loadVoices = () => {
      try {
        const voices = window.speechSynthesis.getVoices();
        if (voices && voices.length > 0) {
          const selected = getSoothingVoice(voices);
          if (selected) {
            persistentVoiceRef.current = selected;
          }
        }
      } catch (e) {}
    };

    loadVoices();
    if (typeof window.speechSynthesis.addEventListener === 'function') {
      window.speechSynthesis.addEventListener('voiceschanged', loadVoices);
    } else {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }

    return () => {
      if ('speechSynthesis' in window) {
        if (typeof window.speechSynthesis.removeEventListener === 'function') {
          window.speechSynthesis.removeEventListener('voiceschanged', loadVoices);
        } else {
          window.speechSynthesis.onvoiceschanged = null;
        }
      }
    };
  }, []);

  // 3. AI Speech Synthesis Engine (Handles Greeting & Question TTS)
  useEffect(() => {
    if (!currentQuestion || isAiThinking || submitting || isFinalizingReport || isSessionEndedRef.current) return;

    const qId = String(currentQuestion.question_id || currentQuestion.id || currentQuestion.order_index || currentQuestion.question_text);

    // Prevent duplicate speech for the same question on re-renders, timers, or transcript updates
    if (lastSpokenQuestionIdRef.current === qId) {
      return;
    }
    lastSpokenQuestionIdRef.current = qId;

    if (!hasGreetedRef.current) {
      hasGreetedRef.current = true;
      const candName = activeSessionState?.candidate_name || sessionData?.candidate_name || sessionData?.candidate_full_name || 'Candidate';
      const roleName = activeSessionState?.role_target || sessionData?.role_target || sessionData?.title || 'Software Engineer';
      const roundName = activeSessionState?.round_type || sessionData?.round_type || 'Technical';
      const greetingSpeech = `Hi ${candName}! Welcome to your ${roundName} interview for the ${roleName} position. I am your AI Interviewer. Let's begin with your first question. ${currentQuestion.question_text}`;
      speakQuestion(greetingSpeech);
    } else {
      speakQuestion(currentQuestion.question_text);
    }
  }, [currentQuestion, isAiThinking, submitting, isFinalizingReport]);

  // Robust text chunker that NEVER drops sentences or text without trailing punctuation
  const splitIntoChunks = (text: string, maxLen: number = 180): string[] => {
    if (!text || text.length <= maxLen) return [text || ''];
    const chunks: string[] = [];
    const parts = text.split(/(?<=[.?!,;:])\s+/);
    let current = '';
    for (const part of parts) {
      if (!part) continue;
      if (current && (current.length + part.length + 1 > maxLen)) {
        chunks.push(current.trim());
        current = part;
      } else {
        current = current ? `${current} ${part}` : part;
      }
    }
    if (current.trim()) chunks.push(current.trim());
    return chunks.length > 0 ? chunks : [text];
  };

  // Safe Chrome resume ticker that prevents Chrome from falling asleep mid-speech (never calls pause)
  const startChromeResumeHack = () => {
    stopChromeResumeHack();
    chromeResumeIntervalRef.current = setInterval(() => {
      if ('speechSynthesis' in window && window.speechSynthesis.speaking) {
        window.speechSynthesis.resume();
      }
    }, 2500);
  };

  const stopChromeResumeHack = () => {
    if (chromeResumeIntervalRef.current) {
      clearInterval(chromeResumeIntervalRef.current);
      chromeResumeIntervalRef.current = null;
    }
  };

  // Fallback Local Speech Synthesis Engine (used if backend network audio fails)
  const fallbackLocalSpeech = (cleanText: string) => {
    if (isSessionEndedRef.current || isFinalizingReport) return;
    if (!('speechSynthesis' in window)) {
      setIsAiSpeaking(false);
      isAiSpeakingRef.current = false;
      startListening();
      return;
    }

    try { window.speechSynthesis.cancel(); } catch(e) {}
    try { window.speechSynthesis.resume(); } catch(e) {}
    stopChromeResumeHack();
    if (speechTimerRef.current) clearTimeout(speechTimerRef.current);

    setIsAiSpeaking(true);
    isAiSpeakingRef.current = true;
    setIsListening(false);
    isListeningRef.current = false;

    const chunks = splitIntoChunks(cleanText);

    // Safety fallback timer so interview never hangs
    const safeDurationMs = Math.max(7000, Math.min(90000, cleanText.length * 95));
    speechTimerRef.current = setTimeout(() => {
      try { window.speechSynthesis.cancel(); } catch(e) {}
      stopChromeResumeHack();
      setIsAiSpeaking(false);
      isAiSpeakingRef.current = false;
      activeUtterancesRef.current = [];
      (window as any).__smarthire_active_utterance = null;
      if (!isSessionEndedRef.current && !isFinalizingReport) {
        startListening();
      }
    }, safeDurationMs);

    const onAllChunksDone = () => {
      if (speechTimerRef.current) clearTimeout(speechTimerRef.current);
      stopChromeResumeHack();
      setIsAiSpeaking(false);
      isAiSpeakingRef.current = false;
      activeUtterancesRef.current = [];
      (window as any).__smarthire_active_utterance = null;
      if (!isSessionEndedRef.current && !isFinalizingReport) {
        startListening();
      }
    };

    const voices = window.speechSynthesis.getVoices();
    const soothingVoice = getSoothingVoice(voices) || persistentVoiceRef.current;

    let chunkIdx = 0;
    startChromeResumeHack();

    const speakNext = () => {
      if (isSessionEndedRef.current || isFinalizingReport || chunkIdx >= chunks.length) {
        onAllChunksDone();
        return;
      }

      const chunk = chunks[chunkIdx];
      chunkIdx++;

      const utterance = new SpeechSynthesisUtterance(chunk);
      utterance.rate = 0.98;
      utterance.pitch = 1.02;
      utterance.volume = 1.0;
      if (soothingVoice) utterance.voice = soothingVoice;

      activeUtterancesRef.current = [utterance];
      (window as any).__smarthire_active_utterance = utterance;

      utterance.onend = () => {
        if (chunkIdx >= chunks.length) {
          onAllChunksDone();
        } else {
          speakNext();
        }
      };

      utterance.onerror = (err) => {
        console.warn("Speech synthesis chunk notice:", err);
        if (chunkIdx >= chunks.length) {
          onAllChunksDone();
        } else {
          speakNext();
        }
      };

      try {
        window.speechSynthesis.resume();
        window.speechSynthesis.speak(utterance);
      } catch (e) {
        console.warn("Speech synthesis speak exception:", e);
        if (chunkIdx >= chunks.length) {
          onAllChunksDone();
        } else {
          speakNext();
        }
      }
    };

    setTimeout(() => {
      speakNext();
    }, 40);
  };

  // Primary AI Speech Engine: High-Fidelity Edge Neural Voice Audio
  const speakQuestion = async (text: string) => {
    if (isSessionEndedRef.current || isFinalizingReport) {
      if (audioPlayerRef.current) {
        try { audioPlayerRef.current.pause(); } catch(e) {}
      }
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      return;
    }
    if (!text || !text.trim()) {
      setIsAiSpeaking(false);
      isAiSpeakingRef.current = false;
      startListening();
      return;
    }

    const cleanText = text.replace(/[*_#`~]/g, '').trim();

    // Abort previous in-flight speech and pause existing audio
    if (audioPlayerRef.current) {
      try {
        audioPlayerRef.current.pause();
        audioPlayerRef.current.currentTime = 0;
      } catch(e) {}
    }
    if (audioAbortControllerRef.current) {
      try { audioAbortControllerRef.current.abort(); } catch(e) {}
    }
    const currentAbortController = new AbortController();
    audioAbortControllerRef.current = currentAbortController;

    if ('speechSynthesis' in window) {
      try { window.speechSynthesis.cancel(); } catch(e) {}
    }
    stopChromeResumeHack();
    if (speechTimerRef.current) clearTimeout(speechTimerRef.current);

    // AI is preparing / speaking: stop microphone so it does not transcribe interviewer voice
    setIsAiSpeaking(true);
    isAiSpeakingRef.current = true;
    setIsListening(false);
    isListeningRef.current = false;
    setIsFetchingTts(true);

    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch(e) {}
    }

    // Play subtle AI chime to notify candidate and unlock audio context
    playAiChime();

    try {
      const audioUrl = await fetchNeuralAudio(cleanText, currentAbortController.signal);
      setIsFetchingTts(false);

      if (isSessionEndedRef.current || isFinalizingReport || currentAbortController.signal.aborted) return;

      if (!audioPlayerRef.current) {
        audioPlayerRef.current = new Audio();
      }
      const player = audioPlayerRef.current;
      player.src = audioUrl;
      player.volume = 1.0;

      // Estimated duration fallback safety timer
      const safeDurationMs = Math.max(8000, Math.min(120000, Math.ceil(cleanText.length * 90)));
      speechTimerRef.current = setTimeout(() => {
        console.log("[AI Voice] Speech timeout reached, resuming candidate listening.");
        setIsAiSpeaking(false);
        isAiSpeakingRef.current = false;
        if (!isSessionEndedRef.current && !isFinalizingReport) {
          startListening();
        }
      }, safeDurationMs);

      player.onended = () => {
        console.log("[AI Voice] Finished reading question.");
        if (speechTimerRef.current) clearTimeout(speechTimerRef.current);
        setIsAiSpeaking(false);
        isAiSpeakingRef.current = false;
        if (!isSessionEndedRef.current && !isFinalizingReport) {
          startListening();
        }
      };

      player.onerror = (e) => {
        console.warn("[AI Voice] Neural audio playback error, falling back to local speech:", e);
        if (speechTimerRef.current) clearTimeout(speechTimerRef.current);
        fallbackLocalSpeech(cleanText);
      };

      const playPromise = player.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setAutoplayBlocked(false);
            setIsAiSpeaking(true);
            isAiSpeakingRef.current = true;
            setIsListening(false);
            isListeningRef.current = false;
          })
          .catch((err) => {
            console.warn("[AI Voice] Audio play rejected by browser:", err);
            if (err.name === 'NotAllowedError') {
              setAutoplayBlocked(true);
              setIsAiSpeaking(false);
              isAiSpeakingRef.current = false;
              // Provide gesture listener to unlock on user click
              const handleUnlock = () => {
                setAutoplayBlocked(false);
                player.play().then(() => {
                  setIsAiSpeaking(true);
                  isAiSpeakingRef.current = true;
                  setIsListening(false);
                  isListeningRef.current = false;
                }).catch(() => {
                  fallbackLocalSpeech(cleanText);
                });
                window.removeEventListener('click', handleUnlock);
                window.removeEventListener('keydown', handleUnlock);
              };
              window.addEventListener('click', handleUnlock, { once: true });
              window.addEventListener('keydown', handleUnlock, { once: true });
              if (!isSessionEndedRef.current && !isFinalizingReport) {
                startListening();
              }
            } else {
              fallbackLocalSpeech(cleanText);
            }
          });
      }

    } catch (err: any) {
      setIsFetchingTts(false);
      if (err.name === 'CanceledError' || err.name === 'AbortError' || currentAbortController.signal.aborted) {
        return;
      }
      console.warn("[AI Voice] Failed to fetch neural audio, falling back to speech synthesis:", err);
      fallbackLocalSpeech(cleanText);
    }
  };

  const handleSkipAiSpeech = () => {
    if (audioPlayerRef.current) {
      try {
        audioPlayerRef.current.pause();
        audioPlayerRef.current.currentTime = 0;
      } catch(e) {}
    }
    if (audioAbortControllerRef.current) {
      audioAbortControllerRef.current.abort();
    }
    if ('speechSynthesis' in window) {
      try { window.speechSynthesis.cancel(); } catch(e) {}
    }
    stopChromeResumeHack();
    if (speechTimerRef.current) clearTimeout(speechTimerRef.current);
    setIsAiSpeaking(false);
    isAiSpeakingRef.current = false;
    setIsFetchingTts(false);
    activeUtterancesRef.current = [];
    (window as any).__smarthire_active_utterance = null;
    startListening();
  };

  const startListening = () => {
    if (isSessionEndedRef.current || isFinalizingReport || submittingRef.current || isAiThinkingRef.current) return;
    setIsListening(true);
    isListeningRef.current = true;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
      } catch (e) {}
    }
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
    if (audioPlayerRef.current) {
      try {
        audioPlayerRef.current.pause();
        audioPlayerRef.current.currentTime = 0;
      } catch (e) {}
    }
    if (audioAbortControllerRef.current) {
      audioAbortControllerRef.current.abort();
    }
    window.speechSynthesis?.cancel();
    stopChromeResumeHack();
    setAutoSubmitCountdown(null);
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch(e) {}
    }
    
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
        const nextQId = String(nextQ.question_id || nextQ.id || nextQ.order_index || nextQ.question_text);
        // Mark next question as spoken so useEffect does not trigger duplicate speech
        lastSpokenQuestionIdRef.current = nextQId;
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

        // Cache in IndexedDB immediately so it is never lost
        await storeSessionRecordingBlob(sessionId, blob);

        try {
          sessionStorage.removeItem(`session_recording_url_${sessionId}`);
        } catch(e) {}

        const durationSec = Math.max(1, Math.round((Date.now() - startTimeRef.current) / 1000));
        
        // Upload in background so interview finalization and candidate navigation are never blocked
        uploadSessionRecordingWithRetry(sessionId, blob, durationSec, 3).catch((e) => {
          console.warn("[Recording] Background upload notice:", e);
        });
      }
    } catch(e) {
      console.warn("Recording finalize notice:", e);
    }
  };

  const handleCompleteSession = async () => {
    const activeId = sessionId || activeSessionState?.session_id || activeSessionState?.id || new URLSearchParams(window.location.search).get('session');
    if (!activeId || isSessionEndedRef.current) return;
    isSessionEndedRef.current = true;
    setShowEndModal(false);
    integrityEngine.stopMonitoring();
    setIsFinalizingReport(true);
    setSubmitting(true);
    setIsAiSpeaking(false);
    setIsListening(false);
    if (speechTimerRef.current) clearTimeout(speechTimerRef.current);
    if (audioPlayerRef.current) {
      try {
        audioPlayerRef.current.pause();
        audioPlayerRef.current.currentTime = 0;
      } catch (e) {}
    }
    if (audioAbortControllerRef.current) {
      audioAbortControllerRef.current.abort();
    }
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch(e) {}
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = null;
      window.speechSynthesis.cancel();
    }
    try {
      // If there is an unsubmitted answer in the transcript textarea, submit it now
      const textToSubmit = (transcriptRef.current || transcript || '').trim();
      if (textToSubmit && currentQuestion) {
        try {
          const elapsedSec = Math.max(0, Math.round((Date.now() - startTimeRef.current) / 1000));
          await api.post('/interview/submit-answer', {
            session_id: activeId,
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
          }, { timeout: 15000 });
        } catch (e) {
          console.warn("Auto-submit final answer notice:", e);
        }
      }
      await finalizeAndUploadRecording();
      await api.post(`/interview/finish/${activeId}`, {}, { timeout: 15000 }).catch(() => {});
    } catch(e) {
      console.warn("Session finish notice:", e);
    } finally {
      setSubmitting(false);
    }
    navigate(`/interview/results?session=${activeId}`, { replace: true });
  };

  // Timer
  useEffect(() => {
    if (!sessionId) return;
    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setTimeout(() => {
            if (!isSessionEndedRef.current) {
              handleCompleteSession();
            }
          }, 0);
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
            onClick={() => setShowEndModal(true)}
            className="px-4 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-extrabold transition-all cursor-pointer shadow-xs active:scale-95"
            title="End interview session early and view report"
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
            {/* Hidden audio player instance */}
            <audio ref={audioPlayerRef} preload="auto" className="hidden" />

            {/* Browser Autoplay Unmute Banner */}
            {autoplayBlocked && (
              <div 
                onClick={() => {
                  setAutoplayBlocked(false);
                  if (audioPlayerRef.current) {
                    audioPlayerRef.current.play().then(() => {
                      setIsAiSpeaking(true);
                      isAiSpeakingRef.current = true;
                      setIsListening(false);
                    }).catch(() => {
                      if (currentQuestion) {
                        fallbackLocalSpeech(currentQuestion.question_text);
                      }
                    });
                  } else if (currentQuestion) {
                    fallbackLocalSpeech(currentQuestion.question_text);
                  }
                }}
                className="mx-auto max-w-lg px-4 py-3 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-200 text-xs font-bold flex items-center justify-between gap-3 animate-pulse cursor-pointer shadow-lg hover:bg-amber-500/30 transition-all"
              >
                <div className="flex items-center gap-2">
                  <Volume2 className="w-5 h-5 text-amber-400 shrink-0" />
                  <span>Browser muted audio. Click anywhere or tap Unmute to hear the AI Interviewer speak.</span>
                </div>
                <span className="px-3 py-1 rounded-lg bg-amber-400 text-slate-950 text-[11px] font-black uppercase tracking-wider shrink-0">Unmute 🔊</span>
              </div>
            )}

            <div className="inline-flex items-center gap-3 px-4 py-1.5 rounded-full bg-slate-950/80 backdrop-blur-md border border-slate-800 shadow-inner">
              <div className={`w-2.5 h-2.5 rounded-full ${
                isFetchingTts ? 'bg-indigo-400 animate-spin' :
                isAiSpeaking ? 'bg-indigo-400 animate-ping' : 
                isAiThinking ? 'bg-amber-400 animate-pulse' : 
                'bg-emerald-400 animate-pulse'
              }`} />
              <span className="text-xs font-black text-slate-200 tracking-wide uppercase">
                {isFetchingTts ? 'Preparing AI Voice... ⏳' :
                 isAiSpeaking ? 'AI Interviewer Speaking... 🎙️' : 
                 isAiThinking ? 'AI Evaluating Response... 🧠' : 
                 'Listening To Candidate... 🟢'}
              </span>
              {isAiSpeaking && (
                <button
                  onClick={handleSkipAiSpeech}
                  className="ml-2 px-2.5 py-0.5 rounded-full bg-indigo-500/20 hover:bg-indigo-500/40 text-indigo-300 text-[10px] font-extrabold uppercase tracking-wider border border-indigo-500/40 transition-all cursor-pointer"
                >
                  Skip Voice ⏩
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
              <div className="p-6 bg-slate-950/60 rounded-2xl border border-slate-800/80 shadow-xl backdrop-blur-sm space-y-4">
                <h2 className="text-xl sm:text-2xl lg:text-3xl font-black text-slate-100 leading-snug tracking-tight">
                  "{currentQuestion.question_text}"
                </h2>

                {/* Interactive Audio Controls */}
                <div className="flex items-center justify-center gap-3 pt-2">
                  <button
                    onClick={() => speakQuestion(currentQuestion.question_text)}
                    disabled={isFetchingTts}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-black shadow-lg hover:shadow-indigo-500/25 transition-all active:scale-95 cursor-pointer"
                    title="Click to hear the AI Interviewer read this question aloud"
                  >
                    <Volume2 className="w-4 h-4" />
                    <span>
                      {isFetchingTts ? 'Loading Voice... ⏳' :
                       isAiSpeaking ? 'Replay Voice 🔊' : 
                       'Read Question Aloud 🔊'}
                    </span>
                  </button>

                  {isAiSpeaking && (
                    <button
                      onClick={handleSkipAiSpeech}
                      className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-extrabold transition-all active:scale-95 cursor-pointer border border-slate-700"
                      title="Skip or mute current question audio"
                    >
                      <VolumeX className="w-4 h-4" />
                      <span>Skip Voice</span>
                    </button>
                  )}
                </div>
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
                  onClick={() => handleSubmitAnswer(transcriptRef.current || transcript)}
                  disabled={submitting || isAiThinking || (!transcript.trim() && !transcriptRef.current.trim())}
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

      {/* End Interview Early Confirmation Modal */}
      {showEndModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-slate-900 border border-rose-500/40 rounded-3xl p-6 sm:p-8 max-w-md w-full text-center space-y-5 shadow-2xl relative">
            <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto">
              <AlertCircle className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-black text-white">End Interview Early?</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Are you sure you want to conclude this interview session now? Your answers and telemetry recorded so far will be evaluated, and your performance report will be generated.
              </p>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowEndModal(false)}
                className="flex-1 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-extrabold transition-all cursor-pointer"
              >
                Resume Interview
              </button>
              <button
                onClick={() => handleCompleteSession()}
                className="flex-1 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-extrabold transition-all shadow-lg shadow-rose-900/30 cursor-pointer"
              >
                Yes, End & View Results
              </button>
            </div>
          </div>
        </div>
      )}

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

