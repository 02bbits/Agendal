import { useRef, type ReactElement } from "react";
import { Button, type ButtonProps } from "../../components/Button";
import { Dialog } from "../../components/Dialog";
import { t, type CopyKey } from "../../copy";

const ACTION = "rounded-2xl! py-3.5 text-base font-semibold";

type Action = {
  label: CopyKey;
  variant: ButtonProps["variant"];
  run: () => void;
};

/**
 * What waits for confirmation: one sign-out tapped in Settings ("this", "everywhere"), or the
 * account menu's one Sign out, which offers both ("either").
 */
export type SignOutChoice = "this" | "everywhere" | "either";

const TEXT: Record<SignOutChoice, { title: CopyKey; body: CopyKey }> = {
  this: { title: "app.sign_out_title", body: "app.sign_out_body" },
  everywhere: {
    title: "app.sign_out_all_title",
    body: "app.sign_out_all_body",
  },
  either: { title: "app.sign_out_title", body: "app.sign_out_body" },
};

/**
 * Sign out asks first (#168): the sign-out chosen, or both from the account menu, then Cancel.
 * Cancel has the focus, so Enter never signs out by mistake; Escape, a tap outside and Back close
 * it too.
 */
export function SignOutDialog({
  choice,
  onSignOut,
  onSignOutEverywhere,
  onClose,
}: {
  /** Open while a choice waits for its confirmation. */
  choice: SignOutChoice | null;
  onSignOut: () => void;
  onSignOutEverywhere?: () => void;
  onClose: () => void;
}): ReactElement {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const text = TEXT[choice ?? "this"];
  const confirm = (run: () => void) => () => {
    onClose();
    run();
  };
  const signOut: Action = {
    label: "app.sign_out",
    variant: "destructive",
    run: onSignOut,
  };
  // Offered next to Sign out it is the second choice; asked on its own it is the action
  const everywhere: Action | null = onSignOutEverywhere
    ? {
        label: "auth.signout_everywhere",
        variant: choice === "either" ? "secondary" : "destructive",
        run: onSignOutEverywhere,
      }
    : null;
  const actions = (
    choice === "either"
      ? [signOut, everywhere]
      : choice === "everywhere"
        ? [everywhere]
        : [signOut]
  ).filter(Boolean) as Action[];

  return (
    <Dialog
      open={choice !== null}
      title={t(text.title)}
      description={t(text.body)}
      onClose={onClose}
      initialFocusRef={cancelRef}
      actions={
        <>
          {actions.map(({ label, variant, run }) => (
            <Button
              key={label}
              variant={variant}
              fullWidth
              className={ACTION}
              onClick={confirm(run)}
            >
              {t(label)}
            </Button>
          ))}
          <Button
            ref={cancelRef}
            variant="outline"
            fullWidth
            className={ACTION}
            onClick={onClose}
          >
            {t("common.cancel")}
          </Button>
        </>
      }
    />
  );
}
