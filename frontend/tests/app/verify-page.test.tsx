import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppFrame } from "../../src/app/AppFrame";
import VerifyPage from "../../src/app/verify/page";

const router = { push: vi.fn(), replace: vi.fn(), back: vi.fn() };
vi.mock("next/navigation", () => ({
  usePathname: () => "/verify",
  useRouter: () => router,
}));

const fetchMock = vi.fn();
const json = (status: number, body: unknown, headers = {}) =>
  new Response(JSON.stringify(body), { status, headers });

let reply: (url: string, init?: RequestInit) => Response | Promise<Response>;

function renderPage() {
  return render(
    <AppFrame>
      <VerifyPage />
    </AppFrame>,
  );
}

beforeEach(() => {
  router.push.mockClear();
  router.replace.mockClear();
  reply = () => json(200, { email: "pending@example.com" });
  fetchMock
    .mockReset()
    .mockImplementation(async (url: string, init?: RequestInit) => {
      if (url === "/api/v1/me") {
        return json(401, {});
      }
      return reply(url, init);
    });
  vi.stubGlobal("fetch", fetchMock);
  document.cookie = "XSRF-TOKEN=token";
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("VerifyPage (/verify)", () => {
  it("GET /auth/signup 404 navigates to /create-account", async () => {
    reply = (url) => {
      if (url === "/api/v1/auth/signup") {
        return json(404, { error: { code: "auth.signup_expired" } });
      }
      return json(404, {});
    };

    renderPage();

    await vi.waitFor(() => {
      expect(router.push).toHaveBeenCalledWith("/create-account");
    });
  });

  it("GET /auth/signup 200 shows the email", async () => {
    reply = (url) => {
      if (url === "/api/v1/auth/signup") {
        return json(200, { email: "pending@example.com" });
      }
      return json(404, {});
    };

    renderPage();

    expect(await screen.findByText("pending@example.com")).toBeTruthy();
  });

  it("a right code calls setUser and goes to /welcome", async () => {
    const verifiedUser = {
      id: "u1",
      email: "pending@example.com",
      display_name: "pending",
      timezone: "UTC",
    };

    reply = (url) => {
      if (url === "/api/v1/auth/signup") {
        return json(200, { email: "pending@example.com" });
      }
      if (url === "/api/v1/auth/signup/verify") {
        return json(200, { user: verifiedUser });
      }
      return json(404, {});
    };

    renderPage();

    const input = await screen.findByRole("textbox", {
      name: "Verification code",
    });

    for (const d of ["1", "2", "3", "4", "5", "6"]) {
      fireEvent.keyDown(input, { key: d });
    }

    await vi.waitFor(
      () => {
        expect(router.replace).toHaveBeenCalledWith("/welcome");
      },
      { timeout: 2000 },
    );
  });

  it("auth.signup_expired navigates to /create-account", async () => {
    reply = (url) => {
      if (url === "/api/v1/auth/signup") {
        return json(200, { email: "pending@example.com" });
      }
      if (url === "/api/v1/auth/signup/verify") {
        return json(422, {
          error: {
            code: "auth.signup_expired",
            message: "This sign-up has expired. Create your account again.",
          },
        });
      }
      return json(404, {});
    };

    renderPage();

    const input = await screen.findByRole("textbox", {
      name: "Verification code",
    });

    for (const d of ["1", "2", "3", "4", "5", "6"]) {
      fireEvent.keyDown(input, { key: d });
    }

    await vi.waitFor(() => {
      expect(router.push).toHaveBeenCalledWith("/create-account");
    });
  });

  it("Use a different account calls DELETE /auth/signup", async () => {
    const deleteSpy = vi.fn();
    reply = (url, init) => {
      if (url === "/api/v1/auth/signup") {
        if (init?.method === "DELETE") {
          deleteSpy();
          return new Response(null, { status: 204 });
        }
        return json(200, { email: "pending@example.com" });
      }
      return json(404, {});
    };

    const user = userEvent.setup();
    renderPage();

    await screen.findByText("pending@example.com");

    const switchBtn = screen.getByRole("button", {
      name: "Use a different account",
    });
    await user.click(switchBtn);

    expect(deleteSpy).toHaveBeenCalled();
    expect(router.push).toHaveBeenCalledWith("/create-account");
  });
});
