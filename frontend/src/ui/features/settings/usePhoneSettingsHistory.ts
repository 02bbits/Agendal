import { useCallback, useEffect, useRef, useState } from "react";
import type { SettingsTab } from "./types";

export type PhoneSettingsView = "list" | SettingsTab;

/**
 * Which page Settings shows on a phone: the list, or one tab's page. Opening a tab adds a
 * browser history entry, so the phone's own Back returns to the list rather than leaving
 * Settings; going back or closing takes that entry away again.
 */
export function usePhoneSettingsHistory(onClose: () => void) {
  const [phoneView, setPhoneView] = useState<PhoneSettingsView>("list");
  const detailEntryPushed = useRef(false);

  const removeDetailEntry = useCallback(() => {
    if (!detailEntryPushed.current) return;
    detailEntryPushed.current = false;
    if (!window.history.state?.settingsDetail) return;
    try {
      window.history.back();
    } catch {}
  }, []);

  const openTab = useCallback((tab: SettingsTab) => {
    setPhoneView(tab);
    try {
      window.history.pushState(
        { ...window.history.state, settingsDetail: true },
        "",
      );
      detailEntryPushed.current = true;
    } catch {}
  }, []);

  const backToList = useCallback(() => {
    removeDetailEntry();
    setPhoneView("list");
  }, [removeDetailEntry]);

  const close = useCallback(() => {
    removeDetailEntry();
    onClose();
  }, [removeDetailEntry, onClose]);

  // The phone's own Back on a tab's page: the browser already left the entry
  useEffect(() => {
    if (phoneView === "list") return;
    const onPopState = () => {
      detailEntryPushed.current = false;
      setPhoneView("list");
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [phoneView]);

  // Settings closed some other way while a tab's page was open
  useEffect(() => removeDetailEntry, [removeDetailEntry]);

  return { phoneView, setPhoneView, openTab, backToList, close };
}
