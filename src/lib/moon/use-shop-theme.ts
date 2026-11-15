import { useEffect, useState, type CSSProperties } from "react";
import { nextTheme, themeById, THEME_STORAGE_KEY, type ShopTheme } from "./theme.ts";

/** Live storefront theme: persisted per browser, applied as CSS variables. */
export function useShopTheme(): { theme: ShopTheme; toggle: () => void; style: CSSProperties } {
  const [theme, setTheme] = useState<ShopTheme>(() => themeById(null));
  useEffect(() => {
    try {
      setTheme(themeById(window.localStorage.getItem(THEME_STORAGE_KEY)));
    } catch {
      // Private mode: stay on the default skin.
    }
  }, []);
  const toggle = () => {
    const next = nextTheme(theme.id);
    setTheme(next);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next.id);
    } catch {
      // The switch still applies for this visit.
    }
  };
  return { theme, toggle, style: theme.vars as CSSProperties };
}
