import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { today as getToday } from "@/lib/clock";
import { t } from "../copy";
import {
  fromIso,
  pad,
  step,
  toIso,
  typeDigit,
  type Segment,
  type Segments,
} from "./dateSegments";

export interface UseDateFieldOptions {
  value: string | null;
  onChange: (value: string | null) => void;
  onCommit?: (value: string) => void;
  onCancel?: () => void;
  autoFocus?: boolean;
}

export function useDateField({
  value,
  onChange,
  onCommit,
  onCancel,
  autoFocus,
}: UseDateFieldOptions) {
  const [prevValue, setPrevValue] = useState<string | null>(value);
  const [segments, setSegments] = useState<Segments>(() => fromIso(value));
  const [focusedSegment, setFocusedSegment] = useState<Segment | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (value !== prevValue) {
    setPrevValue(value);
    setSegments(fromIso(value));
    setError(null);
  }

  const dayRef = useRef<HTMLSpanElement | null>(null);
  const monthRef = useRef<HTMLSpanElement | null>(null);
  const yearRef = useRef<HTMLSpanElement | null>(null);

  const getRef = useCallback((seg: Segment) => {
    switch (seg) {
      case "day":
        return dayRef;
      case "month":
        return monthRef;
      case "year":
        return yearRef;
    }
  }, []);

  useEffect(() => {
    if (autoFocus) {
      dayRef.current?.focus();
    }
  }, [autoFocus]);

  const onSegmentKeyDown = useCallback(
    (seg: Segment, e: KeyboardEvent<HTMLSpanElement>) => {
      const todayStr = getToday();

      if (/^\d$/.test(e.key)) {
        e.preventDefault();
        const { value: nextVal, advance } = typeDigit(
          seg,
          segments[seg],
          e.key,
        );
        const next = { ...segments, [seg]: nextVal };
        setSegments(next);
        setError(null);
        const iso = toIso(next);
        if (iso) onChange(iso);
        if (advance) {
          if (seg === "day") monthRef.current?.focus();
          else if (seg === "month") yearRef.current?.focus();
        }
        return;
      }

      if (e.key === "Tab") {
        if (!e.shiftKey) {
          if (seg === "day") {
            e.preventDefault();
            const padded = pad("day", segments.day);
            const next = { ...segments, day: padded };
            setSegments(next);
            const iso = toIso(next);
            if (iso) onChange(iso);
            monthRef.current?.focus();
          } else if (seg === "month") {
            e.preventDefault();
            const padded = pad("month", segments.month);
            const next = { ...segments, month: padded };
            setSegments(next);
            const iso = toIso(next);
            if (iso) onChange(iso);
            yearRef.current?.focus();
          }
          // Tab on year: leave field normally
        } else {
          if (seg === "year") {
            e.preventDefault();
            monthRef.current?.focus();
          } else if (seg === "month") {
            e.preventDefault();
            dayRef.current?.focus();
          }
          // Shift+Tab on day: leave field normally
        }
        return;
      }

      if (
        e.key === "ArrowRight" ||
        e.key === "/" ||
        e.key === "." ||
        e.key === "-"
      ) {
        e.preventDefault();
        const padded = pad(seg, segments[seg]);
        const next = { ...segments, [seg]: padded };
        setSegments(next);
        const iso = toIso(next);
        if (iso) onChange(iso);
        if (seg === "day") monthRef.current?.focus();
        else if (seg === "month") yearRef.current?.focus();
        return;
      }

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (seg === "year") monthRef.current?.focus();
        else if (seg === "month") dayRef.current?.focus();
        return;
      }

      if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault();
        const delta = e.key === "ArrowUp" ? 1 : -1;
        const stepped = step(seg, segments[seg], delta, todayStr);
        const next = { ...segments, [seg]: stepped };
        setSegments(next);
        setError(null);
        const iso = toIso(next);
        if (iso) onChange(iso);
        return;
      }

      if (e.key === "Backspace") {
        e.preventDefault();
        if (segments[seg].length > 0) {
          const nextVal = segments[seg].slice(0, -1);
          const next = { ...segments, [seg]: nextVal };
          setSegments(next);
          if (!next.day && !next.month && !next.year) {
            onChange(null);
          } else {
            const iso = toIso(next);
            if (iso) onChange(iso);
          }
        } else {
          if (seg === "year") monthRef.current?.focus();
          else if (seg === "month") dayRef.current?.focus();
        }
        return;
      }

      if (e.key === "Enter") {
        e.preventDefault();
        const iso = toIso(segments);
        if (iso) {
          setError(null);
          onCommit?.(iso);
        } else {
          setError(t("task.date_invalid"));
        }
        return;
      }

      if (e.key === "Escape") {
        e.stopPropagation();
        onCancel?.();
        return;
      }
    },
    [segments, onChange, onCommit, onCancel],
  );

  const applyIso = useCallback(
    (iso: string) => {
      const segs = fromIso(iso);
      setSegments(segs);
      setError(null);
      onChange(iso);
      onCommit?.(iso);
    },
    [onChange, onCommit],
  );

  return {
    segments,
    setSegments,
    focusedSegment,
    setFocusedSegment,
    error,
    setError,
    dayRef,
    monthRef,
    yearRef,
    getRef,
    onSegmentKeyDown,
    applyIso,
  };
}
