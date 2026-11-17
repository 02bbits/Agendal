import type { Page } from "@playwright/test";

// Opens a page and waits until React has hydrated it: text filled into a field
// before hydration is wiped when React takes the field over. React marks each
// hydrated DOM node with a "__reactFiber" key, so wait for the page heading to have one.
export async function open(page: Page, path: string): Promise<void> {
  await page.goto(path);
  // `next dev` only: its Dev Tools badge sits over the sidebar's Account button
  await page.addStyleTag({
    content: "nextjs-portal { display: none !important; }",
  });
  await page.waitForFunction(() => {
    const heading = document.querySelector("h1");
    return (
      heading !== null &&
      Object.keys(heading).some((key) => key.startsWith("__reactFiber"))
    );
  });
}
