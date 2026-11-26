import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { ApiRequestError } from "../../../lib/apiError";
import {
  markMicNoticeSeen,
  micNoticeSeen,
  record,
  transcribe,
  type DictationError,
  type Recording,
} from "../../../lib/dictation";
import { t, type CopyKey } from "../../copy";
import { IconButton } from "../../components/IconButton";
import { MicIcon, XIcon } from "../../components/icons";
import { Button } from "../../components/Button";
import { useDrawerDrag } from "../../components/useDrawerDrag";
import { StatusMark } from "../../components/StatusMark";
import { useHistoryEntry } from "../../components/useHistoryEntry";
import { useModalFocus } from "../../components/useModalFocus";

export interface DictationSheetProps {
  /** Offline the mic can't work: the sheet only says so (NC §2.3). */
  offline?: boolean;
  /** ×, Escape, Back or a tap on the scrim: the recording, if any, is dropped. */
  onClose(): void;
  /** The words heard, once written down: they go into the note, to check before Make tasks. */
  onWords(text: string): void;
}

type Phase =
  | { kind: "notice" }
  | { kind: "listening"; started: number }
  | { kind: "writing" }
  | { kind: "message"; key: CopyKey; seconds?: number };

const BARS = 32;
// RMS of normal speech is about 0.02–0.2: this gain fills the bar height without clipping most of it
const LEVEL_GAIN = 12;

const nowMs = () => performance.now();
const silentBars = (): number[] => new Array(BARS).fill(0);

const clock = (ms: number) => {
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
};

/**
 * Dictation (NC-3): a drawer that slides up inside the note, over its lower part, that records, shows the time
 * and a live waveform, and hands the words heard to the note once Stop is tapped.
 */
export function DictationSheet({
  offline,
  onClose,
  onWords,
}: DictationSheetProps) {
  const [phase, setPhase] = useState<Phase>(() =>
    offline
      ? { kind: "message", key: "note.dictation_offline" }
      : micNoticeSeen()
        ? { kind: "listening", started: performance.now() }
        : { kind: "notice" },
  );
  const [levels, setLevels] = useState(silentBars);
  const [now, setNow] = useState(nowMs);
  const recording = useRef<Recording | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const titleId = useId();

  // ×, Escape, Back or the scrim: the recording, if any, is dropped
  const close = () => {
    recording.current?.cancel();
    onClose();
  };
  useModalFocus(sheetRef, titleRef, true, close);
  useHistoryEntry(true, close);
  const drawer = useDrawerDrag(close);

  const start = () => {
    if (recording.current) return;
    setLevels(silentBars());
    const current = record((level) =>
      setLevels((previous) => [
        ...previous.slice(1),
        Math.min(1, level * LEVEL_GAIN),
      ]),
    );
    recording.current = current;
    setPhase({ kind: "listening", started: performance.now() });
    current.done
      .then((audio) => {
        if (recording.current !== current) return null;
        if (!audio) return "";
        setPhase({ kind: "writing" });
        return transcribe(audio);
      })
      .then((words) => {
        if (words === null) return;
        if (words) onWords(words);
        else setPhase({ kind: "message", key: "note.no_speech" });
      })
      .catch((error: DictationError | unknown) =>
        setPhase(
          error instanceof ApiRequestError && error.status === 429
            ? {
                kind: "message",
                key: "error.rate_limited",
                seconds: error.retryAfter ?? 60,
              }
            : {
                kind: "message",
                key:
                  error === "denied"
                    ? "note.mic_denied"
                    : "note.dictation_failed",
              },
        ),
      )
      .finally(() => {
        if (recording.current === current) recording.current = null;
      });
  };

  // Opened from the capture bar's mic: recording starts in that tap, which iOS needs for audio
  useLayoutEffect(() => {
    // Starts the recorder inside the tap
    if (phase.kind === "listening") start();
    return () => {
      // Forgotten as well as dropped, so a remount (React's dev double run) records afresh
      recording.current?.cancel();
      recording.current = null;
    };
    // Once, when the sheet opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The timer ticks while listening
  const listening = phase.kind === "listening";
  useEffect(() => {
    if (!listening) return;
    const id = setInterval(() => setNow(performance.now()), 250);
    return () => clearInterval(id);
  }, [listening]);

  const cancel = (
    <IconButton
      className="size-14! min-h-14! bg-fill!"
      label={t("common.cancel")}
      icon={<XIcon />}
      onClick={close}
    />
  );

  return (
    // Over the note's lower part, with the note dimmed behind it; a tap there closes it like ×
    <div
      className="absolute inset-0 z-10 flex flex-col justify-end rounded-t-sheet bg-scrim backdrop-blur-[2px] motion-safe:animate-fade-in"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-full min-h-0 flex-col rounded-t-sheet bg-surface shadow-lg motion-safe:animate-slide-up"
        style={drawer.style}
      >
        <div
          aria-hidden="true"
          className="flex shrink-0 cursor-grab touch-none justify-center pt-2 pb-3 md:cursor-auto"
          {...drawer.grabber}
        >
          <span className="h-1 w-9 rounded-full bg-fill-2" />
        </div>
        <h2 ref={titleRef} id={titleId} tabIndex={-1} className="sr-only">
          {t("note.mic")}
        </h2>
        <div className="min-h-0 flex-1 overflow-y-auto px-gutter pb-[calc(20px+env(safe-area-inset-bottom))] md:px-gutter-wide md:pb-5">
          {phase.kind === "notice" ? (
            <div className="flex flex-col gap-4 pt-2">
              <p className="m-0 text-center text-body text-ink-secondary">
                {t("note.mic_notice")}
              </p>
              <div className="flex items-center justify-center gap-4">
                {cancel}
                <Button
                  variant="primary"
                  onClick={() => {
                    markMicNoticeSeen();
                    start();
                  }}
                >
                  {t("common.continue")}
                </Button>
              </div>
            </div>
          ) : (
            // One 16px rhythm between every row, and the status row keeps its height when empty, so nothing jumps
            <div className="flex flex-col gap-4">
              <p
                role="status"
                className="m-0 flex min-h-5 items-center justify-center gap-2 text-footnote font-semibold tabular-nums"
              >
                {listening && (
                  <span
                    aria-hidden="true"
                    className="size-2 rounded-full bg-error motion-safe:animate-pulse"
                  />
                )}
                {listening
                  ? `${t("note.listening")} ${clock(Math.max(0, now - phase.started))}`
                  : null}
              </p>
              <div
                aria-hidden="true"
                className="flex h-16 items-center justify-center gap-1"
              >
                {levels.map((level, i) => (
                  <span
                    key={i}
                    className="w-1 rounded-full bg-primary transition-[height] duration-100"
                    style={{
                      // Flat after an error: the last recording's shape would look like it is still listening
                      height: `${6 + (phase.kind === "message" ? 0 : level) * 58}px`,
                      opacity: listening ? 1 : 0.35,
                    }}
                  />
                ))}
              </div>
              {phase.kind === "writing" ? (
                <p className="m-0 text-center text-body">
                  <StatusMark />
                  <span className="shiny-text">{t("note.reading")}</span>
                </p>
              ) : phase.kind === "message" ? (
                <p
                  role="alert"
                  className="m-0 text-center text-body text-ink-secondary"
                >
                  {t(phase.key, { seconds: phase.seconds ?? 0 })}
                </p>
              ) : null}
              <div className="flex items-center justify-center gap-6">
                {cancel}
                {listening ? (
                  <button
                    type="button"
                    aria-label={t("note.stop")}
                    className="focus-ring grid size-[70px] cursor-pointer place-items-center rounded-full border-0 bg-error shadow-md ring-8 ring-error/20"
                    onClick={() => recording.current?.stop()}
                  >
                    <span className="size-5 rounded-[5px] bg-error-content" />
                  </button>
                ) : (
                  <IconButton
                    className="size-[70px]! bg-primary! text-primary-content!"
                    label={t("note.mic")}
                    icon={<MicIcon size={28} />}
                    disabled={phase.kind === "writing" || offline}
                    onClick={start}
                  />
                )}
              </div>
              {listening && (
                <p className="m-0 text-center text-overline text-ink-tertiary">
                  {t("note.dictation_hint")}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
