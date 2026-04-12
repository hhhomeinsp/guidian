import * as React from "react";
import { cn } from "@/lib/utils";

export interface VideoEmbedProps {
  src: string;
  title?: string;
  aspect?: "16/9" | "4/3" | "1/1";
  className?: string;
}

/**
 * Responsive iframe wrapper. Works with YouTube, Vimeo, and direct MP4 (via <video>).
 */
export function VideoEmbed({ src, title = "Lesson video", aspect = "16/9", className }: VideoEmbedProps) {
  const ratioClass =
    aspect === "16/9" ? "aspect-video" : aspect === "4/3" ? "aspect-[4/3]" : "aspect-square";

  const isFile = /\.(mp4|webm|ogg)(\?|$)/i.test(src);

  return (
    <div className={cn("overflow-hidden rounded-lg border border-border bg-black", ratioClass, className)}>
      {isFile ? (
        <video src={src} controls className="h-full w-full" title={title} />
      ) : (
        <iframe
          src={src}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="h-full w-full"
        />
      )}
    </div>
  );
}
