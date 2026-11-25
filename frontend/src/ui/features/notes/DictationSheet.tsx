import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
import { Button } from "../../components/Button";
import { IconButton } from "../../components/IconButton";
import { MicIcon, SparklesIcon, XIcon } from "../../components/icons";
import { useHistoryEntry } from "../../components/useHistoryEntry";
import { useModalFocus } from "../../components/useModalFocus";

export interface DictationSheetProps {
  /** Offline the mic can't work: the sheet only says so (NC §2.3). */
  offline?: boolean;
  /** ×, Escape, Back or a tap on the scrim: the recording, if any, is dropped. */
  onClose: () => void;
  /** Edit note: the words go to the note editor to check first. */
  onEdit: (text: string) => void;
  /** Make tasks: the words are sent as a note at once. Resolves once the caller has moved on. */
  onMakeTasks: (text: string) => Promise<void>;
}

type Phase =
  | { kind: "notice" }
  | { kind: "listening"; started: number }
  | { kind: "writing" }
  | { kind: "heard"; text: string }
  | { kind: "message"; key: CopyKey; seconds?: number };

const BARS = 28;
// RMS of normal speech is about 0.02–0.2: this gain fills the bar height without clipping most of it
const LEVEL_GAIN = 8;

const clock = (ms: number) => {
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
};

/**
 * Dictation (NC-3): a bottom sheet (a dialog on a wide screen) that records, shows the time and a
 * live waveform, then the words heard, with Edit note and Make tasks.
 */
export function DictationSheet({
  offline,
  onClose,
  onEdit,
  onMakeTasks,
}: DictationSheetProps) {
  const [phase, setPhase] = useState<Phase>(() =>
    offline
      ? { kind: "message", key: "note.dictation_offline" }
      : micNoticeSeen()
        ? { kind: "listening", started: performance.now() }
        : { kind: "notice" },
  );
  const [levels, setLevels] = useState<number[]>(() => Array(BARS).fill(0));
  const [now, setNow] = useState(() => performance.now());
  const [sending, setSending] = useState(false);
  const recording = useRef<Recording | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef<HTMLParagraphElement>(null);

  const close = () => {
    if (sending) return false;
    recording.current?.cancel();
    onClose();
  };
  useModalFocus(sheetRef, statusRef, true, close);
  useHistoryEntry(true, close);

  const start = () => {
    if (recording.current) return;
    setLevels(Array(BARS).fill(0));
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
        setPhase(
          words
            ? { kind: "heard", text: words }
            : { kind: "message", key: "note.no_speech" },
        );
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

  const makeTasks = async (text: string) => {
    setSending(true);
    await onMakeTasks(text);
    setSending(false);
  };

  if (typeof document === "undefined") return null;

  const status =
    phase.kind === "listening"
      ? `${t("note.listening")} ${clock(Math.max(0, now - phase.started))}`
      : phase.kind === "heard"
        ? t("note.heard")
        : t("note.mic");

  return createPortal(
    <div
      className="modal modal-open modal-bottom bg-scrim motion-safe:animate-fade-in md:modal-middle"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label={t("note.mic")}
        className="modal-box motion-safe:animate-slide-up mx-auto w-full max-w-[600px] rounded-t-sheet rounded-b-none bg-surface px-gutter pt-2 pb-[calc(20px+env(safe-area-inset-bottom))] text-ink shadow-lg md:max-w-[480px] md:rounded-dialog md:pb-6"
      >
        <div
          aria-hidden="true"
          className="mx-auto mb-4 h-1 w-9 rounded-full bg-fill-2 md:hidden"
        />
        <p
          ref={statusRef}
          tabIndex={-1}
          role="status"
          className="m-0 flex items-center justify-center gap-2 text-footnote font-semibold tabular-nums focus:outline-none"
        >
          {listening && (
            <span
              aria-hidden="true"
              className="size-2 rounded-full bg-error motion-safe:animate-pulse"
            />
          )}
          {status}
        </p>

        {phase.kind === "notice" ? (
          <p className="m-0 mt-4 text-center text-body text-ink-secondary">
            {t("note.mic_notice")}
          </p>
        ) : (
          <>
            <div
              aria-hidden="true"
              className="mt-4 flex h-10 items-center justify-center gap-[3px]"
            >
              {levels.map((level, i) => (
                <span
                  key={i}
                  className="w-[3px] rounded-full bg-ink transition-[height] duration-100"
                  style={{
                    height: `${4 + level * 36}px`,
                    opacity: listening ? 1 : 0.35,
                  }}
                />
              ))}
            </div>
            <div className="mt-4 min-h-[88px] rounded-box bg-fill px-3.5 py-3">
              {phase.kind === "writing" ? (
                <p className="m-0 text-body">
                  <span className="shiny-text">{t("note.reading")}</span>
                </p>
              ) : phase.kind === "heard" ? (
                <p className="m-0 text-body whitespace-pre-wrap">
                  {phase.text}
                </p>
              ) : phase.kind === "message" ? (
                <p role="alert" className="m-0 text-body text-ink-secondary">
                  {t(phase.key, { seconds: phase.seconds ?? 0 })}
                </p>
              ) : null}
            </div>
          </>
        )}

        <div className="mt-5 flex items-center justify-center gap-4">
          {phase.kind === "notice" ? (
            <>
              <Button onClick={close}>{t("common.cancel")}</Button>
              <Button
                variant="primary"
                onClick={() => {
                  markMicNoticeSeen();
                  start();
                }}
              >
                {t("common.continue")}
              </Button>
            </>
          ) : phase.kind === "heard" ? (
            <>
              <IconButton
                plain
                label={t("common.cancel")}
                icon={<XIcon />}
                disabled={sending}
                onClick={close}
              />
              <Button
                className="flex-1 whitespace-nowrap"
                disabled={sending}
                onClick={() => onEdit(phase.text)}
              >
                {t("note.edit")}
              </Button>
              <Button
                variant="primary"
                className="flex-1 whitespace-nowrap"
                busy={sending}
                onClick={() => void makeTasks(phase.text)}
              >
                <SparklesIcon size={18} />
                {t("note.make_tasks")}
              </Button>
            </>
          ) : (
            <>
              <IconButton
                className="size-11! bg-fill!"
                label={t("common.cancel")}
                icon={<XIcon />}
                onClick={close}
              />
              {listening ? (
                <button
                  type="button"
                  aria-label={t("note.stop")}
                  className="focus-ring grid size-16 cursor-pointer place-items-center rounded-full border-0 bg-error shadow-md"
                  onClick={() => recording.current?.stop()}
                >
                  <span className="size-5 rounded-[5px] bg-error-content" />
                </button>
              ) : (
                <IconButton
                  className="size-16! bg-primary! text-primary-content!"
                  label={t("note.mic")}
                  icon={<MicIcon size={26} />}
                  disabled={phase.kind === "writing" || offline}
                  onClick={start}
                />
              )}
              {/* Balances the × so the round button stays centred */}
              <span aria-hidden="true" className="size-11" />
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
