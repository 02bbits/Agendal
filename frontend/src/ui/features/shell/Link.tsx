import type { AnchorHTMLAttributes, MouseEvent } from "react";
import type { Navigate } from "./routes";

export interface LinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  navigate?: Navigate;
}

/** A real link (so Back and new tabs work, AP-4) that hands plain clicks to the app router. */
export function Link({ href, navigate, onClick, ...rest }: LinkProps) {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (event.defaultPrevented || !navigate) return;
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    if (navigate(href) !== false) event.preventDefault();
  };
  return <a href={href} onClick={handleClick} {...rest} />;
}
