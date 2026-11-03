import { useEffect, type ReactNode } from "react";
import { CaptureBar, type CaptureBarProps } from "./CaptureBar";
import { Sidebar, type SidebarProps } from "./Sidebar";
import { TabBar } from "./TabBar";
<<<<<<< HEAD
import { ROUTES, type Navigate, type TabId } from "./routes";
=======
import { useKeyboardInset } from "./useKeyboardInset";
import type { Navigate, TabId } from "./routes";
>>>>>>> origin/main

export interface AppShellProps {
  /** Tab screens pass their tab; pushed screens (task, project, search, account) omit the bars. */
  tab?: TabId;
  navigate?: Navigate;
  capture?: CaptureBarProps;
  /** The sidebar from 768px wide (UX-27); left out on the signed-out screens. */
  sidebar?: Omit<SidebarProps, "active" | "navigate">;
  /** The side panel from 1280px wide, e.g. task detail (UX-28). */
  aside?: ReactNode;
  /** Banners (offline, install) above the content, from the platform owner. */
  banner?: ReactNode;
  toast?: ReactNode;
  children: ReactNode;
}

/**
 * Below 768px: a centred 600px column, 100dvh, capture bar and tab bar fixed at the
 * bottom, above the on-screen keyboard (NF-8, UX-20, UX-24). From 768px: sidebar and
 * a 712px column with the capture bar at its bottom (UX-27); from 1280px the side
 * panel (UX-28).
 */
export function AppShell({
  tab,
  navigate,
  capture,
  sidebar,
  aside,
  banner,
  toast,
  children,
}: AppShellProps) {
  useKeyboardInset();

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
    // --sidebar-w and --panel-w let fixed overlays (toasts) centre on the column
    <div
      className={
        "min-h-dvh bg-paper md:flex" +
        (sidebar ? " md:[--sidebar-w:248px]" : "") +
        (aside ? " xl:[--panel-w:400px]" : "")
      }
    >
      {sidebar && (
        <div className="sticky top-0 hidden h-dvh w-[248px] shrink-0 overflow-y-auto border-r border-separator bg-surface md:block">
          <Sidebar active={tab} navigate={navigate} {...sidebar} />
        </div>
      )}
      <div className="mx-auto flex min-h-dvh w-full max-w-[600px] min-w-0 flex-col bg-paper md:max-w-[792px] lg:mx-0 lg:max-w-none lg:flex-1">
        <main className="flex-1 px-gutter pb-[calc(160px+env(safe-area-inset-bottom))] [overflow-wrap:anywhere] md:px-gutter-wide md:pb-6">
          {banner}
          {children}
        </main>
        {tab && (
          <div className="fixed inset-x-0 bottom-[var(--keyboard-inset,0px)] z-50 mx-auto max-w-[600px] md:sticky md:w-full md:max-w-none xl:[html[data-task-panel]_&]:ml-0 xl:[html[data-task-panel]_&]:w-[calc(100%-400px)] md:bg-linear-to-t md:from-paper md:from-70% md:to-transparent md:pb-[calc(12px+env(safe-area-inset-bottom))]">
            {capture && <CaptureBar {...capture} />}
            <TabBar active={tab} navigate={navigate} />
          </div>
        )}
        {toast}
      </div>
      {aside && (
        <div className="sticky top-0 hidden h-dvh w-[400px] shrink-0 overflow-y-auto border-l border-separator bg-surface xl:block">
          {aside}
        </div>
      )}
    </div>
  );
}
