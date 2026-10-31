import { use } from "react";
import TaskDetailsClient, { SKELETON_DELAY_MS } from "./TaskDetailsClient";

export const instant = false;
export { SKELETON_DELAY_MS };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function TaskDetailsPage({ params }: PageProps) {
  const id = (params as unknown as { id?: string }).id ?? use(params).id;
  return <TaskDetailsClient id={id} />;
}
