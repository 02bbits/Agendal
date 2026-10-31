import type { ReactElement } from "react";
import { Button } from "../../../components/Button";
import { t } from "../../../copy";

export interface DueDateFieldProps {
  value: string | null;
  onSave: (due_date: string | null) => void;
}

export function DueDateField({
  value,
  onSave,
}: DueDateFieldProps): ReactElement {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor="task-due"
        className="text-footnote font-medium text-ink-secondary"
      >
        {t("task.due")}
      </label>
      <div className="flex gap-2">
        <input
          id="task-due"
          type="date"
          value={value ?? ""}
          className="input focus-ring h-[52px] flex-1 rounded-field border-control bg-surface px-4 text-body text-ink"
          onChange={(e) => onSave(e.target.value || null)}
        />
        <Button
          type="button"
          variant="secondary"
          disabled={!value}
          onClick={() => onSave(null)}
        >
          {t("common.clear")}
        </Button>
      </div>
    </div>
  );
}
