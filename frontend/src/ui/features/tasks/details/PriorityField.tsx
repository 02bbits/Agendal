import type { ReactElement } from "react";
import { cx } from "../../../components/cx";
import { Segmented } from "../../../components/Segmented";
import { t, type CopyKey } from "../../../copy";
import { PRIORITIES, type Priority } from "../../../domain/types";

export interface PriorityFieldProps {
  value: Priority;
  onChange: (value: Priority) => void;
  variant?: "panel" | "screen";
}

export function PriorityField({
  value,
  onChange,
  variant = "panel",
}: PriorityFieldProps): ReactElement {
  const isScreen = variant === "screen";

  return (
    <div className="flex flex-col gap-1.5">
      <label
        className={cx(
          isScreen
            ? "text-overline font-semibold uppercase tracking-wider text-ink-secondary"
            : "text-footnote font-medium text-ink-secondary",
        )}
      >
        {t("task.priority")}
      </label>
      <Segmented<Priority>
        label={t("task.priority")}
        value={value}
        options={PRIORITIES.map((p) => ({
          value: p,
          label: t(`priority.${p}` as CopyKey),
        }))}
        onChange={onChange}
      />
    </div>
  );
}
