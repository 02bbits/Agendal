import type { CopyKey } from "../../copy";

export interface SignUpErrors {
  email?: CopyKey;
  password?: CopyKey;
}

/** Trimmed and lower-cased everywhere (AA-E1). */
export const normalizeEmail = (email: string) => email.trim().toLowerCase();

/**
 * Where to go after sign-in: a same-origin path only, never another site (AA-E11, SEC-24).
 * Browsers drop tabs and newlines from URLs, so "/\t/evil.com" would become "//evil.com".
 */
export function safeReturnPath(next: string | null | undefined): string {
  if (
    !next ||
    !next.startsWith("/") ||
    /^\/[/\\]/.test(next) ||
    /[\u0000-\u001f]/.test(next)
  )
    return "/";
  return next;
}

export const isEmail = (email: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email));

/**
 * A display name (Setup, Settings): 3 to 30 characters once trimmed, with no control, invisible
 * or text-direction characters and no angle brackets. The server checks the same (MeController).
 * The emoji joiner (U+200D) stays allowed.
 */
export function displayNameError(name: string): CopyKey | undefined {
  const trimmed = name.trim();
  const length = [...trimmed].length;
  if (length === 0) return "setup.name_required";
  if (length < 3) return "setup.name_too_short";
  if (length > 30) return "setup.name_too_long";
  if (/[\p{Cc}\p{Zl}\p{Zp}<>]|(?!‍)\p{Cf}/u.test(trimmed)) {
    return "setup.name_invalid";
  }
  return undefined;
}

/** AA §2.1 and BR-17, the same rules the server checks. Length counts characters, not UTF-16 units (AA-E9). */
export function signUpErrors(email: string, password: string): SignUpErrors {
  const errors: SignUpErrors = {};
  const normalized = normalizeEmail(email);
  if (!isEmail(normalized)) errors.email = "auth.email_invalid";

  const length = [...password].length;
  if (length < 8 || length > 128) errors.password = "auth.password_rule";
  else if (password.toLowerCase() === normalized)
    errors.password = "auth.password_same_as_email";
  return errors;
}
