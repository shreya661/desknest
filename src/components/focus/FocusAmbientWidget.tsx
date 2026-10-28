import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  CloudRain,
  Waves,
  Flame,
  Wind,
  Headphones,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { ambientAudioService, SoundscapeType } from "../../services/ambientAudioService";
import { soundEffects } from "../../services/soundEffectsService";
import { triggerConfetti } from "../../utils/confetti";

interface FocusAmbientWidgetProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FocusAmbientWidget: React.FC<FocusAmbientWidgetProps> = ({
  isOpen,
  onClose,
}) => {
  // Timer State
  const [timerMode, setTimerMode] = useState<"focus" | "shortBreak" | "longBreak">("focus");
  const [timeLeft, setTimeLeft] = useState<number>(25 * 60);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [sessionsCompleted, setSessionsCompleted] = useState<number>(0);

  // Ambient Audio State
  const [activeSound, setActiveSound] = useState<SoundscapeType | null>(null);
  const [isPlayingSound, setIsPlayingSound] = useState<boolean>(false);
  const [volume, setVolume] = useState<number>(0.4);

  const timerRef = useRef<number | null>(null);

  // Handle Timer Countdown
  useEffect(() => {
    if (isRunning) {
      timerRef.current = window.setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            setIsRunning(false);
            soundEffects.playTaskComplete();
            triggerConfetti();

            if (timerMode === "focus") {
              setSessionsCompleted((s) => s + 1);
              // Auto switch to short break
              setTimerMode("shortBreak");
              return 5 * 60;
            } else {
              setTimerMode("focus");
              return 25 * 60;
            }
          }
          return prev - 1;
        });
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning, timerMode]);

  const setMode = (mode: "focus" | "shortBreak" | "longBreak") => {
    setIsRunning(false);
    setTimerMode(mode);
    if (mode === "focus") setTimeLeft(25 * 60);
    else if (mode === "shortBreak") setTimeLeft(5 * 60);
    else if (mode === "longBreak") setTimeLeft(15 * 60);
    soundEffects.playPop();
  };

  const toggleTimer = () => {
    setIsRunning(!isRunning);
    soundEffects.playPop();
  };

  const resetTimer = () => {
    setIsRunning(false);
    if (timerMode === "focus") setTimeLeft(25 * 60);
    else if (timerMode === "shortBreak") setTimeLeft(5 * 60);
    else if (timerMode === "longBreak") setTimeLeft(15 * 60);
    soundEffects.playPop();
  };

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    return `${mins.toString().padStart(2, "0")}:${rem.toString().padStart(2, "0")}`;
  };

  const totalTimeForMode =
    timerMode === "focus" ? 25 * 60 : timerMode === "shortBreak" ? 5 * 60 : 15 * 60;
  const progressPercent = Math.round(((totalTimeForMode - timeLeft) / totalTimeForMode) * 100);

  // Soundscape handlers
  const handleToggleSound = (type: SoundscapeType) => {
    if (activeSound === type && isPlayingSound) {
      ambientAudioService.stop();
      setIsPlayingSound(false);
      setActiveSound(null);
    } else {
      ambientAudioService.play(type);
      setActiveSound(type);
      setIsPlayingSound(true);
    }
    soundEffects.playPop();
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    ambientAudioService.setVolume(val);
  };

  const soundOptions: { type: SoundscapeType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { type: "rain", label: "Rainfall", icon: CloudRain },
    { type: "waves", label: "Waves", icon: Waves },
    { type: "campfire", label: "Campfire", icon: Flame },
    { type: "wind", label: "Breeze", icon: Wind },
    { type: "whitenoise", label: "Focus Noise", icon: Headphones },
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-muted/40">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-indigo-500/15 text-indigo-500">
              <Sparkles className="w-4 h-4 animate-spin-slow" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-foreground">Focus Sanctuary & Soundscapes</h3>
              <p className="text-[11px] text-muted-fg">Stay in the zone with Pomodoro & ambient audio</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-muted text-muted-fg hover:text-foreground transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Section 1: Pomodoro Timer */}
          <div className="bg-muted/30 border border-border rounded-xl p-4 flex flex-col items-center">
            {/* Mode Selector Tabs */}
            <div className="flex items-center gap-1 bg-surface-elevated p-1 rounded-lg border border-border text-xs mb-4">
              <button
                onClick={() => setMode("focus")}
                className={`px-3 py-1 rounded-md font-medium transition-all ${
                  timerMode === "focus"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-fg hover:text-foreground"
                }`}
              >
                Focus (25m)
              </button>
              <button
                onClick={() => setMode("shortBreak")}
                className={`px-3 py-1 rounded-md font-medium transition-all ${
                  timerMode === "shortBreak"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-fg hover:text-foreground"
                }`}
              >
                Short Break (5m)
              </button>
              <button
                onClick={() => setMode("longBreak")}
                className={`px-3 py-1 rounded-md font-medium transition-all ${
                  timerMode === "longBreak"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-fg hover:text-foreground"
                }`}
              >
                Long Break (15m)
              </button>
            </div>

            {/* Big Countdown Timer */}
            <div className="relative my-2 text-center">
              <div className="text-5xl font-extrabold tracking-tight font-mono text-foreground">
                {formatTime(timeLeft)}
              </div>
              <div className="text-[11px] text-muted-fg mt-1 flex items-center justify-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                <span>{sessionsCompleted} focus intervals completed today</span>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden my-3">
              <div
                className="h-full bg-gradient-to-r from-sky-500 to-indigo-500 transition-all duration-300 rounded-full"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            {/* Controls */}
            <div className="flex items-center gap-2 mt-1">
              <button
                onClick={toggleTimer}
                className="px-5 py-2 rounded-xl bg-primary text-primary-foreground font-semibold text-xs flex items-center gap-1.5 shadow-md hover:scale-105 active:scale-95 transition-all"
              >
                {isRunning ? (
                  <>
                    <Pause className="w-4 h-4 fill-current" />
                    <span>Pause</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current" />
                    <span>Start Focus</span>
                  </>
                )}
              </button>
              <button
                onClick={resetTimer}
                title="Reset timer"
                className="p-2 rounded-xl border border-border hover:bg-surface-hover text-muted-fg hover:text-foreground transition-colors"
                aria-label="Reset timer"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Section 2: Ambient Soundscape Generator */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-fg flex items-center gap-1">
                <Headphones className="w-3.5 h-3.5 text-indigo-400" />
                Offline Ambient Soundscapes
              </span>
              {isPlayingSound && (
                <div className="flex items-center gap-1 text-[10px] text-emerald-500 font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  <span>Playing {activeSound}</span>
                </div>
              )}
            </div>

            {/* Sound Preset Buttons */}
            <div className="grid grid-cols-5 gap-1.5 mb-3">
              {soundOptions.map((opt) => {
                const Icon = opt.icon;
                const isActive = activeSound === opt.type && isPlayingSound;
                return (
                  <button
                    key={opt.type}
                    onClick={() => handleToggleSound(opt.type)}
                    className={`flex flex-col items-center justify-center p-2 rounded-xl border transition-all ${
                      isActive
                        ? "bg-indigo-500/15 border-indigo-500 text-indigo-600 dark:text-indigo-400 font-semibold shadow-xs scale-102"
                        : "border-border hover:bg-surface-hover text-muted-fg hover:text-foreground"
                    }`}
                  >
                    <Icon className={`w-4 h-4 mb-1 ${isActive ? "animate-pulse" : ""}`} />
                    <span className="text-[10px]">{opt.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Volume Slider */}
            <div className="flex items-center gap-2 px-1">
              {volume === 0 ? (
                <VolumeX className="w-3.5 h-3.5 text-muted-fg" />
              ) : (
                <Volume2 className="w-3.5 h-3.5 text-muted-fg" />
              )}
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={volume}
                onChange={handleVolumeChange}
                className="flex-1 h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
              <span className="text-[10px] text-muted-fg w-7 text-right">
                {Math.round(volume * 100)}%
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border bg-muted/30 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-secondary hover:bg-secondary/80 text-foreground text-xs font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
