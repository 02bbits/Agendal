import { Suspense, use } from "react";
import { ProjectClient } from "./ProjectClient";
import { ProjectSkeleton } from "../../skeletons";

export const instant = false;

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function Page({ params }: PageProps) {
  const { id } = use(params);
  return (
    <Suspense fallback={<ProjectSkeleton />}>
      <ProjectClient id={id} />
    </Suspense>
  );
}
