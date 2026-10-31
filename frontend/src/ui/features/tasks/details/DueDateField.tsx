import type { ReactElement } from "react";
import { Button } from "../../../components/Button";
import { cx } from "../../../components/cx";
import { t } from "../../../copy";
import { Field } from "./Field";
import { CONTROL_CLASS } from "./control";

export interface DueDateFieldProps {
  value: string | null;
  onSave: (due_date: string | null) => void;
}

export function DueDateField({
  value,
  onSave,
}: DueDateFieldProps): ReactElement {
  return (
    <Field id="task-due" label={t("task.due")}>
      <div className="flex gap-2">
        <input
          id="task-due"
          type="date"
          value={value ?? ""}
          className={cx(
            CONTROL_CLASS,
            "input focus-ring flex-1 aria-invalid:border-error disabled:opacity-40",
          )}
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
    </Field>
  );
}
