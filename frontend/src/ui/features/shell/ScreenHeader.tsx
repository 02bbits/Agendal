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
  action?: ReactNode;
  navigate?: Navigate;
  onAccount?: () => void;
  children?: ReactNode;
}

/** Tab-screen header: overline, display title, Search and Account at the top right. */
export const ScreenHeader = forwardRef<HTMLHeadingElement, ScreenHeaderProps>(
  function ScreenHeader(
    { overline, title, accountInitial, action, navigate, onAccount, children },
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
              className="focus-ring relative inline-flex size-11 items-center justify-center rounded-full text-ink transition-colors before:absolute before:size-8 before:rounded-full before:bg-fill hover:before:bg-fill-2 [&>svg]:relative"
              aria-label={t("nav.search")}
            >
              <SearchIcon size={20} />
            </Link>
            <Link
              href={ROUTES.account}
              navigate={navigate}
              onClick={(e) => {
                if (onAccount) {
                  e.preventDefault();
                  onAccount();
                }
              }}
              className="focus-ring relative inline-flex size-11 items-center justify-center rounded-full text-footnote font-semibold text-ink before:absolute before:size-8 before:rounded-full before:bg-fill [&>span]:relative cursor-pointer"
              aria-label={t("nav.account")}
            >
              <span aria-hidden="true">
                {accountInitial.slice(0, 1).toUpperCase()}
              </span>
            </Link>
          </div>
        </div>
        <div className="mt-1 flex items-center justify-between gap-4">
          <div>
            <h1
              ref={ref}
              className="text-display font-bold focus:outline-none focus-visible:rounded-tile focus-visible:outline-2 focus-visible:outline-primary m-0"
              tabIndex={-1}
            >
              {title}
            </h1>
            {children}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      </header>
    );
  },
);
