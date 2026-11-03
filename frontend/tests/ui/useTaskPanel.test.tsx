import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useTaskPanel } from "../../src/ui/features/tasks/useTaskPanel";

const router = {
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
};

let pathname = "/projects/p-1";
let searchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useRouter: () => router,
  useSearchParams: () => searchParams,
}));

const mockMatchMedia = (matches: boolean) => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
};

describe("useTaskPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pathname = "/projects/p-1";
    searchParams = new URLSearchParams();
    mockMatchMedia(true);
  });

  it("first open push", () => {
    const baseNavigate = vi.fn();
    const { result } = renderHook(() => useTaskPanel(baseNavigate));

    act(() => {
      const handled = result.current.navigate("/tasks/t-1");
      expect(handled).toBe(true);
    });

    expect(router.push).toHaveBeenCalledWith("/projects/p-1?task=t-1");
    expect(router.replace).not.toHaveBeenCalled();
    expect(baseNavigate).not.toHaveBeenCalled();
  });

  it("second open replace", () => {
    searchParams = new URLSearchParams("task=t-1");
    const baseNavigate = vi.fn();
    const { result } = renderHook(() => useTaskPanel(baseNavigate));

    expect(result.current.selectedTaskId).toBe("t-1");

    act(() => {
      const handled = result.current.navigate("/tasks/t-2");
      expect(handled).toBe(true);
    });

    expect(router.replace).toHaveBeenCalledWith("/projects/p-1?task=t-2");
    expect(router.push).not.toHaveBeenCalled();
    expect(baseNavigate).not.toHaveBeenCalled();
  });

  it("close after push -> back", () => {
    const baseNavigate = vi.fn();
    const { result } = renderHook(() => useTaskPanel(baseNavigate));

    act(() => {
      result.current.navigate("/tasks/t-1");
    });
    expect(router.push).toHaveBeenCalledWith("/projects/p-1?task=t-1");

    act(() => {
      result.current.closePanel();
    });

    expect(router.back).toHaveBeenCalledTimes(1);
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("close after deep link -> replace", () => {
    searchParams = new URLSearchParams("task=t-1");
    const baseNavigate = vi.fn();
    const { result } = renderHook(() => useTaskPanel(baseNavigate));

    act(() => {
      result.current.closePanel();
    });

    expect(router.replace).toHaveBeenCalledWith("/projects/p-1");
    expect(router.back).not.toHaveBeenCalled();
  });

  it("narrow -> original navigate", () => {
    mockMatchMedia(false);
    const baseNavigate = vi.fn().mockReturnValue(true);
    const { result } = renderHook(() => useTaskPanel(baseNavigate));

    act(() => {
      const handled = result.current.navigate("/tasks/t-1");
      expect(handled).toBe(true);
    });

    expect(baseNavigate).toHaveBeenCalledWith("/tasks/t-1");
    expect(router.push).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
  });
});
