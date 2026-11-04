import type { ReactElement } from "react";
import { Sheet } from "../../../components/Sheet";
import { TextField } from "../../../components/TextField";
import { t } from "../../../copy";
import { ProjectField } from "../details/ProjectField";
import { DiscardDialog } from "./DiscardDialog";
import { DueChips } from "./DueChips";
import { NewTaskDates } from "./NewTaskDates";
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
  initialDueDate,
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
    initialDueDate,
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
            value={form.due}
            picked={form.picked}
            onChange={form.handleDueChange}
            onPickedChange={form.handlePickedChange}
            onCancelPick={form.handleCancelPick}
            weekStart={weekStart}
          />

          <NewTaskDates
            dueDate={form.dueDate}
            dueTime={form.dueTime}
            onDueTimeChange={form.setDueTime}
            startDate={form.startDate}
            onStartDateChange={form.setStartDate}
            startTime={form.startTime}
            onStartTimeChange={form.setStartTime}
            error={form.datesError}
            timeFormat={timeFormat}
            weekStart={weekStart}
          />

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
