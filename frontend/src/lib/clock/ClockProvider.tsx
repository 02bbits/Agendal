"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import type { Clock } from "./types";
import { SystemClock } from "./system-clock";

const ClockContext = createContext<Clock | null>(null);

export function ClockProvider({
  children,
  clock,
}: {
  children: ReactNode;
  clock?: Clock;
}) {
  const [systemClock] = useState(() => new SystemClock());
  return (
    <ClockContext.Provider value={clock ?? systemClock}>
      {children}
    </ClockContext.Provider>
  );
}

export function useClock(): Clock {
  const clock = useContext(ClockContext);
  if (!clock) throw new Error("useClock requires a ClockProvider");
  return clock;
}
