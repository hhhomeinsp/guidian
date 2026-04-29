"use client";

import * as React from "react";
import { ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface DiagramProps {
  mermaid: string;
  id?: string;
  className?: string;
}

/**
 * Mermaid renderer. Uses dynamic import to keep mermaid out of the SSR bundle.
 * Supports zoom via CSS transform (no pan — keep it simple).
 */
export function Diagram({ mermaid, id, className }: DiagramProps) {
  const [svg, setSvg] = React.useState<string | null>(null);
  const [zoom, setZoom] = React.useState(1);
  const [error, setError] = React.useState<string | null>(null);
  const uid = React.useId().replace(/:/g, "");

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mod = await import("mermaid");
        const mermaidLib = mod.default;
        mermaidLib.initialize({
          startOnLoad: false,
          theme:
            typeof document !== "undefined" && document.documentElement.classList.contains("dark")
              ? "dark"
              : "default",
          securityLevel: "strict",
        });
        const { svg: rendered } = await mermaidLib.render(`m-${id ?? uid}`, mermaid);
        if (!cancelled) setSvg(rendered);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.mesnova : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mermaid, id, uid]);

  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card p-4",
        className,
      )}
    >
      <div className="mb-2 flex items-center justify-end gap-2">
        <Button variant="outline" size="icon" onClick={() => setZoom((z) => Math.max(0.5, z - 0.1))}>
          <ZoomOut className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" onClick={() => setZoom(1)}>
          <RotateCcw className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" onClick={() => setZoom((z) => Math.min(3, z + 0.1))}>
          <ZoomIn className="h-4 w-4" />
        </Button>
      </div>
      <div className="overflow-auto">
        {error ? (
          <pre className="text-sm text-red-500">{error}</pre>
        ) : svg ? (
          <div
            style={{ transform: `scale(${zoom})`, transformOrigin: "top left" }}
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        ) : (
          <p className="text-sm text-muted-foreground">Rendering diagram…</p>
        )}
      </div>
    </div>
  );
}
