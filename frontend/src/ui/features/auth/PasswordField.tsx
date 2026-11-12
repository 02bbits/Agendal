import { forwardRef, useState, type KeyboardEvent } from "react";
import { t } from "../../copy";
import { IconButton } from "../../components/IconButton";
import { EyeIcon, EyeOffIcon } from "../../components/icons";
import { TextField, type TextFieldProps } from "../../components/TextField";

export type PasswordFieldProps = Omit<TextFieldProps, "type" | "trailing">;

/** Password with an eye button: one fixed label, pressed state in aria-pressed (A11Y-60). */
export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(
  function PasswordField({ onKeyDown, ...props }, ref) {
    const [shown, setShown] = useState(false);

    const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.altKey && event.key === "F8") {
        event.preventDefault();
        setShown((value) => !value);
      }
      onKeyDown?.(event);
    };

    return (
      <TextField
        ref={ref}
        {...props}
        type={shown ? "text" : "password"}
        aria-keyshortcuts="Alt+F8"
        onKeyDown={handleKeyDown}
        trailing={
          <IconButton
            plain
            tabIndex={-1}
            className="size-9! min-h-9!"
            label={t("auth.show_password")}
            aria-pressed={shown}
            icon={shown ? <EyeOffIcon /> : <EyeIcon />}
            onClick={() => setShown((value) => !value)}
          />
        }
      />
    );
  },
);
