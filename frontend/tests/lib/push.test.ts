import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  askForPush,
  forgetPush,
  pushEndpoint,
  pushSnoozed,
  pushState,
  renewPush,
  snoozePush,
  subscribePush,
} from "../../src/lib/push";

// #186, TK §2.5: this device's Web Push subscription

// gitleaks:allow
const SERVER_KEY =
  "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U";
const keyBytes = (b64: string) => {
  const s = atob(b64.replace(/-/g, "+").replace(/_/g, "/") + "=");
  return Uint8Array.from(s, (c) => c.charCodeAt(0)).buffer;
};

type Sub = {
  endpoint: string;
  options: { applicationServerKey: ArrayBuffer | null };
  unsubscribe: ReturnType<typeof vi.fn>;
  toJSON: () => unknown;
};
const makeSub = (endpoint: string, key = keyBytes(SERVER_KEY)): Sub => ({
  endpoint,
  options: { applicationServerKey: key },
  unsubscribe: vi.fn(async () => true),
  toJSON: () => ({ endpoint, keys: { p256dh: "p", auth: "a" } }),
});

let current: Sub | null;
const pushManager = {
  getSubscription: vi.fn(async () => current),
  subscribe: vi.fn<(options: PushSubscriptionOptionsInit) => Promise<Sub>>(
    async () => (current = makeSub("https://fcm.googleapis.com/fcm/send/new")),
  ),
};
const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
  if (url === "/api/v1/push-subscriptions/key")
    return new Response(JSON.stringify({ public_key: SERVER_KEY }), {
      status: 200,
    });
  if (url === "/api/v1/push-subscriptions" && init?.method === "POST")
    return new Response(null, { status: 201 });
  return new Response(null, { status: 404 });
});

function setPermission(permission: NotificationPermission) {
  vi.stubGlobal("Notification", {
    permission,
    requestPermission: vi.fn(async () => "granted"),
  });
}

beforeEach(() => {
  current = null;
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("PushManager", function PushManager() {});
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: { getRegistration: vi.fn(async () => ({ pushManager })) },
  });
  document.cookie = "XSRF-TOKEN=token";
  setPermission("default");
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("pushState", () => {
  it("follows the browser's permission", () => {
    expect(pushState()).toBe("ask");
    setPermission("granted");
    expect(pushState()).toBe("granted");
    setPermission("denied");
    expect(pushState()).toBe("denied");
  });

  it("without the Push API: install on an iPhone in Safari, else unsupported", () => {
    vi.stubGlobal("PushManager", undefined);
    // @ts-expect-error simulating a browser without the Push API
    delete window.PushManager;
    expect(pushState()).toBe("unsupported");
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/604.1",
    );
    expect(pushState()).toBe("install");
  });
});

describe("Not now", () => {
  it("keeps the question away for 14 days", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-23T00:00:00Z"));
    expect(pushSnoozed()).toBe(false);
    snoozePush();
    vi.setSystemTime(new Date("2026-12-06T23:59:00Z"));
    expect(pushSnoozed()).toBe(true);
    vi.setSystemTime(new Date("2026-12-07T00:01:00Z"));
    expect(pushSnoozed()).toBe(false);
  });
});

describe("subscribing", () => {
  it("subscribes with the server's key and sends the subscription", async () => {
    expect(await subscribePush()).toBe(true);
    const options = pushManager.subscribe.mock.calls[0]![0];
    expect(options.userVisibleOnly).toBe(true);
    expect(new Uint8Array(options.applicationServerKey as ArrayBuffer)).toEqual(
      new Uint8Array(keyBytes(SERVER_KEY)),
    );
    const post = fetchMock.mock.calls.find(
      ([, init]) => init?.method === "POST",
    )!;
    expect(JSON.parse(String(post[1]!.body))).toEqual({
      endpoint: "https://fcm.googleapis.com/fcm/send/new",
      keys: { p256dh: "p", auth: "a" },
    });
  });

  it("replaces a subscription made with an older server key", async () => {
    const old = makeSub(
      "https://fcm.googleapis.com/fcm/send/old",
      new Uint8Array(65).buffer,
    );
    current = old;
    await subscribePush();
    expect(old.unsubscribe).toHaveBeenCalled();
    expect(pushManager.subscribe).toHaveBeenCalled();
  });

  it("keeps a subscription made with the current key", async () => {
    current = makeSub("https://fcm.googleapis.com/fcm/send/same");
    await subscribePush();
    expect(pushManager.subscribe).not.toHaveBeenCalled();
  });

  it("does nothing while reminders aren't set up on the server, or without a worker", async () => {
    fetchMock.mockImplementationOnce(
      async () =>
        new Response(JSON.stringify({ public_key: null }), { status: 200 }),
    );
    expect(await subscribePush()).toBe(false);
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: { getRegistration: vi.fn(async () => undefined) },
    });
    expect(await subscribePush()).toBe(false);
    expect(pushManager.subscribe).not.toHaveBeenCalled();
  });

  it("Allow asks the browser, then subscribes on yes", async () => {
    expect(await askForPush()).toBe("granted");
    expect(pushManager.subscribe).toHaveBeenCalled();
  });

  it("on load, subscribes again only where it was already allowed", async () => {
    await renewPush();
    expect(fetchMock).not.toHaveBeenCalled();
    setPermission("granted");
    await renewPush();
    expect(pushManager.subscribe).toHaveBeenCalled();
  });

  it("gives this device's endpoint for sign-out, then drops the subscription", async () => {
    const sub = makeSub("https://fcm.googleapis.com/fcm/send/mine");
    current = sub;
    expect(await pushEndpoint()).toBe(
      "https://fcm.googleapis.com/fcm/send/mine",
    );
    await forgetPush();
    expect(sub.unsubscribe).toHaveBeenCalled();
  });
});
