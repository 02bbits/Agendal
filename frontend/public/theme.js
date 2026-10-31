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
    var meta = document.createElement("meta");
    meta.name = "theme-color";
    meta.content = dark ? "#121211" : "#f6f5f1";
    document.head.appendChild(meta);
  } catch {}
})();
