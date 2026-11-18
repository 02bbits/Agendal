import { useState } from "react";
import type { CopyKey } from "../../../copy";
import { displayNameError, limitDisplayName } from "../../auth/validation";

export type SaveDisplayName = (name: string) => Promise<void>;

/**
 * The name field in Settings: follows the saved name, saves on leaving the field, and shows why
 * a name the server would refuse (3–30 characters) isn't saved.
 */
export function useDisplayName(savedName: string, onSave?: SaveDisplayName) {
  const [prevSavedName, setPrevSavedName] = useState(savedName);
  const [value, setValue] = useState(savedName);
  const [error, setError] = useState<CopyKey>();
  if (savedName !== prevSavedName) {
    setPrevSavedName(savedName);
    setValue(savedName);
  }

  const change = (next: string) => {
    setValue(limitDisplayName(next));
    setError(undefined);
  };

  const save = () => {
    const trimmed = value.trim();
    if (trimmed === savedName) return;
    const refused = displayNameError(trimmed);
    setError(refused);
    if (!refused) onSave?.(trimmed).catch(() => {});
  };

  return { value, error, change, save };
}

export type DisplayNameField = ReturnType<typeof useDisplayName>;
