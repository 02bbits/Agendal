import type { ReactNode } from "react";
import { CaptureBar, type CaptureBarProps } from "./CaptureBar";
import { TabBar } from "./TabBar";
import type { Navigate, TabId } from "./routes";

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
  return (
    <div className="mx-auto flex min-h-dvh max-w-[600px] flex-col bg-paper">
      <main className="flex-1 px-gutter pb-[calc(160px+env(safe-area-inset-bottom))] [overflow-wrap:anywhere]">
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
