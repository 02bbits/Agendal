/**
 * Creates a smooth 60fps Dark/Light mode theme toggle transition featuring
 * a Circular Reveal animation and subtle Pulse Ripple micro-interaction.
 *
 * Requirements:
 * 1. Click Coordinate Tracking (clientX, clientY)
 * 2. Circular Reveal Transition via View Transitions API (document.startViewTransition)
 * 3. Fallback for browsers without startViewTransition or users preferring reduced motion.
 */

export function runThemeTransition(
  event:
    | {
        clientX?: number;
        clientY?: number;
        currentTarget?: EventTarget | null;
      }
    | undefined,
  applyChange: () => void,
): void {
  if (
    typeof document === "undefined" ||
    !("startViewTransition" in document) ||
    (typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches)
  ) {
    applyChange();
    return;
  }

  let x = window.innerWidth / 2;
  let y = window.innerHeight / 2;

  if (event) {
    if (
      typeof event.clientX === "number" &&
      typeof event.clientY === "number" &&
      (event.clientX !== 0 || event.clientY !== 0)
    ) {
      x = event.clientX;
      y = event.clientY;
    } else if (event.currentTarget instanceof HTMLElement) {
      const rect = event.currentTarget.getBoundingClientRect();
      x = rect.left + rect.width / 2;
      y = rect.top + rect.height / 2;
    }
  }

  const endRadius = Math.hypot(
    Math.max(x, window.innerWidth - x),
    Math.max(y, window.innerHeight - y),
  );

  try {
    const transition = (
      document as Document & {
        startViewTransition: (callback: () => void) => {
          ready: Promise<void>;
          finished: Promise<void>;
        };
      }
    ).startViewTransition(() => {
      applyChange();
    });

    transition.ready
      .then(() => {
        document.documentElement.animate(
          {
            clipPath: [
              `circle(0px at ${x}px ${y}px)`,
              `circle(${endRadius}px at ${x}px ${y}px)`,
            ],
          },
          {
            duration: 450,
            easing: "cubic-bezier(0.16, 1, 0.3, 1)",
            pseudoElement: "::view-transition-new(root)",
          },
        );
      })
      .catch(() => {
        // Graceful fallback if transition is cancelled
      });
  } catch {
    applyChange();
  }
}
