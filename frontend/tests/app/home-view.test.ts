import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetHomeViewForTests, takeHomeView } from "../../src/app/homeView";

function screenWidth(wide: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: wide && /min-width:\s*768px/.test(query),
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

describe("Home view opens its tab once, on app start", () => {
  beforeEach(() => {
    resetHomeViewForTests();
    localStorage.clear();
    window.history.replaceState(null, "", "/");
    screenWidth(true);
  });
  afterEach(() => localStorage.clear());

  it("opens the chosen tab the first time the app starts on /", () => {
    localStorage.setItem("agendal.home_view", "upcoming");
    expect(takeHomeView()).toBe("/upcoming");
  });

  it("never again in the same session: back on Inbox, the user stays there", () => {
    localStorage.setItem("agendal.home_view", "projects");
    expect(takeHomeView()).toBe("/projects");
    expect(takeHomeView()).toBeNull();
    expect(takeHomeView()).toBeNull();
  });

  it("does nothing when Inbox is the Home view or nothing is set", () => {
    expect(takeHomeView()).toBeNull();
    resetHomeViewForTests();
    localStorage.setItem("agendal.home_view", "inbox");
    expect(takeHomeView()).toBeNull();
  });

  it("does nothing on a phone", () => {
    screenWidth(false);
    localStorage.setItem("agendal.home_view", "upcoming");
    expect(takeHomeView()).toBeNull();
  });

  it("does nothing when the app was opened on another page", () => {
    localStorage.setItem("agendal.home_view", "upcoming");
    window.history.replaceState(null, "", "/projects");
    expect(takeHomeView()).toBeNull();
  });
});
