import { useLayoutEffect, useRef } from "react";
import { prefersReducedMotion } from "../../domain/motion";
import { TICK_EASE, TICK_MS } from "./stepperMotion";

/** The tick's path length, drawn from nothing to whole. */
const TICK_LENGTH = 24;

/** A step's number, or a tick that draws itself in once the step is done. */
export function StepBadge({
  stepNumber,
  isCompleted,
}: {
  stepNumber: number;
  isCompleted: boolean;
}) {
  const pathRef = useRef<SVGPathElement>(null);
  const wasCompleted = useRef(isCompleted);

  useLayoutEffect(() => {
    const justCompleted = !wasCompleted.current && isCompleted;
    wasCompleted.current = isCompleted;
    if (!justCompleted || prefersReducedMotion()) return;
    pathRef.current?.animate?.(
      [{ strokeDashoffset: String(TICK_LENGTH) }, { strokeDashoffset: "0" }],
      { duration: TICK_MS, easing: TICK_EASE },
    );
  }, [isCompleted]);

  return (
    <span className="stepper__badge">
      {isCompleted ? (
        <svg
          width={14}
          height={14}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="stepper__check"
        >
          <path
            ref={pathRef}
            d="M20 6 9 17l-5-5"
            stroke="currentColor"
            strokeDasharray={TICK_LENGTH}
            strokeDashoffset={0}
          />
        </svg>
      ) : (
        stepNumber
      )}
    </span>
  );
}
