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
 * Latin letters with accents (á, â, ơ, ư, đ…). Vietnamese typing (Unikey, EVKey) turns keys into
 * these even in a hidden password field, so a new password may not have them (AA §2.10).
 */
export const hasAccentedLetters = (value: string) =>
  /[À-ɏḀ-ỿ]/.test(value.normalize("NFC"));

/**
 * A new password may use only what an English keyboard types (printable ASCII, space included)
 * and emoji. Anything else, such as Vietnamese accents from Unikey or CJK input, is refused
 * on submit (AA §2.10, the server checks the same).
 */
export function hasNonKeyboardCharacters(value: string): boolean {
  return /[^\x20-\x7E\p{Extended_Pictographic}\u{FE0F}\u{200D}\u{1F3FB}-\u{1F3FF}\u{1F1E6}-\u{1F1FF}\u{20E3}]/u.test(
    value,
  );
}

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

/** The email, or its name part when 3+ characters, inside the password (case-insensitive). */
function containsEmail(password: string, email: string): boolean {
  const lower = password.toLowerCase();
  const name = email.split("@")[0] ?? "";
  return lower === email || (name.length >= 3 && lower.includes(name));
}

/** AA §2.1 and BR-17, the same rules the server checks. Length counts characters, not UTF-16 units (AA-E9). */
export function signUpErrors(email: string, password: string): SignUpErrors {
  const errors: SignUpErrors = {};
  const normalized = normalizeEmail(email);
  if (!isEmail(normalized)) errors.email = "auth.email_invalid";

  const length = [...password].length;
  if (length < 8 || length > 128) errors.password = "auth.password_rule";
  else if (containsEmail(password, normalized))
    errors.password = "auth.password_same_as_email";
  return errors;
}
