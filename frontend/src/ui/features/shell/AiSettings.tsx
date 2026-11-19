"use client";

import { useEffect, useState } from "react";
import { api } from "../../../lib/api";
import { t, type CopyKey } from "../../copy";
import { Button } from "../../components/Button";
import { cx } from "../../components/cx";
import { ChevronRightIcon, EyeIcon, EyeOffIcon } from "../../components/icons";
import { SelectDropdown } from "../../components/SelectDropdown";
import { Switch } from "../../components/Switch";

interface AiProvider {
  id: string;
  name: string;
  key_url: string;
  /** Last four characters of the saved key; the key itself never reaches the browser. */
  last4: string | null;
  models: string[];
}

export interface AiSettingsData {
  enabled: boolean;
  /** "provider:model" */
  model: string | null;
  providers: AiProvider[];
}

const KEY_ERRORS: CopyKey[] = [
  "ai.key_invalid",
  "ai.key_limited",
  "ai.key_unreachable",
  "ai.key_no_models",
];

/** Settings › AI: the AI switch, one key per LLM provider (checked with the provider on Save) and the model. */
export function AiSettings() {
  const [data, setData] = useState<AiSettingsData | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [key, setKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<CopyKey | null>(null);

  const load = () =>
    api("/me/ai")
      .then((res) => (res.ok ? res.json() : null))
      .then((body: AiSettingsData | null) => body && setData(body))
      .catch(() => {});
  useEffect(() => {
    load();
  }, []);

  const toggle = (id: string) => {
    setOpen(open === id ? null : id);
    setKey("");
    setShowKey(false);
    setError(null);
  };

  const patch = async (
    body: Partial<Pick<AiSettingsData, "enabled" | "model">>,
  ) => {
    if (data) setData({ ...data, ...body });
    const res = await api("/me/ai", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);
    if (res?.ok) setData(await res.json());
    else load();
  };

  const save = async (provider: string) => {
    setBusy(true);
    setError(null);
    const res = await api(`/me/ai/keys/${provider}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: key.trim() }),
    }).catch(() => null);
    setBusy(false);
    if (res?.ok) {
      setData(await res.json());
      toggle(provider);
      return;
    }
    if (res?.status === 429) return setError("ai.too_many");
    const code = res
      ? ((await res.json().catch(() => null))?.error?.fields?.key?.[0] as
          string | undefined)
      : "ai.key_unreachable";
    setError(KEY_ERRORS.find((k) => k === code) ?? "ai.key_invalid");
  };

  const remove = async (provider: string) => {
    await api(`/me/ai/keys/${provider}`, { method: "DELETE" }).catch(
      () => null,
    );
    setOpen(null);
    load();
  };

  if (!data) return null;
  const withKey = data.providers.filter((p) => p.last4);
  const models = withKey.flatMap((p) =>
    p.models.map((m) => ({ value: `${p.id}:${m}`, label: m, badge: p.name })),
  );

  return (
    <div className="flex max-w-[620px] flex-col gap-6" data-testid="ai-tab">
      <div className="rounded-xl border border-separator/40 bg-fill/30 px-4">
        <Switch
          label={t("ai.use")}
          checked={data.enabled}
          onChange={(enabled) => patch({ enabled })}
          divider={false}
        />
      </div>

      {data.enabled && (
        <>
          <section>
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <h2 className="m-0 text-overline font-semibold uppercase text-ink-secondary">
                {t("ai.providers")}
              </h2>
              <span className="text-caption text-ink-secondary">
                {t("ai.configured", {
                  count: withKey.length,
                  total: data.providers.length,
                })}
              </span>
            </div>
            <div className="divide-y divide-separator overflow-hidden rounded-xl border border-separator/40 bg-fill/30">
              {data.providers.map((p) => {
                const isOpen = open === p.id;
                const getKey = (
                  <a
                    href={p.key_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="focus-ring rounded text-footnote text-ink-secondary hover:text-ink"
                  >
                    {t("ai.get_key")} ↗
                  </a>
                );
                return (
                  <div key={p.id}>
                    <div className="flex min-h-11 items-center gap-3 px-4">
                      <button
                        type="button"
                        aria-expanded={isOpen}
                        onClick={() => toggle(p.id)}
                        className="focus-ring flex min-h-11 flex-1 cursor-pointer items-center gap-2 bg-transparent text-left text-body text-ink"
                      >
                        <ChevronRightIcon
                          size={14}
                          className={cx(
                            "text-ink-secondary transition-transform",
                            isOpen && "rotate-90",
                          )}
                        />
                        {p.name}
                      </button>
                      {!isOpen &&
                        (p.last4 ? (
                          <span className="font-mono text-footnote text-ink-secondary">
                            ••••{p.last4}
                          </span>
                        ) : (
                          <>
                            {getKey}
                            <NotSet />
                          </>
                        ))}
                    </div>

                    {isOpen && (
                      <div className="px-4 pb-3">
                        <div className="rounded-lg border border-separator p-3">
                          <div className="mb-2 flex items-center gap-2">
                            <span className="text-callout text-ink">
                              {t("ai.api_key")}
                            </span>
                            {p.last4 ? (
                              <span className="font-mono text-footnote text-ink-secondary">
                                ••••{p.last4}
                              </span>
                            ) : (
                              <NotSet />
                            )}
                            <span className="ml-auto">
                              {!p.last4 && getKey}
                            </span>
                          </div>
                          {p.last4 ? (
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => remove(p.id)}
                            >
                              {t("ai.remove")}
                            </Button>
                          ) : (
                            <form
                              className="flex flex-wrap gap-2"
                              onSubmit={(e) => {
                                e.preventDefault();
                                if (key.trim() && !busy) save(p.id);
                              }}
                            >
                              <div className="flex min-w-0 flex-1 items-center rounded-lg border border-separator bg-base-100 pr-1 focus-within:border-ink-secondary">
                                <input
                                  type={showKey ? "text" : "password"}
                                  value={key}
                                  onChange={(e) => {
                                    setKey(e.target.value);
                                    setError(null);
                                  }}
                                  onKeyDown={(e) =>
                                    e.key === "Escape" && toggle(p.id)
                                  }
                                  placeholder={t("ai.key_placeholder")}
                                  aria-label={`${p.name} ${t("ai.api_key")}`}
                                  aria-invalid={error ? true : undefined}
                                  autoComplete="off"
                                  spellCheck={false}
                                  autoFocus
                                  className="min-w-0 flex-1 bg-transparent px-3 py-2 font-mono text-footnote text-ink outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={() => setShowKey(!showKey)}
                                  aria-label={t(
                                    showKey ? "ai.hide_key" : "ai.show_key",
                                  )}
                                  className="focus-ring inline-flex size-8 cursor-pointer items-center justify-center rounded bg-transparent text-ink-secondary"
                                >
                                  {showKey ? (
                                    <EyeOffIcon size={16} />
                                  ) : (
                                    <EyeIcon size={16} />
                                  )}
                                </button>
                              </div>
                              <Button
                                type="submit"
                                size="sm"
                                disabled={!key.trim() || busy}
                              >
                                {t("common.save")}
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => toggle(p.id)}
                              >
                                {t("common.cancel")}
                              </Button>
                            </form>
                          )}
                          {busy && (
                            <p className="m-0 mt-2 text-footnote text-ink-secondary">
                              {t("ai.checking")}
                            </p>
                          )}
                          {error && (
                            <p
                              role="alert"
                              className="m-0 mt-2 text-footnote text-error"
                            >
                              {t(error)}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          <div className="rounded-xl border border-separator/40 bg-fill/30 px-4 py-3">
            {models.length > 0 && data.model ? (
              <SelectDropdown
                label={t("ai.model")}
                options={models}
                value={data.model}
                onChange={(model) => patch({ model })}
              />
            ) : (
              <div className="flex min-h-11 items-center justify-between gap-3">
                <span className="text-body text-ink">{t("ai.model")}</span>
                <span className="text-footnote text-ink-secondary">
                  {t("ai.add_key_first")}
                </span>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function NotSet() {
  return (
    <span className="rounded border border-separator px-1.5 text-caption text-ink-secondary">
      {t("ai.not_set")}
    </span>
  );
}
