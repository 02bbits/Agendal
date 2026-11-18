"use client";

import { t } from "@/ui";
import {
  dismissInstall,
  promptInstall,
  useInstallDone,
  useInstallKind,
} from "@/lib/install";

// AP-1: the Install banner's state and the Account "Install app" action. Where there is no
// prompt (iOS, Firefox Android), Install app shows the same guidance as the banner, as a toast.
export function useInstall(showToast: (message: string) => void) {
  const kind = useInstallKind();
  const done = useInstallDone();
  return {
    /** Null when nothing can be installed, which hides Account's Install app. */
    kind,
    /** The banner to show: once per device after the first sign-in, until Install or Not now. */
    banner: done ? null : kind,
    notNow: dismissInstall,
    install: () =>
      kind === "prompt"
        ? void promptInstall()
        : showToast(
            t(kind === "ios" ? "app.install_ios" : "app.install_firefox"),
          ),
  };
}
