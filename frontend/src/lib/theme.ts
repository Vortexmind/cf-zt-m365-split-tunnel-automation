export type ColorMode = "dark" | "light";

const STORAGE_KEY = "kumo-color-mode";

export function getSystemPreference(): ColorMode {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function loadMode(): ColorMode {
  if (typeof window === "undefined") return "dark";
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "dark" || stored === "light") return stored;
  return getSystemPreference();
}

export function saveMode(mode: ColorMode): void {
  localStorage.setItem(STORAGE_KEY, mode);
}

export function applyMode(mode: ColorMode): void {
  document.documentElement.setAttribute("data-mode", mode);
}
