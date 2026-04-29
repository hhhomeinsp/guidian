
"use client";

import { NovaVoice } from "@/components/NovaVoice";
import { useMe } from "@/lib/api/hooks";

export function NovaGate() {
  const me = useMe();
  if (!me.data) return null;
  return <NovaVoice />;
}
