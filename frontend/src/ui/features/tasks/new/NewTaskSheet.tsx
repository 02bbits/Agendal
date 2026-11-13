import type { ReactElement } from "react";
import { Sheet } from "../../../components/Sheet";
import { TextField } from "../../../components/TextField";
import { RepeatIcon } from "../../../components/icons";
import { t } from "../../../copy";
import { SettingsRow } from "../details/SettingsRow";
import { RepeatPicker } from "../repeat/RepeatPicker";
import { ProjectField } from "../details/ProjectField";
import { DiscardDialog } from "./DiscardDialog";
import { DueChips } from "./DueChips";
import { NewTaskDue, NewTaskStartTime } from "./NewTaskDates";
import { PriorityChips } from "./PriorityChips";
import type { NewTaskSheetProps } from "./types";
import { useNewTaskForm } from "./useNewTaskForm";

export type { NewTaskSheetProps };

const MAX_TITLE_LENGTH = 200;

export function NewTaskSheet({
  open,
  onClose,
  pathname = "/",
  today,
  initialStartDate,
  projects = [],
  projectsStatus = "ready",
  onRetryProjects,
  onCreate,
  onAdded,
  weekStart = "mon",
  timeFormat = "24h",
}: NewTaskSheetProps): ReactElement | null {
  const form = useNewTaskForm({
    pathname,
    today,
    initialStartDate,
    onCreate,
    onAdded,
    onClose,
  });

  return (
    <>
      <Sheet
        open={open}
        title={t("task.new")}
        closeLabel={t("common.close")}
        confirmLabel={t("common.add")}
        confirmDisabled={!form.valid || form.busy}
        onConfirm={form.submit}
        onClose={form.handleRequestClose}
      >
        <form className="flex flex-col gap-4" onSubmit={form.submit}>
          <TextField
            label={t("task.title")}
            helper={form.fieldError ? undefined : t("task.title_only")}
            error={form.fieldError}
            value={form.title}
            maxLength={MAX_TITLE_LENGTH}
            autoFocus
            enterKeyHint="done"
            autoComplete="off"
            onChange={(e) => {
              form.setTitle(e.target.value);
              form.setFieldError(undefined);
            }}
            onKeyDown={form.onTitleKeyDown}
          />

          <DueChips
            value={form.chip}
            picked={form.picked}
            onChange={form.handleChipChange}
            onPickedChange={form.handlePickedChange}
            onCancelPick={form.handleCancelPick}
            weekStart={weekStart}
          />

          <div className="flex flex-col">
            <NewTaskStartTime
              startDate={form.startDate}
              startTime={form.startTime}
              onStartTimeChange={form.setStartTime}
              error={form.datesError}
              timeFormat={timeFormat}
            />

            <NewTaskDue
              dueDate={form.dueDate}
              onDueDateChange={form.setDueDate}
              dueTime={form.dueTime}
              onDueTimeChange={form.setDueTime}
              startDate={form.startDate}
              startTime={form.startTime}
              error={form.datesError}
              timeFormat={timeFormat}
              weekStart={weekStart}
            />

            <SettingsRow
              icon={<RepeatIcon size={18} />}
              label={t("task.repeat")}
              control={
                <RepeatPicker
                  id="new-task-repeat"
                  variant="row"
                  value={form.repeat}
                  anchor={form.startDate || form.dueDate || form.todayDate}
                  weekStart={weekStart}
                  className="max-w-[220px] [&>div]:max-w-full [&>div>button]:max-w-full [&>div>button>span]:truncate"
                  onChange={form.setRepeat}
                />
              }
            />
          </div>

          <PriorityChips
            value={form.priority}
            onChange={form.handlePriorityChange}
          />

          <ProjectField
            projectId={form.projectId}
            projects={projects}
            projectsStatus={projectsStatus}
            onRetryProjects={onRetryProjects}
            onChange={form.setProjectId}
          />

          {form.formError && (
            <p role="alert" className="text-footnote text-error">
              {form.formError}
            </p>
          )}

          <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
        </form>
      </Sheet>

      <DiscardDialog
        open={form.confirmDiscard}
        onDiscard={() => {
          form.setConfirmDiscard(false);
          onClose();
        }}
        onKeepEditing={() => form.setConfirmDiscard(false)}
      />
    </>
  );
}
