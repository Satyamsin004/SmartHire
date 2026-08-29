// TensorFlow and COCO-SSD are loaded dynamically to prevent main-thread blocking
// on page load (WebGL context + shader compilation = 2-5s synchronous freeze)
import api from './api';

type CocoSsdModel = { detect: (input: HTMLCanvasElement) => Promise<Array<{ class: string; score: number; bbox: [number, number, number, number] }>> };
type DetectedObject = { class: string; score: number; bbox: [number, number, number, number] };

export type IntegrityEventType = 'MULTIPLE_PERSON' | 'MOBILE_PHONE' | 'FACE_NOT_VISIBLE' | 'TAB_SWITCH';

export interface ActiveIncident {
  eventId?: string;
  type: IntegrityEventType;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  title: string;
  message: string;
  startedAt: number;
  durationSeconds: number;
  confidence: number;
}

class IntegrityEngine {
  private model: CocoSsdModel | null = null;
  private isModelLoading: boolean = false;
  private isMonitoring: boolean = false;
  private intervalId: any = null;
  private sessionId: string | null = null;

  // Active Incidents state mapped by event type
  private activeIncidents: Map<IntegrityEventType, {
    eventId?: string;
    startedAt: number;
    lastSeenAt: number;
    consecutiveHits: number;
    consecutiveMisses: number;
    maxConfidence: number;
  }> = new Map();

  private isTerminated: boolean = false;
  private onIncidentCallback: ((incident: ActiveIncident | null) => void) | null = null;
  private onTerminatedCallback: ((reason: string) => void) | null = null;
  private monitoringStartTime: number = Date.now();
  private lastTelemetryTime: number = 0;
  private videoElementRef: HTMLVideoElement | null = null;
  private offscreenCanvas: HTMLCanvasElement | null = null;
  private offscreenCtx: CanvasRenderingContext2D | null = null;
  private telemetryCanvas: HTMLCanvasElement | null = null;
  private telemetryCtx: CanvasRenderingContext2D | null = null;

  // Configuration constants
  private readonly SAMPLING_INTERVAL_MS = 1000; // 1.0 FPS on 320x240 canvas is lightning fast (<20ms)
  private readonly PERSISTENCE_HITS_THRESHOLD = 2; // ~2.0s of consecutive detection to start incident
  private readonly FACE_MISSING_HITS_THRESHOLD = 4; // ~4.0s of missing person before warning
  private readonly RESOLUTION_MISSES_THRESHOLD = 2; // ~2.0s of absence to resolve incident
  private readonly TELEMETRY_INTERVAL_MS = 1500; // Sample frame every 1.5s for real model emotion inference

  public async loadModel(): Promise<CocoSsdModel | null> {
    if (this.model) return this.model;
    if (this.isModelLoading) {
      while (this.isModelLoading) {
        await new Promise(r => setTimeout(r, 100));
      }
      return this.model;
    }

    try {
      this.isModelLoading = true;
      // Yield to the event loop so React can finish rendering the lobby/room UI
      await new Promise(r => setTimeout(r, 150));
      // Dynamic import: TensorFlow.js and COCO-SSD are NOT loaded until this line runs,
      // preventing the 2-5s WebGL shader compilation from blocking page load
      const tf = await import('@tensorflow/tfjs');
      await tf.ready();
      // Another yield after TF.js init to let pending UI events drain
      await new Promise(r => setTimeout(r, 50));
      const cocoSsd = await import('@tensorflow-models/coco-ssd');
      this.model = await cocoSsd.load({ base: 'lite_mobilenet_v2' });
      console.log('✅ [IntegrityEngine] COCO-SSD Vision model loaded successfully.');
      return this.model;
    } catch (err) {
      console.warn('⚠️ [IntegrityEngine] Failed to load COCO-SSD model, vision fallback active:', err);
      return null;
    } finally {
      this.isModelLoading = false;
    }
  }

  public startMonitoring(
    videoElement: HTMLVideoElement,
    sessionId: string,
    onIncident: (incident: ActiveIncident | null) => void,
    onTerminated: (reason: string) => void
  ): () => void {
    this.sessionId = sessionId;
    this.videoElementRef = videoElement;
    this.isMonitoring = true;
    this.isTerminated = false;
    this.monitoringStartTime = Date.now();
    this.lastTelemetryTime = 0;
    this.activeIncidents.clear();
    this.onIncidentCallback = onIncident;
    this.onTerminatedCallback = onTerminated;

    // Initialize reusable offscreen canvas for zero DOM contention
    if (!this.offscreenCanvas) {
      this.offscreenCanvas = document.createElement('canvas');
      this.offscreenCanvas.width = 320;
      this.offscreenCanvas.height = 240;
      this.offscreenCtx = this.offscreenCanvas.getContext('2d', { willReadFrequently: true });
    }
    if (!this.telemetryCanvas) {
      this.telemetryCanvas = document.createElement('canvas');
      this.telemetryCanvas.width = 96;
      this.telemetryCanvas.height = 96;
      this.telemetryCtx = this.telemetryCanvas.getContext('2d', { willReadFrequently: true });
    }

    // 1. Setup Tab Switching / Window Visibility Listeners (DEBOUNCED WITH WARNING LIMIT)
    let tabSwitchCount = 0;
    const MAX_TAB_SWITCH_LIMIT = 3;
    let departureTimeout: any = null;

    const handleVisibilityChange = () => {
      if (document.hidden || document.visibilityState === 'hidden') {
        tabSwitchCount++;
        // Immediately record tab switch violation event to backend
        if (this.sessionId) {
          api.post(`/interview/${this.sessionId}/integrity-events`, {
            event_type: 'TAB_SWITCH',
            severity: 'CRITICAL',
            status: 'RESOLVED',
            confidence: 1.0,
            started_at: new Date().toISOString(),
            ended_at: new Date().toISOString(),
            duration_seconds: 1,
            metadata: { count: tabSwitchCount, event: 'visibilitychange' }
          }).catch(() => {});
        }

        if (tabSwitchCount >= MAX_TAB_SWITCH_LIMIT) {
          this.triggerTermination('TAB_SWITCH', {
            event: 'visibilitychange',
            tabSwitchCount,
            timestamp: new Date().toISOString()
          });
        } else {
          // Show candidate warning overlay
          if (this.onIncidentCallback) {
            this.onIncidentCallback({
              type: 'TAB_SWITCH',
              severity: 'HIGH',
              title: `Tab Switch Warning (${tabSwitchCount}/${MAX_TAB_SWITCH_LIMIT})`,
              message: 'Leaving the interview window is logged as an integrity violation. Repeated departure will auto-terminate your session.',
              startedAt: Date.now(),
              durationSeconds: 3,
              confidence: 1.0
            });
          }

          // If remaining away from tab for more than 15 continuous seconds, auto-terminate
          departureTimeout = setTimeout(() => {
            if (document.hidden && !this.isTerminated) {
              this.triggerTermination('TAB_SWITCH', {
                event: 'away_timeout',
                awaySeconds: 15
              });
            }
          }, 15000);
        }
      } else {
        if (departureTimeout) {
          clearTimeout(departureTimeout);
          departureTimeout = null;
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // 2. Start Vision Inference Sampling Loop (self-scheduling with non-blocking yields)
    this.loadModel().then((model) => {
      if (!this.isMonitoring) return;

      let isDetecting = false;

      const runDetection = async () => {
        if (!this.isMonitoring || this.isTerminated) return;

        if (!isDetecting && videoElement && videoElement.readyState >= 2 && videoElement.videoWidth > 0) {
          isDetecting = true;
          try {
            // Yield 1 tick before detection to keep main thread responsive
            await new Promise(r => setTimeout(r, 0));
            if (model && this.offscreenCanvas && this.offscreenCtx && this.isMonitoring && !this.isTerminated) {
              // Draw scaled video frame to offscreen canvas (instantly frees DOM video element)
              this.offscreenCtx.drawImage(videoElement, 0, 0, 320, 240);
              const rawPredictions = await model.detect(this.offscreenCanvas);
              
              // Scale coordinates back to original video dimensions for accurate face crops
              const scaleX = videoElement.videoWidth / 320;
              const scaleY = videoElement.videoHeight / 240;
              const predictions = rawPredictions.map(p => ({
                ...p,
                bbox: [p.bbox[0] * scaleX, p.bbox[1] * scaleY, p.bbox[2] * scaleX, p.bbox[3] * scaleY] as [number, number, number, number]
              }));

              this.processVisionPredictions(predictions);
            }
          } catch (err) {
            // Ignore transient frame capture errors
          } finally {
            isDetecting = false;
          }
        }

        // Schedule the next detection only after current one completes
        if (this.isMonitoring && !this.isTerminated) {
          this.intervalId = setTimeout(runDetection, this.SAMPLING_INTERVAL_MS);
        }
      };

      this.intervalId = setTimeout(runDetection, this.SAMPLING_INTERVAL_MS);
    });

    // Return cleanup callback
    return () => {
      this.stopMonitoring();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }

  public stopMonitoring() {
    this.isMonitoring = false;
    if (this.intervalId) {
      clearTimeout(this.intervalId);
      this.intervalId = null;
    }
    this.activeIncidents.forEach((data, type) => {
      this.resolveIncident(type, data);
    });
    this.activeIncidents.clear();
    this.onIncidentCallback = null;
    this.onTerminatedCallback = null;
    this.videoElementRef = null;
  }

  private processVisionPredictions(predictions: DetectedObject[]) {
    if (!this.isMonitoring || this.isTerminated) return;

    const persons = predictions.filter(p => p.class === 'person' && p.score >= 0.45);
    const phones = predictions.filter(p => (p.class === 'cell phone' || p.class === 'remote' || p.class === 'telephone') && p.score >= 0.35);

    const personCount = persons.length;
    const phoneCount = phones.length;
    const primaryPerson = persons[0] || null;
    const phoneScore = phones.length > 0 ? Math.max(...phones.map(p => p.score)) : 0;

    const now = Date.now();

    // Visual Telemetry Streaming for Real Trained Emotion CNN Model
    if (this.sessionId && (now - this.lastTelemetryTime >= this.TELEMETRY_INTERVAL_MS)) {
      this.lastTelemetryTime = now;
      const timestampSec = Math.round((now - this.monitoringStartTime) / 1000);

      if (personCount >= 1 && primaryPerson && this.videoElementRef && this.telemetryCanvas && this.telemetryCtx) {
        try {
          const [bx, by, bw, bh] = primaryPerson.bbox;
          // Crop candidate face/head region (top ~45% of detected person)
          const headH = Math.max(20, bh * 0.45);
          this.telemetryCtx.drawImage(
            this.videoElementRef,
            Math.max(0, bx),
            Math.max(0, by),
            Math.max(20, bw),
            headH,
            0,
            0,
            96,
            96
          );
          const b64 = this.telemetryCanvas.toDataURL('image/jpeg', 0.60);
          api.post(`/interview/${this.sessionId}/infer-visual-frame`, {
            frame_base64: b64,
            timestamp: timestampSec,
            face_detected: true,
            face_confidence: primaryPerson.score
          }).catch(() => {});
        } catch (e) {
          // Ignore transient capture exceptions
        }
      } else if (personCount === 0) {
        api.post(`/interview/${this.sessionId}/infer-visual-frame`, {
          frame_base64: null,
          timestamp: timestampSec,
          face_detected: false,
          face_confidence: 0.0
        }).catch(() => {});
      }
    }

    // 1. Multiple Person Detection
    this.updateDetectionState(
      'MULTIPLE_PERSON',
      personCount >= 2,
      personCount >= 2 ? 0.92 : 0,
      this.PERSISTENCE_HITS_THRESHOLD,
      { personCount },
      'Multiple Persons Detected',
      'Another person was detected in your camera frame. Please ensure you are alone.'
    );

    // 2. Mobile Phone Detection
    this.updateDetectionState(
      'MOBILE_PHONE',
      phoneCount > 0,
      phoneScore,
      this.PERSISTENCE_HITS_THRESHOLD,
      { phoneScore },
      'Smartphone Detected',
      'A mobile device was detected in your camera frame. Device usage is prohibited.'
    );

    // 3. Face / Person Missing Detection
    this.updateDetectionState(
      'FACE_NOT_VISIBLE',
      personCount === 0,
      personCount === 0 ? 0.85 : 0,
      this.FACE_MISSING_HITS_THRESHOLD,
      { personCount: 0 },
      'Face Not Clearly Visible',
      'Your face is not clearly visible to the camera. Please return to the camera view.'
    );
  }

  private updateDetectionState(
    type: IntegrityEventType,
    isDetected: boolean,
    confidence: number,
    hitsRequired: number,
    metadata: any,
    title: string,
    message: string
  ) {
    const now = Date.now();
    let state = this.activeIncidents.get(type);

    if (isDetected) {
      if (!state) {
        state = {
          startedAt: now,
          lastSeenAt: now,
          consecutiveHits: 1,
          consecutiveMisses: 0,
          maxConfidence: confidence
        };
        this.activeIncidents.set(type, state);
      } else {
        state.consecutiveHits++;
        state.consecutiveMisses = 0;
        state.lastSeenAt = now;
        state.maxConfidence = Math.max(state.maxConfidence, confidence);
      }

      // Check if threshold reached to trigger/update active incident
      if (state.consecutiveHits >= hitsRequired) {
        const durationSec = Math.round((now - state.startedAt) / 1000);

        // If newly promoted to backend incident
        if (!state.eventId && this.sessionId) {
          this.createBackendIncident(type, state, metadata);
        }

        // Notify candidate UI
        if (this.onIncidentCallback) {
          this.onIncidentCallback({
            eventId: state.eventId,
            type,
            severity: type === 'MULTIPLE_PERSON' ? 'HIGH' : (type === 'MOBILE_PHONE' ? 'HIGH' : 'MEDIUM'),
            title,
            message,
            startedAt: state.startedAt,
            durationSeconds: durationSec,
            confidence: state.maxConfidence
          });
        }
      }
    } else {
      // Condition not detected this frame
      if (state) {
        state.consecutiveMisses++;
        if (state.consecutiveMisses >= this.RESOLUTION_MISSES_THRESHOLD) {
          // Resolve incident
          this.resolveIncident(type, state);
          this.activeIncidents.delete(type);

          // Clear UI warning if no other active incidents
          if (this.onIncidentCallback) {
            const remaining = this.getHighestPriorityActiveIncident();
            this.onIncidentCallback(remaining);
          }
        }
      }
    }
  }

  private async createBackendIncident(type: IntegrityEventType, state: any, metadata: any) {
    if (!this.sessionId || state.isCreatingBackend) return;
    state.isCreatingBackend = true;
    try {
      const res = await api.post(`/interview/${this.sessionId}/integrity-events`, {
        event_type: type,
        severity: type === 'MULTIPLE_PERSON' ? 'HIGH' : (type === 'MOBILE_PHONE' ? 'HIGH' : 'MEDIUM'),
        status: 'ACTIVE',
        confidence: state.maxConfidence,
        started_at: new Date(state.startedAt).toISOString(),
        metadata: { ...metadata, engine: 'SmartHire_COCO_SSD' }
      });
      if (res.data?.event_id) {
        state.eventId = res.data.event_id;
        if (state.pendingResolution) {
          state.pendingResolution = false;
          await this.resolveIncident(type, state);
        }
      }
    } catch (err) {
      console.warn('Could not persist integrity event to backend:', err);
    } finally {
      state.isCreatingBackend = false;
    }
  }

  private async resolveIncident(type: IntegrityEventType, state: any) {
    if (!this.sessionId) return;
    if (!state.eventId) {
      state.pendingResolution = true;
      return;
    }
    try {
      const durationSec = Math.max(1, Math.round((Date.now() - state.startedAt) / 1000));
      await api.post(`/interview/${this.sessionId}/integrity-events`, {
        event_id: state.eventId,
        status: 'RESOLVED',
        ended_at: new Date().toISOString(),
        duration_seconds: durationSec,
        confidence: state.maxConfidence
      });
    } catch (err) {
      console.warn('Could not resolve integrity event on backend:', err);
    }
  }

  private getHighestPriorityActiveIncident(): ActiveIncident | null {
    // Priority order: MULTIPLE_PERSON > MOBILE_PHONE > FACE_NOT_VISIBLE
    const priority: IntegrityEventType[] = ['MULTIPLE_PERSON', 'MOBILE_PHONE', 'FACE_NOT_VISIBLE'];
    for (const p of priority) {
      const state = this.activeIncidents.get(p);
      if (state && state.consecutiveHits >= this.PERSISTENCE_HITS_THRESHOLD) {
        const durationSec = Math.round((Date.now() - state.startedAt) / 1000);
        return {
          eventId: state.eventId,
          type: p,
          severity: p === 'FACE_NOT_VISIBLE' ? 'MEDIUM' : 'HIGH',
          title: p === 'MULTIPLE_PERSON' ? 'Multiple Persons Detected' : (p === 'MOBILE_PHONE' ? 'Mobile Phone Detected' : 'Face Not Visible'),
          message: p === 'MULTIPLE_PERSON' ? 'Another person was detected in your camera view.' : (p === 'MOBILE_PHONE' ? 'A mobile phone was detected in your camera view.' : 'Please return to the camera frame.'),
          startedAt: state.startedAt,
          durationSeconds: durationSec,
          confidence: state.maxConfidence
        };
      }
    }
    return null;
  }

  public async triggerTermination(reason: string = 'TAB_SWITCH', metadata: any = {}) {
    if (this.isTerminated || !this.sessionId) return;
    this.isTerminated = true;
    console.error(`🚨 [IntegrityEngine] Automatic Termination Triggered! Reason: ${reason}`);

    try {
      await api.post(`/interview/${this.sessionId}/terminate`, {
        reason,
        metadata: { ...metadata, userAgent: navigator.userAgent }
      });
    } catch (err) {
      console.warn('Termination API notice:', err);
    }

    if (this.onTerminatedCallback) {
      this.onTerminatedCallback(reason);
    }
    this.stopMonitoring();
  }
}

export const integrityEngine = new IntegrityEngine();
