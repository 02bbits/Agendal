import { act, fireEvent, render, screen } from "@testing-library/react";
import { Activity, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SignInScreen } from "../../src/ui/features/auth/SignInScreen";
import { VerifyEmailScreen } from "../../src/ui/features/auth/VerifyEmailScreen";

// Next keeps a left page alive and hidden (cacheComponents); <Activity> does the same here
const page = (visible: boolean, children: ReactNode) => (
  <Activity mode={visible ? "visible" : "hidden"}>{children}</Activity>
);

async function typeCode(code: string) {
  const input = screen.getByRole("textbox", { name: "Verification code" });
  for (const digit of code) fireEvent.keyDown(input, { key: digit });
  await act(async () => {
    await Promise.resolve();
  });
  act(() => {
    vi.advanceTimersByTime(750);
  });
}

describe("auth screens start over once left (sign out after a code)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("Sign in after a finished two-step code shows an empty form, not the code and its tick", async () => {
    const onTwoFactorSuccess = vi.fn();
    const screenOf = (visible: boolean) =>
      page(
        visible,
        <SignInScreen
          onSubmit={async () => ({ twoFactor: true, email: "a@example.test" })}
          onTwoFactorChallenge={async () => ({ ok: true, user: {} })}
          onTwoFactorSuccess={onTwoFactorSuccess}
          forgotPasswordHref="/forgot-password"
          createAccountHref="/create-account"
        />,
      );
    const { rerender } = render(screenOf(true));

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "a@example.test" },
    });
    fireEvent.change(screen.getByLabelText("Password", { exact: true }), {
      target: { value: "secret words here" },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    });
    await typeCode("123456");
    expect(onTwoFactorSuccess).toHaveBeenCalledTimes(1);

    // Into the app, then Sign out brings Sign in back
    rerender(screenOf(false));
    rerender(screenOf(true));

    expect(
      screen.queryByRole("textbox", { name: "Verification code" }),
    ).toBeNull();
    expect((screen.getByLabelText("Email") as HTMLInputElement).value).toBe("");
    expect(
      (screen.getByLabelText("Password", { exact: true }) as HTMLInputElement)
        .value,
    ).toBe("");
  });

  it("Verify after a finished code shows empty slots again", async () => {
    const navigate = vi.fn();
    const screenOf = (visible: boolean) =>
      page(
        visible,
        <VerifyEmailScreen
          email="a@example.test"
          onVerify={async () => ({ ok: true })}
          navigate={navigate}
        />,
      );
    const { rerender } = render(screenOf(true));

    await typeCode("123456");
    expect(navigate).toHaveBeenCalledWith("/welcome");

    rerender(screenOf(false));
    rerender(screenOf(true));

    const input = screen.getByRole("textbox", {
      name: "Verification code",
    }) as HTMLInputElement;
    expect(input.value).toBe("");
    expect(input.disabled).toBe(false);
  });
});
