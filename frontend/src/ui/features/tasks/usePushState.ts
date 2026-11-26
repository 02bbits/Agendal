import { useSyncExternalStore } from "react";
import { pushState, type PushState } from "../../../lib/push";

const CHANGED = "agendal:push-state";

/** Tells every reader that permission or the subscription changed. */
export function notifyPushState(): void {
  window.dispatchEvent(new Event(CHANGED));
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(CHANGED, onChange);
  // Permission can change in the browser's settings while the app is in the background
  window.addEventListener("focus", onChange);
  return () => {
    window.removeEventListener(CHANGED, onChange);
    window.removeEventListener("focus", onChange);
  };
}

/** This device's push state (TK §2.5); "unsupported" while rendering on the server. */
export function usePushState(): PushState {
  return useSyncExternalStore(subscribe, pushState, () => "unsupported");
}
