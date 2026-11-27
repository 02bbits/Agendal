/**
 * A small status glyph for work in progress: a faint ring with an arc that turns and stretches as it
 * goes, so a long wait doesn't look frozen. Still under reduced motion (UX-52). Decorative: the text
 * beside it says what is happening.
 */
export function StatusMark({ size = 14 }: { size?: number }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 16 16"
      className="mr-1.5 inline-block shrink-0 align-[-2px] motion-safe:animate-spin"
    >
      <circle
        cx="8"
        cy="8"
        r="6.5"
        fill="none"
        strokeWidth="2"
        className="stroke-fill-2"
      />
      <circle
        cx="8"
        cy="8"
        r="6.5"
        fill="none"
        strokeWidth="2"
        strokeLinecap="round"
        pathLength="100"
        className="status-arc stroke-primary"
      />
    </svg>
  );
}
