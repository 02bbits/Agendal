import type { ReactNode, SVGProps } from "react";

// Line icons: rounded caps and joins, drawn in currentColor (theme guide, Icons).
// Decorative by default; give the control around them an accessible name.

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function icon(paths: ReactNode) {
  return function Icon({ size = 20, ...rest }: IconProps) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        focusable="false"
        aria-hidden="true"
        {...rest}
      >
        {paths}
      </svg>
    );
  };
}

export const XIcon = icon(<path d="M6 6l12 12M18 6L6 18" />);
export const PlusIcon = icon(<path d="M12 5v14M5 12h14" />);
export const CheckIcon = icon(<path d="M5 12.5l4.5 4.5L19 7.5" />);
export const CheckCircleIcon = icon(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M8.5 12.5l2.5 2.5 4.5-5" />
  </>,
);
export const SearchIcon = icon(
  <>
    <circle cx="11" cy="11" r="6.5" />
    <path d="M20 20l-4.2-4.2" />
  </>,
);
export const PencilIcon = icon(
  <path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4" />,
);
export const MicIcon = icon(
  <>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5.5 11a6.5 6.5 0 0013 0M12 17.5V21" />
  </>,
);
export const InboxIcon = icon(
  <>
    <path d="M4 13l2.5-7h11L20 13v6H4v-6z" />
    <path d="M4 13h4.5l1 2h5l1-2H20" />
  </>,
);
export const CalendarIcon = icon(
  <>
    <rect x="4" y="5" width="16" height="15" rx="2.5" />
    <path d="M4 10h16M8.5 3v4M15.5 3v4" />
  </>,
);
export const FolderIcon = icon(
  <path d="M3.5 7.5A2 2 0 015.5 5.5h4l2 2h7a2 2 0 012 2V17a2 2 0 01-2 2h-13a2 2 0 01-2-2V7.5z" />,
);
export const ClockIcon = icon(
  <>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </>,
);
export const BellIcon = icon(
  <path d="M6 16.5V11a6 6 0 0112 0v5.5l1.5 1.5h-15L6 16.5zM10 20.5a2 2 0 004 0" />,
);
export const RepeatIcon = icon(
  <path d="M17 3.5l3 3-3 3M20 6.5H8a4 4 0 00-4 4v1M7 20.5l-3-3 3-3M4 17.5h12a4 4 0 004-4v-1" />,
);
export const FlagIcon = icon(<path d="M5.5 21V4.5M5.5 4.5h11l-2 4 2 4h-11" />);
export const NotesIcon = icon(
  <path d="M8 4h8.5L20 7.5V20H8zM16.5 4v3.5H20M4 8v12.5h12" />,
);
export const TrashIcon = icon(
  <path d="M4.5 7h15M10 4h4M6.5 7l1 13h9l1-13M10 11v5.5M14 11v5.5" />,
);
export const ChevronRightIcon = icon(<path d="M9.5 6l6 6-6 6" />);
export const ChevronLeftIcon = icon(<path d="M14.5 6l-6 6 6 6" />);
export const MoreIcon = icon(
  <>
    <circle cx="5.5" cy="12" r="1" />
    <circle cx="12" cy="12" r="1" />
    <circle cx="18.5" cy="12" r="1" />
  </>,
);
export const SparklesIcon = icon(
  <path d="M10 4l1.6 4.4L16 10l-4.4 1.6L10 16l-1.6-4.4L4 10l4.4-1.6L10 4zM18 14l.8 2.2L21 17l-2.2.8L18 20l-.8-2.2L15 17l2.2-.8L18 14z" />,
);
export const PaperclipIcon = icon(
  <path d="M19 11.5l-7.2 7.2a4.5 4.5 0 01-6.4-6.4l7.6-7.6a3 3 0 014.2 4.2l-7.5 7.5a1.5 1.5 0 01-2.1-2.1l6.8-6.8" />,
);
export const ArrowUpIcon = icon(<path d="M12 19V5M6 11l6-6 6 6" />);
