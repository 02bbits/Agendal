export const EASE_SOFT_OUT = [0.215, 0.61, 0.355, 1] as const;

/** A label or tick coming and going: it slides and blurs, or only fades with reduced motion. */
export function swapMotion(
  reduced: boolean,
  moving: {
    from: Record<string, number | string>;
    to: Record<string, number | string>;
    exit: Record<string, number | string>;
  },
  durations: { full: number; reduced: number },
) {
  return reduced
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: durations.reduced, ease: EASE_SOFT_OUT },
      }
    : {
        initial: { ...moving.from, opacity: 0 },
        animate: { ...moving.to, opacity: 1 },
        exit: { ...moving.exit, opacity: 0 },
        transition: { duration: durations.full, ease: EASE_SOFT_OUT },
      };
}
