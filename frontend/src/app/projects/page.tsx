import { Suspense } from "react";
import { ProjectsClient } from "./ProjectsClient";
import { TabFallback } from "../TabFallback";

export default function Page() {
  return (
    <Suspense fallback={<TabFallback tab="projects" />}>
      <ProjectsClient />
    </Suspense>
  );
}
