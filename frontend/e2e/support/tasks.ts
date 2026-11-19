import type { Page } from "@playwright/test";

export interface NewTask {
  title: string;
  /** "today" or "YYYY-MM-DD". */
  due?: string;
  repeat?: "daily" | "weekly" | "monthly" | "yearly";
}

/**
 * Makes tasks for the signed-in user through the app's own API, as New task does (POST /tasks
 * with Sanctum's XSRF token), so a spec starts from a known list. "today" is the browser's
 * local day, the one Inbox shows.
 */
export async function createTasks(page: Page, tasks: NewTask[]): Promise<void> {
  await page.evaluate(async (list) => {
    const pad = (n: number) => String(n).padStart(2, "0");
    const now = new Date();
    const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    await fetch("/sanctum/csrf-cookie", { credentials: "same-origin" });
    const xsrf = decodeURIComponent(
      document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]*)/)?.[1] ?? "",
    );
    for (const task of list) {
      const response = await fetch("/api/v1/tasks", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "X-XSRF-TOKEN": xsrf,
        },
        body: JSON.stringify({
          id: crypto.randomUUID(),
          title: task.title,
          ...(task.due
            ? { due_date: task.due === "today" ? today : task.due }
            : {}),
          ...(task.repeat ? { repeat: task.repeat } : {}),
        }),
      });
      if (!response.ok)
        throw new Error(
          `POST /tasks ${response.status}: ${await response.text()}`,
        );
    }
  }, tasks);
}
