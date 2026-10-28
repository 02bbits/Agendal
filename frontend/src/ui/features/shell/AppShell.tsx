import { useEffect, type ReactNode } from "react";
import { CaptureBar, type CaptureBarProps } from "./CaptureBar";
import { TabBar } from "./TabBar";
import { ROUTES, type Navigate, type TabId } from "./routes";

export interface AppShellProps {
  /** Tab screens pass their tab; pushed screens (task, project, search, account) omit the bars. */
  tab?: TabId;
  navigate?: Navigate;
  capture?: CaptureBarProps;
  /** Banners (offline, install) above the content, from the platform owner. */
  banner?: ReactNode;
  toast?: ReactNode;
  children: ReactNode;
}

/** Centred 600px column, 100dvh, capture bar and tab bar fixed at the bottom (NF-8). */
export function AppShell({
  tab,
  navigate,
  capture,
  banner,
  toast,
  children,
}: AppShellProps) {
  // `/` opens Search on list screens when no field has focus (UX-12)
  useEffect(() => {
    if (!tab || !navigate) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey)
        return;
      const el = document.activeElement;
      if (
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        el instanceof HTMLSelectElement ||
        (el as HTMLElement | null)?.isContentEditable
      )
        return;
      if (document.querySelector('[aria-modal="true"]')) return;
      event.preventDefault();
      navigate(ROUTES.search);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [tab, navigate]);

  return (
    <div className="mx-auto flex min-h-dvh max-w-[600px] flex-col bg-paper">
      <main className="flex-1 px-5 pb-[calc(160px+env(safe-area-inset-bottom))] [overflow-wrap:anywhere]">
        {banner}
        {children}
      </main>
      {tab && (
        <div className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-[600px]">
          {capture && <CaptureBar {...capture} />}
          <TabBar active={tab} navigate={navigate} />
        </div>
      )}
      {toast}
    </div>
  );
}
