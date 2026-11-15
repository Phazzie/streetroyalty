/**
 * Storefront themes. Two full skins, switched live, persisted per browser.
 * Matte Black is the MKBHD lesson — restraint, the cut does the talking.
 * Graffiti Maximal is the house energy — every accent at once, on purpose.
 * Tokens map onto the CSS variables the shop already reads.
 */

export type ShopThemeId = "matte" | "maximal";

export type ShopTheme = {
  id: ShopThemeId;
  name: string;
  tagline: string;
  vars: Record<string, string>;
};

export const SHOP_THEMES: ShopTheme[] = [
  {
    id: "matte",
    name: "Matte Black Everything",
    tagline: "Four pieces. No noise. The cut talks.",
    vars: {
      "--color-bg": "#0a0a0a",
      "--color-surface": "#141414",
      "--color-cream": "#1c1c1c",
      "--color-pipe": "#3a3a3a",
      "--color-accent": "#f6f1ff",
      "--color-accent-fg": "#0a0a0a",
      "--color-line": "#2c2c2c",
    },
  },
  {
    id: "maximal",
    name: "Graffiti Maximal",
    tagline: "Every color on the wall. That is the point.",
    vars: {
      "--color-bg": "#0b0614",
      "--color-surface": "#20182c",
      "--color-cream": "#161022",
      "--color-pipe": "#ff2d95",
      "--color-accent": "#d6ff3c",
      "--color-accent-fg": "#14081c",
      "--color-line": "#3a2d52",
    },
  },
];

export const THEME_STORAGE_KEY = "sr-shop-theme";

export function themeById(id: string | null | undefined): ShopTheme {
  return SHOP_THEMES.find((theme) => theme.id === id) ?? SHOP_THEMES[1]!;
}

export function nextTheme(id: ShopThemeId): ShopTheme {
  return id === "matte" ? SHOP_THEMES[1]! : SHOP_THEMES[0]!;
}
