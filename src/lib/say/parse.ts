/**
 * Turns the way people talk about a piece into a design intent, one sentence at a time.
 * No model, no network. It never throws: what it cannot read goes back in `unsure`.
 */
import {
  COLOR_PATTERN,
  INK_DARK,
  INK_LIGHT,
  colorDistance,
  colorName,
  contrastInk,
  findColors,
} from "./colors.ts";

export type SayBlank = "tee" | "hoodie" | "crewneck" | "hat";
export type SayPlacement = "front" | "back" | "sleeve";
export type SaySize = "small" | "medium" | "big" | "huge";

export type SayLine = { text: string; color: string; size: SaySize; tilt: number };

export type SayIntent = {
  blank: SayBlank;
  garmentColor: string;
  placement: SayPlacement;
  lines: SayLine[];
  font: string;
};

export type SayResult = { intent: SayIntent; understood: string[]; unsure: string[] };

export const SIZES: readonly SaySize[] = ["small", "medium", "big", "huge"];
export const MAX_LINES = 8;
export const MAX_LINE_CHARS = 60;
const TILT_STEP = 8;

export function emptyIntent(): SayIntent {
  return {
    blank: "tee",
    garmentColor: "#141414",
    placement: "front",
    lines: [],
    font: "Archivo Black",
  };
}

const BLANK_NAME: Record<SayBlank, string> = {
  tee: "tee",
  hoodie: "hoodie",
  crewneck: "crewneck",
  hat: "hat",
};

const PLACEMENT_NAME: Record<SayPlacement, string> = {
  front: "Front",
  back: "Back",
  sleeve: "Sleeve",
};

function capital(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function describeGarment(intent: SayIntent): string {
  return capital(`${colorName(intent.garmentColor)} ${BLANK_NAME[intent.blank]}`);
}

export function describeLine(line: SayLine): string {
  const tilt = line.tilt === 0 ? "" : ", tilted";
  return `${line.text} in ${colorName(line.color)}, ${line.size}${tilt}`;
}

/** The whole piece as plain chips: "Black hoodie", "Back", "DO BETTER in pink, big". */
export function describeIntent(intent: SayIntent): string[] {
  return [
    describeGarment(intent),
    PLACEMENT_NAME[intent.placement],
    ...intent.lines.map(describeLine),
    ...(intent.font === "Outfit" ? ["Plain letters"] : []),
  ];
}

const BLANK_WORDS =
  "t[- ]?shirts?|tee[- ]shirts?|tees?|shirts?|pullover hoodies?|hoodies?|hoody|hooded sweatshirts?|hooded|crew ?necks?|crew|sweatshirts?|sweaters?|jumpers?|dad hats?|hats?|caps?|beanies?|snapbacks?|lids?";

const BLANKS: [SayBlank, RegExp][] = [
  ["hoodie", /\b(?:pullover hoodies?|hoodies?|hoody|hooded sweatshirts?|hooded)\b/i],
  ["crewneck", /\b(?:crew ?necks?|crew|sweatshirts?|sweaters?|jumpers?)\b/i],
  ["hat", /\b(?:dad hats?|hats?|caps?|beanies?|snapbacks?|lids?)\b/i],
  ["tee", /\b(?:t[- ]?shirts?|tee[- ]shirts?|tees?|shirts?)\b/i],
];

const RESET =
  /\b(?:start (?:over|again|fresh)|from scratch|scrap (?:it|that)|wipe it|clear (?:it|everything|it all)|new piece)\b/i;

const PRONOUNS = /^(?:it|that|this|them|those|these|mine|one|something|stuff|words?|text|a line)$/i;

const ORDINALS: [RegExp, number][] = [
  [/^(?:first|1st|top)$/i, 0],
  [/^(?:second|2nd|middle)$/i, 1],
  [/^(?:third|3rd)$/i, 2],
  [/^(?:fourth|4th)$/i, 3],
  [/^(?:last|bottom)$/i, -1],
];

/** Words that carry no instruction on their own, so they are never reported as missed. */
const FILLER = new Set(
  (
    "a an the on of in with make made it its it's put please i i'd i'm id im want wanna me my and that " +
    "to is for can you give let's lets some like would do have get need text words word letters " +
    "print printed colour color coloured colored one this be go so just more bit little um uh ok okay " +
    "yeah yo hey now then also too but or at by says say saying reads read write written name line " +
    "lines across over onto up down there here them thing piece look way much really real very " +
    "all side part switch change turn move set size sized kind of sort got gonna going should will " +
    "could us we are am was im' instead again still keep add new another same out off as if no not " +
    "show see how about what when where which who why let try use using wearing wear called call " +
    "something stuff shows showing design designed start mine ours his her their"
  ).split(" "),
);

function normalise(text: unknown): string {
  return String(text ?? "")
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 400);
}

function cleanText(text: string): string {
  return text
    .replace(/^["'\s]+|["'\s]+$/g, "")
    .replace(/[.]+$/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_LINE_CHARS)
    .trim();
}

const STOPS: RegExp[] = [
  /,/,
  new RegExp(`\\s+(?:in|with|using)\\s+(?:a\\s+|the\\s+)?(?:${COLOR_PATTERN})\\b`, "i"),
  /\s+(?:on|across|onto|over|down)\s+(?:the|a|an|my|it|its|this|that|your|both)\b/i,
  /\s+(?:and|then|but)\s+(?:make|put|tilt|turn|change|add|keep|give|move)\b/i,
  /\s+(?:in|all)\s+(?:lower ?case|upper ?case|caps|capitals|small letters|big letters|huge letters|bold)\b/i,
  /\s+(?:but\s+)?(?:lower ?case|upper ?case)\b/i,
];

/** Split what follows a trigger word into the words to print and the rest of the sentence. */
function cutAtStop(said: string): { head: string; rest: string } {
  // The leading space lets a stop match at the very start: "my name on it" has no name in it.
  const tail = ` ${said}`;
  let cut = tail.length;
  for (const stop of STOPS) {
    const match = stop.exec(tail);
    if (match && match.index < cut) cut = match.index;
  }
  return { head: tail.slice(0, cut), rest: tail.slice(cut) };
}

type Pulled = {
  /** Words to print, in the order they were said. */
  texts: string[];
  /** "add" appends a line. "set" replaces the current line, or starts the first. A number targets that line. */
  mode: "add" | "set" | number;
  rest: string;
};

function ordinalIndex(word: string): number | null {
  for (const [pattern, index] of ORDINALS) if (pattern.test(word)) return index;
  return null;
}

function pullText(input: string): Pulled {
  let rest = input;
  const texts: string[] = [];
  let mode: Pulled["mode"] = "set";

  // "remove the last line" names a line without adding one.
  const removing =
    /\b(?:remove|delete|drop|lose|kill|take (?:off|out|away)|get rid of)\b.*\blines?\b/i.test(rest);
  // "second line no encore", "add a line that says no encore", "under it put no encore".
  const numbered = removing
    ? null
    : /\b(?:(?:add|and|then|make|put|change)\s+)?(?:a\s+|the\s+)?(first|1st|top|second|2nd|middle|third|3rd|fourth|4th|last|bottom)\s+lines?\b\s*(?:that\s+|to\s+)?(?:says?|saying|reads?|is|of|with|:)?\s*(.*)$/i.exec(
        rest,
      );
  const added = removing
    ? null
    : (/\b(?:(?:add|and|then|put|give me|with)\s+)?(?:a\s+|an\s+|one\s+)?(?:next|another|new|more|extra|other)\s+lines?\b\s*(?:that\s+)?(?:says?|saying|reads?|is|of|with|:)?\s*(.*)$/i.exec(
        rest,
      ) ??
      /\b(?:add|put)\s+(?:a\s+|another\s+)?lines?\s+(?:that\s+)?(?:says?|saying|reads?|of|with|:)\s*(.*)$/i.exec(
        rest,
      ) ??
      /\b(?:under(?:neath)?|below|beneath)\s+(?:it|that|this)?\s*(?:put|write|add|say|says|:)?\s*(.*)$/i.exec(
        rest,
      ));
  if (numbered) {
    mode = ordinalIndex(numbered[1] ?? "") ?? "add";
    rest = `${rest.slice(0, numbered.index)} | ${numbered[2] ?? ""}`;
  } else if (added) {
    mode = "add";
    rest = `${rest.slice(0, added.index)} | ${added[1] ?? ""}`;
  }

  // Quoted words win over every other rule.
  const quoted = /"([^"]+)"|(?:^|[\s|])'([^']+)'(?=[\s,.!?|]|$)/g;
  let found = false;
  rest = rest.replace(quoted, (_all, double: string | undefined, single: string | undefined) => {
    const text = cleanText(double ?? single ?? "");
    if (text) {
      texts.push(text);
      found = true;
    }
    return " | ";
  });
  if (found) return { texts, mode, rest };

  if (numbered || added) {
    const tailStart = rest.lastIndexOf("|") + 1;
    const { head, rest: after } = cutAtStop(rest.slice(tailStart));
    const text = cleanText(head);
    if (text && !PRONOUNS.test(text)) {
      // "second line pink" is a change to the line, not a line that reads PINK. The caller decides.
      return { texts: [text], mode, rest: `${rest.slice(0, tailStart)} ${after}` };
    }
    return { texts, mode, rest };
  }

  const trigger =
    /\b(?:that\s+)?(?:says|saying|reads|reading|spells|(?:it|to|should|will|gonna|and|shirt|tee|hoodie|hat|crewneck)\s+(?:say|read)|with\s+the\s+(?:words?|text|letters|phrase|name)|the\s+(?:words?|phrase)|my\s+name(?:\s+is)?|(?:the\s+)?name(?:\s+is)?|write|spell)\s*:?\s+(.+)$/i.exec(
      rest,
    );
  if (trigger) {
    const { head, rest: after } = cutAtStop(trigger[1] ?? "");
    const text = cleanText(head);
    // "make the words bigger" is about the words. "that says bigger" is a print.
    const weak = /^the\s/i.test(trigger[0]) && styleOnly(text);
    if (text && !PRONOUNS.test(text) && !weak) {
      return { texts: [text], mode, rest: `${rest.slice(0, trigger.index)} | ${after}` };
    }
  }

  // "a white hoodie with DO BETTER on the back".
  const carried = /\bwith\s+(.+?)\s+(on|across|down|over)\s+(?:the|it|its|both)\b/i.exec(rest);
  if (carried) {
    const text = cleanText(carried[1] ?? "");
    if (
      text &&
      !PRONOUNS.test(text) &&
      !styleOnly(text) &&
      !/^(?:a|an|the|my|some)\b/i.test(text)
    ) {
      const at = carried.index + carried[0].indexOf(carried[1] ?? "");
      return {
        texts: [text],
        mode,
        rest: `${rest.slice(0, at)} | ${rest.slice(at + (carried[1] ?? "").length)}`,
      };
    }
  }

  // "put DO BETTER on the back".
  const put =
    /^(?:(?:please|can you|could you|i want to|i want you to|let's|lets|just|ok|okay|yo)\s+)*(?:put|stick|slap|throw|stamp|print)\s+(.+?)\s+(on|across|onto|over|down|in)\b/i.exec(
      rest,
    );
  if (put) {
    const text = cleanText(put[1] ?? "");
    if (
      text &&
      !PRONOUNS.test(text) &&
      !styleOnly(text) &&
      !/^(?:a|an|the|my|some)\b/i.test(text)
    ) {
      const keep = put[0].length - (put[2] ?? "").length;
      return { texts: [text], mode, rest: ` | ${rest.slice(keep)}` };
    }
  }
  return { texts, mode, rest };
}

type Found = {
  reset: boolean;
  blank: SayBlank | null;
  garmentColor: string | null;
  looseColor: string | null;
  printColor: string | null;
  placement: SayPlacement | null;
  size: SaySize | null;
  step: number;
  tilt: "more" | "flip" | "flat" | "side" | null;
  letters: "lower" | "upper" | null;
  font: string | null;
  removeLine: number | "last" | "all" | null;
  undo: boolean;
  leftover: string[];
};

/** Read every instruction out of a sentence that has already had its print words lifted out. */
function scan(input: string, hasGarmentColorAlready: boolean): Found {
  let rest = ` ${input.toLowerCase()} `;
  const found: Found = {
    reset: false,
    blank: null,
    garmentColor: null,
    looseColor: null,
    printColor: null,
    placement: null,
    size: null,
    step: 0,
    tilt: null,
    letters: null,
    font: null,
    removeLine: null,
    undo: false,
    leftover: [],
  };
  const take = (pattern: RegExp): RegExpExecArray | null => {
    const match = pattern.exec(rest);
    if (match)
      rest = `${rest.slice(0, match.index)} | ${rest.slice(match.index + match[0].length)}`;
    return match;
  };

  if (take(RESET)) found.reset = true;

  // Colours first, while the words around them still say what they belong to.
  let garmentSet = hasGarmentColorAlready;
  const hits = findColors(rest);
  for (const hit of hits) {
    const before = rest.slice(0, hit.index);
    const after = rest.slice(hit.index + hit.length);
    const garmentAfter = new RegExp(
      `^\\s*(?:colou?red\\s+)?(?:heavy\\s+|plain\\s+|blank\\s+)?(?:${BLANK_WORDS}|one)\\b`,
    ).test(after);
    const garmentBefore = new RegExp(
      `\\b(?:${BLANK_WORDS}|garment|blank|fabric|background)\\s+(?:in|is|be|to|that's|thats)?\\s*$`,
    ).test(before);
    const lettersAfter = /^\s*(?:letters|lettering|text|words|writing|print|ink|type)\b/.test(
      after,
    );
    const lettersBefore =
      /\b(?:letters|lettering|text|words|writing|print|ink|type)\s+(?:in|is|to)?\s*$/.test(before);
    if (lettersAfter || lettersBefore) found.printColor = hit.hex;
    else if (garmentAfter || (garmentBefore && !garmentSet)) {
      found.garmentColor = hit.hex;
      garmentSet = true;
    } else found.looseColor = hit.hex;
  }
  for (const hit of [...hits].reverse()) {
    rest = `${rest.slice(0, hit.index)} | ${rest.slice(hit.index + hit.length)}`;
  }

  // Letter case before blanks, so "all caps" is never a hat.
  if (take(/\b(?:lower ?case|small letters|little letters|no caps|not caps|no capitals)\b/))
    found.letters = "lower";
  else if (
    take(/\b(?:upper ?case|all caps|caps|capitals|capital letters|big letters|shout(?:ing)?)\b/)
  )
    found.letters = "upper";

  if (take(/\b(?:no words|no text|remove the (?:words|text)|take the (?:words|text) off)\b/))
    found.removeLine = "all";
  const removed = take(
    /\b(?:remove|delete|drop|lose|kill|take (?:off|out|away)|get rid of)\s+(?:the\s+|that\s+|my\s+)?(?:(first|1st|top|second|2nd|middle|third|3rd|fourth|4th|last|bottom)\s+)?lines?\b/,
  );
  if (removed) found.removeLine = ordinalIndex(removed[1] ?? "") ?? "last";
  if (take(/\b(?:undo|go back|take that back|never ?mind)\b/)) found.undo = true;

  for (const [blank, pattern] of BLANKS) {
    if (take(pattern) && !found.blank) found.blank = blank;
  }

  if (take(/\b(?:sleeves?|arm|shoulder)\b/)) found.placement = "sleeve";
  else if (take(/\b(?:the\s+)?back\b/)) found.placement = "back";
  else if (take(/\b(?:front|chest|heart)\b/)) found.placement = "front";

  const up = take(
    /\b(?:(way|much|a lot|even)\s+)?(?:(?:a\s+)?(?:little|bit|tad|touch)\s+)?(?:bigger|larger|blow it up|size up)\b/,
  );
  if (up) found.step += up[1] ? 2 : 1;
  const down = take(
    /\b(?:(way|much|a lot|even)\s+)?(?:(?:a\s+)?(?:little|bit|tad|touch)\s+)?(?:smaller|tinier|shrink|size down)\b/,
  );
  if (down) found.step -= down[1] ? 2 : 1;
  if (
    take(
      /\b(?:huge|massive|giant|gigantic|enormous|as big as (?:it|you) can(?: go)?|(?:real|really|super|extra|very) (?:big|large))\b/,
    )
  )
    found.size = "huge";
  else if (take(/\b(?:big|large)\b/)) found.size = "big";
  else if (take(/\b(?:small|tiny)\b/)) found.size = "small";
  else if (take(/\b(?:medium|regular size|normal size|mid size)\b/)) found.size = "medium";

  if (take(/\b(?:straight(?:en)?|level|no tilt|untilt|flat)\b/)) found.tilt = "flat";
  else if (take(/\b(?:sideways|vertical|up the side)\b/)) found.tilt = "side";
  else if (take(/\b(?:the other way|other direction|tilt (?:it )?(?:right|back)|clockwise)\b/))
    found.tilt = "flip";
  else if (
    take(
      /\b(?:tilt(?:ed)?|slant(?:ed)?|crooked|lean(?:ing)?|at an angle|angled?|diagonal|rotated?|wonky)\b/,
    )
  )
    found.tilt = "more";

  if (
    take(
      /\b(?:plain|thin|skinny|clean|simple|light|soft|round|regular)\s+(?:letters|lettering|font|type|text|writing)\b/,
    )
  )
    found.font = "Outfit";
  else if (
    take(
      /\b(?:bold|block|blocky|heavy|thick|fat|loud)(?:\s+(?:letters|lettering|font|type|text|writing))?\b/,
    )
  )
    found.font = "Archivo Black";

  found.leftover = rest
    .split("|")
    .map((piece) =>
      piece
        .replace(/[^a-z0-9' -]/g, " ")
        .split(/\s+/)
        .filter((word) => word && !FILLER.has(word)),
    )
    .filter((words) => words.length > 0)
    .map((words) => words.join(" "));
  return found;
}

/** True when the words are all instructions, like "bigger" or "in pink", and nothing to print. */
function styleOnly(text: string): boolean {
  const found = scan(text, false);
  return found.leftover.length === 0 && !nothingFound(found);
}

function stepSize(size: SaySize, by: number): SaySize {
  const at = SIZES.indexOf(size);
  return SIZES[Math.min(SIZES.length - 1, Math.max(0, at + by))] ?? size;
}

function isLower(lines: SayLine[]): boolean {
  return (
    lines.length > 0 &&
    lines.every((line) => /[a-z]/.test(line.text) && line.text === line.text.toLowerCase())
  );
}

function nothingFound(found: Found): boolean {
  return (
    !found.reset &&
    !found.blank &&
    !found.garmentColor &&
    !found.looseColor &&
    !found.printColor &&
    !found.placement &&
    !found.size &&
    found.step === 0 &&
    !found.tilt &&
    !found.letters &&
    !found.font &&
    found.removeLine === null &&
    !found.undo
  );
}

function work(intent: SayIntent, said: string): SayResult {
  const text = normalise(said);
  if (!text) return { intent, understood: [], unsure: [] };

  const pulled = pullText(text);
  let found = scan(pulled.rest, false);
  let texts = pulled.texts;
  const mode = pulled.mode;

  if (found.reset) {
    const fresh = emptyIntent();
    const at = RESET.exec(text);
    const again = work(fresh, at ? text.slice(at.index + at[0].length) : "");
    return {
      intent: again.intent,
      understood: ["Started over", ...again.understood],
      unsure: again.unsure,
    };
  }

  // "second line pink": a change to a line that exists, not a line that reads PINK.
  if (typeof mode === "number" && texts.length === 1) {
    const index = mode === -1 ? intent.lines.length - 1 : mode;
    const asStyle = scan(texts[0] ?? "", false);
    if (
      index >= 0 &&
      index < intent.lines.length &&
      asStyle.leftover.length === 0 &&
      !nothingFound(asStyle)
    ) {
      found = scan(`${pulled.rest} ${texts[0]}`, false);
      texts = [];
    }
  }

  // Bare words and nothing else: on an empty piece they are the print.
  if (texts.length === 0 && nothingFound(found) && mode === "set") {
    const words = text.split(" ").length;
    const instruction =
      /\b(?:put|make|add|write|says?|saying|name|line|change|give|want|can you|please)\b/i.test(
        text,
      );
    if (intent.lines.length === 0 && words <= 8 && !instruction) {
      texts = [cleanText(text)].filter(Boolean);
      found = { ...found, leftover: [] };
    } else {
      return { intent, understood: [], unsure: [text] };
    }
  }

  const next: SayIntent = { ...intent, lines: intent.lines.map((line) => ({ ...line })) };
  const understood: string[] = [];
  const unsure = [...found.leftover];
  const touched = new Set<number>();

  if (found.blank) next.blank = found.blank;
  const hadLines = next.lines.length > 0 || texts.length > 0;
  const garmentColor = found.garmentColor ?? (hadLines ? null : found.looseColor);
  let printColor = found.printColor ?? (hadLines ? found.looseColor : null);
  if (found.printColor && !hadLines) {
    unsure.push(`${colorName(found.printColor)} letters (say the words first)`);
    printColor = null;
  }
  if (garmentColor) next.garmentColor = garmentColor;
  if (found.placement) next.placement = found.placement;
  if (found.font) next.font = found.font;

  // Lines.
  if (found.removeLine === "all") next.lines = [];
  else if (found.removeLine !== null && next.lines.length > 0) {
    const at =
      found.removeLine === "last" || found.removeLine === -1
        ? next.lines.length - 1
        : Math.min(found.removeLine, next.lines.length - 1);
    next.lines.splice(at, 1);
    understood.push("Took a line off");
  }

  const lower = found.letters === "lower" || (found.letters !== "upper" && isLower(intent.lines));
  const shape = (value: string) => (lower ? value.toLowerCase() : value.toUpperCase());
  const template = next.lines[next.lines.length - 1];
  texts.forEach((value, order) => {
    const fresh: SayLine = {
      text: shape(value),
      color: template?.color ?? contrastInk(next.garmentColor),
      size: template?.size ?? "medium",
      tilt: template?.tilt ?? 0,
    };
    const target =
      order > 0 || mode === "add"
        ? next.lines.length
        : mode === "set"
          ? Math.max(0, next.lines.length - 1)
          : mode === -1
            ? Math.max(0, next.lines.length - 1)
            : Math.min(mode, next.lines.length);
    if (target >= MAX_LINES) {
      unsure.push(`${value} (eight lines is the limit)`);
      return;
    }
    const existing = next.lines[target];
    if (existing) existing.text = fresh.text;
    else next.lines.push(fresh);
    touched.add(Math.min(target, next.lines.length - 1));
  });

  // Style goes to the line just said, the line that was named, or the whole print.
  const named = typeof mode === "number" && texts.length === 0;
  const scope: number[] = named
    ? [mode === -1 ? next.lines.length - 1 : mode].filter((at) => at >= 0 && at < next.lines.length)
    : touched.size > 0
      ? [...touched]
      : next.lines.map((_line, at) => at);
  if (named && scope.length === 0 && !nothingFound(found))
    unsure.push("that line (it is not there yet)");

  const styled = Boolean(printColor || found.size || found.step || found.tilt || found.letters);
  for (const at of scope) {
    const line = next.lines[at];
    if (!line) continue;
    if (printColor) line.color = printColor;
    if (found.size) line.size = found.size;
    if (found.step) line.size = stepSize(line.size, found.step);
    if (found.tilt === "flat") line.tilt = 0;
    if (found.tilt === "side") line.tilt = -90;
    if (found.tilt === "flip") line.tilt = line.tilt === 0 ? TILT_STEP : -line.tilt;
    if (found.tilt === "more") {
      const way = line.tilt > 0 ? 1 : -1;
      line.tilt = Math.max(-40, Math.min(40, line.tilt + way * TILT_STEP));
    }
    if (found.letters === "lower") line.text = line.text.toLowerCase();
    if (found.letters === "upper") line.text = line.text.toUpperCase();
    if (styled) touched.add(at);
  }
  if (styled && scope.length === 0 && next.lines.length === 0 && !found.printColor) {
    const what = found.tilt ? "tilt" : found.letters ? "letters" : "size";
    unsure.push(`${what} (say the words first)`);
  }

  // A print left in its starting ink would vanish on a garment of the same colour. Keep it showing.
  if (garmentColor) {
    next.lines.forEach((line, at) => {
      const starter = line.color === INK_DARK || line.color === INK_LIGHT;
      if (starter && !printColor && colorDistance(line.color, next.garmentColor) < 14) {
        line.color = contrastInk(next.garmentColor);
        touched.add(at);
      }
    });
  }

  if (found.blank || garmentColor) understood.unshift(describeGarment(next));
  if (found.placement) understood.push(PLACEMENT_NAME[next.placement]);
  for (const at of [...touched].sort((a, b) => a - b)) {
    const line = next.lines[at];
    if (line) understood.push(describeLine(line));
  }
  if (found.font) understood.push(next.font === "Outfit" ? "Plain letters" : "Bold letters");
  if (found.undo) unsure.push("undo (tap Undo)");

  return { intent: next, understood, unsure: [...new Set(unsure)] };
}

/**
 * Apply one sentence to the piece so far.
 * Understands a fresh description and follow-ups alike. Never throws.
 */
export function applyUtterance(intent: SayIntent, text: string): SayResult {
  try {
    return work(intent, text);
  } catch {
    const said = normalise(text);
    return { intent, understood: [], unsure: said ? [said] : [] };
  }
}

const HEX6 = /^#[0-9a-fA-F]{6}$/;

/** Read back an intent that was put away as JSON. Anything off and it is treated as not there. */
export function reviveIntent(input: unknown): SayIntent | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Record<string, unknown>;
  const blank = (["tee", "hoodie", "crewneck", "hat"] as const).find((item) => item === raw.blank);
  const placement = (["front", "back", "sleeve"] as const).find((item) => item === raw.placement);
  if (!blank || !placement || !Array.isArray(raw.lines)) return null;
  if (typeof raw.garmentColor !== "string" || !HEX6.test(raw.garmentColor)) return null;
  const lines: SayLine[] = [];
  for (const entry of raw.lines.slice(0, MAX_LINES)) {
    if (!entry || typeof entry !== "object") return null;
    const line = entry as Record<string, unknown>;
    const size = SIZES.find((item) => item === line.size);
    const text = typeof line.text === "string" ? line.text.trim().slice(0, MAX_LINE_CHARS) : "";
    const tilt = Number(line.tilt);
    if (!size || !text || typeof line.color !== "string" || !HEX6.test(line.color)) return null;
    lines.push({
      text,
      color: line.color,
      size,
      tilt: Number.isFinite(tilt) ? Math.max(-180, Math.min(180, tilt)) : 0,
    });
  }
  return {
    blank,
    garmentColor: raw.garmentColor,
    placement,
    lines,
    font: raw.font === "Outfit" ? "Outfit" : "Archivo Black",
  };
}
