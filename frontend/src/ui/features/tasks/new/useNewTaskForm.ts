import { useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { ApiRequestError } from "../../../../lib/apiError";
import { today as getToday } from "../../../../lib/clock";
import { uuidv7 } from "../../../../lib/uuid";
import { t } from "../../../copy";
import {
  createBody,
  defaultPriority,
  defaultsFor,
  dueDateFor,
  type DueChip,
} from "../../../domain/newTask";
import type { Priority } from "../../../domain/types";
import type { NewTaskSheetProps } from "./types";

export function useNewTaskForm({
  pathname = "/",
  today,
  onCreate,
  onAdded,
  onClose,
}: Pick<
  NewTaskSheetProps,
  "pathname" | "today" | "onCreate" | "onAdded" | "onClose"
>) {
  const todayDate = today ?? getToday();
  const defaults = defaultsFor(pathname);

  const [title, setTitle] = useState("");
  const [due, setDue] = useState<DueChip>(defaults.chip);
  const [picked, setPicked] = useState("");
  const initialDueDate = dueDateFor(defaults.chip, todayDate);
  const [priority, setPriority] = useState<Priority>(
    defaultPriority(initialDueDate, todayDate),
  );
  const [priorityTouched, setPriorityTouched] = useState(false);
  const [projectId, setProjectId] = useState<string | null>(
    defaults.projectId ?? null,
  );
  const [busy, setBusy] = useState(false);
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | undefined>();
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const previousDueRef = useRef<DueChip>(defaults.chip);
  const idRef = useRef(uuidv7());

  const hasInput =
    title.length > 0 ||
    due !== defaults.chip ||
    priorityTouched ||
    (projectId !== null && projectId !== (defaults.projectId ?? null)) ||
    picked !== "";

  const trimmedTitle = title.trim();
  const valid = trimmedTitle.length > 0 && (due !== "pick" || picked !== "");

  const handleDueChange = (nextDue: DueChip) => {
    if (nextDue !== "pick") {
      previousDueRef.current = nextDue;
    }
    setDue(nextDue);
    if (!priorityTouched) {
      const nextDate = dueDateFor(nextDue, todayDate, picked);
      setPriority(defaultPriority(nextDate, todayDate));
    }
  };

  const handlePickedChange = (nextPicked: string) => {
    setPicked(nextPicked);
    if (!priorityTouched) {
      setPriority(defaultPriority(nextPicked || null, todayDate));
    }
  };

  const handleCancelPick = () => {
    setDue(previousDueRef.current);
    if (!priorityTouched) {
      const nextDate = dueDateFor(previousDueRef.current, todayDate, picked);
      setPriority(defaultPriority(nextDate, todayDate));
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
      if (err instanceof ApiRequestError) {
        if (err.status === 422 && err.fields?.title) {
          setFieldError(err.fields.title[0]);
        } else if (err.code === "task.limit") {
          setFormError(t("task.limit"));
        } else {
          setFormError(t("error.save_failed"));
        }
      } else {
        setFormError(t("error.save_failed"));
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
