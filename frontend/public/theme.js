// AP-3: runs before first paint so a chosen theme never flashes the other one.
// Reads the choice AppFrame keeps in localStorage ("system" or missing leaves the device setting).
(function () {
  try {
    var theme = localStorage.getItem("agendal.theme");
    var dark =
      theme === "dark" ||
      (theme !== "light" && matchMedia("(prefers-color-scheme: dark)").matches);
    if (theme === "light" || theme === "dark")
      document.documentElement.setAttribute("data-theme", "agendal-" + theme);
    var pageView = localStorage.getItem("agendal.page_view") || "flat";
    document.documentElement.setAttribute("data-page-view", pageView);
    // Must match THEME_PALETTES in src/ui/domain/theme.ts: agendal #db4c3f, moonstone #4a7298, tangerine #ff7043, kale #299764, blueberry #14aaf5, lavender #8c52ff, raspberry #e040fb
    var PALETTES = {
      agendal: "#db4c3f",
      moonstone: "#4a7298",
      tangerine: "#ff7043",
      kale: "#299764",
      blueberry: "#14aaf5",
      lavender: "#8c52ff",
      raspberry: "#e040fb",
    };
    var palette = localStorage.getItem("agendal.theme_palette");
    if (palette && PALETTES[palette]) {
      document.documentElement.style.setProperty(
        "--color-primary",
        PALETTES[palette],
      );
      document.documentElement.style.setProperty(
        "--color-primary-tint",
        PALETTES[palette] + "22",
      );
    }
    var meta = document.createElement("meta");
    meta.name = "theme-color";
    meta.content = dark ? "#1a1a1a" : "#f2f2f2";
    document.head.appendChild(meta);
  } catch {}
})();
