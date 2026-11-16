import type { ShopTheme } from "@/lib/moon/theme";

export function ThemeSwitch({ theme, onToggle }: { theme: ShopTheme; onToggle: () => void }) {
  return (
    <button type="button" onClick={onToggle} className="chip" aria-label={`Switch storefront theme. Current: ${theme.name}`}>
      Skin: {theme.name} — flip it
    </button>
  );
}
