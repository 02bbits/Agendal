"use client";

import { NavBar, RouteEmptyState, t } from "@/ui";
import { useAppFrame } from "../AppFrame";

/** Search route; the search field and results come with IM-30. */
export default function SearchPage() {
  const { back } = useAppFrame();
  return (
    <>
      <NavBar
        backLabel={t("common.back")}
        onBack={back}
        title={t("nav.search")}
      />
      <RouteEmptyState route="search" />
    </>
  );
}
