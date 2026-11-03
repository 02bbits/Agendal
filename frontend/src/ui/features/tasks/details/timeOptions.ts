import type { PickerOption } from "../../../components/usePickerKeyboard";
import { t } from "../../../copy";
import { formatTime } from "../../../domain/dates";
import type { TimeFormat } from "../../../domain/types";

export function buildTimeOptions(
  minTime: string | null,
  current: string,
  timeFormat: TimeFormat,
): PickerOption<string>[] {
  const options: PickerOption<string>[] = [
    { value: "", label: t("task.not_set") },
  ];
  let customInserted = !current || (minTime !== null && current <= minTime);
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 15) {
      const val = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      if (minTime !== null && val <= minTime) continue;
      if (!customInserted && current && current < val) {
        options.push({
          value: current,
          label: formatTime(current, timeFormat),
        });
        customInserted = true;
      }
      if (current === val) customInserted = true;
      options.push({ value: val, label: formatTime(val, timeFormat) });
    }
  }
  if (!customInserted && current && (minTime === null || current > minTime)) {
    options.push({ value: current, label: formatTime(current, timeFormat) });
  }
  return options;
}
