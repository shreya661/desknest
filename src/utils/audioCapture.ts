/**
 * Audio Capture & Processing Utilities for DeskNest.
 * Provides safe Web Audio gain processing, hardware audio constraints,
 * error diagnostics, and offline speech-to-text fallback helpers.
 */

export interface AudioConstraintsConfig {
  echoCancellation: boolean;
  noiseSuppression: boolean;
  autoGainControl: boolean;
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
  config: AudioConstraintsConfig = DEFAULT_AUDIO_CONSTRAINTS
): MediaStreamConstraints {
  return {
    audio: {
      echoCancellation: config.echoCancellation,
      noiseSuppression: config.noiseSuppression,
      autoGainControl: config.autoGainControl,
    },
  };
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
