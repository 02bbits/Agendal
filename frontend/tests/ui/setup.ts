import { cleanup, configure } from "@testing-library/react";
import { afterEach } from "vitest";

// findBy and waitFor give up after 1 s by default, which a full parallel run on a busy machine can
// outlast while every single file passes alone
configure({ asyncUtilTimeout: 3000 });

// Node 22 native BroadcastChannel conflicts with JSDOM EventTarget (ERR_INVALID_ARG_TYPE)
if (typeof window !== "undefined") {
  class MockBroadcastChannel extends EventTarget {
    name: string;
    onmessage: ((event: MessageEvent) => void) | null = null;
    onmessageerror: ((event: MessageEvent) => void) | null = null;
    private static channels = new Map<string, Set<MockBroadcastChannel>>();

    constructor(name: string) {
      super();
      this.name = name;
      if (!MockBroadcastChannel.channels.has(name)) {
        MockBroadcastChannel.channels.set(name, new Set());
      }
      MockBroadcastChannel.channels.get(name)!.add(this);
    }

    postMessage(message: unknown) {
      const peers = MockBroadcastChannel.channels.get(this.name);
      if (!peers) return;
      queueMicrotask(() => {
        for (const peer of peers) {
          if (peer !== this) {
            const event = new MessageEvent("message", { data: message });
            peer.onmessage?.(event);
            peer.dispatchEvent(event);
          }
        }
      });
    }

    close() {
      MockBroadcastChannel.channels.get(this.name)?.delete(this);
    }
  }

  // @ts-expect-error Mock BroadcastChannel in JSDOM test environment
  globalThis.BroadcastChannel = MockBroadcastChannel;
  // @ts-expect-error Mock BroadcastChannel in JSDOM test environment
  window.BroadcastChannel = MockBroadcastChannel;
}

afterEach(() => {
  if (typeof document === "undefined") return; // tokens.test.ts runs in node
  cleanup();
  document.documentElement.removeAttribute("data-theme");
});
