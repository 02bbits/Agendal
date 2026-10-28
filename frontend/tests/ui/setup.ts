import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  if (typeof document === "undefined") return; // tokens.test.ts runs in node
  cleanup();
  document.documentElement.removeAttribute("data-theme");
});
