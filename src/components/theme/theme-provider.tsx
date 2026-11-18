"use client";

import * as React from "react";

export type ThemeMode = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

interface ThemeContextValue {
  mode: ThemeMode;
  resolvedTheme: ResolvedTheme;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = React.createContext<ThemeContextValue>({
  mode: "system",
  resolvedTheme: "light",
  setMode: () => {},
});

const STORAGE_KEY = "color-scheme";

function getSystemPreference(): ResolvedTheme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyThemeToDOM(mode: ThemeMode): ResolvedTheme {
  if (typeof document === "undefined") return "light";
  const resolved: ResolvedTheme = mode === "system" ? getSystemPreference() : mode;
  const root = document.documentElement;
  const meta = document.querySelector('meta[name="color-scheme"]');

  if (meta) {
    meta.setAttribute("content", mode === "system" ? "light dark" : mode);
  }

  root.dataset.theme = resolved;
  root.dataset.themeMode = mode;

  if (resolved === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }

  return resolved;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = React.useState<ThemeMode>("system");
  const [resolvedTheme, setResolvedTheme] = React.useState<ResolvedTheme>("light");

  React.useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
    const validMode: ThemeMode =
      stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
    setModeState(validMode);
    setResolvedTheme(applyThemeToDOM(validMode));
  }, []);

  React.useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleMediaChange = () => {
      // Respeita a preferência explícita salva; só acompanha o SO quando em modo 'system'
      const currentStored = window.localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
      if (!currentStored || currentStored === "system") {
        setResolvedTheme(applyThemeToDOM("system"));
      }
    };

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        const nextMode: ThemeMode =
          e.newValue === "light" || e.newValue === "dark" || e.newValue === "system"
            ? e.newValue
            : "system";
        setModeState(nextMode);
        setResolvedTheme(applyThemeToDOM(nextMode));
      }
    };

    mediaQuery.addEventListener("change", handleMediaChange);
    window.addEventListener("storage", handleStorageChange);

    return () => {
      mediaQuery.removeEventListener("change", handleMediaChange);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  const setMode = React.useCallback((nextMode: ThemeMode) => {
    setModeState(nextMode);
    if (nextMode === "system") {
      window.localStorage.removeItem(STORAGE_KEY);
    } else {
      window.localStorage.setItem(STORAGE_KEY, nextMode);
    }
    setResolvedTheme(applyThemeToDOM(nextMode));
  }, []);

  const value = React.useMemo(
    () => ({ mode, resolvedTheme, setMode }),
    [mode, resolvedTheme, setMode]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return React.useContext(ThemeContext);
}

