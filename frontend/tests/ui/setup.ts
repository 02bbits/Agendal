import { cleanup, configure } from "@testing-library/react";
import { afterEach } from "vitest";

// findBy and waitFor give up after 1 s by default, which a full parallel run on a busy machine can
// outlast while every single file passes alone
configure({ asyncUtilTimeout: 3000 });

afterEach(() => {
  if (typeof document === "undefined") return; // tokens.test.ts runs in node
  cleanup();
  document.documentElement.removeAttribute("data-theme");
});
