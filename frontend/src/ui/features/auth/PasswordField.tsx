import {
  forwardRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
} from "react";
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

    // Accented letters (Vietnamese typing) are reported when the form is sent, not while typing
    const warningText = capsLock ? t("auth.caps_lock_on") : null;

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
          onChange={onChange}
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
