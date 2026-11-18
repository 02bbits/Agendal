import { onTestFinished } from "vitest";

/**
 * For one test: the window counts as 768px or wider (popovers, the typed time list) and
 * narrower than anything larger (the task panel stays a full screen). Restored afterwards.
 */
export function useWideScreen(): void {
  const original = Object.getOwnPropertyDescriptor(window, "matchMedia");
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: /min-width:\s*768px/.test(query),
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
  onTestFinished(() => {
    if (original) Object.defineProperty(window, "matchMedia", original);
    else delete (window as { matchMedia?: unknown }).matchMedia;
  });
}
