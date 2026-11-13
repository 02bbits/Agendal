import {
  Children,
  isValidElement,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from "react";
import { Button } from "./Button";
import { cx } from "./cx";
import { t } from "../copy";

export interface StepProps {
  title?: string;
  children: ReactNode;
  id?: string;
}

export function Step({ children }: StepProps) {
  return <>{children}</>;
}

export interface StepperProps {
  children: ReactNode;
  step?: number; // 1-indexed (controlled)
  initialStep?: number;
  onStepChange?: (step: number) => void;
  onFinalStepCompleted?: () => void;
  linear?: boolean;
  showFooter?: boolean;
  backButtonText?: string;
  nextButtonText?: string;
  completeButtonText?: string;
  nextButtonProps?: ButtonHTMLAttributes<HTMLButtonElement> & {
    busy?: boolean;
  };
  backButtonProps?: ButtonHTMLAttributes<HTMLButtonElement>;
  footerExtra?: ReactNode;
  className?: string;
  footerClassName?: string;
  /**
   * Keeps the panes area as tall as the tallest step, so a centred card and its buttons stay
   * put while the steps change (the pointer doesn't have to chase Continue).
   */
  stableHeight?: boolean;
}

const SPRING =
  "linear(0, 0.0603, 0.2033, 0.3821, 0.5633, 0.7258, 0.8584, 0.9574, 1.0242, 1.0634, 1.0809, 1.0828, 1.0747, 1.0613, 1.046, 1.0313, 1.0186, 1.0085, 1.0012, 0.9965, 0.994, 0.9931, 0.9933, 0.9941, 0.9953, 0.9966, 0.9978, 0.9988, 1)";
const FALLBACK_SPRING = "cubic-bezier(0.34, 1.4, 0.64, 1)";

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false)
  );
}

let cachedSpringEasing: string | null = null;
function getSpringEasing(): string {
  if (cachedSpringEasing !== null) return cachedSpringEasing;
  if (
    typeof CSS !== "undefined" &&
    typeof CSS.supports === "function" &&
    CSS.supports("transition-timing-function", "linear(0, 1)")
  ) {
    cachedSpringEasing = SPRING;
  } else {
    cachedSpringEasing = FALLBACK_SPRING;
  }
  return cachedSpringEasing;
}

function StepBadge({
  stepNumber,
  isCompleted,
}: {
  stepNumber: number;
  isCompleted: boolean;
}) {
  const pathRef = useRef<SVGPathElement>(null);
  const wasCompletedRef = useRef(isCompleted);

  useLayoutEffect(() => {
    const wasCompleted = wasCompletedRef.current;
    wasCompletedRef.current = isCompleted;

    if (!wasCompleted && isCompleted) {
      const reducedMotion = prefersReducedMotion();

      if (!reducedMotion) {
        const path = pathRef.current;
        if (path && typeof path.animate === "function") {
          path.animate(
            [{ strokeDashoffset: "24" }, { strokeDashoffset: "0" }],
            {
              duration: 360,
              easing: "cubic-bezier(0.22, 1, 0.36, 1)",
            },
          );
        }
      }
    }
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
            strokeDasharray={24}
            strokeDashoffset={0}
          />
        </svg>
      ) : (
        stepNumber
      )}
    </span>
  );
}

export function Stepper({
  children,
  step: controlledStep,
  initialStep = 1,
  onStepChange,
  onFinalStepCompleted,
  linear = true,
  showFooter = true,
  backButtonText,
  nextButtonText,
  completeButtonText,
  nextButtonProps,
  backButtonProps,
  footerExtra,
  className,
  footerClassName,
  stableHeight = false,
}: StepperProps) {
  const steps = Children.toArray(children).filter(
    (child): child is ReactElement<StepProps> => isValidElement(child),
  );
  const totalSteps = steps.length;

  const [uncontrolledStep, setUncontrolledStep] = useState(initialStep);
  const currentStep = controlledStep ?? uncontrolledStep;
  const [maxReachedStep, setMaxReachedStep] = useState(currentStep);
  const effectiveMaxReached = Math.max(maxReachedStep, currentStep);

  const [compact, setCompact] = useState(false);
  const trackRef = useRef<HTMLOListElement>(null);
  const indicatorRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const gliderRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const newPaneRef = useRef<HTMLDivElement>(null);
  const leavingPaneRef = useRef<HTMLDivElement>(null);
  const nextButtonRef = useRef<HTMLButtonElement>(null);
  const backButtonRef = useRef<HTMLButtonElement>(null);

  const isFirstGliderPlacement = useRef(true);
  const lastHeightRef = useRef<number | null>(null);
  const shouldFocusNewPaneRef = useRef(false);

  const [viewState, setViewState] = useState<{
    step: number;
    previous: number | null;
    direction: number;
  }>({
    step: currentStep,
    previous: null,
    direction: 1,
  });

  const [prevRenderStep, setPrevRenderStep] = useState(currentStep);
  if (currentStep !== prevRenderStep) {
    setPrevRenderStep(currentStep);
    setViewState({
      step: currentStep,
      previous: prevRenderStep,
      direction: currentStep > prevRenderStep ? 1 : -1,
    });
  }

  const placeGlider = useCallback(
    (immediate = false) => {
      const activeIndex = currentStep - 1;
      const activeEl = indicatorRefs.current[activeIndex];
      const glider = gliderRef.current;
      if (!activeEl || !glider) return;

      const reducedMotion = prefersReducedMotion();

      const spring = getSpringEasing();
      const skipTransition =
        immediate || isFirstGliderPlacement.current || reducedMotion;

      if (skipTransition) {
        glider.style.transition = "none";
      } else {
        glider.style.transition = `transform 560ms ${spring}, width 560ms ${spring}, height 560ms ${spring}`;
      }

      glider.style.transform = `translate3d(${activeEl.offsetLeft}px, ${activeEl.offsetTop}px, 0)`;
      glider.style.width = `${activeEl.offsetWidth}px`;
      glider.style.height = `${activeEl.offsetHeight}px`;
      glider.style.opacity = "1";

      if (isFirstGliderPlacement.current) {
        void glider.offsetHeight; // force reflow
        if (!reducedMotion) {
          glider.style.transition = `transform 560ms ${spring}, width 560ms ${spring}, height 560ms ${spring}`;
        }
        isFirstGliderPlacement.current = false;
      }
    },
    [currentStep],
  );

  const measureTitles = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;

    let naturalWidth = 0;
    if (typeof document !== "undefined") {
      const clone = track.cloneNode(true) as HTMLElement;
      clone.className = "stepper__track";
      clone.style.position = "absolute";
      clone.style.left = "-9999px";
      clone.style.top = "-9999px";
      clone.style.visibility = "hidden";
      clone.style.width = "max-content";
      clone.style.maxWidth = "none";

      const items = clone.querySelectorAll<HTMLElement>(".stepper__step-item");
      items.forEach((item) => {
        item.style.flex = "0 0 auto";
        item.style.width = "auto";
      });
      const btns = clone.querySelectorAll<HTMLElement>(".stepper__step-btn");
      btns.forEach((btn) => {
        btn.style.width = "auto";
        btn.style.padding = "0 8px";
      });
      const titles = clone.querySelectorAll<HTMLElement>(
        ".stepper__step-title",
      );
      titles.forEach((t) => {
        t.style.display = "inline";
      });

      // Outside `.stepper`, so the compact rules can't reach the copy: the answer depends on the
      // titles and the track width only, never on the current mode (no flip-flop)
      document.body.appendChild(clone);
      const sumNaturalWidths = Array.from(items).reduce(
        (acc, item) => acc + item.getBoundingClientRect().width,
        0,
      );
      naturalWidth = sumNaturalWidths + 8; // + the track's 4 px padding each side
      clone.remove();
    }

    const shouldBeCompact = naturalWidth > track.clientWidth;
    setCompact((prev) => (prev !== shouldBeCompact ? shouldBeCompact : prev));
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

  useLayoutEffect(() => {
    const newPane = newPaneRef.current;
    if (newPane && lastHeightRef.current === null) {
      lastHeightRef.current = newPane.offsetHeight;
    }
  }, []);

  useLayoutEffect(() => {
    if (viewState.previous === null) return;

    const reducedMotion = prefersReducedMotion();
    const spring = getSpringEasing();

    const viewport = viewportRef.current;
    const newPane = newPaneRef.current;
    const leavingPane = leavingPaneRef.current;

    // 1. Height animation
    const newHeight = newPane ? newPane.offsetHeight : 0;
    const lastHeight = lastHeightRef.current;
    lastHeightRef.current = newHeight;

    if (
      !reducedMotion &&
      viewport &&
      typeof viewport.animate === "function" &&
      lastHeight !== null &&
      lastHeight > 0 &&
      newHeight > 0 &&
      lastHeight !== newHeight
    ) {
      const heightAnim = viewport.animate(
        [{ height: `${lastHeight}px` }, { height: `${newHeight}px` }],
        { duration: 560, easing: spring },
      );
      heightAnim.onfinish = () => {
        viewport.style.height = "";
      };
    }

    // 2. Leaving pane animation
    if (leavingPane && typeof leavingPane.animate === "function") {
      // Its resting state is gone: between the fade's end and its removal it must not reappear
      leavingPane.style.opacity = "0";
      if (reducedMotion) {
        leavingPane.animate([{ opacity: 1 }, { opacity: 0 }], {
          duration: 150,
          easing: "ease",
        });
      } else {
        leavingPane.animate([{ opacity: 1 }, { opacity: 0 }], {
          duration: 140,
          easing: "ease",
        });
        leavingPane.animate(
          [
            { transform: "none" },
            { transform: `translateX(${-viewState.direction * 36}px)` },
          ],
          {
            duration: 200,
            easing: "ease",
          },
        );
      }
    }

    // 3. New pane animation
    if (newPane && typeof newPane.animate === "function") {
      if (reducedMotion) {
        newPane.animate([{ opacity: 0 }, { opacity: 1 }], {
          duration: 150,
          easing: "ease",
        });
      } else {
        newPane.animate(
          [
            { transform: `translateX(${viewState.direction * 36}px)` },
            { transform: "none" },
          ],
          {
            duration: 560,
            easing: spring,
          },
        );
        newPane.animate(
          [{ opacity: 0 }, { opacity: 0, offset: 0.25 }, { opacity: 1 }],
          {
            duration: 420,
            easing: "ease",
          },
        );
      }
    }

    // 4. Focus management
    const activeEl =
      typeof document !== "undefined" ? document.activeElement : null;
    const isFocusInLeaving =
      activeEl && leavingPane ? leavingPane.contains(activeEl) : false;
    const isFocusOnNav =
      activeEl &&
      (activeEl === nextButtonRef.current ||
        activeEl === backButtonRef.current);
    const shouldFocus =
      shouldFocusNewPaneRef.current || isFocusInLeaving || isFocusOnNav;

    if (shouldFocus && newPane) {
      const focusTarget =
        newPane.querySelector<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? newPane;
      focusTarget.focus();
      shouldFocusNewPaneRef.current = false;
    }

    // 5. Remove leaving pane from state after animation completes
    const timer = setTimeout(
      () => {
        setViewState((s) =>
          s.previous !== null ? { ...s, previous: null } : s,
        );
      },
      reducedMotion ? 150 : 200,
    );

    return () => {
      clearTimeout(timer);
    };
  }, [viewState]);

  const goToStep = (targetStep: number, isDirectNav = false) => {
    if (targetStep < 1 || targetStep > totalSteps) return;
    if (linear && isDirectNav && targetStep > effectiveMaxReached) return;

    const activeEl =
      typeof document !== "undefined" ? document.activeElement : null;
    const inOldPane =
      activeEl && viewportRef.current
        ? viewportRef.current.contains(activeEl)
        : false;
    const onNavBtn =
      activeEl &&
      (activeEl === nextButtonRef.current ||
        activeEl === backButtonRef.current);
    if (inOldPane || onNavBtn) {
      shouldFocusNewPaneRef.current = true;
    }

    setMaxReachedStep((prev) => Math.max(prev, targetStep));

    if (controlledStep === undefined) {
      setUncontrolledStep(targetStep);
    }
    onStepChange?.(targetStep);
  };

  const handleNext = () => {
    if (currentStep < totalSteps) {
      goToStep(currentStep + 1);
    } else {
      onFinalStepCompleted?.();
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      goToStep(currentStep - 1);
    }
  };

  const isFirstStep = currentStep === 1;
  const isLastStep = currentStep === totalSteps;

  const defaultBackText = backButtonText ?? t("stepper.back");
  const defaultNextText = nextButtonText ?? t("stepper.next");
  const defaultCompleteText = completeButtonText ?? t("stepper.next");

  const resolvedNextText = isLastStep ? defaultCompleteText : defaultNextText;

  const {
    className: backClassName,
    style: backStyle,
    ...restBackProps
  } = (backButtonProps ?? {}) as {
    className?: string;
    style?: CSSProperties;
    [key: string]: unknown;
  };
  const { className: nextClassName, ...restNextProps } = (nextButtonProps ??
    {}) as {
    className?: string;
    [key: string]: unknown;
  };

  return (
    <div
      className={cx(
        "stepper flex-1 flex flex-col",
        compact && "stepper--compact",
        className,
      )}
    >
      {/* Stepper indicators track */}
      <ol
        ref={trackRef}
        aria-label={t("stepper.progress")}
        className="stepper__track"
      >
        <div ref={gliderRef} aria-hidden="true" className="stepper__glider" />

        {steps.map((child, index) => {
          const stepNumber = index + 1;
          const isActive = stepNumber === currentStep;
          const isCompleted = stepNumber < currentStep;
          const isSelectable = !linear || stepNumber <= effectiveMaxReached;
          const title = child.props.title ?? "";

          const state = isActive
            ? "active"
            : isCompleted
              ? "completed"
              : "upcoming";

          return (
            <li
              key={stepNumber}
              className="stepper__step-item"
              data-active={isActive ? "true" : undefined}
            >
              <button
                ref={(el) => {
                  indicatorRefs.current[index] = el;
                }}
                type="button"
                aria-current={isActive ? "step" : undefined}
                aria-label={t("stepper.step", {
                  number: stepNumber,
                  title,
                })}
                disabled={!isSelectable}
                data-state={state}
                onClick={() => goToStep(stepNumber, true)}
                className="stepper__step-btn focus-ring"
              >
                <StepBadge stepNumber={stepNumber} isCompleted={isCompleted} />
                {title && <span className="stepper__step-title">{title}</span>}
              </button>
            </li>
          );
        })}
      </ol>

      {/* Pane viewport */}
      <div
        ref={viewportRef}
        className={cx(
          "stepper__viewport mt-6 lg:flex-1",
          stableHeight && "stepper__viewport--stable",
        )}
      >
        {/* Invisible copies of every step share one grid cell with the active pane, so the area
            takes the tallest step's height. Inert: no focus, no reading, no clicks */}
        {stableHeight &&
          steps.map((step, index) => (
            <div
              key={`sizer-${index}`}
              aria-hidden="true"
              inert
              className="stepper__sizer"
            >
              {step}
            </div>
          ))}
        {viewState.previous !== null && (
          <div
            ref={leavingPaneRef}
            aria-hidden="true"
            className="stepper__pane stepper__pane--leaving"
            style={{
              position: "absolute",
              inset: "0 0 auto 0",
              pointerEvents: "none",
            }}
          >
            {steps[viewState.previous - 1]}
          </div>
        )}

        <div
          ref={newPaneRef}
          tabIndex={-1}
          className="stepper__pane stepper__pane--active outline-none"
        >
          {steps[viewState.step - 1]}
        </div>
      </div>

      {/* Footer. The default gap is a utility, not CSS in globals.css: unlayered CSS would beat
          the caller's footerClassName (e.g. mt-auto) whatever its specificity */}
      {(showFooter || footerExtra) && (
        <div
          className={cx("stepper__footer-container", footerClassName ?? "mt-6")}
        >
          {showFooter && (
            <div className="stepper__footer">
              <Button
                ref={backButtonRef}
                variant="secondary"
                size="md"
                className={cx(
                  "flex-1 lg:flex-none lg:min-w-[120px] min-h-11 h-11",
                  backClassName,
                )}
                style={{
                  visibility: isFirstStep ? "hidden" : "visible",
                  ...backStyle,
                }}
                onClick={handleBack}
                {...restBackProps}
              >
                {defaultBackText}
              </Button>

              <Button
                ref={nextButtonRef}
                variant="primary"
                size="md"
                className={cx(
                  "flex-1 lg:flex-none lg:min-w-[120px] min-h-11 h-11",
                  nextClassName,
                )}
                onClick={handleNext}
                {...restNextProps}
              >
                {resolvedNextText}
              </Button>
            </div>
          )}

          {footerExtra}
        </div>
      )}
    </div>
  );
}
