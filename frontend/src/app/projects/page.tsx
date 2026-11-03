import { Suspense } from "react";
import { ProjectsClient } from "./ProjectsClient";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ProjectsClient />
    </Suspense>
  );
}
