import {
  forwardRef,
  useState,
  type ChangeEvent,
  type FocusEvent,
  type KeyboardEvent,
} from "react";
import { t } from "../../copy";
import { IconButton } from "../../components/IconButton";
import { EyeIcon, EyeOffIcon } from "../../components/icons";
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
    const [uncontrolledValue, setUncontrolledValue] = useState(
      defaultValue !== undefined ? String(defaultValue) : "",
    );

    const rawValue = value !== undefined ? String(value) : uncontrolledValue;
    const accented = /[\u00C0-\u024F\u1E00-\u1EFF]/.test(
      rawValue.normalize("NFC"),
    );

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

    const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
      if (value === undefined) {
        setUncontrolledValue(event.target.value);
      }
      onChange?.(event);
    };

    const warningText = accented
      ? t("auth.password_accented")
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
            className="m-0 mt-1.5 flex items-center gap-1.5 text-footnote text-error"
          >
            {warningText}
          </p>
        )}
      </div>
    );
  },
);
