"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface FlashcardItem {
  id: string;
  front: React.ReactNode;
  back: React.ReactNode;
}

export type SRSRating = "again" | "hard" | "good" | "easy";

export interface FlashcardProps {
  cards: FlashcardItem[];
  onRate?: (cardId: string, rating: SRSRating) => void;
}

export function Flashcard({ cards, onRate }: FlashcardProps) {
  const [index, setIndex] = React.useState(0);
  const [flipped, setFlipped] = React.useState(false);
  const card = cards[index];

  if (!card) return <p className="text-muted-foreground">Deck complete.</p>;

  const rate = (rating: SRSRating) => {
    onRate?.(card.id, rating);
    setFlipped(false);
    setIndex((i) => i + 1);
  };

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground">
        Card {index + 1} / {cards.length}
      </div>
      <div
        className="perspective-1000 h-56 cursor-pointer select-none"
        onClick={() => setFlipped((f) => !f)}
      >
        <motion.div
          className="relative h-full w-full"
          style={{ transformStyle: "preserve-3d" }}
          animate={{ rotateY: flipped ? 180 : 0 }}
          transition={{ duration: 0.45 }}
        >
          <Face className="bg-card">{card.front}</Face>
          <Face className="bg-secondary" back>
            {card.back}
          </Face>
        </motion.div>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {(["again", "hard", "good", "easy"] as const).map((r) => (
          <Button key={r} variant="outline" size="sm" onClick={() => rate(r)} disabled={!flipped}>
            {r}
          </Button>
        ))}
      </div>
    </div>
  );
}

function Face({
  children,
  className,
  back = false,
}: {
  children: React.ReactNode;
  className?: string;
  back?: boolean;
}) {
  return (
    <div
      className={cn(
        "absolute inset-0 flex items-center justify-center rounded-lg border border-border p-6 text-center text-lg font-medium shadow-sm",
        className,
      )}
      style={{ backfaceVisibility: "hidden", transform: back ? "rotateY(180deg)" : undefined }}
    >
      {children}
    </div>
  );
}
