/**
 * Rules for a maker's handle, display name and bio. Pure, so the browser can run the
 * same checks the server enforces.
 */

export const HANDLE_MIN = 3;
export const HANDLE_MAX = 20;
export const NAME_MIN = 2;
export const NAME_MAX = 40;
export const BIO_MAX = 160;

/** Words that would read as the house speaking, or collide with a page. */
export const RESERVED_HANDLES: ReadonlySet<string> = new Set([
  "admin",
  "administrator",
  "me",
  "api",
  "studio",
  "shop",
  "rack",
  "lab",
  "street",
  "royalty",
  "streetroyalty",
  "street_royalty",
  "support",
  "help",
  "login",
  "logout",
  "signin",
  "signup",
  "cart",
  "bag",
  "order",
  "orders",
  "checkout",
  "battle",
  "battles",
  "maker",
  "makers",
  "account",
  "settings",
  "auth",
  "about",
  "drop",
  "drops",
  "crown",
  "crowns",
  "episodes",
  "official",
  "staff",
  "mod",
  "moderator",
  "owner",
  "team",
  "system",
  "root",
  "null",
  "undefined",
  "terms",
  "privacy",
  "home",
  "new",
  "edit",
  "www",
]);

export type Checked = { ok: true; value: string } | { ok: false; error: string };

/** Lower case, no leading @, no outer spaces. Says nothing about whether it is allowed. */
export function normalizeHandle(raw: string): string {
  return String(raw ?? "")
    .trim()
    .replace(/^@+/, "")
    .toLowerCase();
}

export function isReservedHandle(handle: string): boolean {
  return RESERVED_HANDLES.has(normalizeHandle(handle));
}

/** A handle someone typed. */
export function checkHandle(raw: string): Checked {
  const handle = normalizeHandle(raw);
  if (handle.length < HANDLE_MIN)
    return { ok: false, error: `A handle needs at least ${HANDLE_MIN} characters.` };
  if (handle.length > HANDLE_MAX)
    return { ok: false, error: `A handle can be ${HANDLE_MAX} characters at most.` };
  if (!/^[a-z0-9_]+$/.test(handle))
    return { ok: false, error: "Use letters, numbers and underscores only." };
  if (isReservedHandle(handle))
    return { ok: false, error: "That handle is kept back. Try another." };
  return { ok: true, value: handle };
}

/**
 * A starting handle from whatever name the account has. Always the right shape
 * (3 to 20 of a-z, 0-9, underscore). It can still be reserved or taken, which is
 * what `handleCandidate` is for.
 */
export function handleFromName(name: string): string {
  const base = String(name ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, HANDLE_MAX)
    .replace(/_+$/g, "");
  if (base.length === 0) return "maker";
  if (base.length < HANDLE_MIN) return `${base}_maker`;
  return base;
}

/** The base on the first try, then the base with 2, 3, 4 and so on, kept inside the limit. */
export function handleCandidate(base: string, attempt: number): string {
  if (attempt <= 0) return base;
  const digits = String(attempt + 1);
  return `${base.slice(0, HANDLE_MAX - digits.length)}${digits}`;
}

function singleLine(raw: string): string {
  return (
    String(raw ?? "")
      // Control characters, line breaks included, become spaces: a bio is one plain line.
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u001f\u007f]+/g, " ")
      // Blank fillers, and the marks that flip the reading direction, are dropped: they
      // make empty-looking names and can scramble the words around them.
      .replace(
        /[\u00ad\u061c\u115f\u1160\u180e\u200b\u200e\u200f\u2028-\u202e\u2060-\u2069\u3164\ufeff\uffa0]/g,
        "",
      )
      .replace(/\s+/g, " ")
      .trim()
  );
}

/** Names that would read as the house, or its staff, speaking. */
const HOUSE_NAMES: ReadonlySet<string> = new Set([
  "admin",
  "administrator",
  "official",
  "staff",
  "support",
  "moderator",
]);

/** True when a display name would pass for Street Royalty itself, however it is spaced or cased. */
export function isHouseName(name: string): boolean {
  const flat = String(name ?? "")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
  return flat.includes("streetroyalty") || HOUSE_NAMES.has(flat);
}

export function checkDisplayName(raw: string): Checked {
  const name = singleLine(raw);
  if (name.length < NAME_MIN)
    return { ok: false, error: `A name needs at least ${NAME_MIN} characters.` };
  if (name.length > NAME_MAX)
    return { ok: false, error: `Keep the name to ${NAME_MAX} characters.` };
  // Something a person can read, so a name is never a row of marks or blanks.
  if ((name.match(/[\p{L}\p{N}]/gu) ?? []).length < NAME_MIN)
    return { ok: false, error: `A name needs at least ${NAME_MIN} letters or numbers.` };
  if (isHouseName(name))
    return { ok: false, error: "That name belongs to the house. Pick your own." };
  return { ok: true, value: name };
}

/** Plain text, one line. It is stored as typed and only ever drawn as text. */
export function checkBio(raw: string): Checked {
  const bio = singleLine(raw);
  if (bio.length > BIO_MAX) return { ok: false, error: `Keep the bio to ${BIO_MAX} characters.` };
  return { ok: true, value: bio };
}
