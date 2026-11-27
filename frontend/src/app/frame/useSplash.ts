import { useCallback, useState } from "react";
import type { Splash } from "../TabLoading";

/**
 * Why the full-screen loading screen is up (#161), if it is: every screen opens or reloads behind
 * it ("start"), and it comes back going into the app from the sign-in screens ("enter") and on
 * the way out to Sign in ("leave").
 */
export function useSplash() {
  const [splash, setSplash] = useState<Splash | null>("start");
  const show = useCallback((next: Splash | null) => setSplash(next), []);
  const enterApp = useCallback(() => setSplash("enter"), []);
  // Ends the splash that faded; one asked for meanwhile (signed in as the start screen went) stays
  const end = useCallback(
    (faded: string | null) =>
      setSplash((current) => (current === faded ? null : current)),
    [],
  );
  return { splash, show, enterApp, end };
}

/** The loading screen leaves once the app is on the screen it was going to. */
export function splashReady(
  splash: Splash | null,
  {
    sessionChecked,
    signedIn,
    onAuthScreen,
  }: { sessionChecked: boolean; signedIn: boolean; onAuthScreen: boolean },
): boolean {
  switch (splash) {
    case "start":
      // Checked, and on the right side: a signed-out visit to the app waits for Sign in
      return sessionChecked && (signedIn || onAuthScreen);
    case "enter":
      return !onAuthScreen && signedIn;
    case "leave":
      return onAuthScreen;
    default:
      return true;
  }
}
