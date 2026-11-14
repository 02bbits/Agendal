import {
  forwardRef,
  useState,
  type ChangeEvent,
  type FocusEvent,
  type KeyboardEvent,
} from "react";
import { KeyboardOnlyFilter } from "./keyboardOnly";
import { t } from "../../copy";
import { IconButton } from "../../components/IconButton";
import { AlertCircleIcon, EyeIcon, EyeOffIcon } from "../../components/icons";
import { TextField, type TextFieldProps } from "../../components/TextField";

export type PasswordFieldProps = Omit<TextFieldProps, "type" | "trailing">;

/** Password with an eye button: one fixed label, pressed state in aria-pressed (A11Y-60). */
export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(
  function PasswordField(
    { onKeyDown, onKeyUp, onBlur, onChange, value, defaultValue, ...props },
    ref,
  ) {
    const [shown, setShown] = useState(false);
    const [capsLock, setCapsLock] = useState(false);
    // Keys only: Vietnamese typing is undone as it happens, other scripts are dropped (AA §2.10)
    const [filter] = useState(() => new KeyboardOnlyFilter());
    const [dropped, setDropped] = useState(false);

    const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
      const input = event.target;
      const previous = String(value ?? "");
      const result = filter.change(previous, input.value, event.timeStamp);
      setDropped(result.dropped);
      if (input.value !== result.value) {
        input.value = result.value;
        // Setting the value leaves the caret at the end. Move it only for an edit in the middle:
        // moving the selection can scroll the page to the field, which made the form jump
        if (result.caret < [...result.value].length) {
          input.setSelectionRange(result.caret, result.caret);
        }
      }
      // Nothing the field may hold changed (only a dropped character): no change to report
      if (result.value === previous) return;
      onChange?.(event);
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.altKey && event.key === "F8") {
        event.preventDefault();
        setShown((val) => !val);
      }
      if (typeof event.getModifierState === "function") {
        setCapsLock(event.getModifierState("CapsLock"));
      }
      onKeyDown?.(event);
    };

    const handleKeyUp = (event: KeyboardEvent<HTMLInputElement>) => {
      if (typeof event.getModifierState === "function") {
        setCapsLock(event.getModifierState("CapsLock"));
      }
      onKeyUp?.(event);
    };

    const handleBlur = (event: FocusEvent<HTMLInputElement>) => {
      setCapsLock(false);
      onBlur?.(event);
    };

    const warningText = dropped
      ? t("auth.password_keyboard_only")
      : capsLock
        ? t("auth.caps_lock_on")
        : null;

    return (
      <div className="flex flex-col">
        <TextField
          ref={ref}
          {...props}
          value={value}
          defaultValue={defaultValue}
          type={shown ? "text" : "password"}
          aria-keyshortcuts="Alt+F8"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          lang="en"
          onKeyDown={handleKeyDown}
          onKeyUp={handleKeyUp}
          onBlur={handleBlur}
          onChange={handleChange}
          trailing={
            <IconButton
              plain
              tabIndex={-1}
              className="size-9! min-h-9!"
              label={t("auth.show_password")}
              aria-pressed={shown}
              icon={shown ? <EyeOffIcon /> : <EyeIcon />}
              onClick={() => setShown((val) => !val)}
            />
          }
        />
        {warningText && (
          <p
            role="status"
            aria-live="polite"
            className="m-0 mt-1.5 flex items-start gap-1.5 text-footnote text-ink-secondary"
          >
            {/* A heads-up, not an error: one quiet line, the icon carries the colour */}
            <AlertCircleIcon
              size={16}
              aria-hidden
              className="mt-px shrink-0 text-error"
            />
            <span>{warningText}</span>
          </p>
        )}
      </div>
    );
  },
);
