import { Suspense } from "react";
import { UpcomingClient } from "./UpcomingClient";
import { TabFallback } from "../TabFallback";

export default function Page() {
  return (
    <Suspense fallback={<TabFallback tab="upcoming" />}>
      <UpcomingClient />
    </Suspense>
  );
}
