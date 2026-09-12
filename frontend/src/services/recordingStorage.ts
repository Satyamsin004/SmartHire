import api from './api';

const DB_NAME = 'smarthire_recordings_db';
const STORE_NAME = 'session_recordings';
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB not supported'));
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'sessionId' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function storeSessionRecordingBlob(sessionId: string, blob: Blob): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const data = {
        sessionId,
        blob,
        timestamp: Date.now(),
        size: blob.size,
        type: blob.type
      };
      const req = store.put(data);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn('[RecordingStorage] Failed to store blob in IndexedDB:', e);
  }
}

export async function getSessionRecordingBlob(sessionId: string): Promise<Blob | null> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(sessionId);
      req.onsuccess = () => {
        if (req.result && req.result.blob) {
          resolve(req.result.blob);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  } catch (e) {
    return null;
  }
}

export async function uploadSessionRecordingWithRetry(
  sessionId: string,
  blob: Blob,
  durationSec: number,
  maxRetries = 3
): Promise<boolean> {
  const mime = blob.type || 'video/webm';
  const ext = mime.includes('mp4') ? 'mp4' : 'webm';
  const formData = new FormData();
  formData.append('file', blob, `recording_${sessionId}.${ext}`);
  formData.append('duration', String(durationSec));
  formData.append('recording_type', mime.startsWith('audio') ? 'AUDIO_ONLY' : 'VIDEO_AUDIO');

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await api.post(`/uploads/interview-sessions/${sessionId}/recordings`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 90000
      });
      console.log(`[RecordingStorage] Upload succeeded for session ${sessionId} on attempt ${attempt}`);
      return true;
    } catch (err: any) {
      console.warn(`[RecordingStorage] Upload attempt ${attempt} failed:`, err?.response?.status || err?.message);
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 1000 * attempt));
      }
    }
  }
  return false;
}
