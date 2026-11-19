import {
  Children,
  isValidElement,
  useState,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from "react";
import { Button } from "./Button";
import { cx } from "./cx";
import { t } from "../copy";
import { StepBadge } from "./stepper/StepBadge";
import { usePaneTransition } from "./stepper/usePaneTransition";
import { useStepTrack } from "./stepper/useStepTrack";

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

  const { compact, trackRef, gliderRef, stepRefs } = useStepTrack(
    currentStep,
    totalSteps,
  );
  const {
    view,
    viewportRef,
    newPaneRef,
    leavingPaneRef,
    backButtonRef,
    nextButtonRef,
    keepFocusWithPane,
  } = usePaneTransition(currentStep);

  const goToStep = (targetStep: number, isDirectNav = false) => {
    if (targetStep < 1 || targetStep > totalSteps) return;
    if (linear && isDirectNav && targetStep > effectiveMaxReached) return;

    keepFocusWithPane();
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
                  stepRefs.current[index] = el;
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
        {view.previous !== null && (
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
            {steps[view.previous - 1]}
          </div>
        )}

        <div
          ref={newPaneRef}
          tabIndex={-1}
          className="stepper__pane stepper__pane--active outline-none"
        >
          {steps[view.step - 1]}
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
