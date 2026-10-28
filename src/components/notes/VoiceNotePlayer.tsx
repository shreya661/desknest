import React, { useState, useRef, useEffect } from "react";
import { Play, Pause, Trash2, Download, Mic, FileText } from "lucide-react";
import { VoiceRecording } from "../../types";

interface VoiceNotePlayerProps {
  recording: VoiceRecording;
  onDelete: (id: string) => void;
  onAppendTranscription?: (text: string) => void;
}

export const VoiceNotePlayer: React.FC<VoiceNotePlayerProps> = ({
  recording,
  onDelete,
  onAppendTranscription,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [showTranscription, setShowTranscription] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = new Audio(recording.audioData);
    audioRef.current = audio;

    audio.ontimeupdate = () => {
      setCurrentTime(audio.currentTime);
    };

    audio.onended = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    return () => {
      audio.pause();
      audioRef.current = null;
    };
  }, [recording.audioData]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = Number(e.target.value);
    setCurrentTime(time);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  };

  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = recording.audioData;
    link.download = `voice-memo-${new Date(recording.createdAt).toISOString().slice(0, 10)}.webm`;
    link.click();
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  const duration = recording.durationSeconds || (audioRef.current?.duration ? Math.floor(audioRef.current.duration) : 0);

  return (
    <div className="bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl p-2.5 my-1.5 space-y-1.5 transition-all select-none">
      <div className="flex items-center gap-2">
        {/* Play/Pause Button */}
        <button
          type="button"
          onClick={togglePlay}
          className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-xs flex-shrink-0"
          aria-label={isPlaying ? "Pause audio" : "Play audio"}
        >
          {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
        </button>

        {/* Progress Slider & Waveform Simulation */}
        <div className="flex-1 flex flex-col justify-center">
          <input
            type="range"
            min={0}
            max={duration || 1}
            step={0.1}
            value={currentTime}
            onChange={handleSeek}
            className="w-full h-1 bg-black/20 dark:bg-white/20 rounded-lg appearance-none cursor-pointer accent-primary"
          />
          <div className="flex justify-between items-center text-[10px] text-muted-fg font-mono mt-1">
            <span>{formatTime(currentTime)}</span>
            <span className="flex items-center gap-1 font-sans text-[10px]">
              <Mic className="w-2.5 h-2.5 text-primary" />
              Voice Memo
            </span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Actions: Transcribe, Download, Delete */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {recording.transcription && (
            <button
              type="button"
              onClick={() => setShowTranscription(!showTranscription)}
              title="Show / Hide transcription"
              className={`p-1 rounded text-muted-fg hover:text-foreground transition-colors ${
                showTranscription ? "text-primary font-bold" : ""
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            type="button"
            onClick={handleDownload}
            title="Download voice memo (.webm)"
            className="p-1 rounded text-muted-fg hover:text-foreground transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => onDelete(recording.id)}
            title="Delete voice memo"
            className="p-1 rounded text-muted-fg hover:text-rose-500 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Transcription View */}
      {showTranscription && recording.transcription && (
        <div className="p-2 bg-black/10 dark:bg-white/10 rounded-lg text-xs text-foreground/90 italic flex items-center justify-between gap-2 animate-in fade-in">
          <span>"{recording.transcription}"</span>
          {onAppendTranscription && (
            <button
              type="button"
              onClick={() => onAppendTranscription(recording.transcription!)}
              className="text-[10px] text-primary hover:underline font-semibold flex-shrink-0"
            >
              Insert into note
            </button>
          )}
        </div>
      )}
    </div>
  );
};
