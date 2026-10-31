import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppFrame, useAppFrame } from "../../src/app/AppFrame";
import { api } from "../../src/lib/api";

// IM-18: a session that ends elsewhere (AA-E6, UX-44) and a different account on this device (AA-E7)
const router = { push: vi.fn(), replace: vi.fn(), back: vi.fn() };
vi.mock("next/navigation", () => ({
  usePathname: () => "/upcoming",
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
  render(
    <AppFrame>
      <Who />
    </AppFrame>,
  );
}

beforeEach(() => {
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
});
