import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppFrame, useAppFrame } from "../../src/app/AppFrame";
import { api } from "../../src/lib/api";

// IM-18: a session that ends elsewhere (AA-E6, UX-44) and a different account on this device (AA-E7)
const router = { push: vi.fn(), replace: vi.fn(), back: vi.fn() };
let pathname = "/upcoming";
vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useRouter: () => router,
}));

const indexedDBMock = {
  databases: vi.fn(async () => [{ name: "agendal" }]),
  deleteDatabase: vi.fn(() => {
    const request = {} as IDBOpenDBRequest;
    queueMicrotask(() => request.onsuccess?.({} as Event));
    return request;
  }),
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status });
const me = (id: number) =>
  json(200, { id, email: `user${id}@example.com`, display_name: `User ${id}` });

let meReply: () => Response;
let otherReply: () => Response;

function Who() {
  return <p>{useAppFrame().user?.email ?? "nobody"}</p>;
}

function open() {
  return render(
    <AppFrame>
      <Who />
    </AppFrame>,
  );
}

beforeEach(() => {
  pathname = "/upcoming";
  router.replace.mockClear();
  indexedDBMock.deleteDatabase.mockClear();
  meReply = () => me(1);
  otherReply = () => json(401, { error: { code: "auth.session_expired" } });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) =>
      url === "/api/v1/me" ? meReply() : otherReply(),
    ),
  );
  vi.stubGlobal("indexedDB", indexedDBMock);
  window.history.replaceState(null, "", "/upcoming?view=due");
  localStorage.clear();
  localStorage.setItem("agendal.user_id", "1");
  localStorage.setItem("draft", "buy milk");
});
afterEach(() => vi.unstubAllGlobals());

describe("session ended elsewhere (AA-E6, UX-44)", () => {
  it("T-AA-106: a 401 opens Sign in with the notice, comes back here after, and keeps the device's data", async () => {
    open();
    await screen.findByText("user1@example.com");

    await api("/tasks/t_1/complete", { method: "POST" });

    expect(
      await screen.findByText(/You've been signed out\. Sign in to continue/),
    ).toBeTruthy();
    expect(router.replace).toHaveBeenCalledWith(
      "/sign-in?next=%2Fupcoming%3Fview%3Ddue",
    );
    expect(localStorage.getItem("draft")).toBe("buy milk");
    expect(indexedDBMock.deleteDatabase).not.toHaveBeenCalled();
    expect(screen.getByText("nobody")).toBeTruthy();
  });

  it("a visitor who was never signed in gets Sign in without the notice", async () => {
    meReply = () => json(401, {});
    open();

    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith("/sign-in?next=%2Fupcoming"),
    );
    expect(screen.queryByText(/You've been signed out/)).toBeNull();
  });

  it("a 401 from signing in or out is part of that flow, not an ended session", async () => {
    const heard = vi.fn();
    window.addEventListener("agendal:session-expired", heard);
    await api("/auth/logout", { method: "POST" });
    await api("/tasks", { method: "POST" });
    window.removeEventListener("agendal:session-expired", heard);

    expect(heard).toHaveBeenCalledTimes(1);
  });
});

describe("a different account on this device (AA-E7)", () => {
  it("T-AA-107, SEC-52: wipes the previous account's data before the new one loads", async () => {
    localStorage.setItem("agendal.user_id", "2");
    open();

    // Already gone when the new account first shows
    await screen.findByText("user1@example.com");
    expect(indexedDBMock.deleteDatabase).toHaveBeenCalledWith("agendal");
    expect(localStorage.getItem("draft")).toBeNull();
    expect(localStorage.getItem("agendal.user_id")).toBe("1");
  });

  it("the same account keeps its unsynced data (AA-E6)", async () => {
    open();

    await waitFor(() =>
      expect(localStorage.getItem("agendal.user_id")).toBe("1"),
    );
    expect(indexedDBMock.deleteDatabase).not.toHaveBeenCalled();
    expect(localStorage.getItem("draft")).toBe("buy milk");
  });

  it("after signOut, --color-primary is empty and data-page-view is flat", async () => {
    document.documentElement.style.setProperty("--color-primary", "#db4c3f");
    document.documentElement.style.setProperty(
      "--color-primary-tint",
      "#db4c3f22",
    );
    document.documentElement.setAttribute("data-page-view", "full");
    localStorage.setItem("agendal.theme_palette", "agendal");
    localStorage.setItem("agendal.page_view", "full");

    function SignOutTrigger() {
      const { signOut } = useAppFrame();
      return <button onClick={() => void signOut()}>Sign out</button>;
    }

    render(
      <AppFrame>
        <Who />
        <SignOutTrigger />
      </AppFrame>,
    );

    await screen.findByText("user1@example.com");

    const signOutBtn = screen.getByRole("button", { name: "Sign out" });
    signOutBtn.click();

    await waitFor(() => {
      expect(
        document.documentElement.style.getPropertyValue("--color-primary"),
      ).toBe("");
      expect(document.documentElement.getAttribute("data-page-view")).toBe(
        "flat",
      );
    });
  });

  it("sign-out then a different account whose /me has the defaults results in no inline --color-primary and data-page-view flat", async () => {
    meReply = () =>
      json(200, {
        id: 1,
        email: "user1@example.com",
        display_name: "User 1",
        theme_palette: "lavender",
        page_view: "full",
      });

    function SignOutTrigger() {
      const { signOut } = useAppFrame();
      return <button onClick={() => void signOut()}>Sign out</button>;
    }

    const { unmount } = render(
      <AppFrame>
        <Who />
        <SignOutTrigger />
      </AppFrame>,
    );

    await screen.findByText("user1@example.com");
    await waitFor(() => {
      expect(
        document.documentElement.style.getPropertyValue("--color-primary"),
      ).toBe("#8c52ff");
      expect(document.documentElement.getAttribute("data-page-view")).toBe(
        "full",
      );
    });

    const signOutBtn = screen.getByRole("button", { name: "Sign out" });
    signOutBtn.click();

    await waitFor(() => {
      expect(
        document.documentElement.style.getPropertyValue("--color-primary"),
      ).toBe("");
      expect(document.documentElement.getAttribute("data-page-view")).toBe(
        "flat",
      );
    });

    unmount();

    // Now a different account signs in with defaults
    meReply = () =>
      json(200, {
        id: 2,
        email: "user2@example.com",
        display_name: "User 2",
        theme_palette: "default",
        page_view: "flat",
      });

    render(
      <AppFrame>
        <Who />
      </AppFrame>,
    );

    await screen.findByText("user2@example.com");
    await waitFor(() => {
      expect(
        document.documentElement.style.getPropertyValue("--color-primary"),
      ).toBe("");
      expect(document.documentElement.getAttribute("data-page-view")).toBe(
        "flat",
      );
    });
  });
});

describe("request budget (AP §10)", () => {
  const meCalls = () =>
    vi.mocked(fetch).mock.calls.filter(([url]) => url === "/api/v1/me").length;
  const frame = () => (
    <AppFrame>
      <Who />
    </AppFrame>
  );

  beforeEach(() => {
    // The screens' own reads answer: only /me says whether the session ended
    otherReply = () => json(200, {});
  });

  it("a confirmed session asks /me once across screens, and again when the app comes back", async () => {
    const { rerender } = open();
    await screen.findByText("user1@example.com");

    for (const next of ["/", "/projects", "/notes"]) {
      pathname = next;
      await act(async () => rerender(frame()));
    }
    expect(meCalls()).toBe(1);

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await waitFor(() => expect(meCalls()).toBe(2));
  });

  it("AP-E10, T-AP-107: a theme changed on another device applies when the app is visible again", async () => {
    open();
    await screen.findByText("user1@example.com");
    expect(document.documentElement.getAttribute("data-theme")).toBeNull();

    meReply = () =>
      json(200, { id: 1, email: "user1@example.com", theme: "dark" });
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    await waitFor(() =>
      expect(document.documentElement.getAttribute("data-theme")).toBe(
        "agendal-dark",
      ),
    );
  });

  it("coming back to an ended session opens Sign in", async () => {
    open();
    await screen.findByText("user1@example.com");

    meReply = () => json(401, {});
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith("/sign-in?next=%2Fupcoming"),
    );
  });

  it("a signed-in visit to Sign in still goes to Inbox, without asking again", async () => {
    const { rerender } = open();
    await screen.findByText("user1@example.com");
    const asked = meCalls();

    pathname = "/sign-in";
    await act(async () => rerender(frame()));

    expect(router.replace).toHaveBeenCalledWith("/");
    expect(meCalls()).toBe(asked);
  });
});
