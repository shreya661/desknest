import { describe, it, expect } from "vitest";
import {
  getEnhancedAudioConstraints,
  getFriendlyAudioErrorMessage,
  formatBoostLabel,
  getTranscriptionDiagnostic,
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
});
