import TaskDetailsClient, { SKELETON_DELAY_MS } from "./TaskDetailsClient";

export const instant = false;
export { SKELETON_DELAY_MS };

interface PageProps {
  params: Promise<{ id: string }> | { id: string };
}

export default function TaskDetailsPage(props: PageProps) {
  return <TaskDetailsClient {...props} />;
}
