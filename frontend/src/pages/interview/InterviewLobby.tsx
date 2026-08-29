import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Mic, MicOff, Video, VideoOff, Clock, CheckCircle2, AlertCircle, ShieldCheck, Play, Wifi, WifiOff, Volume2, RotateCcw } from 'lucide-react';
import api from '../../services/api';
import { integrityEngine } from '../../services/IntegrityEngine';

export const InterviewLobby: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [loading, setLoading] = useState(false);
  const [micActive, setMicActive] = useState(false);
  const [videoActive, setVideoActive] = useState(false);
  const [cameraStatus, setCameraStatus] = useState<'READY' | 'BLOCKED' | 'UNAVAILABLE' | 'PENDING'>('PENDING');
  const [microphoneStatus, setMicrophoneStatus] = useState<'READY' | 'BLOCKED' | 'UNAVAILABLE' | 'PENDING'>('PENDING');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [audioLevel, setAudioLevel] = useState(0);
  const [networkStatus, setNetworkStatus] = useState<'good' | 'fair' | 'poor'>('good');
  const [scheduledDetails, setScheduledDetails] = useState<any>(null);
  const [interviewMode, setInterviewMode] = useState<'MOCK' | 'RECRUITER'>('MOCK');
  
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const params = new URLSearchParams(location.search);
  const scheduleId = params.get('schedule') || params.get('schedule_id');

  useEffect(() => {
    if (scheduleId) {
      setInterviewMode('RECRUITER');
      api.get(`/scheduling/detail/${scheduleId}`)
        .then((res) => setScheduledDetails(res.data))
        .catch((err) => console.warn('Fetch schedule error:', err));
    } else {
      setInterviewMode('MOCK');
    }

    const checkNetwork = () => {
      const conn = (navigator as any).connection;
      if (conn) {
        const dl = conn.downlink;
        if (dl >= 5) setNetworkStatus('good');
        else if (dl >= 1) setNetworkStatus('fair');
        else setNetworkStatus('poor');
      }
    };
    checkNetwork();

    // Auto-request media access on lobby load
    startCamera();

    // Pre-warm AI vision models in background only when browser is idle
    // (prevents main-thread blocking during lobby render)
    const idleHandle = (window as any).requestIdleCallback
      ? (window as any).requestIdleCallback(() => { integrityEngine.loadModel().catch(() => {}); }, { timeout: 5000 })
      : setTimeout(() => { integrityEngine.loadModel().catch(() => {}); }, 2000);


    return () => {
      stopMedia();
      if ((window as any).cancelIdleCallback) {
        (window as any).cancelIdleCallback(idleHandle);
      } else {
        clearTimeout(idleHandle);
      }
    };
  }, [scheduleId]);

  // Ensure video element srcObject is attached when cameraStatus becomes READY or videoRef mounts
  useEffect(() => {
    if (cameraStatus === 'READY' && videoActive && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(e => console.warn('Lobby video play notice:', e));
    }
  }, [cameraStatus, videoActive]);

  const startCamera = async () => {
    setErrorMsg(null);

    // Check secure context
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraStatus('UNAVAILABLE');
      setMicrophoneStatus('UNAVAILABLE');
      setErrorMsg('Camera and microphone access require a secure (HTTPS) connection or supported browser.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setVideoActive(true);
      setCameraStatus('READY');
      setMicActive(true);
      setMicrophoneStatus('READY');

      // Setup audio level meter for microphone check
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const analyser = audioCtx.createAnalyser();
        const source = audioCtx.createMediaStreamSource(stream);
        source.connect(analyser);
        analyser.fftSize = 256;
        audioContextRef.current = audioCtx;
        analyserRef.current = analyser;
        
        let lastAudioUpdate = 0;
        const monitorAudio = () => {
          if (!analyserRef.current) return;
          const now = performance.now();
          if (now - lastAudioUpdate >= 80) {
            lastAudioUpdate = now;
            const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
            analyserRef.current.getByteFrequencyData(dataArray);
            const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
            setAudioLevel(Math.min(100, Math.round(avg * 1.5)));
          }
          animFrameRef.current = requestAnimationFrame(monitorAudio);
        };
        monitorAudio();
      } catch (audioErr) {
        console.warn('Audio meter init error:', audioErr);
      }

    } catch (err: any) {
      console.error('Media access error:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraStatus('BLOCKED');
        setMicrophoneStatus('BLOCKED');
        setErrorMsg('Camera access is required for the interview. Microphone access is required for the interview.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setCameraStatus('UNAVAILABLE');
        setMicrophoneStatus('UNAVAILABLE');
        setErrorMsg('No camera or microphone device was detected on your system.');
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        setCameraStatus('BLOCKED');
        setMicrophoneStatus('BLOCKED');
        setErrorMsg('Camera or microphone is already in use by another application.');
      } else {
        setCameraStatus('BLOCKED');
        setMicrophoneStatus('BLOCKED');
        setErrorMsg(err.message || 'Could not access camera or microphone.');
      }
    }
  };

  const stopMedia = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      try { audioContextRef.current.close(); } catch(e) {}
      audioContextRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
    }
    setVideoActive(false);
    setMicActive(false);
  };

  const toggleMic = () => {
    if (streamRef.current) {
      const audioTracks = streamRef.current.getAudioTracks();
      audioTracks.forEach(t => { t.enabled = !t.enabled; });
      setMicActive(audioTracks[0]?.enabled || false);
    }
  };

  const toggleVideo = () => {
    if (streamRef.current) {
      const videoTracks = streamRef.current.getVideoTracks();
      videoTracks.forEach(t => { t.enabled = !t.enabled; });
      setVideoActive(videoTracks[0]?.enabled || false);
    }
  };

  const testSpeaker = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      gain.gain.value = 0.1;
      osc.frequency.value = 440;
      osc.start();
      setTimeout(() => { osc.stop(); ctx.close(); }, 500);
    } catch(e) {}
  };

  const handleJoinInterview = async () => {
    setLoading(true);
    try {
      let res;
      if (interviewMode === 'RECRUITER' && scheduleId) {
        res = await api.post('/interview/start', { schedule_id: scheduleId, language: params.get('language') || location.state?.language || 'English' }, { timeout: 60000 });
      } else {
        res = await api.post('/interview/start', {
          role_target: params.get('role') || 'Software Engineer',
          round_type: params.get('round') || 'Technical',
          difficulty: params.get('difficulty') || 'Medium',
          language: params.get('language') || location.state?.language || 'English',
          duration_minutes: parseInt(params.get('duration') || '15'),
          resume_text: location.state?.resumeText || '',
          parsed_resume: location.state?.parsedResume || null
        }, { timeout: 60000 });
      }
      // Stop local preview tracks so live room can acquire stream
      stopMedia();
      navigate(`/interview/live?session=${res.data.session_id}`, { state: { sessionData: res.data } });
    } catch (err: any) {
      console.error('Start interview error:', err);
      const status = err.response?.status;
      const detailMsg = typeof err.response?.data?.detail === 'string'
        ? err.response.data.detail
        : (err.response?.data?.message || err.message);

      if (status === 401) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user_data');
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        alert('Your session has expired. Please log in again.');
        navigate('/login');
      } else if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
        alert('Interview setup took a bit longer than expected. Please click "Join Interview Room" again to continue.');
      } else if (detailMsg && status) {
        alert(`Error (${status}): ${detailMsg}`);
      } else if (err.code === 'ERR_NETWORK' || err.message?.includes('Network Error')) {
        console.warn('Network error on interview start, retrying silently...');
        try {
          const retryRes = await api.post('/interview/start', {
            role_target: params.get('role') || 'Software Engineer',
            round_type: params.get('round') || 'Technical',
            difficulty: params.get('difficulty') || 'Medium',
            language: params.get('language') || location.state?.language || 'English',
            duration_minutes: parseInt(params.get('duration') || '15'),
            resume_text: location.state?.resumeText || '',
            parsed_resume: location.state?.parsedResume || null
          }, { timeout: 60000 });
          stopMedia();
          navigate(`/interview/live?session=${retryRes.data.session_id}`, { state: { sessionData: retryRes.data } });
          return;
        } catch (retryErr: any) {
          alert('Could not connect to interview service. Please try again.');
        }
      } else {
        alert(detailMsg || 'Failed to start interview. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const allChecksPass = cameraStatus === 'READY' && microphoneStatus === 'READY';

  return (
    <>
      <main className="p-6 lg:p-10 max-w-7xl mx-auto w-full flex flex-col items-center justify-center">
        
        <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* LEFT COLUMN: Camera & Hardware Check */}
          <div className="card-luxury p-8 flex flex-col items-center justify-center space-y-6">
            {/* Camera Preview */}
            <div className="relative w-full aspect-video bg-slate-900 rounded-3xl overflow-hidden shadow-luxury border-4 border-slate-800">
              {cameraStatus === 'READY' && videoActive ? (
                <video
                  ref={(el) => {
                    videoRef.current = el;
                    if (el && streamRef.current && el.srcObject !== streamRef.current) {
                      el.srcObject = streamRef.current;
                      el.play().catch(e => console.warn('Lobby video play notice:', e));
                    }
                  }}
                  autoPlay
                  playsInline
                  muted
                  className="absolute inset-0 w-full h-full object-cover"
                  style={{ transform: 'scaleX(-1)' }}
                />
              ) : cameraStatus === 'BLOCKED' ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-800 text-slate-300 gap-2 p-4 text-center">
                  <VideoOff className="w-8 h-8 text-rose-500" />
                  <span className="text-xs font-bold text-rose-400">CAMERA BLOCKED</span>
                  <span className="text-[11px] text-slate-400">Camera access is required for the interview.</span>
                  <button
                    onClick={startCamera}
                    className="mt-2 px-3 py-1.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-[11px] font-bold flex items-center gap-1 transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Retry Permission</span>
                  </button>
                </div>
              ) : cameraStatus === 'UNAVAILABLE' ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-800 text-slate-300 gap-2 p-4 text-center">
                  <VideoOff className="w-8 h-8 text-amber-500" />
                  <span className="text-xs font-bold text-amber-400">CAMERA UNAVAILABLE</span>
                  <span className="text-[11px] text-slate-400">{errorMsg || 'No camera detected on this system.'}</span>
                </div>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-800 text-slate-400 gap-3">
                  <Video className="w-8 h-8" />
                  <button
                    onClick={startCamera}
                    className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition-colors"
                  >
                    Enable Camera & Microphone
                  </button>
                </div>
              )}
              
              {/* Camera Controls Overlay */}
              {cameraStatus === 'READY' && (
                <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4">
                  <button 
                    onClick={toggleMic}
                    className={`p-4 rounded-full shadow-lg backdrop-blur-md transition-all ${micActive ? 'bg-emerald-500/90 text-white' : 'bg-rose-500/90 text-white'}`}
                  >
                    {micActive ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
                  </button>
                  <button 
                    onClick={toggleVideo}
                    className={`p-4 rounded-full shadow-lg backdrop-blur-md transition-all ${videoActive ? 'bg-emerald-500/90 text-white' : 'bg-rose-500/90 text-white'}`}
                  >
                    {videoActive ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
                  </button>
                </div>
              )}
            </div>

            {/* Hardware Status */}
            <div className="w-full space-y-3">
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-cream-100 border border-stoneBorder">
                <div className="flex items-center gap-3">
                  <Video className="w-4 h-4 text-slate-500" />
                  <span className="text-xs font-bold text-brand-ink">HD Web Camera</span>
                </div>
                <span className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-full ${
                  cameraStatus === 'READY' ? 'bg-emerald-100 text-emerald-700' :
                  cameraStatus === 'BLOCKED' ? 'bg-rose-100 text-rose-700' :
                  cameraStatus === 'UNAVAILABLE' ? 'bg-amber-100 text-amber-700' :
                  'bg-slate-100 text-slate-600'
                }`}>
                  CAMERA {cameraStatus}
                </span>
              </div>
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-cream-100 border border-stoneBorder">
                <div className="flex items-center gap-3">
                  <Mic className="w-4 h-4 text-slate-500" />
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-brand-ink">Microphone</span>
                    {microphoneStatus === 'READY' && (
                      <div className="flex items-center gap-0.5 h-3">
                        {[...Array(5)].map((_, i) => (
                          <div key={i} className={`w-1 rounded-full transition-all duration-75 ${
                            audioLevel > i * 20 ? 'bg-emerald-500' : 'bg-slate-300'
                          }`} style={{ height: `${4 + i * 2}px` }} />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <span className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-full ${
                  microphoneStatus === 'READY' ? 'bg-emerald-100 text-emerald-700' :
                  microphoneStatus === 'BLOCKED' ? 'bg-rose-100 text-rose-700' :
                  microphoneStatus === 'UNAVAILABLE' ? 'bg-amber-100 text-amber-700' :
                  'bg-slate-100 text-slate-600'
                }`}>
                  MICROPHONE {microphoneStatus}
                </span>
              </div>
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-cream-100 border border-stoneBorder">
                <div className="flex items-center gap-3">
                  <Volume2 className="w-4 h-4 text-slate-500" />
                  <span className="text-xs font-bold text-brand-ink">Speaker</span>
                </div>
                <button onClick={testSpeaker} className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 transition-colors">
                  Test Audio
                </button>
              </div>
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-cream-100 border border-stoneBorder">
                <div className="flex items-center gap-3">
                  {networkStatus === 'good' ? <Wifi className="w-4 h-4 text-emerald-500" /> : <WifiOff className="w-4 h-4 text-amber-500" />}
                  <span className="text-xs font-bold text-brand-ink">Network Connection</span>
                </div>
                <CheckCircle2 className={`w-5 h-5 ${networkStatus === 'good' ? 'text-emerald-500' : 'text-amber-500'}`} />
              </div>
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-cream-100 border border-stoneBorder">
                <div className="flex items-center gap-3">
                  <ShieldCheck className="w-4 h-4 text-slate-500" />
                  <span className="text-xs font-bold text-brand-ink">Candidate Verification</span>
                </div>
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Instructions & Join */}
          <div className="card-luxury p-8 space-y-8 flex flex-col">
            <div className="space-y-2 border-b border-stoneBorder pb-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-brand-accent/20 text-brand-accent text-xs font-extrabold mb-2">
                <Clock className="w-4 h-4" /> 
                <span>{interviewMode === 'RECRUITER' ? 'Scheduled Interview' : 'Practice Interview'}</span>
              </div>
              <h2 className="text-2xl lg:text-3xl font-extrabold text-brand-ink tracking-tight">
                {interviewMode === 'RECRUITER' ? scheduledDetails?.job_title : params.get('role') || 'Software Engineer'}
              </h2>
              <p className="text-sm font-semibold text-brand-primary">
                {interviewMode === 'RECRUITER' ? scheduledDetails?.company_name : 'SmartHire AI Simulator'}
              </p>
              <div className="flex flex-wrap gap-2 pt-2">
                <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-[10px] font-bold text-slate-600">
                  {params.get('round') || 'Technical'} Round
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-[10px] font-bold text-slate-600">
                  {params.get('difficulty') || 'Medium'} Difficulty
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-[10px] font-bold text-slate-600">
                  {params.get('duration') || '15'} Minutes
                </span>
              </div>
            </div>

            <div className="flex-1 space-y-6">
              <h3 className="text-xs font-extrabold text-brand-ink uppercase tracking-wider">Interview Guidelines</h3>
              <ul className="space-y-4">
                {[
                  'Ensure you are in a quiet room with strong internet.',
                  'The AI will listen carefully. Speak clearly and audibly.',
                  'Do not exit full-screen mode or switch tabs during the session.',
                  'Your camera and microphone must remain active throughout.',
                  'The interview will auto-submit after 3 seconds of silence.'
                ].map((text, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-brand-accent/20 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-[10px] font-bold text-brand-accent">{i + 1}</span>
                    </div>
                    <span className="text-sm font-medium text-slate-600">{text}</span>
                  </li>
                ))}
              </ul>
            </div>

            {!allChecksPass && (
              <div className="flex flex-col gap-2 p-4 rounded-xl bg-amber-50 border border-amber-200">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <p className="text-[11px] font-bold text-amber-700">
                    {errorMsg || 'Please allow camera and microphone access to start the interview.'}
                  </p>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <button
                    onClick={startCamera}
                    className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold flex items-center justify-center gap-1 transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Retry Access</span>
                  </button>
                  <button
                    onClick={() => {
                      setCameraStatus('READY');
                      setMicrophoneStatus('READY');
                    }}
                    className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-800 text-white text-xs font-bold flex items-center justify-center gap-1 transition-colors"
                  >
                    <span>Bypass Check & Join</span>
                  </button>
                </div>
              </div>
            )}

            <button
              onClick={handleJoinInterview}
              disabled={loading}
              className="w-full py-4 rounded-2xl bg-brand-primary hover:bg-sb-700 text-white font-extrabold text-sm flex items-center justify-center gap-2 transition-all shadow-luxury disabled:opacity-50"
            >
              {loading ? (
                <span>Initializing Engine...</span>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  <span>Join Interview Room</span>
                </>
              )}
            </button>
          </div>

        </div>
      </main>
    </>
  );
};
