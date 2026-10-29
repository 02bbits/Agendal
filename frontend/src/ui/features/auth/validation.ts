import type { CopyKey } from "../../copy";

export interface SignUpErrors {
  email?: CopyKey;
  password?: CopyKey;
}

/** Trimmed and lower-cased everywhere (AA-E1). */
export const normalizeEmail = (email: string) => email.trim().toLowerCase();

/** AA §2.1 and BR-17, the same rules the server checks. Length counts characters, not UTF-16 units (AA-E9). */
export function signUpErrors(email: string, password: string): SignUpErrors {
  const errors: SignUpErrors = {};
  const normalized = normalizeEmail(email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized))
    errors.email = "auth.email_invalid";

  const length = [...password].length;
  if (length < 8 || length > 128) errors.password = "auth.password_rule";
  else if (password.toLowerCase() === normalized)
    errors.password = "auth.password_same_as_email";
  return errors;
}
