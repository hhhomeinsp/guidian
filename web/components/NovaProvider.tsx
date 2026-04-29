"use client";

import * as React from "react";

interface NovaContextValue {
  courseId: string | null;
  lessonTitle: string | null;
  setNovaContext: (courseId: string | null, lessonTitle: string | null) => void;
  activateNova: (() => void) | null;
  setActivateNova: (fn: (() => void) | null) => void;
}

const NovaContext = React.createContext<NovaContextValue>({
  courseId: null,
  lessonTitle: null,
  setNovaContext: () => {},
  activateNova: null,
  setActivateNova: () => {},
});

export function NovaProvider({ children }: { children: React.ReactNode }) {
  const [courseId, setCourseId] = React.useState<string | null>(null);
  const [lessonTitle, setLessonTitle] = React.useState<string | null>(null);
  const [activateNova, setActivateNova] = React.useState<(() => void) | null>(null);

  const setNovaContext = React.useCallback(
    (cid: string | null, title: string | null) => {
      setCourseId(cid);
      setLessonTitle(title);
    },
    [],
  );

  return (
    <NovaContext.Provider value={{ courseId, lessonTitle, setNovaContext, activateNova, setActivateNova }}>
      {children}
    </NovaContext.Provider>
  );
}

export function useNovaContext() {
  return React.useContext(NovaContext);
}
