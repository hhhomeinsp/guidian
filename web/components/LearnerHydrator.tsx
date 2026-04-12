"use client";

import { useEffect } from "react";
import { useLearnerProfile, useMe } from "@/lib/api/hooks";
import { useLearnerStore } from "@/lib/store/learner";

/**
 * Mount once in the root layout. When the user is authenticated, fetches the
 * learner profile and pushes `preferred_style` + `style_vector` into the
 * Zustand store so the AdaptiveRenderer reads a live, server-derived preference
 * rather than the hard-coded fallback.
 */
export function LearnerHydrator() {
  const me = useMe();
  const profile = useLearnerProfile();
  const hydrate = useLearnerStore((s) => s.hydrate);

  useEffect(() => {
    if (me.data && profile.data) {
      hydrate({
        preferredStyle: profile.data.preferred_style,
        styleVector: profile.data.style_vector,
      });
    }
  }, [me.data, profile.data, hydrate]);

  return null;
}
