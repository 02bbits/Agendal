import { useCallback, useEffect, useState } from "react";
import {
  ensureSubscribed,
  needsInstall,
  pushPermission,
  pushSupported,
} from "../../../lib/push";
import type { Clock } from "./types";

export const NOT_NOW_KEY = "agendal.push_not_now_until";

export interface UsePushPromptReturn {
  dialog: null | "ask" | "install";
  denied: boolean;
  onReminderSet: () => void;
  allow: () => Promise<void>;
  notNow: () => void;
}

export function usePushPrompt(clock: Clock): UsePushPromptReturn {
  const [dialog, setDialog] = useState<null | "ask" | "install">(null);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      setDenied(pushPermission() === "denied");
    });
  }, []);

  const onReminderSet = useCallback(() => {
    const perm = pushPermission();
    if (perm !== "granted") {
      try {
        const until = localStorage.getItem(NOT_NOW_KEY);
        if (until) {
          const untilDate = new Date(until);
          if (clock.now().getTime() < untilDate.getTime()) {
            return;
          }
        }
      } catch {
        // localStorage error swallowed
      }
    }

    if (needsInstall()) {
      setDialog("install");
      return;
    }

    if (!pushSupported()) {
      return;
    }

    if (perm === "granted") {
      ensureSubscribed().catch(() => {});
      return;
    }

    if (perm === "denied") {
      setDenied(true);
      return;
    }

    setDialog("ask");
  }, [clock]);

  const allow = useCallback(async () => {
    setDialog(null);
    if (typeof Notification === "undefined") {
      return;
    }
    try {
      const result = await Notification.requestPermission();
      if (result === "granted") {
        setDenied(false);
        await ensureSubscribed();
      } else if (result === "denied") {
        setDenied(true);
      }
    } catch {
      // ignore
    }
  }, []);

  const notNow = useCallback(() => {
    setDialog(null);
    try {
      const fourteenDays = new Date(
        clock.now().getTime() + 14 * 24 * 60 * 60 * 1000,
      );
      localStorage.setItem(NOT_NOW_KEY, fourteenDays.toISOString());
    } catch {
      // ignore
    }
  }, [clock]);

  return {
    dialog,
    denied,
    onReminderSet,
    allow,
    notNow,
  };
}
