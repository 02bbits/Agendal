import { use } from "react";
import { SKELETON_DELAY_MS } from "./NoteResultClient";
import NotesClient from "../NotesClient";

export const instant = false;
export { SKELETON_DELAY_MS };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function NoteResultPage({ params }: PageProps) {
  const { id } = use(params);
  return <NotesClient noteId={id} />;
}
