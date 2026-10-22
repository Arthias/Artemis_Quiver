import { useState } from "react";

/** A boolean UI preference remembered in localStorage (per browser). Storage can
 * be unavailable (private window, blocked site data); the flag then just
 * resets to its default on reload. */
export function usePersistentFlag(key: string, initial = false): [boolean, (next: boolean) => void] {
  const [value, setValue] = useState(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored === null ? initial : stored === "1";
    } catch {
      return initial;
    }
  });
  const set = (next: boolean) => {
    setValue(next);
    try {
      localStorage.setItem(key, next ? "1" : "0");
    } catch {
      // not persisted; the in-memory value still applies
    }
  };
  return [value, set];
}
