import { t } from "../../copy";
import { cx } from "../../components/cx";
import { passwordStrength } from "../../domain/passwordStrength";

const WORDS = [
  undefined,
  "auth.strength_weak",
  "auth.strength_fair",
  "auth.strength_good",
  "auth.strength_strong",
] as const;

const COLORS = ["", "bg-error", "bg-warning", "bg-info", "bg-success"];

/** Four-segment strength bar with its word and hint, for a new password (Register, Change password). */
export function PasswordStrength({
  id,
  password,
  hint = true,
}: {
  id: string;
  password: string;
  /** The "longer is stronger" line; off where the field's helper already says it */
  hint?: boolean;
}) {
  const score = passwordStrength(password);
  const word = WORDS[score];
  return (
    <div id={id} aria-live="polite" className="flex flex-col gap-1 mt-1">
      <div className="flex gap-1.5 h-1 w-full" aria-hidden="true">
        {[1, 2, 3, 4].map((seg) => (
          <div
            key={seg}
            className={cx(
              "flex-1 h-full rounded-full transition-colors",
              score >= seg ? COLORS[score] : "bg-fill-2",
            )}
          />
        ))}
      </div>
      {/* Holds a line's height before the word shows, so the form doesn't move */}
      <div className="flex min-h-[1lh] items-start gap-3 text-caption">
        {word && (
          <span className="shrink-0 whitespace-nowrap font-semibold text-ink">
            {t(word)}
          </span>
        )}
        {hint && (
          <span className="min-w-0 flex-1 text-ink-tertiary">
            {t("auth.strength_hint")}
          </span>
        )}
      </div>
    </div>
  );
}
