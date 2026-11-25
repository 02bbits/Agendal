import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Toast, type ToastData } from "@/ui/components/Toast";
import { useState } from "react";
import { useUpdateToast } from "@/app/useUpdateToast";
import { expectAxeCleanInBothThemes } from "./axe";

// UX-42, AP-E5, T-AP-105: a waiting worker offers Reload, never during a sheet, never by itself
function Host() {
  const [toast, setToast] = useState<ToastData | null>(null);
  useUpdateToast((draft) => setToast({ ...draft, id: 1 }));
  return <Toast toast={toast} onDismiss={() => setToast(null)} />;
}

const worker = { postMessage: vi.fn() };
const controllerListeners: Array<() => void> = [];

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.stubEnv("NODE_ENV", "production");
  worker.postMessage.mockClear();
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: {
      controller: {},
      ready: new Promise(() => {}),
      register: vi.fn(async () => ({
        waiting: worker,
        addEventListener: vi.fn(),
      })),
      addEventListener: (_: string, fn: () => void) =>
        controllerListeners.push(fn),
    },
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  document.body.innerHTML = "";
});

describe("update toast", () => {
  it("shows when a new version waits, and Reload hands over to it", async () => {
    render(<Host />);

    expect(await screen.findByText("A new version is ready.")).toBeTruthy();
    await expectAxeCleanInBothThemes();
    await userEvent.click(screen.getByRole("button", { name: "Reload" }));
    expect(worker.postMessage).toHaveBeenCalledWith("skipWaiting");
  });

  it("holds back while a sheet is open, then shows", async () => {
    const modal = document.createElement("div");
    modal.setAttribute("aria-modal", "true");
    document.body.append(modal);
    render(<Host />);

    await act(() => vi.advanceTimersByTimeAsync(3000));
    expect(screen.queryByText("A new version is ready.")).toBeNull();

    modal.remove();
    await act(() => vi.advanceTimersByTimeAsync(1100));
    expect(screen.getByText("A new version is ready.")).toBeTruthy();
  });

  it("stays quiet on the first install, which replaces nothing", async () => {
    const active = { postMessage: vi.fn() };
    Object.defineProperty(navigator.serviceWorker, "controller", {
      value: null,
    });
    Object.defineProperty(navigator.serviceWorker, "ready", {
      value: Promise.resolve({ active }),
    });
    render(<Host />);

    await act(() => vi.advanceTimersByTimeAsync(2000));
    expect(screen.queryByText("A new version is ready.")).toBeNull();
    // AP §2.2: the files this first page loaded go to the new worker's cache
    expect(active.postMessage).toHaveBeenCalledWith({
      precache: expect.arrayContaining([window.location.pathname]),
    });
  });

  it("detects a newer server buildId via /app-version without reloading", async () => {
    vi.stubEnv("NEXT_PUBLIC_BUILD_ID", "build-1");
    const newWorker = { postMessage: vi.fn() };
    const registerMock = vi.fn(async (url: string) => {
      if (url.includes("build-2")) {
        return { waiting: newWorker, addEventListener: vi.fn() };
      }
      return { waiting: null, addEventListener: vi.fn() };
    });
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {
        controller: {},
        ready: new Promise(() => {}),
        register: registerMock,
        addEventListener: vi.fn(),
      },
    });
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ buildId: "build-2" }), { status: 200 }),
      );

    render(<Host />);
    expect(screen.queryByText("A new version is ready.")).toBeNull();

    await act(async () => {
      window.dispatchEvent(new Event("focus"));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(registerMock).toHaveBeenCalledWith("/sw.js?v=build-2");
    expect(await screen.findByText("A new version is ready.")).toBeTruthy();

    fetchMock.mockRestore();
  });

  it("polls /app-version every 15s while visible without requiring tab focus", async () => {
    vi.stubEnv("NEXT_PUBLIC_BUILD_ID", "build-1");
    const newWorker = { postMessage: vi.fn() };
    const registerMock = vi.fn(async (url: string) => {
      if (url.includes("build-3")) {
        return { waiting: newWorker, addEventListener: vi.fn() };
      }
      return { waiting: null, addEventListener: vi.fn() };
    });
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {
        controller: {},
        ready: new Promise(() => {}),
        register: registerMock,
        addEventListener: vi.fn(),
      },
    });
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ buildId: "build-3" }), { status: 200 }),
      );

    render(<Host />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000);
    });

    expect(registerMock).toHaveBeenCalledWith("/sw.js?v=build-3");
    expect(await screen.findByText("A new version is ready.")).toBeTruthy();

    fetchMock.mockRestore();
  });
});
