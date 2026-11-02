import type { ReactElement } from "react";
import { XIcon } from "../../../components/icons";
import { t } from "../../../copy";

export interface PanelHeaderProps {
  onClose?: () => void;
}

export function PanelHeader({ onClose }: PanelHeaderProps): ReactElement {
  return (
    <div className="flex h-11 items-center justify-between border-b border-separator px-4">
      <span className="text-footnote font-semibold text-ink">
        {t("task.heading")}
      </span>
      <button
        type="button"
        aria-label={t("common.close")}
        className="focus-ring inline-flex size-8 cursor-pointer items-center justify-center rounded-full text-ink-secondary hover:text-ink"
        onClick={onClose}
      >
        <XIcon size={18} />
      </button>
    </div>
  );
}
