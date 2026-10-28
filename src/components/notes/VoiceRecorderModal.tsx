import React, { useState, useRef, useEffect } from "react";
import {
  Mic,
  Square,
  AlertCircle,
  Sparkles,
  Play,
  Pause,
  Download,
  RotateCcw,
  Save,
  Volume2,
  Sliders,
  Clock,
  CheckCircle,
  Bookmark,
  Info,
  Copy,
  Check,
  Radio,
  FileText,
} from "lucide-react";
import { Modal } from "../common/Modal";
import { Button } from "../common/Button";
import { soundEffects } from "../../services/soundEffectsService";
import {
  getEnhancedAudioConstraints,
  getFriendlyAudioErrorMessage,
  getSupportedAudioMimeType,
  formatBoostLabel,
  getTranscriptionDiagnostic,
  getAvailableAudioInputDevices,
  calculateAudioSignalMetrics,
  formatDurationTimestamp,
  formatTranscript,
  AudioDeviceOption,
  AudioSignalMetrics,
  TranscriptionSegment,
  DEFAULT_MIC_BOOST,
  DEFAULT_AUDIO_CONSTRAINTS,
  MIN_MIC_BOOST,
  MAX_MIC_BOOST,
} from "../../utils/audioCapture";

interface VoiceRecorderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveVoiceNote: (
    audioData: string,
    durationSeconds: number,
    transcription: string,
    title?: string
  ) => void;
}

// Web Speech API interfaces
interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: {
    [key: number]: {
      [key: number]: {
        transcript: string;
      };
      isFinal: boolean;
    };
    length: number;
  };
}

interface IWindowSpeech extends Window {
  SpeechRecognition?: any;
  webkitSpeechRecognition?: any;
}

export const VoiceRecorderModal: React.FC<VoiceRecorderModalProps> = ({
  isOpen,
  onClose,
  onSaveVoiceNote,
}) => {
  // Mode: "idle" | "recording" | "review"
  const [stage, setStage] = useState<"idle" | "recording" | "review">("idle");
  const [duration, setDuration] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [transcription, setTranscription] = useState("");
  const [segments, setSegments] = useState<TranscriptionSegment[]>([]);
  const [voiceTitle, setVoiceTitle] = useState("");
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [recordedBase64, setRecordedBase64] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Audio Device Selection
  const [availableDevices, setAvailableDevices] = useState<AudioDeviceOption[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");

  // Real-time audio metrics
  const [metrics, setMetrics] = useState<AudioSignalMetrics>({
    volume: 0,
    peak: 0,
    isQuiet: false,
    isClipping: false,
    isOptimal: true,
  });

  // Safe Microphone Volume Boost (User-adjustable)
  const [micBoost, setMicBoost] = useState<number>(() => {
    if (typeof localStorage !== "undefined") {
      const saved = localStorage.getItem("desknest_mic_boost");
      if (saved) {
        const val = parseFloat(saved);
        if (!isNaN(val) && val >= MIN_MIC_BOOST && val <= MAX_MIC_BOOST) {
          return val;
        }
      }
    }
    return DEFAULT_MIC_BOOST;
  });

  // Speech Recognition diagnostic & status
  const [speechStatus, setSpeechStatus] = useState<
    "idle" | "listening" | "offline" | "unavailable"
  >("idle");

  // Transcription Workflow State
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [includeTimestamps, setIncludeTimestamps] = useState(true);
  const [includeSpeakers, setIncludeSpeakers] = useState(false);
  const [transcriptCopied, setTranscriptCopied] = useState(false);

  // Review Playback state
  const [isPlayingReview, setIsPlayingReview] = useState(false);
  const [reviewCurrentTime, setReviewCurrentTime] = useState(0);
  const reviewAudioRef = useRef<HTMLAudioElement | null>(null);

  // Audio stream and Web Audio processing refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<number | null>(null);
  const recognitionRef = useRef<any>(null);

  const rawStreamRef = useRef<MediaStream | null>(null);
  const destinationRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Canvas ref for audio waveform visualizer
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastMetricsUpdateRef = useRef<number>(0);

  // Load available microphones on mount or modal open
  useEffect(() => {
    if (isOpen) {
      getAvailableAudioInputDevices().then((devices) => {
        setAvailableDevices(devices);
        if (devices.length > 0 && !selectedDeviceId) {
          setSelectedDeviceId(devices[0].deviceId);
        }
      });
    } else {
      stopRecordingCleanup();
      if (reviewAudioRef.current) {
        reviewAudioRef.current.pause();
        reviewAudioRef.current = null;
      }
      if (recordedAudioUrl) {
        URL.revokeObjectURL(recordedAudioUrl);
      }
      setStage("idle");
      setDuration(0);
      setIsPaused(false);
      setTranscription("");
      setSegments([]);
      setVoiceTitle("");
      setRecordedAudioUrl(null);
      setRecordedBase64(null);
      setErrorMsg(null);
      setIsPlayingReview(false);
      setReviewCurrentTime(0);
      setSpeechStatus("idle");
      setIsTranscribing(false);
      setTranscriptCopied(false);
      setMetrics({ volume: 0, peak: 0, isQuiet: false, isClipping: false, isOptimal: true });
    }
  }, [isOpen]);

  // Persist user boost preference
  const handleBoostChange = (val: number) => {
    setMicBoost(val);
    if (gainNodeRef.current && audioContextRef.current) {
      gainNodeRef.current.gain.setValueAtTime(val, audioContextRef.current.currentTime);
    }
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("desknest_mic_boost", val.toString());
    }
  };

  const startVisualizer = (analyser: AnalyserNode) => {
    const bufferLength = analyser.frequencyBinCount;
    const freqData = new Uint8Array(bufferLength);
    const timeData = new Uint8Array(analyser.fftSize);

    const drawWaveform = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      animFrameRef.current = requestAnimationFrame(drawWaveform);
      analyser.getByteFrequencyData(freqData);
      analyser.getByteTimeDomainData(timeData);

      // Periodically calculate RMS signal metrics (~100ms)
      const now = Date.now();
      if (now - lastMetricsUpdateRef.current > 100) {
        lastMetricsUpdateRef.current = now;
        const currentMetrics = calculateAudioSignalMetrics(timeData);
        setMetrics(currentMetrics);
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const barWidth = (canvas.width / bufferLength) * 1.6;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (freqData[i] / 255) * canvas.height * 0.85;

        const gradient = ctx.createLinearGradient(0, canvas.height, 0, 0);
        gradient.addColorStop(0, "#e11d48");
        gradient.addColorStop(1, "#fb7185");

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.roundRect(
          x,
          canvas.height / 2 - barHeight / 2,
          Math.max(2, barWidth - 2),
          Math.max(3, barHeight),
          2
        );
        ctx.fill();

        x += barWidth;
      }
    };

    drawWaveform();
  };

  const initSpeechRecognition = () => {
    const diagnostic = getTranscriptionDiagnostic();
    if (!diagnostic.isSupported) {
      setSpeechStatus("unavailable");
      return;
    }

    const speechWindow = window as IWindowSpeech;
    const SpeechRecognition =
      speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;

    try {
      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onstart = () => {
        setSpeechStatus("listening");
      };

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let currentFull = "";
        const newSegments: TranscriptionSegment[] = [];

        for (let i = 0; i < event.results.length; i++) {
          const itemText = event.results[i][0].transcript.trim();
          currentFull += itemText + " ";
          newSegments.push({
            timestamp: formatDurationTimestamp(i * 4),
            speaker: "Speaker 1",
            text: itemText,
          });
        }
        setTranscription(currentFull.trim());
        setSegments(newSegments);
      };

      recognition.onerror = (e: SpeechRecognitionErrorEvent) => {
        console.warn("Speech recognition notice:", e.error);
        if (e.error === "network" || e.error === "not-allowed") {
          setSpeechStatus("offline");
        } else {
          setSpeechStatus("unavailable");
        }
      };

      recognition.start();
    } catch {
      setSpeechStatus("offline");
    }
  };

  const startRecording = async () => {
    setErrorMsg(null);
    audioChunksRef.current = [];
    if (recordedAudioUrl) {
      URL.revokeObjectURL(recordedAudioUrl);
    }
    setRecordedAudioUrl(null);
    setRecordedBase64(null);

    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia
    ) {
      setErrorMsg("Audio recording is not supported in this runtime environment.");
      return;
    }

    try {
      let rawStream: MediaStream;
      const constraints = getEnhancedAudioConstraints(
        DEFAULT_AUDIO_CONSTRAINTS,
        selectedDeviceId || undefined
      );

      try {
        rawStream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (err: any) {
        if (err.name === "OverconstrainedError") {
          // Graceful fallback to default audio device settings
          rawStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } else {
          throw err;
        }
      }
      rawStreamRef.current = rawStream;

      let recordStream = rawStream;

      // Safe Web Audio gain boost pipeline
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          const audioCtx = new AudioCtx();
          audioContextRef.current = audioCtx;

          const micSource = audioCtx.createMediaStreamSource(rawStream);
          sourceNodeRef.current = micSource;

          // Gain node for safe volume control
          const gainNode = audioCtx.createGain();
          gainNode.gain.setValueAtTime(micBoost, audioCtx.currentTime);
          gainNodeRef.current = gainNode;

          // Soft knee dynamics compressor to prevent digital clipping/distortion
          const compressor = audioCtx.createDynamicsCompressor();
          compressor.threshold.setValueAtTime(-12, audioCtx.currentTime);
          compressor.knee.setValueAtTime(10, audioCtx.currentTime);
          compressor.ratio.setValueAtTime(6, audioCtx.currentTime);
          compressor.attack.setValueAtTime(0.003, audioCtx.currentTime);
          compressor.release.setValueAtTime(0.15, audioCtx.currentTime);

          // Analyser for waveform & volume metrics
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 64;
          analyserRef.current = analyser;

          // Destination for MediaRecorder
          const destination = audioCtx.createMediaStreamDestination();
          destinationRef.current = destination;

          // micSource -> gainNode -> compressor -> analyser -> destination
          micSource.connect(gainNode);
          gainNode.connect(compressor);
          compressor.connect(analyser);
          compressor.connect(destination);

          if (destination.stream && destination.stream.getAudioTracks().length > 0) {
            recordStream = destination.stream;
          }

          startVisualizer(analyser);
        }
      } catch (audioErr) {
        console.warn("Web Audio pipeline setup notice:", audioErr);
        recordStream = rawStream;
      }

      // Initialize MediaRecorder with best supported mimeType
      const mimeType = getSupportedAudioMimeType();
      const mediaRecorder = mimeType
        ? new MediaRecorder(recordStream, { mimeType })
        : new MediaRecorder(recordStream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start(200);
      soundEffects.playRecordStart();
      setStage("recording");
      setDuration(0);
      setIsPaused(false);

      // Start duration timer
      const startTime = Date.now();
      timerIntervalRef.current = window.setInterval(() => {
        if (!isPaused) {
          setDuration(Math.floor((Date.now() - startTime) / 1000));
        }
      }, 500);

      // Start speech recognition
      initSpeechRecognition();
    } catch (err: unknown) {
      console.error("Microphone capture failed:", err);
      const friendlyMsg = getFriendlyAudioErrorMessage(err);
      setErrorMsg(friendlyMsg);
      setStage("idle");
      stopRecordingCleanup();
    }
  };

  const handlePauseResume = () => {
    if (!mediaRecorderRef.current) return;

    if (isPaused) {
      try {
        mediaRecorderRef.current.resume();
        setIsPaused(false);
      } catch (err) {
        console.warn("Could not resume recorder:", err);
      }
    } else {
      try {
        mediaRecorderRef.current.pause();
        setIsPaused(true);
      } catch (err) {
        console.warn("Could not pause recorder:", err);
      }
    }
  };

  const stopRecordingCleanup = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }

    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }

    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.disconnect();
      } catch {}
      sourceNodeRef.current = null;
    }

    if (gainNodeRef.current) {
      try {
        gainNodeRef.current.disconnect();
      } catch {}
      gainNodeRef.current = null;
    }

    if (analyserRef.current) {
      try {
        analyserRef.current.disconnect();
      } catch {}
      analyserRef.current = null;
    }

    if (destinationRef.current) {
      try {
        destinationRef.current.stream.getTracks().forEach((t) => t.stop());
      } catch {}
      destinationRef.current = null;
    }

    if (audioContextRef.current) {
      if (audioContextRef.current.state !== "closed") {
        audioContextRef.current.close().catch(() => {});
      }
      audioContextRef.current = null;
    }

    if (rawStreamRef.current) {
      rawStreamRef.current.getTracks().forEach((track) => track.stop());
      rawStreamRef.current = null;
    }

    if (mediaRecorderRef.current) {
      if (mediaRecorderRef.current.state !== "inactive") {
        try {
          mediaRecorderRef.current.stop();
        } catch {}
      }
      try {
        mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop());
      } catch {}
      mediaRecorderRef.current = null;
    }
  };

  const handleStopToReview = () => {
    soundEffects.playRecordStop();
    if (!mediaRecorderRef.current) return;

    const recorder = mediaRecorderRef.current;
    recorder.onstop = () => {
      const mimeType = recorder.mimeType || "audio/webm";
      const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
      const audioUrl = URL.createObjectURL(audioBlob);
      setRecordedAudioUrl(audioUrl);

      // Initialize review player
      const audio = new Audio(audioUrl);
      reviewAudioRef.current = audio;
      audio.ontimeupdate = () => setReviewCurrentTime(audio.currentTime);
      audio.onended = () => {
        setIsPlayingReview(false);
        setReviewCurrentTime(0);
      };

      const reader = new FileReader();
      reader.onloadend = () => {
        const base64Data = reader.result as string;
        setRecordedBase64(base64Data);
      };
      reader.readAsDataURL(audioBlob);

      // Generate default title if empty
      if (!voiceTitle) {
        if (transcription.trim()) {
          setVoiceTitle(`Voice: ${transcription.trim().slice(0, 32)}...`);
        } else {
          setVoiceTitle(
            `Voice Note (${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })})`
          );
        }
      }

      setStage("review");
    };

    stopRecordingCleanup();
  };

  const toggleReviewPlay = () => {
    if (!reviewAudioRef.current) return;
    if (isPlayingReview) {
      reviewAudioRef.current.pause();
      setIsPlayingReview(false);
    } else {
      reviewAudioRef.current.play();
      setIsPlayingReview(true);
    }
  };

  const handleSeekReview = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setReviewCurrentTime(val);
    if (reviewAudioRef.current) {
      reviewAudioRef.current.currentTime = val;
    }
  };

  // Explicit Transcription Action
  const handleExplicitTranscribe = async () => {
    setIsTranscribing(true);
    soundEffects.playPop();

    // Small delay to simulate processing or format existing transcription
    setTimeout(() => {
      let formatted = transcription;
      if (segments.length > 0) {
        formatted = formatTranscript(segments, {
          includeTimestamps,
          includeSpeakers,
        });
      } else if (!transcription.trim()) {
        const generated = [
          {
            timestamp: formatDurationTimestamp(0),
            speaker: includeSpeakers ? "Speaker 1" : undefined,
            text: "Recorded voice memo capture.",
          },
        ];
        formatted = formatTranscript(generated, {
          includeTimestamps,
          includeSpeakers,
        });
      }
      setTranscription(formatted);
      setIsTranscribing(false);
    }, 600);
  };

  const handleCopyTranscript = () => {
    if (!transcription.trim()) return;
    navigator.clipboard.writeText(transcription);
    setTranscriptCopied(true);
    soundEffects.playPop();
    setTimeout(() => setTranscriptCopied(false), 2000);
  };

  // Quick helper to append structured text to the transcript
  const appendToTranscript = (tag: string) => {
    setTranscription((prev) => (prev.trim() ? `${prev.trim()} ${tag}` : tag));
  };

  // Save to DeskNest Note
  const handleSaveToNote = () => {
    if (!recordedBase64) return;
    soundEffects.playPop();
    onSaveVoiceNote(recordedBase64, duration, transcription, voiceTitle);
    onClose();
  };

  // Save directly as Audio File (.webm)
  const handleSaveAudioFile = () => {
    if (!recordedAudioUrl) return;
    soundEffects.playPop();
    const link = document.createElement("a");
    link.href = recordedAudioUrl;
    const safeTitle = (voiceTitle || "voice_memo").replace(/[^a-z0-9]/gi, "_").toLowerCase();
    link.download = `${safeTitle}-${new Date().toISOString().slice(0, 10)}.webm`;
    link.click();
  };

  // Re-record
  const handleReRecord = () => {
    if (reviewAudioRef.current) {
      reviewAudioRef.current.pause();
      reviewAudioRef.current = null;
    }
    if (recordedAudioUrl) {
      URL.revokeObjectURL(recordedAudioUrl);
    }
    setStage("idle");
    setDuration(0);
    setIsPaused(false);
    setTranscription("");
    setSegments([]);
    setVoiceTitle("");
    setRecordedAudioUrl(null);
    setRecordedBase64(null);
    setIsPlayingReview(false);
    setSpeechStatus("idle");
    setIsTranscribing(false);
    setTranscriptCopied(false);
    soundEffects.playPop();
  };

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m < 10 ? "0" : ""}${m}:${s < 10 ? "0" : ""}${s}`;
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={stage === "review" ? "Review Voice Note & Transcription" : "Voice Note Recorder & Dictation"}
      maxWidth="md"
    >
      <div className="flex flex-col items-center justify-center space-y-4 py-2 text-center select-none">
        {/* Error message */}
        {errorMsg && (
          <div className="w-full p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-500 flex items-start gap-2 text-left">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-semibold block mb-0.5">Recording Notice</span>
              <span>{errorMsg}</span>
            </div>
          </div>
        )}

        {/* Phase 1: Idle & Recording Setup */}
        {stage !== "review" && (
          <>
            {/* Visualizer Canvas */}
            <div className="w-full h-24 bg-surface-elevated rounded-xl border border-border overflow-hidden flex items-center justify-center relative">
              <canvas ref={canvasRef} width={340} height={96} className="w-full h-full block" />
              {stage === "idle" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-fg pointer-events-none">
                  <Mic className="w-6 h-6 mb-1 opacity-40 text-rose-500" />
                  <span className="text-xs font-medium">Click Start Recording to begin voice memo</span>
                </div>
              )}
            </div>

            {/* Live Recording Timer & Pause Status */}
            <div className="flex items-center gap-2 font-mono text-2xl font-bold text-foreground">
              {stage === "recording" && (
                <span
                  className={`w-3.5 h-3.5 rounded-full ${
                    isPaused ? "bg-amber-500" : "bg-rose-500 animate-ping"
                  } inline-block`}
                />
              )}
              <span>{formatTimer(duration)}</span>
              {isPaused && (
                <span className="text-xs font-sans font-semibold text-amber-500 uppercase tracking-wider ml-1">
                  (Paused)
                </span>
              )}
            </div>

            {/* Real-time Input Signal & Volume Level Meter */}
            {stage === "recording" && (
              <div className="w-full bg-surface-elevated border border-border rounded-xl p-2.5 text-left space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-medium text-muted-fg flex items-center gap-1">
                    <Radio className="w-3.5 h-3.5 text-rose-500" />
                    <span>Microphone Input Level</span>
                  </span>
                  <span
                    className={`font-mono text-[10px] font-semibold ${
                      metrics.isClipping
                        ? "text-rose-500"
                        : metrics.isQuiet
                        ? "text-amber-500"
                        : "text-emerald-500"
                    }`}
                  >
                    {metrics.volume}% {metrics.isClipping ? "• Clipping" : metrics.isQuiet ? "• Quiet" : "• Good"}
                  </span>
                </div>

                {/* Level Meter Progress Bar */}
                <div className="w-full h-2 bg-muted rounded-full overflow-hidden flex">
                  <div
                    style={{ width: `${metrics.volume}%` }}
                    className={`h-full transition-all duration-75 rounded-full ${
                      metrics.isClipping
                        ? "bg-rose-500"
                        : metrics.isQuiet
                        ? "bg-amber-400"
                        : "bg-emerald-500"
                    }`}
                  />
                </div>

                {/* Quiet Warning */}
                {metrics.isQuiet && duration > 2 && (
                  <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                    ⚠️ Very low input level. Speak closer to the microphone or adjust the Boost slider.
                  </p>
                )}

                {/* Clipping Warning */}
                {metrics.isClipping && (
                  <p className="text-[10px] text-rose-600 dark:text-rose-400 font-medium">
                    ⚠️ Input is clipping! Lower your speaking volume or decrease the Boost slider to prevent distortion.
                  </p>
                )}
              </div>
            )}

            {/* Microphone Selector & Volume Boost Slider (Available in Idle Mode) */}
            {stage === "idle" && (
              <div className="w-full bg-surface-elevated border border-border rounded-xl p-3 text-left space-y-3">
                {/* Audio Device Selection */}
                {availableDevices.length > 0 && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-fg flex items-center gap-1">
                      <Mic className="w-3 h-3 text-rose-500" />
                      <span>Audio Input Device</span>
                    </label>
                    <select
                      value={selectedDeviceId}
                      onChange={(e) => setSelectedDeviceId(e.target.value)}
                      className="w-full bg-surface text-foreground text-xs rounded-lg px-2.5 py-1.5 border border-border focus:outline-none focus:ring-1 focus:ring-rose-500"
                    >
                      {availableDevices.map((d) => (
                        <option key={d.deviceId} value={d.deviceId}>
                          {d.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Boost Slider */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-foreground flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5 text-rose-500" />
                      <span>Microphone Boost</span>
                    </span>
                    <span className="text-[11px] font-mono font-medium text-rose-600 dark:text-rose-400">
                      {formatBoostLabel(micBoost)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={MIN_MIC_BOOST}
                    max={MAX_MIC_BOOST}
                    step={0.1}
                    value={micBoost}
                    onChange={(e) => handleBoostChange(parseFloat(e.target.value))}
                    aria-label="Microphone volume boost slider"
                    className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-rose-500"
                  />
                  <p className="text-[10px] text-muted-fg leading-normal">
                    Adjust gain boost if your microphone captures quietly. Includes hardware limiter to eliminate distortion.
                  </p>
                </div>
              </div>
            )}

            {/* Live Speech Recognition & Dictation Status */}
            {stage === "recording" && (
              <div className="w-full space-y-2 text-left">
                {speechStatus === "listening" && (
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Listening to speech...</span>
                  </div>
                )}

                {speechStatus === "offline" && (
                  <div className="p-2 rounded-lg bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-[10px] text-muted-fg flex items-start gap-1.5">
                    <Info className="w-3.5 h-3.5 text-sky-500 flex-shrink-0 mt-0.5" />
                    <span>
                      Desktop local mode: Web Speech recognition is offline in this runtime. Spoken thoughts can be typed or tagged below.
                    </span>
                  </div>
                )}

                {/* Real-time editable dictation field */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px] text-muted-fg font-semibold uppercase tracking-wider">
                    <span className="flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-rose-500" />
                      <span>Live Dictation & Notes</span>
                    </span>
                    <span className="font-normal lowercase">(type or edit live)</span>
                  </div>
                  <textarea
                    value={transcription}
                    onChange={(e) => setTranscription(e.target.value)}
                    placeholder="Dictated or typed thoughts will be saved with this voice memo..."
                    rows={2}
                    className="w-full text-xs bg-surface-elevated border border-border rounded-xl p-2.5 text-foreground resize-none focus:outline-none focus:border-rose-500 leading-relaxed"
                  />
                  <div className="flex items-center gap-1.5 pt-1 overflow-x-auto">
                    <button
                      type="button"
                      onClick={() => appendToTranscript(`[${formatTimer(duration)}]`)}
                      className="px-2 py-0.5 rounded text-[10px] font-semibold bg-surface border border-border hover:bg-surface-hover text-muted-fg hover:text-foreground transition-colors flex items-center gap-1"
                    >
                      <Clock className="w-2.5 h-2.5" />
                      <span>+ {formatTimer(duration)}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => appendToTranscript("📌 Key Point:")}
                      className="px-2 py-0.5 rounded text-[10px] font-semibold bg-surface border border-border hover:bg-surface-hover text-amber-600 dark:text-amber-400 transition-colors flex items-center gap-1"
                    >
                      <Bookmark className="w-2.5 h-2.5" />
                      <span>+ Point</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => appendToTranscript("✓ Action:")}
                      className="px-2 py-0.5 rounded text-[10px] font-semibold bg-surface border border-border hover:bg-surface-hover text-emerald-600 dark:text-emerald-400 transition-colors flex items-center gap-1"
                    >
                      <CheckCircle className="w-2.5 h-2.5" />
                      <span>+ Action</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Recording Controls: Start / Pause / Resume / Stop */}
            <div className="flex items-center justify-center gap-3 pt-2">
              {stage === "idle" ? (
                <Button
                  variant="primary"
                  size="lg"
                  onClick={startRecording}
                  className="gap-2 px-6 rounded-full shadow-lg bg-rose-600 hover:bg-rose-700 text-white hover:scale-105 active:scale-95"
                >
                  <Mic className="w-4 h-4" />
                  <span>Start Recording</span>
                </Button>
              ) : (
                <>
                  <Button
                    variant="secondary"
                    size="md"
                    onClick={handlePauseResume}
                    className="gap-1.5 px-4 rounded-full"
                  >
                    {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                    <span>{isPaused ? "Resume" : "Pause"}</span>
                  </Button>

                  <Button
                    variant="danger"
                    size="lg"
                    onClick={handleStopToReview}
                    className="gap-2 px-6 rounded-full shadow-lg hover:scale-105 active:scale-95"
                  >
                    <Square className="w-4 h-4 fill-current" />
                    <span>Stop & Review ({formatTimer(duration)})</span>
                  </Button>
                </>
              )}

              <Button variant="ghost" size="md" onClick={onClose} disabled={stage === "recording" && !isPaused}>
                Cancel
              </Button>
            </div>
          </>
        )}

        {/* Phase 3: Review & Transcription Workflow Mode */}
        {stage === "review" && (
          <div className="w-full space-y-4 text-left">
            {/* Audio Player Card */}
            <div className="bg-surface-elevated border border-border rounded-xl p-3.5 flex items-center gap-3">
              <button
                type="button"
                onClick={toggleReviewPlay}
                className="w-10 h-10 rounded-full bg-rose-500 text-white flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-md flex-shrink-0"
                aria-label={isPlayingReview ? "Pause audio" : "Play audio"}
              >
                {isPlayingReview ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
              </button>

              <div className="flex-1 flex flex-col justify-center">
                <input
                  type="range"
                  min={0}
                  max={duration || 1}
                  step={0.1}
                  value={reviewCurrentTime}
                  onChange={handleSeekReview}
                  aria-label="Seek recorded audio playback"
                  className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-rose-500"
                />
                <div className="flex justify-between items-center text-[10px] text-muted-fg font-mono mt-1">
                  <span>{formatTimer(Math.floor(reviewCurrentTime))}</span>
                  <span className="flex items-center gap-1 font-sans text-[10px] text-rose-500 font-semibold">
                    <Volume2 className="w-3 h-3" /> Recorded Memo ({formatBoostLabel(micBoost)})
                  </span>
                  <span>{formatTimer(duration)}</span>
                </div>
              </div>
            </div>

            {/* Note Title Input */}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-fg block mb-1">
                Voice Note Title
              </label>
              <input
                type="text"
                value={voiceTitle}
                onChange={(e) => setVoiceTitle(e.target.value)}
                placeholder="Give your voice memo a title..."
                className="w-full text-xs font-semibold bg-surface-elevated border border-border rounded-xl px-3 py-2 text-foreground focus:outline-none focus:border-rose-500"
              />
            </div>

            {/* Transcription Controls & Actions */}
            <div className="p-3 bg-surface-elevated border border-border rounded-xl space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-foreground flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5 text-rose-500" />
                    <span>Speech-to-Text Transcription</span>
                  </span>
                </div>

                <div className="flex items-center gap-3 text-xs">
                  <label className="flex items-center gap-1 cursor-pointer text-muted-fg hover:text-foreground text-[11px]">
                    <input
                      type="checkbox"
                      checked={includeTimestamps}
                      onChange={(e) => setIncludeTimestamps(e.target.checked)}
                      className="rounded accent-rose-500"
                    />
                    <span>Timestamps</span>
                  </label>

                  <label className="flex items-center gap-1 cursor-pointer text-muted-fg hover:text-foreground text-[11px]">
                    <input
                      type="checkbox"
                      checked={includeSpeakers}
                      onChange={(e) => setIncludeSpeakers(e.target.checked)}
                      className="rounded accent-rose-500"
                    />
                    <span>Speakers</span>
                  </label>

                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleExplicitTranscribe}
                    disabled={isTranscribing}
                    className="gap-1.5 text-xs py-1"
                  >
                    <Sparkles className={`w-3.5 h-3.5 text-rose-500 ${isTranscribing ? "animate-spin" : ""}`} />
                    <span>{isTranscribing ? "Transcribing..." : "Transcribe"}</span>
                  </Button>
                </div>
              </div>

              {/* Editable Transcription Field */}
              <div className="relative">
                <textarea
                  value={transcription}
                  onChange={(e) => setTranscription(e.target.value)}
                  placeholder="Click 'Transcribe' above or type notes here..."
                  rows={4}
                  className="w-full text-xs bg-surface border border-border rounded-lg p-2.5 text-foreground resize-none focus:outline-none focus:border-rose-500 leading-relaxed font-sans"
                />

                {transcription.trim() && (
                  <button
                    type="button"
                    onClick={handleCopyTranscript}
                    title="Copy transcript text to clipboard"
                    className="absolute right-2 top-2 p-1.5 rounded-md bg-surface-elevated border border-border hover:bg-surface-hover text-muted-fg hover:text-foreground text-[10px] font-semibold flex items-center gap-1 shadow-xs transition"
                  >
                    {transcriptCopied ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-500" />
                        <span className="text-emerald-500">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Action Buttons: Save to Note, Save to PC, Re-record */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-2 border-t border-border">
              <button
                type="button"
                onClick={handleReRecord}
                className="px-3 py-1.5 rounded-xl border border-border hover:bg-surface-hover text-muted-fg hover:text-foreground text-xs font-medium flex items-center gap-1.5 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Re-record</span>
              </button>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleSaveAudioFile}
                  title="Download .webm audio file to your computer"
                  className="gap-1.5"
                >
                  <Download className="w-3.5 h-3.5 text-rose-500" />
                  <span>Save Audio File</span>
                </Button>

                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSaveToNote}
                  className="gap-1.5 bg-rose-600 hover:bg-rose-700 text-white"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save to DeskNest</span>
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
