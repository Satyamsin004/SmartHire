import { useState, useRef, useCallback, useEffect } from 'react';

export type RecordingStatus = 'IDLE' | 'STARTING' | 'RECORDING' | 'STOPPING' | 'COMPLETED' | 'ERROR';

export interface RecordingMetadata {
  sessionId: string;
  recordingStatus: RecordingStatus;
  mimeType: string;
  startedAt: string | null;
  stoppedAt: string | null;
  duration: number; // seconds
  size: number; // bytes
  objectUrl: string | null;
  blob: Blob | null;
  errorMessage: string | null;
}

export function getSupportedMimeType(): string {
  if (typeof window === 'undefined' || typeof MediaRecorder === 'undefined') {
    return 'video/webm';
  }

  const candidateTypes = [
    'video/webm',
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp9,opus',
    'video/mp4;codecs=h264,aac',
    'video/mp4'
  ];

  for (const type of candidateTypes) {
    try {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    } catch (e) {
      // Ignore type check error
    }
  }

  return 'video/webm';
}

export function useMediaRecorder() {
  const [recordingStatus, setRecordingStatus] = useState<RecordingStatus>('IDLE');
  const [recordingMeta, setRecordingMeta] = useState<RecordingMetadata | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingMetaRef = useRef<RecordingMetadata | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  const cleanupObjectUrl = useCallback(() => {
    if (objectUrlRef.current) {
      try {
        URL.revokeObjectURL(objectUrlRef.current);
      } catch (e) {
        // Ignore revoke error
      }
      objectUrlRef.current = null;
    }
  }, []);

  const startRecording = useCallback((stream: MediaStream, sessionId: string) => {
    setErrorMessage(null);
    cleanupObjectUrl();

    if (typeof window === 'undefined' || typeof MediaRecorder === 'undefined') {
      setRecordingStatus('ERROR');
      setErrorMessage('MediaRecorder API is not supported in this browser environment.');
      return false;
    }

    if (!stream || stream.getTracks().length === 0) {
      setRecordingStatus('ERROR');
      setErrorMessage('Invalid or empty MediaStream provided for recording.');
      return false;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      console.log("🎥 [MediaRecorder] Recorder is already active and recording for session:", sessionId);
      return true;
    }

    try {
      setRecordingStatus('STARTING');
      sessionIdRef.current = sessionId;
      chunksRef.current = [];
      recordingMetaRef.current = null;

      const mimeType = getSupportedMimeType();
      const recorder = new MediaRecorder(stream, { mimeType });

      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onerror = (event: any) => {
        console.error('MediaRecorder runtime error:', event);
        setRecordingStatus('ERROR');
        setErrorMessage(event.error?.message || 'MediaRecorder encountered a runtime error.');
      };

      recorder.onstop = () => {
        const stoppedAtTime = Date.now();
        const startedAtTime = startTimeRef.current || stoppedAtTime;
        const durationSec = Math.max(0, Math.round((stoppedAtTime - startedAtTime) / 1000));

        const finalBlob = new Blob(chunksRef.current, { type: mimeType });
        cleanupObjectUrl();
        const objUrl = URL.createObjectURL(finalBlob);
        objectUrlRef.current = objUrl;

        const meta: RecordingMetadata = {
          sessionId: sessionIdRef.current || sessionId,
          recordingStatus: 'COMPLETED',
          mimeType: mimeType,
          startedAt: new Date(startedAtTime).toISOString(),
          stoppedAt: new Date(stoppedAtTime).toISOString(),
          duration: durationSec,
          size: finalBlob.size,
          objectUrl: objUrl,
          blob: finalBlob,
          errorMessage: null
        };

        recordingMetaRef.current = meta;
        setRecordingMeta(meta);
        setRecordingStatus('COMPLETED');
      };

      startTimeRef.current = Date.now();
      recorder.start(1000); // 1-second time slices
      mediaRecorderRef.current = recorder;
      setRecordingStatus('RECORDING');
      return true;
    } catch (err: any) {
      console.error('Failed to start MediaRecorder:', err);
      setRecordingStatus('ERROR');
      setErrorMessage(err.message || 'Failed to initialize MediaRecorder.');
      return false;
    }
  }, [cleanupObjectUrl]);

  const stopRecording = useCallback(async (): Promise<RecordingMetadata | null> => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
      return recordingMetaRef.current || recordingMeta;
    }

    setRecordingStatus('STOPPING');

    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder) {
        setRecordingStatus('COMPLETED');
        resolve(recordingMetaRef.current || recordingMeta);
        return;
      }

      recorder.onstop = () => {
        const stoppedAtTime = Date.now();
        const startedAtTime = startTimeRef.current || stoppedAtTime;
        const durationSec = Math.max(0, Math.round((stoppedAtTime - startedAtTime) / 1000));
        const mimeType = recorder.mimeType || getSupportedMimeType();

        const finalBlob = new Blob(chunksRef.current, { type: mimeType });
        cleanupObjectUrl();
        const objUrl = URL.createObjectURL(finalBlob);
        objectUrlRef.current = objUrl;

        const meta: RecordingMetadata = {
          sessionId: sessionIdRef.current || 'unknown_session',
          recordingStatus: 'COMPLETED',
          mimeType: mimeType,
          startedAt: new Date(startedAtTime).toISOString(),
          stoppedAt: new Date(stoppedAtTime).toISOString(),
          duration: durationSec,
          size: finalBlob.size,
          objectUrl: objUrl,
          blob: finalBlob,
          errorMessage: null
        };

        recordingMetaRef.current = meta;
        setRecordingMeta(meta);
        setRecordingStatus('COMPLETED');
        resolve(meta);
      };

      try {
        if (recorder.state === 'recording' || recorder.state === 'paused') {
          try {
            recorder.requestData();
          } catch (reqErr) {
            console.warn("MediaRecorder requestData notice:", reqErr);
          }
        }
        recorder.stop();
      } catch (e) {
        setRecordingStatus('COMPLETED');
        resolve(recordingMetaRef.current || recordingMeta);
      }
    });
  }, [cleanupObjectUrl, recordingMeta]);

  const resetRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {}
    }
    mediaRecorderRef.current = null;
    chunksRef.current = [];
    startTimeRef.current = null;
    sessionIdRef.current = null;
    cleanupObjectUrl();
    setRecordingMeta(null);
    setRecordingStatus('IDLE');
    setErrorMessage(null);
  }, [cleanupObjectUrl]);

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.stop();
        } catch (e) {}
      }
      cleanupObjectUrl();
    };
  }, [cleanupObjectUrl]);

  return {
    recordingStatus,
    recordingMeta,
    errorMessage,
    startRecording,
    stopRecording,
    resetRecording
  };
}
