"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface ScenarioNode {
  id: string;
  prompt: string;
  choices?: { label: string; nextId: string; feedback?: string }[];
  terminal?: { outcome: "success" | "failure" | "neutral"; message: string };
}

export interface ScenarioProps {
  title?: string;
  startId: string;
  nodes: ScenarioNode[];
  onComplete?: (path: string[], outcome: "success" | "failure" | "neutral") => void;
}

export function Scenario({ title = "Scenario", startId, nodes, onComplete }: ScenarioProps) {
  const nodeMap = React.useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const [currentId, setCurrentId] = React.useState(startId);
  const [path, setPath] = React.useState<string[]>([startId]);
  const current = nodeMap.get(currentId);

  React.useEffect(() => {
    if (current?.terminal) onComplete?.(path, current.terminal.outcome);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentId]);

  const reset = () => {
    setCurrentId(startId);
    setPath([startId]);
  };

  if (!current) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <AnimatePresence mode="wait">
          <motion.div
            key={currentId}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            <p className="text-base leading-relaxed">{current.prompt}</p>

            {current.terminal ? (
              <div
                className={
                  "rounded-md border p-4 text-sm " +
                  (current.terminal.outcome === "success"
                    ? "border-emerald-500/40 bg-emerald-500/10"
                    : current.terminal.outcome === "failure"
                      ? "border-red-500/40 bg-red-500/10"
                      : "border-border bg-muted")
                }
              >
                <p className="font-semibold capitalize">{current.terminal.outcome}</p>
                <p className="mt-1">{current.terminal.message}</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={reset}>
                  Restart scenario
                </Button>
              </div>
            ) : (
              <div className="grid gap-2">
                {current.choices?.map((c) => (
                  <Button
                    key={c.nextId + c.label}
                    variant="outline"
                    className="justify-start"
                    onClick={() => {
                      setCurrentId(c.nextId);
                      setPath((p) => [...p, c.nextId]);
                    }}
                  >
                    {c.label}
                  </Button>
                ))}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}
