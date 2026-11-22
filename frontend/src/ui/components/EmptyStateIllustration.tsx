/** Decorative empty-state illustrations for the main lists. */
export type EmptyStateIllustrationType = "inbox" | "projects" | "notes";

export function EmptyStateIllustration({
  type,
}: {
  type: EmptyStateIllustrationType;
}) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 160 140"
      className="h-36 w-40 max-w-full"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {type === "inbox" && (
        <>
          <circle cx="80" cy="70" r="56" fill="#DBEAFE" />
          <rect
            x="49"
            y="25"
            width="62"
            height="66"
            rx="6"
            fill="#FFFFFF"
            stroke="#2563EB"
            strokeWidth="2.5"
          />
          <path
            d="M62 43H98M62 54H93M62 65H86"
            stroke="#93C5FD"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <path
            d="M36 78L46 59H114L124 78V108A6 6 0 0 1 118 114H42A6 6 0 0 1 36 108V78Z"
            fill="#93C5FD"
            stroke="#2563EB"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          <path
            d="M36 82H61L68 92H92L99 82H124"
            stroke="#2563EB"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
        </>
      )}

      {type === "projects" && (
        <>
          <circle cx="80" cy="70" r="56" fill="#F3E8FF" />
          <path
            d="M28 52V42A7 7 0 0 1 35 35H65L75 46H124A7 7 0 0 1 131 53V104A7 7 0 0 1 124 111H35A7 7 0 0 1 28 104V52Z"
            fill="#C4B5FD"
            stroke="#7C3AED"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          <path d="M28 65H131" stroke="#7C3AED" strokeWidth="2.5" />
          <rect
            x="58"
            y="62"
            width="46"
            height="34"
            rx="5"
            fill="#FFFFFF"
            stroke="#7C3AED"
            strokeWidth="2.5"
          />
          <path
            d="M67 75H95M67 83H86"
            stroke="#C4B5FD"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <circle cx="117" cy="32" r="17" fill="#8B5CF6" />
          <path
            d="M117 23V41M108 32H126"
            stroke="#FFFFFF"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </>
      )}

      {type === "notes" && (
        <>
          <circle cx="80" cy="70" r="56" fill="#FEF3C7" />
          <rect
            x="42"
            y="23"
            width="77"
            height="94"
            rx="7"
            fill="#FCD34D"
            stroke="#D97706"
            strokeWidth="2.5"
            transform="rotate(-7 80 70)"
          />
          <rect
            x="49"
            y="18"
            width="77"
            height="94"
            rx="7"
            fill="#FFFFFF"
            stroke="#D97706"
            strokeWidth="2.5"
          />
          <path
            d="M63 41H108M63 54H112M63 67H98M63 80H105"
            stroke="#FBBF24"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <path
            d="M101 106L125 82L134 91L110 115L98 118Z"
            fill="#F59E0B"
            stroke="#B45309"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path d="M101 106L98 118L110 115Z" fill="#92400E" />
        </>
      )}
    </svg>
  );
}
