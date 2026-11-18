import { useState, type ReactElement } from "react";
import { Picker } from "../../../components/Picker";
import { t } from "../../../copy";
import { describeRepeat } from "../../../domain/repeat";
import {
  presetIdFor,
  repeatPresets,
  type RepeatValue,
} from "../../../domain/repeatPresets";
import type { WeekStart } from "../../../domain/types";
import { RepeatCustomDialog } from "./RepeatCustomDialog";

export interface RepeatPickerProps {
  id: string;
  value: RepeatValue;
  /** The date the series starts on: the start date, else the due date, else today. */
  anchor: string;
  onChange: (value: RepeatValue) => void;
  weekStart?: WeekStart;
  variant?: "panel" | "row";
  ariaDescribedBy?: string;
  className?: string;
}

const CUSTOM = "custom";
const CUSTOM_NEW = "custom_new";

/** The Repeat control in New task and Task details (#154): presets from the start date, or Custom…. */
export function RepeatPicker({
  id,
  value,
  anchor,
  onChange,
  weekStart = "mon",
  variant = "panel",
  ariaDescribedBy,
  className,
}: RepeatPickerProps): ReactElement {
  const [customOpen, setCustomOpen] = useState(false);
  const presets = repeatPresets(anchor);
  const current = presetIdFor(value, anchor);
  const summary = describeRepeat({
    ...value,
    repeat_anchor: anchor,
    due_date: null,
  });

  const options = [
    ...presets.map((preset) => ({ value: preset.id, label: preset.label })),
    // A custom rule shows its own summary as the selected choice
    ...(current === CUSTOM && summary
      ? [
          {
            value: CUSTOM,
            label: summary.charAt(0).toLocaleUpperCase() + summary.slice(1),
          },
        ]
      : []),
    { value: CUSTOM_NEW, label: t("repeat_preset.custom") },
  ];

  return (
    <>
      <Picker<string>
        id={id}
        variant={variant}
        label={t("task.repeat")}
        value={current}
        options={options}
        ariaDescribedBy={ariaDescribedBy}
        className={className}
        onChange={(next) => {
          if (next === CUSTOM_NEW) {
            setCustomOpen(true);
            return;
          }
          const preset = presets.find((p) => p.id === next);
          if (preset) onChange(preset.value);
        }}
      />
      {customOpen && (
        <RepeatCustomDialog
          open
          value={value}
          anchor={anchor}
          weekStart={weekStart}
          onCancel={() => setCustomOpen(false)}
          onDone={(next) => {
            setCustomOpen(false);
            onChange(next);
          }}
        />
      )}
    </>
  );
}
