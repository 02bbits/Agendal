import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppFrame } from "../../src/app/AppFrame";
import AccountPage from "../../src/app/account/page";

const router = { push: vi.fn(), replace: vi.fn(), back: vi.fn() };
vi.mock("next/navigation", () => ({
  usePathname: () => "/account",
  useRouter: () => router,
}));

const fetchMock = vi.fn();
// Every call but the session check gets `reply`
let reply: () => Promise<Response>;
const posts = () =>
  fetchMock.mock.calls
    .filter(([, init]) => init?.method === "POST")
    .map(([url]) => url);

const indexedDBMock = {
  databases: vi.fn(async () => [{ name: "agendal" }]),
  deleteDatabase: vi.fn(() => {
    const request = {} as IDBOpenDBRequest;
    queueMicrotask(() => request.onsuccess?.({} as Event));
    return request;
  }),
};
const cachesMock = {
  keys: vi.fn(async () => ["api-data"]),
  delete: vi.fn(async () => true),
};

async function signOutWith(button: string) {
  render(
    <AppFrame>
      <AccountPage />
    </AppFrame>,
  );
  await screen.findByText("ann@example.com");
  await userEvent.click(screen.getByRole("button", { name: button }));
}

beforeEach(() => {
  router.replace.mockClear();
  indexedDBMock.deleteDatabase.mockClear();
  cachesMock.delete.mockClear();
  reply = async () => new Response(null, { status: 204 });
  fetchMock.mockReset().mockImplementation(async (url: string) =>
    url === "/api/v1/user"
      ? new Response(
          JSON.stringify({
            id: 1,
            email: "ann@example.com",
            display_name: "Ann",
          }),
          { status: 200 },
        )
      : reply(),
  );
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("indexedDB", indexedDBMock);
  vi.stubGlobal("caches", cachesMock);
  document.cookie = "XSRF-TOKEN=token";
  localStorage.setItem("draft", "buy milk");
  sessionStorage.setItem("agendal.signin-lock", "1");
});
afterEach(() => vi.unstubAllGlobals());

const expectWiped = () => {
  expect(indexedDBMock.deleteDatabase).toHaveBeenCalledWith("agendal");
  expect(cachesMock.delete).toHaveBeenCalledWith("api-data");
  expect(localStorage.length).toBe(0);
  expect(sessionStorage.length).toBe(0);
};

describe("Sign out (AA-5)", () => {
  it("T-AA-40, T-AA-41, SEC-50: ends the session, wipes the device and opens Sign in", async () => {
    await signOutWith("Sign out");

    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith("/sign-in"),
    );
    expect(posts()).toEqual(["/api/v1/auth/logout"]);
    expectWiped();
  });

  it("offline, still wipes the device at once", async () => {
    reply = () => Promise.reject(new TypeError("Failed to fetch"));
    await signOutWith("Sign out");

    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith("/sign-in"),
    );
    expectWiped();
  });

  it("T-AA-43: Sign out on all devices ends every session", async () => {
    await signOutWith("Sign out on all devices");

    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith("/sign-in"),
    );
    expect(posts()).toEqual(["/api/v1/auth/logout-everywhere"]);
    expectWiped();
  });

  it("offline, Sign out on all devices keeps this device signed in and says why", async () => {
    reply = () => Promise.reject(new TypeError("Failed to fetch"));
    await signOutWith("Sign out on all devices");

    expect(await screen.findByText("You're offline")).toBeTruthy();
    expect(router.replace).not.toHaveBeenCalled();
    expect(localStorage.getItem("draft")).toBe("buy milk");
  });
});
