"use client";

import * as React from "react";
import { Pause, Play, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { formatSeconds } from "@/lib/utils";

export interface AudioPlayerProps {
  src?: string | null;
  title?: string;
  autoPlay?: boolean;
  /** Expose a toggle handle so parent (SlideViewer) can pause/play on tap */
  onToggleRef?: React.MutableRefObject<(() => void) | null>;
  /** Called whenever playing state changes */
  onPlayingChange?: (playing: boolean) => void;
}

const SPEEDS = [0.75, 1, 1.25, 1.5, 2] as const;

export function AudioPlayer({
  src,
  title = "Lesson narration",
  autoPlay = false,
  onToggleRef,
  onPlayingChange,
}: AudioPlayerProps) {
  const audioRef = React.useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = React.useState(false);
  const [current, setCurrent] = React.useState(0);
  const [duration, setDuration] = React.useState(0);
  const [speed, setSpeed] = React.useState<number>(1);
  // Resolved presigned URL — fetched with auth headers, blob URL passed to <audio>
  const [resolvedSrc, setResolvedSrc] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!src) { setResolvedSrc(null); return; }
    let objectUrl: string | null = null;
    const token = typeof window !== 'undefined' ? (localStorage.getItem('guidian.access_token') ?? '') : '';
    fetch(src, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => { if (!res.ok) throw new Error('audio fetch failed'); return res.blob(); })
      .then(blob => { objectUrl = URL.createObjectURL(blob); setResolvedSrc(objectUrl); })
      .catch((e) => { console.error('AudioPlayer fetch failed:', e); setResolvedSrc(null); });
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [src]);

  const setPlayingState = (val: boolean) => {
    setPlaying(val);
    onPlayingChange?.(val);
  };

  React.useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime = () => setCurrent(Math.floor(a.currentTime));
    const onMeta = () => {
      setDuration(Math.floor(a.duration || 0));
      if (autoPlay) {
        a.play().then(() => setPlayingState(true)).catch(() => {});
      }
    };
    const onEnd = () => setPlayingState(false);
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("loadedmetadata", onMeta);
    a.addEventListener("ended", onEnd);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("loadedmetadata", onMeta);
      a.removeEventListener("ended", onEnd);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, autoPlay]);

  React.useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = speed;
  }, [speed]);

  const toggle = React.useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) {
      a.pause();
      setPlayingState(false);
    } else {
      a.play().then(() => setPlayingState(true)).catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  // Expose toggle to parent via ref
  React.useEffect(() => {
    if (onToggleRef) onToggleRef.current = toggle;
  }, [toggle, onToggleRef]);

  const pct = duration ? (current / duration) * 100 : 0;

  return (
    <div className="flex items-center gap-3 px-2">
      {resolvedSrc ? (
        <>
          <audio ref={audioRef} src={resolvedSrc} preload="metadata" />
          <Button
            size="icon"
            variant="ghost"
            onClick={toggle}
            aria-label={playing ? "Pause" : "Play"}
            className="shrink-0 h-9 w-9 rounded-full bg-amber text-white hover:bg-amber-light"
          >
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
          <div className="flex-1 min-w-0">
            <Progress value={pct} className="h-1.5" />
            <div className="mt-1 flex justify-between text-xs text-muted-foreground">
              <span>{formatSeconds(current)}</span>
              <span>{formatSeconds(duration)}</span>
            </div>
          </div>
          <div className="flex gap-1 shrink-0">
            {SPEEDS.map((s) => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className={`rounded px-1.5 py-0.5 text-xs font-medium transition-colors ${
                  s === speed
                    ? "bg-navy text-white"
                    : "text-steel hover:text-navy"
                }`}
              >
                {s}x
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Volume2 className="h-3.5 w-3.5" />
          <span>{src ? 'Loading audio…' : 'Audio generating…'}</span>
        </div>
      )}
    </div>
  );
}
