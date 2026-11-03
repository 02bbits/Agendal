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
import type { Priority } from "../../../domain/types";
import { saveErrorMessage } from "../saveError";
import type { NewTaskSheetProps } from "./types";

export function useNewTaskForm({
  pathname = "/",
  today,
  initialDueDate,
  onCreate,
  onAdded,
  onClose,
}: Pick<
  NewTaskSheetProps,
  "pathname" | "today" | "initialDueDate" | "onCreate" | "onAdded" | "onClose"
>) {
  const todayDate = today ?? getToday();
  const defaults = defaultsFor(pathname);
  const initial = initialDueDate
    ? chipForDate(initialDueDate, todayDate)
    : null;
  const startingDue = initial ? initial.chip : defaults.chip;
  const startingPicked = initial ? initial.picked : "";

  const [title, setTitle] = useState("");
  const [due, setDue] = useState<DueChip>(startingDue);
  const [picked, setPicked] = useState(startingPicked);
  const initialDueDateValue = dueDateFor(
    startingDue,
    todayDate,
    startingPicked,
  );
  const [priority, setPriority] = useState<Priority>(
    defaultPriority(initialDueDateValue, todayDate),
  );
  const [priorityTouched, setPriorityTouched] = useState(false);
  const [projectId, setProjectId] = useState<string | null>(
    defaults.projectId ?? null,
  );
  const [busy, setBusy] = useState(false);
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | undefined>();
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const previousDueRef = useRef<DueChip>(startingDue);
  const idRef = useRef(uuidv7());

  const hasInput =
    title.length > 0 ||
    due !== startingDue ||
    priorityTouched ||
    (projectId !== null && projectId !== (defaults.projectId ?? null)) ||
    picked !== startingPicked;

  const trimmedTitle = title.trim();
  const valid = trimmedTitle.length > 0 && (due !== "pick" || picked !== "");

  const updatePriorityFromDue = (targetDue: DueChip, targetPicked = picked) => {
    if (!priorityTouched) {
      const nextDate = dueDateFor(targetDue, todayDate, targetPicked);
      setPriority(defaultPriority(nextDate, todayDate));
    }
  };

  const handleDueChange = (nextDue: DueChip) => {
    if (nextDue !== "pick") {
      previousDueRef.current = nextDue;
    }
    setDue(nextDue);
    updatePriorityFromDue(nextDue);
  };

  const handlePickedChange = (nextPicked: string) => {
    setPicked(nextPicked);
    updatePriorityFromDue("pick", nextPicked);
  };

  const handleCancelPick = () => {
    setDue(previousDueRef.current);
    updatePriorityFromDue(previousDueRef.current);
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

    const calculatedDueDate = dueDateFor(due, todayDate, picked);
    const body = createBody({
      id: idRef.current,
      title: trimmedTitle,
      dueDate: calculatedDueDate,
      priority,
      projectId,
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
    due,
    picked,
    priority,
    projectId,
    setProjectId,
    busy,
    valid,
    fieldError,
    setFieldError,
    formError,
    confirmDiscard,
    setConfirmDiscard,
    handleDueChange,
    handlePickedChange,
    handleCancelPick,
    handlePriorityChange,
    handleRequestClose,
    submit,
    onTitleKeyDown,
  };
}
