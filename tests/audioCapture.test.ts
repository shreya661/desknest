import { describe, it, expect } from "vitest";
import {
  getEnhancedAudioConstraints,
  getFriendlyAudioErrorMessage,
  formatBoostLabel,
  getTranscriptionDiagnostic,
  calculateAudioSignalMetrics,
  formatDurationTimestamp,
  formatTranscript,
  DEFAULT_MIC_BOOST,
  MIN_MIC_BOOST,
  MAX_MIC_BOOST,
} from "../src/utils/audioCapture";

describe("Audio Capture & Processing Utilities", () => {
  describe("1. Microphone Constraints", () => {
    it("returns enhanced constraints with AGC, echo cancellation, and noise suppression", () => {
      const constraints = getEnhancedAudioConstraints();
      expect(constraints.audio).toEqual({
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      });
    });

    it("allows custom overrides for audio constraints", () => {
      const constraints = getEnhancedAudioConstraints({
        echoCancellation: false,
        noiseSuppression: true,
        autoGainControl: false,
      });
      expect(constraints.audio).toEqual({
        echoCancellation: false,
        noiseSuppression: true,
        autoGainControl: false,
      });
    });
  });

  describe("2. Error Diagnostics", () => {
    it("provides helpful message for permission denied", () => {
      const err = { name: "NotAllowedError", message: "Permission dismissed" };
      const msg = getFriendlyAudioErrorMessage(err);
      expect(msg).toContain("Windows Settings");
      expect(msg).toContain("denied");
    });

    it("provides helpful message for missing audio devices", () => {
      const err = { name: "NotFoundError" };
      const msg = getFriendlyAudioErrorMessage(err);
      expect(msg).toContain("No audio recording device detected");
      expect(msg).toContain("connect a microphone");
    });

    it("provides helpful message for device in use / conflict", () => {
      const err = { name: "NotReadableError" };
      const msg = getFriendlyAudioErrorMessage(err);
      expect(msg).toContain("in use by another application");
    });

    it("provides helpful message for overconstrained settings", () => {
      const err = { name: "OverconstrainedError" };
      const msg = getFriendlyAudioErrorMessage(err);
      expect(msg).toContain("Falling back");
    });

    it("handles generic or null error gracefully", () => {
      expect(getFriendlyAudioErrorMessage(null)).toBe("An unknown microphone error occurred.");
      expect(getFriendlyAudioErrorMessage({ message: "Custom hardware fault" })).toContain("Custom hardware fault");
    });
  });

  describe("3. Mic Boost Multipliers & Labels", () => {
    it("formats 1.0x as normal", () => {
      expect(formatBoostLabel(1.0)).toContain("Normal");
      expect(formatBoostLabel(1.0)).toContain("100%");
    });

    it("formats 1.2x as gentle boost", () => {
      expect(formatBoostLabel(1.2)).toContain("Gentle Boost");
      expect(formatBoostLabel(1.2)).toContain("120%");
    });

    it("formats 1.5x as clear speech", () => {
      expect(formatBoostLabel(1.5)).toContain("Clear Speech");
      expect(formatBoostLabel(1.5)).toContain("150%");
    });

    it("formats 2.0x+ as high boost", () => {
      expect(formatBoostLabel(2.0)).toContain("High Boost");
      expect(formatBoostLabel(2.5)).toContain("High Boost");
    });

    it("has sane constants", () => {
      expect(MIN_MIC_BOOST).toBe(1.0);
      expect(DEFAULT_MIC_BOOST).toBe(1.2);
      expect(MAX_MIC_BOOST).toBe(2.5);
    });
  });

  describe("4. Transcription Diagnostics", () => {
    it("returns diagnosis object with status message", () => {
      const diag = getTranscriptionDiagnostic();
      expect(diag).toHaveProperty("isSupported");
      expect(diag).toHaveProperty("isWebView2OrOffline");
      expect(diag).toHaveProperty("message");
      expect(typeof diag.message).toBe("string");
    });
  });

  describe("5. Audio Signal & Volume Quality Metrics", () => {
    it("flags silent/flat input as quiet", () => {
      // 128 is baseline neutral for time-domain byte audio
      const silentData = new Uint8Array(128).fill(128);
      const metrics = calculateAudioSignalMetrics(silentData);

      expect(metrics.volume).toBe(0);
      expect(metrics.isQuiet).toBe(true);
      expect(metrics.isClipping).toBe(false);
      expect(metrics.isOptimal).toBe(false);
    });

    it("detects healthy optimal vocal signal", () => {
      const vocalData = new Uint8Array(100);
      for (let i = 0; i < 100; i++) {
        vocalData[i] = 128 + Math.round(35 * Math.sin(i / 5));
      }
      const metrics = calculateAudioSignalMetrics(vocalData);

      expect(metrics.volume).toBeGreaterThanOrEqual(15);
      expect(metrics.volume).toBeLessThan(90);
      expect(metrics.isQuiet).toBe(false);
      expect(metrics.isClipping).toBe(false);
      expect(metrics.isOptimal).toBe(true);
    });

    it("detects clipping / digital distortion", () => {
      const clippingData = new Uint8Array(100).fill(255);
      const metrics = calculateAudioSignalMetrics(clippingData);

      expect(metrics.isClipping).toBe(true);
      expect(metrics.volume).toBeGreaterThan(80);
    });
  });

  describe("6. Transcription Formatting & Timestamps", () => {
    it("formats duration seconds as [mm:ss]", () => {
      expect(formatDurationTimestamp(5)).toBe("[00:05]");
      expect(formatDurationTimestamp(65)).toBe("[01:05]");
      expect(formatDurationTimestamp(600)).toBe("[10:00]");
    });

    it("formats transcript with timestamps and speaker labels", () => {
      const segments = [
        { timestamp: "[00:02]", speaker: "Speaker 1", text: "Hello and welcome." },
        { timestamp: "[00:06]", speaker: "Speaker 2", text: "Glad to be here." },
      ];

      const withAll = formatTranscript(segments, {
        includeTimestamps: true,
        includeSpeakers: true,
      });
      expect(withAll).toContain("[00:02] Speaker 1: Hello and welcome.");
      expect(withAll).toContain("[00:06] Speaker 2: Glad to be here.");

      const textOnly = formatTranscript(segments, {
        includeTimestamps: false,
        includeSpeakers: false,
      });
      expect(textOnly).toBe("Hello and welcome.\n\nGlad to be here.");
    });
  });
});
