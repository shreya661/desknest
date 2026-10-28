/**
 * Audio Capture & Processing Utilities for DeskNest.
 * Provides safe Web Audio gain processing, hardware audio constraints,
 * error diagnostics, and offline speech-to-text fallback helpers.
 */

export interface AudioConstraintsConfig {
  echoCancellation: boolean;
  noiseSuppression: boolean;
  autoGainControl: boolean;
  deviceId?: string;
}

export interface AudioDeviceOption {
  deviceId: string;
  label: string;
  groupId?: string;
}

export interface AudioSignalMetrics {
  volume: number; // 0 to 100
  peak: number; // 0 to 1
  isQuiet: boolean; // < 15%
  isClipping: boolean; // > 90%
  isOptimal: boolean; // 15% - 85%
}

export interface TranscriptionSegment {
  timestamp?: string; // "[00:05]"
  speaker?: string; // "Speaker 1"
  text: string;
}

export const DEFAULT_AUDIO_CONSTRAINTS: AudioConstraintsConfig = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
};

export const MIN_MIC_BOOST = 1.0;
export const MAX_MIC_BOOST = 2.5;
export const DEFAULT_MIC_BOOST = 1.2;

/**
 * Returns MediaStreamConstraints with enhanced hardware audio capture settings.
 */
export function getEnhancedAudioConstraints(
  config: AudioConstraintsConfig = DEFAULT_AUDIO_CONSTRAINTS,
  deviceId?: string
): MediaStreamConstraints {
  const targetDeviceId = deviceId || config.deviceId;
  const audioConstraints: MediaTrackConstraints = {
    echoCancellation: config.echoCancellation,
    noiseSuppression: config.noiseSuppression,
    autoGainControl: config.autoGainControl,
  };

  if (targetDeviceId) {
    audioConstraints.deviceId = { exact: targetDeviceId };
  }

  return {
    audio: audioConstraints,
  };
}

/**
 * Enumerates available audio input devices (microphones/headsets).
 */
export async function getAvailableAudioInputDevices(): Promise<AudioDeviceOption[]> {
  if (
    typeof navigator === "undefined" ||
    !navigator.mediaDevices ||
    !navigator.mediaDevices.enumerateDevices
  ) {
    return [];
  }

  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const audioInputs = devices.filter((d) => d.kind === "audioinput");

    return audioInputs.map((device, index) => ({
      deviceId: device.deviceId,
      label: device.label || `Microphone ${index + 1}`,
      groupId: device.groupId,
    }));
  } catch (err) {
    console.warn("Could not enumerate audio devices:", err);
    return [];
  }
}

/**
 * Computes RMS volume and peak distortion metrics from raw time-domain audio data (Uint8Array, centered around 128).
 */
export function calculateAudioSignalMetrics(dataArray: Uint8Array): AudioSignalMetrics {
  if (!dataArray || dataArray.length === 0) {
    return { volume: 0, peak: 0, isQuiet: true, isClipping: false, isOptimal: false };
  }

  let sumSquares = 0;
  let peak = 0;

  for (let i = 0; i < dataArray.length; i++) {
    const normalized = Math.abs(dataArray[i] - 128) / 128;
    sumSquares += normalized * normalized;
    if (normalized > peak) {
      peak = normalized;
    }
  }

  const rms = Math.sqrt(sumSquares / dataArray.length);
  // Scale RMS to 0 - 100 with perceptual sensitivity factor
  const volume = Math.min(100, Math.round(rms * 100 * 2.8));

  return {
    volume,
    peak,
    isQuiet: volume < 15,
    isClipping: peak >= 0.95 || volume >= 90,
    isOptimal: volume >= 15 && volume < 90,
  };
}

/**
 * Formats seconds into standard timestamp: [mm:ss]
 */
export function formatDurationTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `[${m < 10 ? "0" : ""}${m}:${s < 10 ? "0" : ""}${s}]`;
}

/**
 * Formats transcription segments into clean, styled readable text.
 */
export function formatTranscript(
  segments: TranscriptionSegment[],
  options: { includeTimestamps?: boolean; includeSpeakers?: boolean } = {}
): string {
  if (!segments || segments.length === 0) return "";

  return segments
    .map((s) => {
      const parts: string[] = [];
      if (options.includeTimestamps && s.timestamp) {
        parts.push(s.timestamp);
      }
      if (options.includeSpeakers && s.speaker) {
        parts.push(`${s.speaker}:`);
      }
      parts.push(s.text.trim());
      return parts.join(" ");
    })
    .filter(Boolean)
    .join("\n\n");
}

/**
 * Translates low-level browser audio/media exceptions into human-friendly,
 * actionable error messages for the user.
 */
export function getFriendlyAudioErrorMessage(err: unknown): string {
  if (!err) return "An unknown microphone error occurred.";

  const error = err as { name?: string; message?: string };
  const name = error.name || "";
  const msg = error.message || "";

  switch (name) {
    case "NotAllowedError":
    case "PermissionDeniedError":
      return "Microphone permission was denied. Please allow microphone access in Windows Settings > Privacy & security > Microphone.";
    case "NotFoundError":
    case "DevicesNotFoundError":
      return "No audio recording device detected. Please connect a microphone or headset and try again.";
    case "NotReadableError":
    case "TrackStartError":
      return "Microphone is in use by another application. Please close other voice or recording apps and try again.";
    case "OverconstrainedError":
      return "Microphone does not support the requested hardware audio settings. Falling back to default settings...";
    case "SecurityError":
      return "Microphone access blocked due to security restrictions.";
    default:
      if (msg.includes("permission") || msg.includes("denied")) {
        return "Microphone permission was denied. Please allow microphone access in Windows Settings.";
      }
      return msg ? `Microphone error: ${msg}` : "Could not initialize audio capture.";
  }
}

/**
 * Returns supported MediaRecorder audio mime type.
 */
export function getSupportedAudioMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "audio/webm";

  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/mp4",
  ];

  for (const mime of candidates) {
    if (typeof MediaRecorder.isTypeSupported === "function" && MediaRecorder.isTypeSupported(mime)) {
      return mime;
    }
  }

  return "";
}

/**
 * Formats boost factor multiplier as human-readable label.
 */
export function formatBoostLabel(multiplier: number): string {
  const percent = Math.round(multiplier * 100);
  if (multiplier <= 1.05) return "1.0x (100% Normal)";
  if (multiplier <= 1.25) return `${multiplier.toFixed(1)}x (${percent}% Gentle Boost)`;
  if (multiplier <= 1.6) return `${multiplier.toFixed(1)}x (${percent}% Clear Speech)`;
  return `${multiplier.toFixed(1)}x (${percent}% High Boost)`;
}

/**
 * Diagnostic status for Speech-to-Text in the current desktop runtime environment.
 */
export function getTranscriptionDiagnostic(): {
  isSupported: boolean;
  isWebView2OrOffline: boolean;
  message: string;
} {
  const hasApi =
    typeof window !== "undefined" &&
    !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  // In Tauri WebView2, navigator.userAgent contains "Edg/" or "WebView" without Google speech keys
  const isWebView =
    typeof navigator !== "undefined" &&
    (navigator.userAgent.includes("Edg/") || (window as any).__TAURI_INTERNALS__);

  if (!hasApi) {
    return {
      isSupported: false,
      isWebView2OrOffline: true,
      message: "Speech-to-text API is not supported in this runtime. Manual transcript entry is available.",
    };
  }

  if (isWebView) {
    return {
      isSupported: true,
      isWebView2OrOffline: true,
      message: "Offline local mode: Web Speech API may be blocked in WebView2. You can type or edit thoughts directly.",
    };
  }

  return {
    isSupported: true,
    isWebView2OrOffline: false,
    message: "Speech dictation ready.",
  };
}
