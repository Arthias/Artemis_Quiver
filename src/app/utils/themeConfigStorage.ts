import type { ThemeConfig } from "../../types/cv";

export function loadThemeConfig(key: string): ThemeConfig | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as ThemeConfig;
  } catch {
    return null;
  }
}

export function saveThemeConfig(key: string, config: ThemeConfig): void {
  try {
    localStorage.setItem(key, JSON.stringify(config));
  } catch {
    // Storage unavailable (private browsing, quota) — theme just won't persist.
  }
}
