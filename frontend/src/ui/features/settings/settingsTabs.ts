import type { ComponentType } from "react";
import { t } from "../../copy";
import {
  PaletteIcon,
  SidebarIcon,
  SlidersIcon,
  SparklesIcon,
  UserIcon,
} from "../../components/icons";
import type { SettingsTab } from "./types";

export interface SettingsTabItem {
  id: SettingsTab;
  label: string;
  Icon: ComponentType<{ size?: number }>;
  /** Extra words the Settings search matches besides the label. */
  keywords: string;
}

/** The Settings tabs in menu order. Sidebar settings only change the desktop sidebar. */
export function settingsTabs(isDesktop: boolean): SettingsTabItem[] {
  const tabs: SettingsTabItem[] = [
    {
      id: "account",
      label: t("settings.tab_account"),
      Icon: UserIcon,
      keywords: "account name email password two-step remember device",
    },
    {
      id: "general",
      label: t("app.tab_general"),
      Icon: SlidersIcon,
      keywords: "general time format week start page view",
    },
    {
      id: "llm",
      label: t("settings.tab_ai"),
      Icon: SparklesIcon,
      keywords: "ai llm provider model api key claude gemini openrouter openai",
    },
    {
      id: "theme",
      label: t("settings.tab_theme"),
      Icon: PaletteIcon,
      keywords: "theme appearance dark light color",
    },
    {
      id: "sidebar",
      label: t("settings.tab_sidebar"),
      Icon: SidebarIcon,
      keywords: "sidebar navigation projects tabs counts",
    },
  ];
  return isDesktop ? tabs : tabs.filter((tab) => tab.id !== "sidebar");
}

/** The tabs whose label or keywords contain the search, or all of them with no search. */
export function filterSettingsTabs(
  tabs: SettingsTabItem[],
  search: string,
): SettingsTabItem[] {
  const query = search.trim().toLowerCase();
  if (!query) return tabs;
  return tabs.filter(
    (tab) =>
      tab.label.toLowerCase().includes(query) || tab.keywords.includes(query),
  );
}
