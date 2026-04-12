"use client";

import * as React from "react";
import { Pause, Play, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { formatSeconds } from "@/lib/utils";

export interface AudioPlayerProps {
  src?: string | null;
  title?: string;
}

const SPEEDS = [0.75, 1, 1.25, 1.5, 2] as const;

export function AudioPlayer({ src, title = "Lesson narration" }: AudioPlayerProps) {
  const audioRef = React.useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = React.useState(false);
  const [current, setCurrent] = React.useState(0);
  const [duration, setDuration] = React.useState(0);
  const [speed, setSpeed] = React.useState<number>(1);

  React.useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime = () => setCurrent(Math.floor(a.currentTime));
    const onMeta = () => setDuration(Math.floor(a.duration || 0));
    const onEnd = () => setPlaying(false);
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("loadedmetadata", onMeta);
    a.addEventListener("ended", onEnd);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("loadedmetadata", onMeta);
      a.removeEventListener("ended", onEnd);
    };
  }, [src]);

  React.useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = speed;
  }, [speed]);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) {
      a.pause();
      setPlaying(false);
    } else {
      a.play();
      setPlaying(true);
    }
  };

  const pct = duration ? (current / duration) * 100 : 0;

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-center gap-2 text-sm">
        <Volume2 className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium">{title}</span>
      </div>
      {src ? (
        <>
          <audio ref={audioRef} src={src} preload="metadata" />
          <div className="flex items-center gap-3">
            <Button size="icon" variant="outline" onClick={toggle} aria-label={playing ? "Pause" : "Play"}>
              {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>
            <div className="flex-1">
              <Progress value={pct} />
              <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                <span>{formatSeconds(current)}</span>
                <span>{formatSeconds(duration)}</span>
              </div>
            </div>
            <div className="flex gap-1">
              {SPEEDS.map((s) => (
                <Button
                  key={s}
                  variant={s === speed ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSpeed(s)}
                >
                  {s}x
                </Button>
              ))}
            </div>
          </div>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">No audio generated yet.</p>
      )}
    </div>
  );
}
