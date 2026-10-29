import { forwardRef, useState } from "react";
import { t } from "../../copy";
import { IconButton } from "../../components/IconButton";
import { EyeIcon, EyeOffIcon } from "../../components/icons";
import { TextField, type TextFieldProps } from "../../components/TextField";

export type PasswordFieldProps = Omit<TextFieldProps, "type" | "trailing">;

/** Password with an eye button: one fixed label, pressed state in aria-pressed (A11Y-60). */
export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(
  function PasswordField(props, ref) {
    const [shown, setShown] = useState(false);
    return (
      <TextField
        ref={ref}
        {...props}
        type={shown ? "text" : "password"}
        trailing={
          <IconButton
            plain
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
