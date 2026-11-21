import { useCallback, useEffect, useRef, useState } from "react";

/** The done row rises and fades at least this long while the server answers. */
export const MERGE_OUT_MS = 260;
/** The open row it went back into lights up this long. */
export const MERGE_IN_MS = 1400;

const reducedMotion = () =>
  typeof window !== "undefined" &&
  Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);

type Flags = ReadonlySet<string>;
const withFlag = (flags: Flags, id: string, on: boolean): Flags => {
  const next = new Set(flags);
  if (on) next.add(id);
  else next.delete(id);
  return next;
};

/**
 * Unticking a done occurrence of a repeating task in a Completed list (#168). With `motion` (a
 * project's page) its row rises and fades (`leaving`) while the server answers, and the open row
 * it went back into gets the tick's swipe (`arriving`); elsewhere the rows just change. Either way
 * `settle` applies the answer, and a second tap waits until it has (`isBusy`). With reduced
 * motion the row doesn't wait.
 */
export function useMergeBack(motion: boolean) {
  const [leaving, setLeaving] = useState<Flags>(new Set());
  const [arriving, setArriving] = useState<Flags>(new Set());
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const inFlight = useRef(new Set<string>());

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  const later = useCallback((ms: number, run: () => void) => {
    const timer = setTimeout(() => {
      timers.current.delete(timer);
      run();
    }, ms);
    timers.current.add(timer);
  }, []);

  const mergeBack = useCallback(
    <R>(
      id: string,
      request: () => Promise<R>,
      settle: (result: R) => string | null,
      fail: (error: unknown) => void,
    ) => {
      inFlight.current.add(id);
      if (motion) setLeaving((flags) => withFlag(flags, id, true));
      const shown = new Promise<void>((done) =>
        later(motion && !reducedMotion() ? MERGE_OUT_MS : 0, done),
      );
      const finish = () => {
        inFlight.current.delete(id);
        if (motion) setLeaving((flags) => withFlag(flags, id, false));
      };
      Promise.all([request(), shown]).then(
        ([result]) => {
          const lit = settle(result);
          finish();
          if (!lit || !motion) return;
          setArriving((flags) => withFlag(flags, lit, true));
          later(MERGE_IN_MS, () =>
            setArriving((flags) => withFlag(flags, lit, false)),
          );
        },
        (error: unknown) => {
          finish();
          fail(error);
        },
      );
    },
    [later, motion],
  );

  const isBusy = useCallback((id: string) => inFlight.current.has(id), []);

  return { mergeBack, isBusy, leaving, arriving };
}
