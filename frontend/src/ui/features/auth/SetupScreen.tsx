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
import { Button } from "../../components/Button";
import { Segmented } from "../../components/Segmented";
import { TextField } from "../../components/TextField";
import { cx } from "../../components/cx";
import { CheckIcon, ChevronDownIcon, SearchIcon } from "../../components/icons";
import { t } from "../../copy";
import { formatTime } from "../../domain/dates";
import type { TimeFormat, WeekStart } from "../../domain/types";
import { ROUTES } from "../shell/routes";
import { AuthLayout } from "./AuthLayout";
import type { SetupScreenProps } from "./setupTypes";

export type { SetupScreenProps };

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
  initialWeekStart = "mon",
  initialTimeFormat = "24h",
  initialTimeZone,
  onContinue,
  onSkip,
  navigate,
  showToast,
  changeSettings,
}: SetupScreenProps): ReactElement {
  const [weekStart, setWeekStart] = useState<WeekStart>(initialWeekStart);
  const [timeFormat, setTimeFormat] = useState<TimeFormat>(initialTimeFormat);
  const [manualZone, setManualZone] = useState<string | null>(
    initialTimeZone ?? null,
  );
  const [isChangingZone, setIsChangingZone] = useState(false);
  const [zoneFilter, setZoneFilter] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const headingRef = useRef<HTMLHeadingElement>(null);
  const changeZoneButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  // The device zone and the clock are read in the browser only: a prerender would bake in the server's
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

  async function handleContinue() {
    setBusy(true);
    setError(null);
    const payload: {
      week_start: WeekStart;
      time_format: TimeFormat;
      timezone?: string;
      timezone_auto?: boolean;
    } = {
      week_start: weekStart,
      time_format: timeFormat,
    };
    if (manualZone !== null) {
      payload.timezone = manualZone;
    } else {
      payload.timezone_auto = true;
    }

    try {
      if (onContinue) {
        await onContinue(payload);
      } else {
        const res = await api("/me", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          setError(t("error.save_failed"));
          setBusy(false);
          return;
        }
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
      }
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
    <AuthLayout framed={false}>
      <header className="mt-6 text-center lg:mt-0 lg:text-left">
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
      </header>

      {/* Grouped settings card */}
      <div className="mt-6 overflow-hidden rounded-box border border-separator bg-surface divide-y divide-separator">
        {/* Row 1: Week starts on */}
        <div className="flex min-h-14 items-center justify-between gap-3 px-4 py-2.5">
          <span id="setup-week-start-label" className="text-body text-ink">
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
            <span id="setup-time-format-label" className="text-body text-ink">
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
            <span className="text-body text-ink">{t("setup.time_zone")}</span>
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
                      <CheckIcon size={18} className="shrink-0 text-primary" />
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
          className="mt-2 text-left text-footnote text-ink underline cursor-pointer bg-transparent border-0 p-0 hover:text-ink/80 focus-ring"
        >
          {t("setup.time_zone_auto")}
        </button>
      )}

      {/* Actions */}
      <div className="mt-auto pt-6 pb-[max(1rem,env(safe-area-inset-bottom))] lg:mt-8 lg:pt-0 lg:pb-0 flex flex-col gap-2">
        {error && (
          <div role="alert" className="text-footnote text-error">
            {error}
          </div>
        )}
        <Button
          type="button"
          variant="primary"
          size="lg"
          fullWidth
          busy={busy}
          onClick={handleContinue}
        >
          {t("setup.continue")}
        </Button>
        <Button
          type="button"
          plain
          size="lg"
          fullWidth
          disabled={busy}
          onClick={handleSkip}
          className="text-ink-secondary hover:text-ink"
        >
          {t("setup.skip")}
        </Button>
      </div>
    </AuthLayout>
  );
}
