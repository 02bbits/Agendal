/**
 * Decorative empty-state illustrations. The art lives in public/illustrations as static SVGs,
 * one light and one dark file each (an <img> can't read theme tokens); CSS in globals.css shows
 * the one matching the active theme.
 */
export type EmptyStateIllustrationType = "inbox" | "projects" | "notes";

export function EmptyStateIllustration({
  type,
}: {
  type: EmptyStateIllustrationType;
}) {
  return (
    <>
      {(["light", "dark"] as const).map((theme) => (
        // next/image doesn't optimise SVGs, so a plain <img> does the same job
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={theme}
          src={`/illustrations/empty-${type}-${theme}.svg`}
          alt=""
          width={224}
          height={180}
          className={`empty-illustration-${theme} h-45 w-56 max-w-full`}
        />
      ))}
    </>
  );
}
