import { useId, type ReactElement } from "react";
import { cx } from "../../../components/cx";
import { Segmented } from "../../../components/Segmented";
import { FlagIcon } from "../../../components/icons";
import { t, type CopyKey } from "../../../copy";
import { PRIORITIES, type Priority } from "../../../domain/types";

export interface PriorityFieldProps {
  value: Priority;
  onChange: (value: Priority) => void;
  variant?: "panel" | "screen";
}

const PRIORITY_COPY_KEYS: Record<Priority, CopyKey> = {
  low: "priority.low",
  medium: "priority.medium",
  high: "priority.high",
};

export function PriorityField({
  value,
  onChange,
  variant = "panel",
}: PriorityFieldProps): ReactElement {
  const isScreen = variant === "screen";
  const labelId = useId();

  return (
    <div className="flex flex-col gap-1.5">
      <p
        id={labelId}
        className={cx(
          isScreen
            ? "text-overline font-semibold uppercase tracking-wider text-ink-secondary"
            : "text-footnote font-medium text-ink-secondary",
        )}
      >
        {t("task.priority")}
      </p>
      <Segmented<Priority>
        aria-labelledby={labelId}
        value={value}
        options={PRIORITIES.map((p) => ({
          value: p,
          label: t(PRIORITY_COPY_KEYS[p]),
          icon:
            p === "low" ? undefined : (
              <FlagIcon
                size={14}
                className={p === "high" ? "text-error" : "text-warning"}
              />
            ),
        }))}
        onChange={onChange}
      />
    </div>
  );
}
