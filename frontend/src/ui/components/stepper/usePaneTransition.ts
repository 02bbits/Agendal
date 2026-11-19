import { useLayoutEffect, useRef, useState } from "react";
import { prefersReducedMotion } from "../../domain/motion";
import {
  FADE_IN_MS,
  FADE_OUT_MS,
  REDUCED_FADE_MS,
  SLIDE_OUT_MS,
  SLIDE_PX,
  spring,
  SPRING_MS,
} from "./stepperMotion";

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface ViewState {
  step: number;
  /** The step sliding out, until its animation is over. */
  previous: number | null;
  /** 1 forward, -1 back. */
  direction: number;
}

/** The area grows or shrinks to the new step's height. */
function animateHeight(
  viewport: HTMLElement | null,
  from: number | null,
  to: number,
) {
  if (
    !viewport?.animate ||
    from === null ||
    from <= 0 ||
    to <= 0 ||
    from === to
  )
    return;
  const growth = viewport.animate(
    [{ height: `${from}px` }, { height: `${to}px` }],
    { duration: SPRING_MS, easing: spring() },
  );
  growth.onfinish = () => {
    viewport.style.height = "";
  };
}

function animateOut(
  pane: HTMLElement | null,
  direction: number,
  reduced: boolean,
) {
  if (!pane?.animate) return;
  // Its resting state is gone: between the fade's end and its removal it must not reappear
  pane.style.opacity = "0";
  pane.animate([{ opacity: 1 }, { opacity: 0 }], {
    duration: reduced ? REDUCED_FADE_MS : FADE_OUT_MS,
    easing: "ease",
  });
  if (reduced) return;
  pane.animate(
    [
      { transform: "none" },
      { transform: `translateX(${-direction * SLIDE_PX}px)` },
    ],
    { duration: SLIDE_OUT_MS, easing: "ease" },
  );
}

function animateIn(
  pane: HTMLElement | null,
  direction: number,
  reduced: boolean,
) {
  if (!pane?.animate) return;
  if (reduced) {
    pane.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: REDUCED_FADE_MS,
      easing: "ease",
    });
    return;
  }
  pane.animate(
    [
      { transform: `translateX(${direction * SLIDE_PX}px)` },
      { transform: "none" },
    ],
    { duration: SPRING_MS, easing: spring() },
  );
  pane.animate([{ opacity: 0 }, { opacity: 0, offset: 0.25 }, { opacity: 1 }], {
    duration: FADE_IN_MS,
    easing: "ease",
  });
}

/**
 * Changing step: the old pane slides and fades out the way it came, the new one springs in and
 * the area eases to its height. Focus follows into the new pane when it was in the old one or on
 * Back or Continue. With reduced motion the panes only fade.
 */
export function usePaneTransition(currentStep: number) {
  const backButtonRef = useRef<HTMLButtonElement>(null);
  const nextButtonRef = useRef<HTMLButtonElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const newPaneRef = useRef<HTMLDivElement>(null);
  const leavingPaneRef = useRef<HTMLDivElement>(null);
  const lastHeight = useRef<number | null>(null);
  const focusNewPane = useRef(false);

  const [view, setView] = useState<ViewState>({
    step: currentStep,
    previous: null,
    direction: 1,
  });
  const [renderedStep, setRenderedStep] = useState(currentStep);
  if (currentStep !== renderedStep) {
    setRenderedStep(currentStep);
    setView({
      step: currentStep,
      previous: renderedStep,
      direction: currentStep > renderedStep ? 1 : -1,
    });
  }

  const focusIsOn = (element: HTMLElement | null) => {
    const active = document.activeElement;
    return Boolean(active && element?.contains(active));
  };
  const focusOnNav = () =>
    [backButtonRef.current, nextButtonRef.current].includes(
      document.activeElement as HTMLButtonElement,
    );

  /** Call before changing step: focus then follows into the new pane. */
  const keepFocusWithPane = () => {
    if (focusIsOn(viewportRef.current) || focusOnNav())
      focusNewPane.current = true;
  };

  useLayoutEffect(() => {
    if (lastHeight.current === null && newPaneRef.current)
      lastHeight.current = newPaneRef.current.offsetHeight;
  }, []);

  useLayoutEffect(() => {
    if (view.previous === null) return;
    const reduced = prefersReducedMotion();
    const newPane = newPaneRef.current;
    const leavingPane = leavingPaneRef.current;

    const height = newPane?.offsetHeight ?? 0;
    if (!reduced)
      animateHeight(viewportRef.current, lastHeight.current, height);
    lastHeight.current = height;
    animateOut(leavingPane, view.direction, reduced);
    animateIn(newPane, view.direction, reduced);

    if (
      newPane &&
      (focusNewPane.current || focusIsOn(leavingPane) || focusOnNav())
    ) {
      (newPane.querySelector<HTMLElement>(FOCUSABLE) ?? newPane).focus();
      focusNewPane.current = false;
    }

    // The leaving pane goes once its animation is over
    const timer = setTimeout(
      () =>
        setView((s) => (s.previous !== null ? { ...s, previous: null } : s)),
      reduced ? REDUCED_FADE_MS : SLIDE_OUT_MS,
    );
    return () => clearTimeout(timer);
  }, [view]);

  return {
    view,
    viewportRef,
    newPaneRef,
    leavingPaneRef,
    backButtonRef,
    nextButtonRef,
    keepFocusWithPane,
  };
}
