import type { ReactNode } from "react";

/** Decorative relief made from the icon's own outline, with no background tile. */
export function LayeredIcon({ children }: { children: ReactNode }) {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none isolate inline-grid shrink-0"
    >
      <span className="col-start-1 row-start-1 translate-y-[1.5px] text-black/45 blur-[0.5px]">
        {children}
      </span>
      <span className="relative col-start-1 row-start-1 [filter:drop-shadow(0_-0.5px_0_rgb(255_255_255/0.18))_drop-shadow(0_2px_2px_rgb(0_0_0/0.30))]">
        {children}
      </span>
    </span>
  );
}
