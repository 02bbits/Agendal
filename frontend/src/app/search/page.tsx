"use client";

import { Suspense, useEffect, useState } from "react";
import { now, timeZone } from "@/lib/clock";
import {
  httpTaskApi,
  projects as fetchProjects,
  search as apiSearch,
} from "@/lib/taskApi";
import {
  SearchScreen,
  TaskStoreProvider,
  type Clock,
  type Project,
} from "@/ui";
import { useAppFrame } from "../AppFrame";

const clock: Clock = {
  now,
  get timeZone() {
    return timeZone();
  },
};

function SearchContent() {
  const { back, navigate, settings } = useAppFrame();
  const [projectList, setProjectList] = useState<Project[]>([]);

  useEffect(() => {
    fetchProjects()
      .then((res) => setProjectList(res ?? []))
      .catch(() => {});
  }, []);

  return (
    <TaskStoreProvider
      api={httpTaskApi}
      clock={clock}
      initialTasks={[]}
      initialProjects={projectList}
      timeFormat={settings.timeFormat}
    >
      <SearchScreen onBack={back} navigate={navigate} searchFn={apiSearch} />
    </TaskStoreProvider>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={null}>
      <SearchContent />
    </Suspense>
  );
}
