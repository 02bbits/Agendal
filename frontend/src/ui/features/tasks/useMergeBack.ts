import { useCallback, useEffect, useRef, useState } from "react";

/** The done row rises and fades at least this long while the server answers. */
export const MERGE_OUT_MS = 260;
/** The open row it went back into lights up this long. */
export const MERGE_IN_MS = 800;

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
 * Unticking a done occurrence of a repeating task in a Completed list (#168): its row rises and
 * fades (`leaving`) while the server answers. `settle` applies the answer and names the open row
 * to light up (`arriving`), if any. With reduced motion the row doesn't wait.
 */
export function useMergeBack() {
  const [leaving, setLeaving] = useState<Flags>(new Set());
  const [arriving, setArriving] = useState<Flags>(new Set());
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());

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
      setLeaving((flags) => withFlag(flags, id, true));
      const shown = new Promise<void>((done) =>
        later(reducedMotion() ? 0 : MERGE_OUT_MS, done),
      );
      Promise.all([request(), shown]).then(
        ([result]) => {
          const lit = settle(result);
          setLeaving((flags) => withFlag(flags, id, false));
          if (!lit) return;
          setArriving((flags) => withFlag(flags, lit, true));
          later(MERGE_IN_MS, () =>
            setArriving((flags) => withFlag(flags, lit, false)),
          );
        },
        (error: unknown) => {
          setLeaving((flags) => withFlag(flags, id, false));
          fail(error);
        },
      );
    },
    [later],
  );

  return { mergeBack, leaving, arriving };
}
