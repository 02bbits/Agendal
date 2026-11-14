import {
  useEffect,
  useMemo,
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
import { cx } from "../../components/cx";
import { useMediaQuery } from "../../components/useMediaQuery";
import {
  CheckIcon,
  ChevronDownIcon,
  LockIcon,
  SearchIcon,
} from "../../components/icons";
import { t } from "../../copy";
import { formatTime } from "../../domain/dates";
import type { TimeFormat, WeekStart } from "../../domain/types";
import { ROUTES } from "../shell/routes";
import { AuthLayout } from "./AuthLayout";
import type { SetupPayload, SetupScreenProps } from "./setupTypes";
import { displayNameError } from "./validation";

export type { SetupPayload, SetupScreenProps };

const noSubscribe = () => () => {};

function getUtcOffset(zone: string, date: Date = now()): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      timeZoneName: "shortOffset",
    }).formatToParts(date);
    const tzPart = parts.find((p) => p.type === "timeZoneName");
    if (tzPart?.value) return tzPart.value;
  } catch {}
  return "";
}

export function SetupScreen({
  initialName = "",
  initialWeekStart = "mon",
  initialTimeFormat = "24h",
  initialTimeZone,
  onContinue,
  onSkip,
  navigate,
  showToast,
  changeSettings,
}: SetupScreenProps): ReactElement {
  const [currentStep, setCurrentStep] = useState(1);
  const [name, setName] = useState(initialName);
  const [nameTouched, setNameTouched] = useState(false);

  const [weekStart, setWeekStart] = useState<WeekStart>(initialWeekStart);
  const [timeFormat, setTimeFormat] = useState<TimeFormat>(initialTimeFormat);
  const [manualZone, setManualZone] = useState<string | null>(
    initialTimeZone ?? null,
  );
  const [isChangingZone, setIsChangingZone] = useState(false);
  const [zoneFilter, setZoneFilter] = useState("");
  const [twoFactor, setTwoFactor] = useState(false);

  const [busy, setBusy] = useState(false);
  // Desktop centres the card: hold its height so the card and Continue don't move between steps
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const [error, setError] = useState<string | null>(null);

  const headingRef = useRef<HTMLHeadingElement>(null);
  const changeZoneButtonRef = useRef<HTMLButtonElement>(null);

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
  const deviceZone = mounted ? getDeviceTimeZone() : "UTC";
  const currentZone = manualZone ?? deviceZone;
  const offset = mounted ? getUtcOffset(currentZone) : "";
  const displayZoneText = offset ? `${currentZone} · ${offset}` : currentZone;

  const supportedZones = useMemo(() => {
    if (
      typeof Intl !== "undefined" &&
      typeof Intl.supportedValuesOf === "function"
    ) {
      return Intl.supportedValuesOf("timeZone");
    }
    return [
      "UTC",
      "Asia/Ho_Chi_Minh",
      "America/New_York",
      "Europe/London",
      "Asia/Tokyo",
    ];
  }, []);

  const filteredZones = useMemo(() => {
    const q = zoneFilter.trim().toLowerCase();
    if (!q) return supportedZones;
    return supportedZones.filter((z) => z.toLowerCase().includes(q));
  }, [supportedZones, zoneFilter]);

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
    if (manualZone !== null) {
      payload.timezone = manualZone;
    } else {
      payload.timezone_auto = true;
    }

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
      if (payload.timezone) {
        mePayload.timezone = payload.timezone;
      } else {
        mePayload.timezone_auto = true;
      }

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

      // 3. Complete
      changeSettings?.({
        weekStart: payload.week_start,
        timeFormat: payload.time_format,
        ...(payload.timezone
          ? { timezone: payload.timezone, timezoneAuto: false }
          : {}),
        ...(payload.timezone_auto ? { timezoneAuto: true } : {}),
      });

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
                maxLength={60}
                onChange={(e) => {
                  setName(e.target.value);
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

                {/* Row 3: Time zone */}
                <div className="flex min-h-14 items-center justify-between gap-3 px-4 py-2.5">
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-body text-ink">
                      {t("setup.time_zone")}
                    </span>
                    <span className="text-footnote text-ink-secondary truncate">
                      {displayZoneText}
                    </span>
                  </div>
                  <button
                    ref={changeZoneButtonRef}
                    type="button"
                    aria-expanded={isChangingZone}
                    aria-controls="setup-tz-panel"
                    onClick={() => setIsChangingZone((prev) => !prev)}
                    className="focus-ring inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-lg border-0 bg-transparent px-2 text-footnote font-medium text-ink hover:bg-fill"
                  >
                    <span>{t("setup.time_zone_change")}</span>
                    <ChevronDownIcon
                      size={16}
                      className={cx(
                        "shrink-0 text-ink-secondary transition-transform duration-200",
                        isChangingZone && "rotate-180",
                      )}
                    />
                  </button>
                </div>

                {/* Extra row when open */}
                {isChangingZone && (
                  <div
                    id="setup-tz-panel"
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        e.preventDefault();
                        e.stopPropagation();
                        setIsChangingZone(false);
                        changeZoneButtonRef.current?.focus();
                      }
                    }}
                    className="flex flex-col gap-3 p-4 bg-surface"
                  >
                    <TextField
                      label={t("setup.time_zone_search")}
                      value={zoneFilter}
                      onChange={(e) => setZoneFilter(e.target.value)}
                      leading={<SearchIcon size={18} />}
                      autoFocus
                    />
                    <div
                      role="listbox"
                      aria-label={t("setup.time_zone")}
                      className="max-h-64 overflow-y-auto divide-y divide-separator/20 overscroll-contain"
                    >
                      {filteredZones.map((z) => {
                        const isCurrent = z === currentZone;
                        return (
                          <button
                            key={z}
                            type="button"
                            role="option"
                            aria-selected={isCurrent}
                            onClick={() => {
                              setManualZone(z);
                              setIsChangingZone(false);
                              setZoneFilter("");
                              changeZoneButtonRef.current?.focus();
                            }}
                            className="flex min-h-11 h-11 w-full items-center justify-between px-3 text-left text-body text-ink hover:bg-fill cursor-pointer rounded-lg transition-colors"
                          >
                            <span className="truncate">{z}</span>
                            {isCurrent && (
                              <CheckIcon
                                size={18}
                                className="shrink-0 text-primary"
                              />
                            )}
                          </button>
                        );
                      })}
                      {filteredZones.length === 0 && (
                        <p className="px-3 py-4 text-center text-footnote text-ink-tertiary">
                          {t("settings.none_found")}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Use device's time zone link when picked by hand */}
              {manualZone !== null && (
                <button
                  type="button"
                  onClick={() => {
                    setManualZone(null);
                    setIsChangingZone(false);
                  }}
                  className="focus-ring mt-1 inline-flex min-h-11 cursor-pointer items-center self-start border-0 bg-transparent px-1 text-footnote text-primary"
                >
                  <span className="link-swipe leading-4">
                    {t("setup.time_zone_auto")}
                  </span>
                </button>
              )}
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
