import { useEffect, useEffectEvent } from "react";
import { PROJECTS_CHANGED, TASK_CREATED } from "@/ui/domain/appEvents";
import { today } from "@/lib/clock";
import { NOTE_RENAMED, NOTE_UPDATED } from "@/lib/noteApi";
import { SYNCED } from "@/lib/sync";

/** Everything that changes what a list or count shows. */
const CHANGES = [
  TASK_CREATED,
  PROJECTS_CHANGED,
  NOTE_UPDATED,
  NOTE_RENAMED,
  SYNCED,
];
/** A burst of changes (a save, then the sync that brings it back) reloads once, this long after the last. */
export const SETTLE_MS = 300;

// One schedule for the whole app: every screen and the sidebar reload in the same task, so their
// identical reads share one request (`api`)
const reloads = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | undefined;
let day = "";

function settle() {
  clearTimeout(timer);
  timer = setTimeout(() => {
    day = today();
    reloads.forEach((reload) => reload());
  }, SETTLE_MS);
}

// Back in the app on another day: Today moved. Otherwise the sync that runs then fires SYNCED if
// anything changed
function onVisible() {
  if (document.visibilityState === "visible" && today() !== day) settle();
}

function listen(on: boolean) {
  const method = on ? "addEventListener" : "removeEventListener";
  CHANGES.forEach((name) => window[method](name, settle));
  document[method]("visibilitychange", onVisible);
  if (on) day = today();
  else clearTimeout(timer);
}

/** Calls `reload` once after data changed (AP §10 request budget). */
export function useDataChanged(reload: () => void) {
  const run = useEffectEvent(reload);

  useEffect(() => {
    const entry = () => run();
    if (reloads.size === 0) listen(true);
    reloads.add(entry);
    return () => {
      reloads.delete(entry);
      if (reloads.size === 0) listen(false);
    };
  }, []);
}
