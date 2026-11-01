import { use } from "react";
import NoteResultClient, { SKELETON_DELAY_MS } from "./NoteResultClient";

export const instant = false;
export { SKELETON_DELAY_MS };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function NoteResultPage({ params }: PageProps) {
  const { id } = use(params);
  return <NoteResultClient id={id} />;
}
