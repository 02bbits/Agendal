import { useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { ApiRequestError } from "../../../../lib/apiError";
import { today as getToday } from "../../../../lib/clock";
import { uuidv7 } from "../../../../lib/uuid";
import {
  chipForDate,
  createBody,
  defaultPriority,
  defaultsFor,
  dueDateFor,
  type DueChip,
} from "../../../domain/newTask";
import type { CopyKey } from "../../../copy";
import { startAfterDue } from "../../../domain/edit";
import type { RepeatValue } from "../../../domain/repeatPresets";
import type { Priority } from "../../../domain/types";
import { saveErrorMessage } from "../saveError";
import type { NewTaskSheetProps } from "./types";

export function useNewTaskForm({
  pathname = "/",
  today,
  initialStartDate,
  onCreate,
  onAdded,
  onClose,
}: Pick<
  NewTaskSheetProps,
  "pathname" | "today" | "initialStartDate" | "onCreate" | "onAdded" | "onClose"
>) {
  const todayDate = today ?? getToday();
  const defaults = defaultsFor(pathname);
  const initial = initialStartDate
    ? chipForDate(initialStartDate, todayDate)
    : null;
  // The date chips set the START date: every way of creating a task gives it a start date the
  // way it used to give it a due date. The due date is optional and added by hand (#154).
  const startingChip = initial ? initial.chip : defaults.chip;
  const startingPicked = initial ? initial.picked : "";

  const [title, setTitle] = useState("");
  const [chip, setChip] = useState<DueChip>(startingChip);
  const [picked, setPicked] = useState(startingPicked);
  const [priority, setPriority] = useState<Priority>(
    defaultPriority(
      dueDateFor(startingChip, todayDate, startingPicked),
      todayDate,
    ),
  );
  const [priorityTouched, setPriorityTouched] = useState(false);
  const [startTime, setStartTime] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("");
  const [repeat, setRepeat] = useState<RepeatValue>({
    repeat: "never",
    repeat_rule: null,
  });
  const [projectId, setProjectId] = useState<string | null>(
    defaults.projectId ?? null,
  );
  const [busy, setBusy] = useState(false);
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | undefined>();
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const previousChipRef = useRef<DueChip>(startingChip);
  const idRef = useRef(uuidv7());

  const hasInput =
    title.length > 0 ||
    chip !== startingChip ||
    priorityTouched ||
    (projectId !== null && projectId !== (defaults.projectId ?? null)) ||
    picked !== startingPicked ||
    startTime !== "" ||
    dueDate !== "" ||
    dueTime !== "" ||
    repeat.repeat !== "never";

  // Pick date with nothing picked yet counts as no date
  const startDate = dueDateFor(chip, todayDate, picked) || null;
  // A time only counts with its date; start must be before due (TK-3).
  const dates = {
    start_date: startDate,
    start_time: (startDate && startTime) || null,
    due_date: dueDate || null,
    due_time: (dueDate && dueTime) || null,
  };
  const datesError: CopyKey | null = startAfterDue(dates)
    ? "task.start_after_due"
    : null;

  const trimmedTitle = title.trim();
  const valid =
    trimmedTitle.length > 0 &&
    (chip !== "pick" || picked !== "") &&
    datesError === null;

  const updatePriorityFromStart = (
    targetChip: DueChip,
    targetPicked = picked,
  ) => {
    if (!priorityTouched) {
      const nextDate = dueDateFor(targetChip, todayDate, targetPicked);
      setPriority(defaultPriority(nextDate, todayDate));
    }
  };

  const handleChipChange = (nextChip: DueChip) => {
    if (nextChip !== "pick") {
      previousChipRef.current = nextChip;
    }
    setChip(nextChip);
    if (nextChip === "none") setStartTime("");
    updatePriorityFromStart(nextChip);
  };

  const handlePickedChange = (nextPicked: string) => {
    setPicked(nextPicked);
    updatePriorityFromStart("pick", nextPicked);
  };

  const handleCancelPick = () => {
    setChip(previousChipRef.current);
    updatePriorityFromStart(previousChipRef.current);
  };

  const handleDueDateChange = (value: string) => {
    setDueDate(value);
    if (!value) setDueTime("");
  };

  // A repeat needs a date to start from: with none, the task starts today (#154)
  const handleRepeatChange = (value: RepeatValue) => {
    setRepeat(value);
    if (value.repeat !== "never" && !startDate && !dueDate) {
      handleChipChange("today");
    }
  };

  const handlePriorityChange = (nextPriority: Priority) => {
    setPriorityTouched(true);
    setPriority(nextPriority);
  };

  const handleRequestClose = () => {
    if (busy) return;
    if (hasInput) {
      setConfirmDiscard(true);
    } else {
      onClose();
    }
  };

  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!valid || busy) return;

    setBusy(true);
    setFieldError(undefined);
    setFormError(undefined);

    const body = createBody({
      id: idRef.current,
      title: trimmedTitle,
      dueDate: dates.due_date,
      dueTime: dates.due_time,
      startDate: dates.start_date,
      startTime: dates.start_time,
      priority,
      projectId,
      repeat: repeat.repeat,
      repeatRule: repeat.repeat_rule,
    });

    try {
      await onCreate?.(body);
      setBusy(false);
      onAdded?.(trimmedTitle);
      onClose();
    } catch (err) {
      setBusy(false);
      if (
        err instanceof ApiRequestError &&
        err.status === 422 &&
        err.fields?.title
      ) {
        setFieldError(err.fields.title[0]);
      } else {
        const { message } = saveErrorMessage(err);
        setFormError(message);
      }
    }
  };

  const onTitleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submit();
    }
  };

  return {
    title,
    setTitle,
    chip,
    picked,
    priority,
    projectId,
    setProjectId,
    startDate,
    startTime,
    setStartTime,
    dueDate,
    setDueDate: handleDueDateChange,
    dueTime,
    setDueTime,
    repeat,
    setRepeat: handleRepeatChange,
    todayDate,
    datesError,
    busy,
    valid,
    fieldError,
    setFieldError,
    formError,
    confirmDiscard,
    setConfirmDiscard,
    handleChipChange,
    handlePickedChange,
    handleCancelPick,
    handlePriorityChange,
    handleRequestClose,
    submit,
    onTitleKeyDown,
  };
}
