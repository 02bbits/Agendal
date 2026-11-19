import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { t } from "../../src/ui/copy";
import {
  AiSettings,
  type AiSettingsData,
} from "../../src/ui/features/shell/AiSettings";

const settings = (over: Partial<AiSettingsData> = {}): AiSettingsData => ({
  enabled: true,
  model: null,
  providers: [
    {
      id: "gemini",
      name: "Gemini",
      key_url: "https://aistudio.google.com/apikey",
      last4: null,
      models: [],
    },
    {
      id: "openai",
      name: "OpenAI",
      key_url: "https://platform.openai.com/api-keys",
      last4: null,
      models: [],
    },
  ],
  ...over,
});
const withGemini = () =>
  settings({
    model: "gemini:gemini-3.5-flash-lite",
    providers: [
      {
        ...settings().providers[0],
        last4: "Q7xd",
        models: ["gemini-3.5-flash-lite", "gemini-3.7-flash"],
      },
      settings().providers[1],
    ],
  });
const json = (status: number, body: unknown) =>
  new Response(body === null ? null : JSON.stringify(body), { status });

describe("Settings › AI", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    document.cookie = "XSRF-TOKEN=test-token";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("lists each provider with Get key and Not set, and no model until a key is saved", async () => {
    fetchMock.mockResolvedValueOnce(json(200, settings()));
    render(<AiSettings />);

    expect(
      await screen.findByText(t("ai.configured", { count: 0, total: 2 })),
    ).toBeTruthy();
    const links = screen.getAllByRole("link", { name: `${t("ai.get_key")} ↗` });
    expect(links.map((a) => a.getAttribute("href"))).toEqual([
      "https://aistudio.google.com/apikey",
      "https://platform.openai.com/api-keys",
    ]);
    expect(screen.getAllByText(t("ai.not_set"))).toHaveLength(2);
    expect(screen.getByText(t("ai.add_key_first"))).toBeTruthy();
  });

  it("saves a key with its provider, then shows only its last four characters and the models", async () => {
    const user = userEvent.setup();
    fetchMock
      .mockResolvedValueOnce(json(200, settings()))
      .mockResolvedValueOnce(json(200, withGemini()));
    render(<AiSettings />);

    await user.click(await screen.findByRole("button", { name: "Gemini" }));
    await user.type(
      screen.getByLabelText(`Gemini ${t("ai.api_key")}`),
      "AIza-test-only",
    );
    await user.click(screen.getByRole("button", { name: t("common.save") }));

    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe("/api/v1/me/ai/keys/gemini");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body)).toEqual({ key: "AIza-test-only" });
    expect(await screen.findByText("••••Q7xd")).toBeTruthy();
    expect(screen.queryByLabelText(`Gemini ${t("ai.api_key")}`)).toBeNull();
    expect(screen.getByText("gemini-3.5-flash-lite")).toBeTruthy();
  });

  it("shows why a key was refused and keeps the field", async () => {
    const user = userEvent.setup();
    fetchMock
      .mockResolvedValueOnce(json(200, settings()))
      .mockResolvedValueOnce(
        json(422, { error: { fields: { key: ["ai.key_limited"] } } }),
      );
    render(<AiSettings />);

    await user.click(await screen.findByRole("button", { name: "Gemini" }));
    await user.type(
      screen.getByLabelText(`Gemini ${t("ai.api_key")}`),
      "AIza-test-only{Enter}",
    );

    expect((await screen.findByRole("alert")).textContent).toBe(
      t("ai.key_limited"),
    );
    expect(screen.getByLabelText(`Gemini ${t("ai.api_key")}`)).toBeTruthy();
  });

  it("turns AI off and hides the providers", async () => {
    const user = userEvent.setup();
    fetchMock
      .mockResolvedValueOnce(json(200, settings()))
      .mockResolvedValueOnce(json(200, settings({ enabled: false })));
    render(<AiSettings />);

    await user.click(await screen.findByRole("switch", { name: t("ai.use") }));

    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({
      enabled: false,
    });
    expect(screen.queryByText(t("ai.providers"))).toBeNull();
  });
});
