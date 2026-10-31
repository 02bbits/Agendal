import type { ReactNode } from "react";
import { CaptureBar, type CaptureBarProps } from "./CaptureBar";
import { Sidebar, type SidebarProps } from "./Sidebar";
import { TabBar } from "./TabBar";
import { useKeyboardInset } from "./useKeyboardInset";
import type { Navigate, TabId } from "./routes";

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
      <div className="mx-auto flex min-h-dvh w-full max-w-[600px] min-w-0 flex-col bg-paper md:max-w-[792px]">
        <main className="flex-1 px-gutter pb-[calc(160px+env(safe-area-inset-bottom))] [overflow-wrap:anywhere] md:px-gutter-wide md:pb-6">
          {banner}
          {children}
        </main>
        {tab && (
          <div className="fixed inset-x-0 bottom-[var(--keyboard-inset,0px)] z-50 mx-auto max-w-[600px] md:sticky md:w-full md:max-w-none md:bg-linear-to-t md:from-paper md:from-70% md:to-transparent md:pb-[calc(12px+env(safe-area-inset-bottom))]">
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
