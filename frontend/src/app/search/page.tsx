"use client";
import { useWideScreen } from "@/ui/components/useMediaQuery";

import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { projects as fetchProjects, search as apiSearch } from "@/lib/taskApi";
import { listNotes, noteEntriesToHits, searchNotes } from "@/lib/noteApi";
import { SearchScreen, useToday, type NoteHit, type Project } from "@/ui";
import { useAppFrame } from "../AppFrame";
import { appClock } from "../appClock";

function SearchContent() {
  const router = useRouter();
  const { back, navigate, settings, openSearch } = useAppFrame();
  const isWide = useWideScreen();
  const [projectList, setProjectList] = useState<Project[]>([]);
  const [recentNotes, setRecentNotes] = useState<NoteHit[]>([]);
  const today = useToday(appClock);

  useEffect(() => {
    if (isWide) {
      router.replace("/");
      openSearch();
    }
  }, [isWide, router, openSearch]);

  useEffect(() => {
    if (!isWide) {
      fetchProjects()
        .then((res) => setProjectList(res ?? []))
        .catch(() => {});
      listNotes("all")
        .then((res) =>
          setRecentNotes(noteEntriesToHits((res?.items ?? []).slice(0, 5))),
        )
        .catch(() => {});
    }
  }, [isWide]);

  if (isWide) {
    return null;
  }

  return (
    <SearchScreen
      onBack={back}
      navigate={navigate}
      projects={projectList}
      recentNotes={recentNotes}
      today={today}
      timeFormat={settings.timeFormat}
      searchTasks={apiSearch}
      searchNotes={searchNotes}
    />
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={null}>
      <SearchContent />
    </Suspense>
  );
}
