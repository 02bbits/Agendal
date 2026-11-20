import { useEffect } from "react";
import { ROUTES } from "@/ui";
import { isAuthPath } from "./frameRoutes";

/** Marks <html> while one of these is open, so the page styles can follow. */
function useRootFlag(name: string, on: boolean) {
  useEffect(() => {
    if (on) document.documentElement.setAttribute(name, "true");
    else document.documentElement.removeAttribute(name);
  }, [name, on]);
}

/** The /account page and the sign-in screens style the page around them differently. */
export function usePageFlags(pathname: string) {
  useRootFlag("data-account-page", pathname === ROUTES.account);
  useRootFlag("data-auth-page", isAuthPath(pathname));
}
