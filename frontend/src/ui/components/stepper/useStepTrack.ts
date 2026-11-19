import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { prefersReducedMotion } from "../../domain/motion";
import { spring, SPRING_MS } from "./stepperMotion";

/** The track's padding, 4px each side. */
const TRACK_PADDING_PX = 8;
/** A step's padding once laid out at its natural width. */
const NATURAL_STEP_PADDING = "0 8px";

/**
 * The width the steps take with their titles shown in full. Measured on a hidden copy outside
 * `.stepper`, so the compact rules can't reach it: the answer depends on the titles and the
 * track only, never on the current mode (no flip-flop).
 */
function naturalTrackWidth(track: HTMLElement): number {
  const copy = track.cloneNode(true) as HTMLElement;
  copy.className = "stepper__track";
  Object.assign(copy.style, {
    position: "absolute",
    left: "-9999px",
    top: "-9999px",
    visibility: "hidden",
    width: "max-content",
    maxWidth: "none",
  });
  const items = copy.querySelectorAll<HTMLElement>(".stepper__step-item");
  items.forEach((item) =>
    Object.assign(item.style, { flex: "0 0 auto", width: "auto" }),
  );
  copy.querySelectorAll<HTMLElement>(".stepper__step-btn").forEach((btn) =>
    Object.assign(btn.style, {
      width: "auto",
      padding: NATURAL_STEP_PADDING,
    }),
  );
  copy
    .querySelectorAll<HTMLElement>(".stepper__step-title")
    .forEach((title) => (title.style.display = "inline"));

  document.body.appendChild(copy);
  const width = Array.from(items).reduce(
    (sum, item) => sum + item.getBoundingClientRect().width,
    0,
  );
  copy.remove();
  return width + TRACK_PADDING_PX;
}

/**
 * The row of step buttons: compact (numbers only) when the titles don't fit, and a glider that
 * springs under the current step. It jumps there without moving the first time, on a resize and
 * with reduced motion.
 */
export function useStepTrack(currentStep: number, totalSteps: number) {
  const [compact, setCompact] = useState(false);
  const trackRef = useRef<HTMLOListElement>(null);
  const gliderRef = useRef<HTMLDivElement>(null);
  const stepRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const firstPlacement = useRef(true);

  const placeGlider = useCallback(
    (immediate = false) => {
      const step = stepRefs.current[currentStep - 1];
      const glider = gliderRef.current;
      if (!step || !glider) return;
      const reduced = prefersReducedMotion();
      const moving = `transform ${SPRING_MS}ms ${spring()}, width ${SPRING_MS}ms ${spring()}, height ${SPRING_MS}ms ${spring()}`;
      glider.style.transition =
        immediate || firstPlacement.current || reduced ? "none" : moving;
      glider.style.transform = `translate3d(${step.offsetLeft}px, ${step.offsetTop}px, 0)`;
      glider.style.width = `${step.offsetWidth}px`;
      glider.style.height = `${step.offsetHeight}px`;
      glider.style.opacity = "1";
      if (!firstPlacement.current) return;
      void glider.offsetHeight; // Force a reflow, so the next move animates
      if (!reduced) glider.style.transition = moving;
      firstPlacement.current = false;
    },
    [currentStep],
  );

  const measureTitles = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    setCompact(naturalTrackWidth(track) > track.clientWidth);
  }, []);

  useLayoutEffect(() => {
    measureTitles();
    placeGlider();
  }, [currentStep, compact, measureTitles, placeGlider]);

  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      measureTitles();
      placeGlider(true);
    });
    observer.observe(track);
    return () => observer.disconnect();
  }, [totalSteps, measureTitles, placeGlider]);

  return { compact, trackRef, gliderRef, stepRefs };
}
