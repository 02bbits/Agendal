/** A springy ease for the glider, the panes and the height: overshoots a little, then settles. */
const SPRING =
  "linear(0, 0.0603, 0.2033, 0.3821, 0.5633, 0.7258, 0.8584, 0.9574, 1.0242, 1.0634, 1.0809, 1.0828, 1.0747, 1.0613, 1.046, 1.0313, 1.0186, 1.0085, 1.0012, 0.9965, 0.994, 0.9931, 0.9933, 0.9941, 0.9953, 0.9966, 0.9978, 0.9988, 1)";
/** Browsers without linear() easing get a close cubic-bezier. */
const FALLBACK_SPRING = "cubic-bezier(0.34, 1.4, 0.64, 1)";

/** The glider's move, a pane sliding in and the height change. */
export const SPRING_MS = 560;
/** The new pane fading in. */
export const FADE_IN_MS = 420;
/** The old pane sliding out. */
export const SLIDE_OUT_MS = 200;
/** The old pane fading out. */
export const FADE_OUT_MS = 140;
/** The only change with reduced motion: a plain fade. */
export const REDUCED_FADE_MS = 150;
/** How far a pane slides as it comes and goes. */
export const SLIDE_PX = 36;
/** The tick drawing itself into a finished step's badge. */
export const TICK_MS = 360;
export const TICK_EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

let springEasing: string | null = null;

/** The spring this browser can play, worked out once. */
export function spring(): string {
  springEasing ??=
    typeof CSS !== "undefined" &&
    typeof CSS.supports === "function" &&
    CSS.supports("transition-timing-function", "linear(0, 1)")
      ? SPRING
      : FALLBACK_SPRING;
  return springEasing;
}
