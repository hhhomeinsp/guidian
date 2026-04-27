"use client";

import * as React from "react";
import { Pause, Play, Volume2 } from "lucide-react";
import { formatSeconds } from "@/lib/utils";

export interface AudioPlayerProps {
  src?: string | null;
  autoPlay?: boolean;
  onToggleRef?: React.MutableRefObject<(() => void) | null>;
  onPlayingChange?: (playing: boolean) => void;
}

const SPEEDS = [0.75, 1, 1.25, 1.5, 2] as const;

export function AudioPlayer({ src, autoPlay = false, onToggleRef, onPlayingChange }: AudioPlayerProps) {
  const audioRef = React.useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = React.useState(false);
  const [current, setCurrent] = React.useState(0);
  const [duration, setDuration] = React.useState(0);
  const [speed, setSpeed] = React.useState(1);

  React.useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime  = () => setCurrent(Math.floor(a.currentTime));
    const onMeta  = () => { setDuration(Math.floor(a.duration || 0)); if (autoPlay) a.play().catch(() => {}); };
    const onPlay  = () => { setPlaying(true);  onPlayingChange?.(true);  };
    const onPause = () => { setPlaying(false); onPlayingChange?.(false); };
    const onEnd   = () => { setPlaying(false); onPlayingChange?.(false); };
    a.addEventListener("timeupdate",    onTime);
    a.addEventListener("loadedmetadata", onMeta);
    a.addEventListener("play",          onPlay);
    a.addEventListener("pause",         onPause);
    a.addEventListener("ended",         onEnd);
    return () => {
      a.removeEventListener("timeupdate",    onTime);
      a.removeEventListener("loadedmetadata", onMeta);
      a.removeEventListener("play",          onPlay);
      a.removeEventListener("pause",         onPause);
      a.removeEventListener("ended",         onEnd);
    };
  }, [autoPlay, onPlayingChange]);

  React.useEffect(() => { if (audioRef.current) audioRef.current.playbackRate = speed; }, [speed]);

  const toggle = React.useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) a.play().catch(() => {}); else a.pause();
  }, []);

  React.useEffect(() => { if (onToggleRef) onToggleRef.current = toggle; }, [toggle, onToggleRef]);

  const pct = duration > 0 ? (current / duration) * 100 : 0;

  if (!src) return null;

  return (
    <div className="flex items-center gap-3 px-2">
      {/* Audio element — src is the public /audio redirect endpoint */}
      <audio ref={audioRef} src={src} preload="metadata" />

      <button
        onClick={toggle}
        aria-label={playing ? "Pause" : "Play"}
        className="shrink-0 flex h-9 w-9 items-center justify-center rounded-full bg-amber text-white hover:bg-amber-light active:scale-95 transition-transform"
      >
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 translate-x-px" />}
      </button>

      <div className="flex-1 min-w-0">
        <div className="relative h-1.5 w-full rounded-full bg-muted overflow-hidden">
          <div className="absolute inset-y-0 left-0 bg-amber rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-1 flex justify-between text-xs text-muted-foreground">
          <span>{formatSeconds(current)}</span>
          <span>{formatSeconds(duration)}</span>
        </div>
      </div>

      <div className="flex gap-1 shrink-0">
        {SPEEDS.map((s) => (
          <button key={s} onClick={() => setSpeed(s)}
            className={`rounded px-1.5 py-0.5 text-xs font-medium transition-colors ${s === speed ? "bg-navy text-white" : "text-steel hover:text-navy"}`}>
            {s}x
          </button>
        ))}
      </div>
    </div>
  );
}
