"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ClipboardEvent,
  type ChangeEvent,
  type MouseEvent,
} from "react";
import {
  animate,
  motion,
  motionValue,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "motion/react";
import { CheckIcon } from "./icons";
import { t } from "../copy";
import { Slot } from "./codeSlots/Slot";
import {
  clamp01,
  digitsOf,
  firstEmptyOf,
  isFull,
  slotsStyle,
  toSlots,
} from "./codeSlots/slots";
import {
  useSuccessWash,
  type CodeSlotsStatus,
} from "./codeSlots/useSuccessWash";

/** A slot is a little taller than wide. */
const SLOT_HEIGHT_RATIO = 1.18;
/** How far a digit sinks under the success wash, as part of the slot's height. */
const SINK_RATIO = 0.5;
/** With reduced motion a wrong code clears after this long. */
const REDUCED_DRAIN_MS = 300;

/** Arrow keys, Home and End move the caret without typing. */
const CARET_KEYS: Record<string, (active: number, length: number) => number> = {
  ArrowLeft: (active) => Math.max(active - 1, 0),
  ArrowRight: (active, length) => Math.min(active + 1, length - 1),
  Home: () => 0,
  End: (_active, length) => length - 1,
};

export type { CodeSlotsStatus };

export interface CodeSlotsProps {
  length?: number;
  value?: string;
  defaultValue?: string;
  onChange?: (code: string) => void;
  onComplete?: (code: string) => void;
  status?: CodeSlotsStatus;
  mask?: boolean;
  caret?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  accentColor?: string;
  inkColor?: string;
  slotColor?: string;
  digitColor?: string;
  dangerColor?: string;
  slotSize?: number;
  gap?: number;
  radius?: number;
  bounce?: number;
  settle?: number;
  rise?: number;
  cascade?: number;
  ariaLabel?: string;
  className?: string;
}

export default function CodeSlots({
  length = 6,
  value,
  defaultValue = "",
  onChange,
  onComplete,
  status = "idle",
  mask = false,
  caret = true,
  disabled = false,
  autoFocus = false,
  accentColor,
  inkColor,
  slotColor,
  digitColor,
  dangerColor,
  slotSize = 44,
  gap = 8,
  radius = 12,
  bounce = 0.2,
  settle = 0.3,
  rise = 8,
  cascade = 20,
  ariaLabel,
  className = "",
}: CodeSlotsProps) {
  const uid = useId();
  const reduce = useReducedMotion();
  const inputRef = useRef<HTMLInputElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const [slots, setSlots] = useState<string[]>(() =>
    toSlots(value ?? defaultValue, length),
  );
  const [active, setActive] = useState<number>(() => firstEmptyOf(slots));
  const [focused, setFocused] = useState<boolean>(false);
  const activeMv = useMotionValue<number>(active);
  const glide = useRef<Set<number>>(new Set());
  const target = useRef<number[]>([]);
  const draining = useRef<boolean>(false);
  const drainTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const emitted = useRef<string>(
    digitsOf(value ?? defaultValue).slice(0, length),
  );
  const slotsRef = useRef<string[]>(slots);
  const live = useRef({ settle, bounce, cascade, reduce });

  useLayoutEffect(() => {
    slotsRef.current = slots;
    live.current = { settle, bounce, cascade, reduce };
  });

  const [springs, setSprings] = useState(() => ({
    len: length,
    mvs: Array.from({ length }, (_, i) =>
      motionValue(toSlots(value ?? defaultValue, length)[i] ? 1 : 0),
    ),
    drops: Array.from({ length }, () =>
      motionValue(status === "success" ? 1 : 0),
    ),
  }));

  if (springs.len !== length) {
    setSprings({
      len: length,
      mvs: Array.from({ length }, (_, i) => motionValue(slots[i] ? 1 : 0)),
      drops: Array.from({ length }, () =>
        motionValue(status === "success" ? 1 : 0),
      ),
    });
  }
  const { mvs, drops } = springs;
  const pitch = slotSize + gap;
  const height = Math.round(slotSize * SLOT_HEIGHT_RATIO);
  const { statusRef, veiled, covered, washClip, checkTransform, checkOpacity } =
    useSuccessWash({
      status,
      drops,
      washRadius: Math.min(radius, slotSize / 2),
      live,
    });

  const drive = useCallback(
    (i: number, to: number, delayMs = 0) => {
      const mv = mvs[i];
      if (!mv) return;
      target.current[i] = to;
      const L = live.current;
      if (L.reduce) {
        mv.jump(to);
        return;
      }
      animate(mv, to, {
        type: "spring",
        duration: L.settle,
        bounce: L.bounce,
        delay: delayMs / 1000,
      });
    },
    [mvs],
  );

  const land = useCallback(
    (i: number, delayMs = 0) => {
      if (mvs[i].get() > 0) mvs[i].jump(0);
      drive(i, 1, delayMs);
    },
    [mvs, drive],
  );

  const moveActive = useCallback(
    (next: number, crossed: number[]) => {
      crossed.forEach((j) => glide.current.add(j));
      activeMv.jump(next);
      setActive(next);
    },
    [activeMv],
  );

  const jumpActive = useCallback(
    (next: number) => {
      glide.current.clear();
      activeMv.jump(next);
      setActive(next);
    },
    [activeMv],
  );

  const caretX = useTransform(() => {
    const a = activeMv.get();
    let x = a * pitch;
    for (let j = 0; j < mvs.length; j++) {
      const h = clamp01(mvs[j].get());
      if (!glide.current.has(j)) continue;
      const to = target.current[j];
      if (to === undefined || h === clamp01(to)) {
        glide.current.delete(j);
        continue;
      }
      x += j < a ? -(1 - h) * pitch : h * pitch;
    }
    return Math.min(Math.max(x, 0), (mvs.length - 1) * pitch);
  });
  const caretTransform = useTransform(caretX, (x) => `translateX(${x}px)`);
  const commit = useCallback(
    (next: string[]) => {
      const prev = slotsRef.current;
      slotsRef.current = next;
      setSlots(next);
      const code = next.join("");
      emitted.current = code;
      onChange?.(code);
      if (!isFull(prev) && isFull(next)) onComplete?.(code);
    },
    [onChange, onComplete],
  );

  const insert = (raw: string, from = active) => {
    const digits = digitsOf(raw);
    // A full code is being checked: more digits never overwrite the last slot
    if (!digits || isFull(slotsRef.current)) return;
    const next = [...slotsRef.current];
    const crossed: number[] = [];
    const step = reduce ? 0 : cascade;
    let i = from;
    for (const ch of digits) {
      if (i >= length) break;
      next[i] = ch;
      land(i, (i - from) * step);
      crossed.push(i);
      i += 1;
    }
    if (!crossed.length) return;
    commit(next);
    moveActive(Math.min(i, length - 1), crossed);
  };

  const clearSlot = (i: number, stepBack = false) => {
    if (!slotsRef.current[i]) {
      if (stepBack) jumpActive(i);
      return;
    }
    const next = [...slotsRef.current];
    next[i] = "";
    drive(i, 0);
    commit(next);
    if (stepBack) moveActive(i, [i]);
  };

  const isBusy = () => disabled || draining.current || status === "success";

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (isBusy() || e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key;
    if (/^[0-9]$/.test(k)) {
      e.preventDefault();
      insert(k);
    } else if (k === "Backspace") {
      e.preventDefault();
      if (slots[active]) clearSlot(active);
      else if (active > 0) clearSlot(active - 1, true);
    } else if (k === "Delete") {
      e.preventDefault();
      clearSlot(active);
    } else if (k in CARET_KEYS) {
      e.preventDefault();
      jumpActive(CARET_KEYS[k]!(active, length));
    }
  };

  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    if (isBusy()) return;
    e.preventDefault();
    insert(e.clipboardData.getData("text"));
  };

  const onInput = (e: ChangeEvent<HTMLInputElement>) => {
    if (isBusy()) return;
    const d = digitsOf(e.target.value);
    if (!d) return;
    insert(d, d.length === 1 ? active : 0);
  };

  const onRowMouseDown = (e: MouseEvent<HTMLDivElement>) => {
    if (disabled) return;
    e.preventDefault();
    const row = rowRef.current;
    if (row && !draining.current && status !== "success") {
      const rect = row.getBoundingClientRect();
      const zoom = rect.width / (row.offsetWidth || rect.width) || 1;
      const i = Math.floor((e.clientX - rect.left) / zoom / pitch);
      jumpActive(Math.max(0, Math.min(i, firstEmptyOf(slotsRef.current))));
    }
    inputRef.current?.focus();
  };

  useEffect(() => {
    glide.current.clear();
    target.current = [];
    const next = Array.from({ length }, (_, i) => slotsRef.current[i] ?? "");
    slotsRef.current = next;
    setSlots(next);
    jumpActive(firstEmptyOf(next));
    const code = next.join("");
    if (code !== emitted.current) {
      emitted.current = code;
      onChange?.(code);
    }
  }, [length, jumpActive, onChange]);

  useEffect(() => {
    if (value === undefined) return;
    const clean = digitsOf(value).slice(0, length);
    if (clean === emitted.current) return;
    emitted.current = clean;
    const prev = slotsRef.current;
    const next = toSlots(clean, length);
    const hidden = statusRef.current === "success";
    const landing: number[] = [];
    const leaving: number[] = [];
    next.forEach((ch, i) => {
      if (ch === prev[i]) return;
      (ch ? landing : leaving).push(i);
    });
    const step = live.current.reduce || hidden ? 0 : live.current.cascade;
    landing.forEach((i, k) => land(i, k * step));
    leaving.reverse().forEach((i, k) => {
      if (hidden) {
        target.current[i] = 0;
        mvs[i].jump(0);
        drops[i].jump(0);
      } else {
        drive(i, 0, k * step);
      }
    });
    slotsRef.current = next;
    setSlots(next);
    moveActive(firstEmptyOf(next), [...landing, ...leaving]);
    if (!isFull(prev) && isFull(next)) onComplete?.(clean);
  }, [
    value,
    length,
    land,
    drive,
    moveActive,
    mvs,
    drops,
    onComplete,
    statusRef,
  ]);

  useEffect(() => {
    if (status !== "error") return;
    const filled = slotsRef.current
      .map((c, i) => (c ? i : -1))
      .filter((i) => i >= 0);
    if (!filled.length) return;
    filled.reverse();
    draining.current = true;
    const L = live.current;
    const step = L.reduce ? 0 : L.cascade;
    filled.forEach((i, k) => drive(i, 0, k * step));
    moveActive(
      0,
      slotsRef.current.map((_, j) => j),
    );
    clearTimeout(drainTimer.current);
    drainTimer.current = setTimeout(
      () => {
        draining.current = false;
        commit(Array.from({ length }, () => ""));
      },
      L.reduce
        ? REDUCED_DRAIN_MS
        : (filled.length - 1) * step + L.settle * 1000,
    );
  }, [status, commit, drive, length, moveActive]);

  useEffect(() => () => clearTimeout(drainTimer.current), []);
  // Focus on mount, and again when the slots are enabled after a check or a lock
  useEffect(() => {
    if (autoFocus && !disabled) inputRef.current?.focus();
  }, [autoFocus, disabled]);

  const view =
    slots.length === length
      ? slots
      : Array.from({ length }, (_, i) => slots[i] ?? "");
  const showCaret =
    caret &&
    focused &&
    !disabled &&
    !veiled &&
    status !== "success" &&
    (status === "error" || !view[active]);

  const inlineStyle = slotsStyle({
    slotSize,
    height,
    gap,
    radius,
    colors: {
      accent: accentColor,
      ink: inkColor,
      slot: slotColor,
      digit: digitColor,
      danger: dangerColor,
    },
  });

  return (
    <div
      className={`code-slots${className ? ` ${className}` : ""}`}
      style={inlineStyle as CSSProperties}
    >
      <div
        ref={rowRef}
        className="code-slots__row"
        data-status={status}
        data-focused={focused ? "" : undefined}
        data-disabled={disabled ? "" : undefined}
        data-covered={covered ? "" : undefined}
        onMouseDown={onRowMouseDown}
      >
        <input
          ref={inputRef}
          className="code-slots__input"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          value=""
          maxLength={length}
          aria-label={ariaLabel ?? t("auth.verify_label")}
          aria-invalid={status === "error"}
          aria-describedby={`${uid}-count`}
          disabled={disabled}
          readOnly={status === "success"}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          onChange={onInput}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        {view.map((ch, i) => (
          <Slot
            key={i}
            mv={mvs[i]}
            drop={drops[i]}
            char={mask && ch ? "•" : ch}
            active={focused && i === active}
            rise={rise}
            sink={Math.round(height * SINK_RATIO)}
          />
        ))}
        <motion.span
          className="code-slots__wash"
          aria-hidden="true"
          style={{ clipPath: washClip }}
        >
          <motion.span
            className="code-slots__check"
            style={{ transform: checkTransform, opacity: checkOpacity }}
          >
            <CheckIcon size={Math.round(slotSize * 0.6)} />
          </motion.span>
        </motion.span>
        <motion.span
          className="code-slots__caret"
          aria-hidden="true"
          data-show={showCaret ? "" : undefined}
          style={{ transform: caretTransform }}
        >
          <span key={active} className="code-slots__caret-line" />
        </motion.span>
      </div>
      <span id={`${uid}-count`} className="code-slots__sr" aria-live="polite">
        {status === "success"
          ? t("code.accepted")
          : t("code.count", { count: view.filter(Boolean).length, length })}
      </span>
    </div>
  );
}
