"use client";
import { useWideScreen } from "@/ui/components/useMediaQuery";

import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { projects as fetchProjects, search as apiSearch } from "@/lib/taskApi";
import { searchNotes } from "@/lib/noteApi";
import type { Project } from "@/ui/domain/types";
import { SearchScreen } from "@/ui/features/lists/SearchScreen";
import { useToday } from "@/ui/features/tasks/useToday";
import { useAppFrame } from "../AppFrame";
import { appClock } from "../appClock";

function SearchContent() {
  const router = useRouter();
  const { back, navigate, settings, openSearch } = useAppFrame();
  const isWide = useWideScreen();
  const [projectList, setProjectList] = useState<Project[]>([]);
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
