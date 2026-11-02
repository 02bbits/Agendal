import { Suspense } from "react";
import { UpcomingClient } from "./UpcomingClient";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <UpcomingClient />
    </Suspense>
  );
}
