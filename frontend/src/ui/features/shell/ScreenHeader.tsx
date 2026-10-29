import { forwardRef, type ReactNode } from "react";
import { t } from "../../copy";
import { SearchIcon } from "../../components/icons";
import { Link } from "./Link";
import { ROUTES, type Navigate } from "./routes";

export interface ScreenHeaderProps {
  /** Date or count above the title, e.g. "Friday 23 October" on Inbox. */
  overline?: string;
  title: string;
  /** The account avatar shows the first letter of the name. */
  accountInitial: string;
  navigate?: Navigate;
  children?: ReactNode;
}

/** Tab-screen header: overline, serif display title, Search and Account at the top right. */
export const ScreenHeader = forwardRef<HTMLHeadingElement, ScreenHeaderProps>(
  function ScreenHeader(
    { overline, title, accountInitial, navigate, children },
    ref,
  ) {
    return (
      <header className="mb-5 pt-3 md:pt-8">
        <div className="flex min-h-11 items-center justify-between">
          <p className="text-overline font-semibold uppercase m-0 text-ink-secondary">
            {overline ?? ""}
          </p>
          {/* From 768px the sidebar has Search and Account (UX-27) */}
          <div className="flex items-center gap-1 md:hidden">
            <Link
              href={ROUTES.search}
              navigate={navigate}
              className="btn btn-circle btn-ghost focus-ring size-11 min-h-11 text-ink"
              aria-label={t("nav.search")}
            >
              <SearchIcon size={20} />
            </Link>
            <Link
              href={ROUTES.account}
              navigate={navigate}
              className="focus-ring relative inline-flex size-11 items-center justify-center rounded-full text-footnote font-semibold text-ink before:absolute before:size-[30px] before:rounded-full before:bg-fill [&>span]:relative"
              aria-label={t("nav.account")}
            >
              <span aria-hidden="true">
                {accountInitial.slice(0, 1).toUpperCase()}
              </span>
            </Link>
          </div>
        </div>
        <h1
          ref={ref}
          className="mt-1 font-serif text-display font-semibold focus:outline-none focus-visible:rounded-tile focus-visible:outline-2 focus-visible:outline-primary"
          tabIndex={-1}
        >
          {title}
        </h1>
        {children}
      </header>
    );
  },
);
