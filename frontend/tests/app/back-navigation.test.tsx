import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppFrame, useAppFrame } from "../../src/app/AppFrame";

// AP-4: tab switches replace the history entry, and Back never leaves the app (T-AP-30)
const router = { push: vi.fn(), replace: vi.fn(), back: vi.fn() };
let pathname = "/";
vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useRouter: () => router,
}));

function Buttons({ to }: { to: string }) {
  const { navigate, back } = useAppFrame();
  return (
    <>
      <button onClick={() => navigate(to)}>Go</button>
      <button onClick={back}>Back</button>
    </>
  );
}

const frame = (to = "/") => (
  <AppFrame>
    <Buttons to={to} />
  </AppFrame>
);

beforeEach(() => {
  Object.values(router).forEach((fn) => fn.mockClear());
  pathname = "/";
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("{}", { status: 200 })),
  );
});

const TABS = ["/", "/upcoming", "/projects", "/notes"];
const PUSHED = ["/search", "/account"];
const pairs = [...TABS, ...PUSHED].flatMap((from) =>
  [...TABS, ...PUSHED].filter((to) => to !== from).map((to) => [from, to]),
);

describe("navigation between screens", () => {
  it.each(pairs)("T-AP-30: %s → %s", async (from, to) => {
    pathname = from!;
    render(frame(to));
    await userEvent.click(screen.getByText("Go"));

    const tabSwitch = TABS.includes(from!) && TABS.includes(to!);
    expect(tabSwitch ? router.replace : router.push).toHaveBeenCalledWith(to);
    expect(tabSwitch ? router.push : router.replace).not.toHaveBeenCalled();
  });
});

describe("the in-app back button", () => {
  it("goes to the previous screen after moving around in the app", async () => {
    const { rerender } = render(frame("/account"));
    pathname = "/account";
    rerender(frame("/account"));
    await userEvent.click(screen.getByText("Back"));

    expect(router.back).toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it.each([
    ["/account", "/"],
    ["/search", "/"],
    ["/projects/5", "/projects"],
    ["/notes/9", "/notes"],
  ])(
    "from a deep link to %s, goes to %s instead of out of the app",
    async (from, root) => {
      pathname = from!;
      render(frame());
      await userEvent.click(screen.getByText("Back"));

      expect(router.replace).toHaveBeenCalledWith(root);
      expect(router.back).not.toHaveBeenCalled();
    },
  );
});
