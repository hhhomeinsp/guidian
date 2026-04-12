"use client";

import { create } from "zustand";
import type { LearningStyle } from "@/lib/api/schema";

interface LearnerState {
  preferredStyle: LearningStyle;
  styleVector: number[] | null;
  hydrated: boolean;
  setPreferredStyle: (s: LearningStyle) => void;
  hydrate: (args: { preferredStyle: LearningStyle; styleVector: number[] | null }) => void;
  variantServed: Record<string, LearningStyle>;
  recordVariant: (lessonId: string, variant: LearningStyle) => void;
}

export const useLearnerStore = create<LearnerState>((set) => ({
  preferredStyle: "read",
  styleVector: null,
  hydrated: false,
  setPreferredStyle: (preferredStyle) => set({ preferredStyle }),
  hydrate: ({ preferredStyle, styleVector }) =>
    set({ preferredStyle, styleVector, hydrated: true }),
  variantServed: {},
  recordVariant: (lessonId, variant) =>
    set((state) => ({
      variantServed: { ...state.variantServed, [lessonId]: variant },
    })),
}));
