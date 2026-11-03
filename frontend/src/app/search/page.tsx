"use client";

import { Suspense } from "react";
import { now, timeZone } from "@/lib/clock";
import { httpTaskApi } from "@/lib/taskApi";
import { SearchScreen, TaskStoreProvider, type Clock } from "@/ui";
import { useAppFrame } from "../AppFrame";

const clock: Clock = {
  now,
  get timeZone() {
    return timeZone();
  },
};

function SearchContent() {
  const { back, navigate, settings } = useAppFrame();
  return (
    <TaskStoreProvider
      api={httpTaskApi}
      clock={clock}
      initialTasks={[]}
      initialProjects={[]}
      timeFormat={settings.timeFormat}
    >
      <SearchScreen onBack={back} navigate={navigate} />
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
