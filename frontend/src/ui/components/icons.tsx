import {
  Children,
  cloneElement,
  Fragment,
  isValidElement,
  type ReactElement,
  type ReactNode,
  type SVGProps,
} from "react";

// Line icons: rounded caps and joins, drawn in currentColor (theme guide, Icons).
// Decorative by default; give the control around them an accessible name.

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function suppressChildren(node: ReactNode): ReactNode {
  if (!isValidElement(node)) return node;
  const element = node as ReactElement<{
    children?: ReactNode;
    suppressHydrationWarning?: boolean;
  }>;
  const children = element.props?.children;
  const newChildren = children
    ? Children.map(children, suppressChildren)
    : undefined;
  if (element.type === Fragment) {
    return cloneElement(element, undefined, newChildren);
  }
  return cloneElement(element, {
    suppressHydrationWarning: true,
    ...(newChildren ? { children: newChildren } : {}),
  });
}

function icon(paths: ReactNode) {
  const suppressedPaths = Children.map(paths, suppressChildren);
  return function Icon({ size = 20, ...rest }: IconProps) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.9}
        strokeLinecap="round"
        strokeLinejoin="round"
        focusable="false"
        aria-hidden="true"
        suppressHydrationWarning
        {...rest}
      >
        {suppressedPaths}
      </svg>
    );
  };
}

export const GripVerticalIcon = icon(
  <>
    <circle cx="9" cy="5" r="1.25" fill="currentColor" stroke="none" />
    <circle cx="9" cy="12" r="1.25" fill="currentColor" stroke="none" />
    <circle cx="9" cy="19" r="1.25" fill="currentColor" stroke="none" />
    <circle cx="15" cy="5" r="1.25" fill="currentColor" stroke="none" />
    <circle cx="15" cy="12" r="1.25" fill="currentColor" stroke="none" />
    <circle cx="15" cy="19" r="1.25" fill="currentColor" stroke="none" />
  </>,
);

export const XIcon = icon(<path d="M18 6 6 18M6 6l12 12" />);
export const PlusIcon = icon(<path d="M12 5v14M5 12h14" />);
export const CheckIcon = icon(<path d="M20 6 9 17l-5-5" />);
export const CheckCircleIcon = icon(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M8.5 12.5l2.5 2.5 4.5-5" />
  </>,
);
export const GridIcon = icon(
  <>
    <rect width="7" height="7" x="3" y="3" rx="1" />
    <rect width="7" height="7" x="14" y="3" rx="1" />
    <rect width="7" height="7" x="14" y="14" rx="1" />
    <rect width="7" height="7" x="3" y="14" rx="1" />
  </>,
);
export const ListIcon = icon(
  <>
    <line x1="8" x2="21" y1="6" y2="6" />
    <line x1="8" x2="21" y1="12" y2="12" />
    <line x1="8" x2="21" y1="18" y2="18" />
    <line x1="3" x2="3.01" y1="6" y2="6" />
    <line x1="3" x2="3.01" y1="12" y2="12" />
    <line x1="3" x2="3.01" y1="18" y2="18" />
  </>,
);
export const SearchIcon = icon(
  <>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.6-3.6" />
  </>,
);
export const PencilIcon = icon(
  <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z" />,
);
export const MicIcon = icon(
  <>
    <rect x="9" y="2.5" width="6" height="12" rx="3" />
    <path d="M18.5 10.5v.5a6.5 6.5 0 0 1-13 0v-.5M12 17.5V21" />
  </>,
);
export const InboxIcon = icon(
  <>
    <path d="M22 12h-6l-2 3h-4l-2-3H2" />
    <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
  </>,
);
export const CalendarIcon = icon(
  <>
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <path d="M16 2v4M8 2v4M3 10h18" />
  </>,
);
export const FolderIcon = icon(
  <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2z" />,
);
export const ClockIcon = icon(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7.5V12l3 2" />
  </>,
);
export const BellIcon = icon(
  <>
    <path d="M6 8.5a6 6 0 0 1 12 0c0 6.5 2.5 8.5 2.5 8.5h-17S6 15 6 8.5" />
    <path d="M10.3 20.5a1.94 1.94 0 0 0 3.4 0" />
  </>,
);
export const SlidersIcon = icon(
  <>
    <line x1="4" x2="4" y1="21" y2="14" />
    <line x1="4" x2="4" y1="10" y2="3" />
    <line x1="12" x2="12" y1="21" y2="12" />
    <line x1="12" x2="12" y1="8" y2="3" />
    <line x1="20" x2="20" y1="21" y2="16" />
    <line x1="20" x2="20" y1="12" y2="3" />
    <line x1="1" x2="7" y1="14" y2="14" />
    <line x1="9" x2="15" y1="8" y2="8" />
    <line x1="17" x2="23" y1="16" y2="16" />
  </>,
);
export const RepeatIcon = icon(
  <>
    <path d="m17 2 4 4-4 4" />
    <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
    <path d="m7 22-4-4 4-4" />
    <path d="M21 13v1a4 4 0 0 1-4 4H3" />
  </>,
);
export const FlagIcon = icon(
  <>
    <path
      d="M5 15s1-1 4-1 5 2 8 2 3-1 3-1V3.5s-1 1-3 1-5-2-8-2-4 1-4 1z"
      fill="currentColor"
    />
    <path d="M5 21.5v-7" />
  </>,
);
export const NotesIcon = icon(
  <>
    <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
    <path d="M14 3v6h6M8 13h8M8 17h5" />
  </>,
);
export const TrashIcon = icon(
  <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" />,
);
export const ChevronRightIcon = icon(<path d="m9 18 6-6-6-6" />);
export const ChevronLeftIcon = icon(<path d="m15 18-6-6 6-6" />);
export const ChevronDownIcon = icon(<path d="m6 9 6 6 6-6" />);
export const MoreIcon = icon(
  <path d="M5 12h.01M12 12h.01M19 12h.01" strokeWidth="3.2" />,
);
export const SparklesIcon = icon(
  <>
    <path d="M11 3.5l1.8 4.9 4.9 1.8-4.9 1.8L11 16.9l-1.8-4.9-4.9-1.8 4.9-1.8z" />
    <path d="M18.5 14.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z" />
  </>,
);
export const PaperclipIcon = icon(
  <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />,
);
export const ArrowUpIcon = icon(<path d="M12 19V5M5 12l7-7 7 7" />);
export const ArrowDownIcon = icon(<path d="M12 5v14M19 12l-7 7-7-7" />);
export const RotateCcwIcon = icon(
  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8m0-5v5h5" />,
);
export const EyeIcon = icon(
  <>
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
  </>,
);
export const EyeOffIcon = icon(
  <>
    <path d="M9.9 5.7A9.6 9.6 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-2.7 3.4M6.6 6.6C3.9 8.3 2.5 12 2.5 12S6 18.5 12 18.5c1.7 0 3.2-.5 4.5-1.2" />
    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2M3.5 3.5l17 17" />
  </>,
);
export const UserIcon = icon(
  <>
    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </>,
);
export const PaletteIcon = icon(
  <path d="M12 2C6.48 2 2 6.48 2 12c0 4.41 3.59 8 8 8h1a2 2 0 0 0 2-2c0-.55-.22-1.05-.59-1.41-.36-.36-.59-.86-.59-1.41 0-1.1.9-2 2-2h1.6c3.53 0 6.4-2.87 6.4-6.4C22 5.67 17.52 2 12 2zM6.5 12a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm3-4a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm3 4a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z" />,
);
export const CreditCardIcon = icon(
  <>
    <rect width="20" height="14" x="2" y="5" rx="2" />
    <line x1="2" x2="22" y1="10" y2="10" />
  </>,
);
export const SidebarIcon = icon(
  <>
    <rect width="18" height="18" x="3" y="3" rx="2" />
    <path d="M9 3v18" />
  </>,
);
export const CloudIcon = icon(
  <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />,
);
export const PlugIcon = icon(
  <>
    <path d="M12 22v-5" />
    <path d="M9 8V2" />
    <path d="M15 8V2" />
    <path d="M18 8v5a6 6 0 0 1-12 0V8c0-.6.4-1 1-1h10c.6 0 1 .4 1 1Z" />
  </>,
);
export const LockIcon = icon(
  <>
    <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </>,
);
