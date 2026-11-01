import { use } from "react";
import { ProjectClient } from "./ProjectClient";

export const instant = false;

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function Page({ params }: PageProps) {
  const { id } = use(params);
  return <ProjectClient id={id} />;
}
