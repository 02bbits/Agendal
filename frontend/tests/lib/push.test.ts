import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ensureSubscribed,
  needsInstall,
  pushPermission,
  pushSupported,
  removeSubscription,
} from "@/lib/push";

describe("lib/push", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    document.cookie = "XSRF-TOKEN=test-token";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("pushSupported checks navigator and window properties", () => {
    vi.stubGlobal("Notification", {});
    vi.stubGlobal("PushManager", {});
    Object.defineProperty(navigator, "serviceWorker", {
      value: {},
      configurable: true,
    });
    expect(pushSupported()).toBe(true);

    // without Notification
    vi.stubGlobal("Notification", undefined);
    expect(pushSupported()).toBe(false);
  });

  it("needsInstall returns true only for iOS non-standalone", () => {
    // Non-iOS
    Object.defineProperty(navigator, "userAgent", {
      value: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      configurable: true,
    });
    expect(needsInstall()).toBe(false);

    // iPhone non-standalone
    Object.defineProperty(navigator, "userAgent", {
      value: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
      configurable: true,
    });
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    expect(needsInstall()).toBe(true);

    // iPhone standalone
    vi.stubGlobal("matchMedia", (q: string) => ({
      matches: q.includes("standalone"),
    }));
    expect(needsInstall()).toBe(false);
  });

  it("pushPermission returns current permission", () => {
    vi.stubGlobal("Notification", { permission: "granted" });
    expect(pushPermission()).toBe("granted");

    vi.stubGlobal("Notification", undefined);
    expect(pushPermission()).toBe("default");
  });

  it("ensureSubscribed registers sw, subscribes, and POSTs subscription to server", async () => {
    const subscribeMock = vi.fn().mockResolvedValue({
      toJSON: () => ({
        endpoint: "https://push.example.com/sub/123",
        keys: { p256dh: "key-123", auth: "auth-123" },
      }),
    });
    const getSubscriptionMock = vi.fn().mockResolvedValue(null);

    const pushManagerMock = {
      getSubscription: getSubscriptionMock,
      subscribe: subscribeMock,
    };

    const mockRegistration = {
      pushManager: pushManagerMock,
    };

    Object.defineProperty(navigator, "serviceWorker", {
      value: {
        register: vi.fn().mockResolvedValue(mockRegistration),
        ready: Promise.resolve(mockRegistration),
      },
      configurable: true,
    });
    vi.stubGlobal("PushManager", {});
    vi.stubGlobal("Notification", { permission: "granted" });

    // Mock GET key response
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ key: "BF_test_key" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    // Mock POST subscription response
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({}), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await ensureSubscribed();

    expect(subscribeMock).toHaveBeenCalledWith(
      expect.objectContaining({ userVisibleOnly: true }),
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const [postUrl, postInit] = fetchMock.mock.calls[1];
    expect(postUrl).toBe("/api/v1/push-subscriptions");
    expect(postInit.method).toBe("POST");
    expect(JSON.parse(postInit.body as string)).toEqual({
      endpoint: "https://push.example.com/sub/123",
      keys: { p256dh: "key-123", auth: "auth-123" },
    });
  });

  it("removeSubscription sends DELETE and unsubscribes without throwing", async () => {
    const unsubscribeMock = vi.fn().mockResolvedValue(true);
    const mockSub = {
      endpoint: "https://push.example.com/sub/123",
      unsubscribe: unsubscribeMock,
    };
    const mockRegistration = {
      pushManager: {
        getSubscription: vi.fn().mockResolvedValue(mockSub),
      },
    };

    Object.defineProperty(navigator, "serviceWorker", {
      value: {
        getRegistration: vi.fn().mockResolvedValue(mockRegistration),
      },
      configurable: true,
    });
    vi.stubGlobal("PushManager", {});
    vi.stubGlobal("Notification", {});

    fetchMock.mockResolvedValueOnce(
      new Response(null, {
        status: 204,
      }),
    );

    await removeSubscription();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [delUrl, delInit] = fetchMock.mock.calls[0];
    expect(delUrl).toBe("/api/v1/push-subscriptions");
    expect(delInit.method).toBe("DELETE");
    expect(unsubscribeMock).toHaveBeenCalled();
  });
});
