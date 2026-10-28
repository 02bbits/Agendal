import type { ReactNode } from "react";
import { IconButton } from "./IconButton";
import { ChevronLeftIcon } from "./icons";

export interface NavBarProps {
  /** Accessible name of the back button (`common.back`). */
  backLabel: string;
  onBack: () => void;
  /** Small left-aligned title; omit when the screen shows its own serif title. */
  title?: string;
  actions?: ReactNode;
}

/** Pushed-screen bar: back is always top-left (theme guide, Consistency). */
export function NavBar({ backLabel, onBack, title, actions }: NavBarProps) {
  return (
    <div className="-ml-3 flex min-h-14 items-center gap-1">
      <IconButton
        plain
        label={backLabel}
        icon={<ChevronLeftIcon size={22} />}
        onClick={onBack}
      />
      {title && <span className="text-heading font-semibold">{title}</span>}
      <span className="ml-auto flex gap-1">{actions}</span>
    </div>
  );
}
