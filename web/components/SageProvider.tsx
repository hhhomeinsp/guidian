"use client";

import * as React from "react";

interface SageContextValue {
  courseId: string | null;
  lessonTitle: string | null;
  setSageContext: (courseId: string | null, lessonTitle: string | null) => void;
  activateSage: (() => void) | null;
  setActivateSage: (fn: (() => void) | null) => void;
}

const SageContext = React.createContext<SageContextValue>({
  courseId: null,
  lessonTitle: null,
  setSageContext: () => {},
  activateSage: null,
  setActivateSage: () => {},
});

export function SageProvider({ children }: { children: React.ReactNode }) {
  const [courseId, setCourseId] = React.useState<string | null>(null);
  const [lessonTitle, setLessonTitle] = React.useState<string | null>(null);
  const [activateSage, setActivateSage] = React.useState<(() => void) | null>(null);

  const setSageContext = React.useCallback(
    (cid: string | null, title: string | null) => {
      setCourseId(cid);
      setLessonTitle(title);
    },
    [],
  );

  return (
    <SageContext.Provider value={{ courseId, lessonTitle, setSageContext, activateSage, setActivateSage }}>
      {children}
    </SageContext.Provider>
  );
}

export function useSageContext() {
  return React.useContext(SageContext);
}
