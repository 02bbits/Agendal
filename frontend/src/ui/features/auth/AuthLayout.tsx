import type { ReactNode } from "react";
import { cx } from "../../components/cx";
import { CheckIcon } from "../../components/icons";
import { t } from "../../copy";
import { AuthIllustration } from "./AuthIllustration";

export interface AuthLayoutProps {
  children: ReactNode;
  framed?: boolean;
}

export function AuthLayout({ children, framed = true }: AuthLayoutProps) {
  const brand = (
    <div className="flex items-center justify-center gap-2.5 lg:hidden">
      <span
        aria-hidden="true"
        className="inline-flex size-10 items-center justify-center rounded-[10px] bg-ink text-paper"
      >
        <CheckIcon size={24} aria-hidden />
      </span>
      <span className="text-[22px] leading-[28px] font-bold tracking-[-0.015em] text-ink">
        {t("app.name")}
      </span>
    </div>
  );

  return (
    <div className="relative isolate min-h-dvh flex flex-col bg-paper lg:flex-row">
      <div
        aria-hidden="true"
        className="auth-backdrop auth-backdrop-fade pointer-events-none absolute inset-x-0 top-0 h-[420px] -z-10"
      />

      <section
        aria-label={t("auth.hero_label")}
        className="hidden lg:flex flex-col justify-between p-12 xl:p-16 shrink-0 bg-navy text-hero-ink lg:basis-[38%] lg:min-w-[420px] lg:max-w-[720px] select-none min-h-dvh"
      >
        <div className="flex items-center gap-2.5 text-[17px] font-bold">
          <span
            aria-hidden="true"
            className="inline-flex size-[30px] items-center justify-center rounded-lg bg-hero-ink text-navy"
          >
            <CheckIcon size={18} strokeWidth={3} />
          </span>
          {t("app.name")}
        </div>

        <div className="my-auto flex justify-center py-6 w-full max-w-[420px] xl:max-w-[480px] self-center">
          <AuthIllustration />
        </div>

        <div className="flex flex-col gap-3.5 max-w-[460px]">
          <h2 className="m-0 text-[28px] leading-[34px] xl:text-[32px] xl:leading-[40px] font-bold tracking-[-0.02em]">
            {t("auth.hero_title")}
          </h2>
          <p className="m-0 text-[13px] leading-[18px] text-hero-ink/70">
            {t("auth.hero_body")}
          </p>
        </div>
      </section>

      <div className="relative isolate flex-1 flex flex-col lg:items-center lg:justify-center lg:p-12 bg-paper">
        <div
          aria-hidden="true"
          className="auth-backdrop auth-backdrop-fade pointer-events-none absolute inset-0 -z-10"
        />

        <div
          className={cx(
            "mx-auto flex w-full max-w-[400px] flex-1 flex-col min-h-dvh lg:min-h-0 lg:p-0 lg:flex-initial",
            "pt-[max(3.5rem,calc(env(safe-area-inset-top)+1.5rem))]",
            "pl-[max(1.75rem,env(safe-area-inset-left))]",
            "pr-[max(1.75rem,env(safe-area-inset-right))]",
            framed ? "pb-[max(1.5rem,env(safe-area-inset-bottom))]" : "pb-0",
            framed ? "lg:max-w-[400px]" : "lg:max-w-[360px]",
          )}
        >
          {framed ? (
            <div className="my-auto w-full pb-[min(18vh,140px)] lg:pb-0">
              {brand}
              <div className="w-full lg:max-w-[400px] lg:rounded-dialog lg:border lg:border-separator lg:bg-surface lg:p-8 lg:shadow-[0_18px_50px_rgba(0,0,0,0.18)]">
                {children}
              </div>
            </div>
          ) : (
            <>
              {brand}
              {children}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
