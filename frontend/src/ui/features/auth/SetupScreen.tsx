import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactElement,
} from "react";
import { api } from "../../../lib/api";
import {
  localTime,
  now,
  timeZone as getDeviceTimeZone,
} from "../../../lib/clock";
import { Segmented } from "../../components/Segmented";
import { TextField } from "../../components/TextField";
import { Switch } from "../../components/Switch";
import { Stepper, Step } from "../../components/Stepper";
import { useMediaQuery } from "../../components/useMediaQuery";
import { LockIcon } from "../../components/icons";
import { t } from "../../copy";
import { formatTime } from "../../domain/dates";
import type { TimeFormat, WeekStart } from "../../domain/types";
import { ROUTES } from "../shell/routes";
import { AuthLayout } from "./AuthLayout";
import type { SetupPayload, SetupScreenProps } from "./setupTypes";
import { displayNameError, limitDisplayName } from "./validation";

export type { SetupPayload, SetupScreenProps };

const noSubscribe = () => () => {};

export function SetupScreen({
  initialName = "",
  initialWeekStart = "mon",
  initialTimeFormat = "24h",
  onContinue,
  onSkip,
  navigate,
  showToast,
  onSaved,
}: SetupScreenProps): ReactElement {
  const [currentStep, setCurrentStep] = useState(1);
  const [name, setName] = useState(initialName);
  const [nameTouched, setNameTouched] = useState(false);

  const [weekStart, setWeekStart] = useState<WeekStart>(initialWeekStart);
  const [timeFormat, setTimeFormat] = useState<TimeFormat>(initialTimeFormat);
  const [twoFactor, setTwoFactor] = useState(false);

  const [busy, setBusy] = useState(false);
  // Desktop centres the card: hold its height so the card and Continue don't move between steps
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const [error, setError] = useState<string | null>(null);

  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  // Validation for Step 1 Name
  const trimmedName = name.trim();
  const nameErrorKey = displayNameError(name);
  const nameError = nameErrorKey ? t(nameErrorKey) : null;
  const isNameValid = nameError === null;

  // The device zone and the clock are read in the browser only
  const mounted = useSyncExternalStore(
    noSubscribe,
    () => true,
    () => false,
  );
  const currentZone = mounted ? getDeviceTimeZone() : "UTC";

  const formattedExample = mounted
    ? formatTime(localTime(currentZone, now()), timeFormat)
    : "";

  async function handleFinish() {
    setBusy(true);
    setError(null);

    const payload: SetupPayload = {
      display_name: trimmedName,
      week_start: weekStart,
      time_format: timeFormat,
      two_factor_enabled: twoFactor,
    };

    try {
      if (onContinue) {
        await onContinue(payload);
        return;
      }

      // Default implementation:
      // 1. PATCH /me
      const mePayload: Record<string, unknown> = {
        display_name: payload.display_name,
        week_start: payload.week_start,
        time_format: payload.time_format,
      };

      const res = await api("/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mePayload),
      });

      if (!res.ok) {
        setError(t("error.save_failed"));
        setBusy(false);
        return;
      }
      const saved = await res.json();

      // 2. If 2FA enabled: POST /auth/two-factor
      if (twoFactor) {
        const twoFactorRes = await api("/auth/two-factor", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enabled: true }),
        });

        if (!twoFactorRes.ok) {
          setError(t("error.save_failed"));
          setBusy(false);
          return;
        }
      }

      // 3. Complete: the app takes the saved account, no second PATCH or GET /me
      onSaved?.(twoFactor ? { ...saved, two_factor_enabled: true } : saved);

      showToast?.(t("auth.welcome"));
      navigate?.(ROUTES.inbox);
    } catch {
      setError(t("error.save_failed"));
    } finally {
      setBusy(false);
    }
  }

  function handleSkip() {
    if (onSkip) {
      onSkip();
    } else {
      showToast?.(t("auth.welcome"));
      navigate?.(ROUTES.inbox);
    }
  }

  return (
    <AuthLayout framed={true} footerAtBottom={true} wide={true}>
      {/* Phones: a fixed anchor, not centred on the step's height (steps differ, so centring made
          the title and the steps jump on every Continue); the panes grow downward from it */}
      <header className="mt-[max(1.5rem,14dvh)] mb-6 text-center lg:mt-0 lg:mb-0 lg:text-left lg:flex lg:items-start lg:justify-between lg:gap-4">
        <div>
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="m-0 text-[22px] leading-[28px] font-bold tracking-[-0.015em] text-ink outline-none"
          >
            {t("setup.title")}
          </h1>
          <p className="m-0 mt-1 text-footnote text-ink-secondary">
            {t("setup.subtitle")}
          </p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={handleSkip}
          className="fixed top-[max(3.5rem,calc(env(safe-area-inset-top,0px)+1.25rem))] right-[max(0.75rem,env(safe-area-inset-right))] z-10 lg:static lg:-mt-2 lg:-mr-3 shrink-0 whitespace-nowrap min-h-11 px-3 inline-flex items-center rounded-lg border-0 bg-transparent cursor-pointer text-footnote font-semibold text-ink-secondary hover:text-ink focus-ring disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {t("setup.skip")}
        </button>
      </header>

      {/* Phones: these wrappers step aside (display: contents) so the header, steps, pane and
          footer share the card's column, and the header's and footer's auto margins centre the form */}
      <div className="max-lg:contents lg:mt-6 lg:flex lg:flex-1 lg:flex-col">
        <Stepper
          className="max-lg:contents"
          stableHeight={isDesktop}
          footerClassName="mt-auto pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] lg:mt-6 lg:pt-0 lg:pb-0"
          step={currentStep}
          onStepChange={setCurrentStep}
          onFinalStepCompleted={handleFinish}
          linear={true}
          nextButtonText={t("stepper.next")}
          completeButtonText={t("setup.finish")}
          nextButtonProps={{
            disabled: currentStep === 1 ? !isNameValid : busy,
            busy: currentStep === 3 && busy,
          }}
          backButtonProps={{
            disabled: busy,
          }}
          footerExtra={
            error ? (
              <div role="alert" className="mt-2 text-footnote text-error">
                {error}
              </div>
            ) : null
          }
        >
          {/* Step 1: Name */}
          <Step title={t("setup.step_name")}>
            <div className="flex flex-col gap-3 py-2">
              <TextField
                label={t("setup.name_label")}
                value={name}
                onChange={(e) => {
                  setName(limitDisplayName(e.target.value));
                  setNameTouched(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && isNameValid) {
                    e.preventDefault();
                    setCurrentStep(2);
                  }
                }}
                autoFocus
              />
              {nameTouched && nameError && (
                <p role="alert" className="m-0 text-footnote text-error">
                  {nameError}
                </p>
              )}
            </div>
          </Step>

          {/* Step 2: Dates and times */}
          <Step title={t("setup.step_dates")}>
            <div className="flex flex-col py-2">
              <div className="overflow-hidden rounded-box border border-separator bg-surface divide-y divide-separator">
                {/* Row 1: Week starts on */}
                <div className="flex min-h-14 items-center justify-between gap-3 px-4 py-2.5">
                  <span
                    id="setup-week-start-label"
                    className="text-body text-ink"
                  >
                    {t("setup.week_start")}
                  </span>
                  <Segmented
                    aria-labelledby="setup-week-start-label"
                    value={weekStart}
                    onChange={setWeekStart}
                    options={[
                      { value: "mon", label: t("app.week_mon") },
                      { value: "sun", label: t("app.week_sun") },
                    ]}
                  />
                </div>

                {/* Row 2: Time format */}
                <div className="flex min-h-14 items-center justify-between gap-3 px-4 py-2.5">
                  <div className="flex flex-col gap-0.5">
                    <span
                      id="setup-time-format-label"
                      className="text-body text-ink"
                    >
                      {t("setup.time_format")}
                    </span>
                    <span className="text-footnote text-ink-tertiary">
                      {t("setup.time_example", { time: formattedExample })}
                    </span>
                  </div>
                  <Segmented
                    aria-labelledby="setup-time-format-label"
                    value={timeFormat}
                    onChange={setTimeFormat}
                    options={[
                      { value: "24h", label: t("app.time_24h") },
                      { value: "12h", label: t("app.time_12h") },
                    ]}
                  />
                </div>
              </div>
            </div>
          </Step>

          {/* Step 3: Security */}
          <Step title={t("setup.step_security")}>
            <div className="py-2">
              <div className="rounded-box border border-separator bg-surface p-4 flex flex-col gap-1">
                <Switch
                  icon={<LockIcon size={20} />}
                  label={t("setup.two_factor_label")}
                  checked={twoFactor}
                  onChange={setTwoFactor}
                  description={t("setup.two_factor_help")}
                  divider={false}
                />
              </div>
            </div>
          </Step>
        </Stepper>
      </div>
    </AuthLayout>
  );
}
