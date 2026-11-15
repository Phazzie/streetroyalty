/**
 * Crown Fitting (the quiz) + Fit Rescue (the PSA flow). Fast, funny, no
 * pity language anywhere — the quiz seeds a colorway, a size lane, and
 * board tags; the rescue starts from what is wrong and re-cuts it.
 */
import { CURATED_COLORWAYS, type Colorway } from "./colorway.ts";

export type FittingAnswers = {
  /** Where the piece does its work. */
  scene: "block" | "boardroom" | "night" | "everywhere";
  /** How it should sit. */
  fit: "close" | "classic" | "oversized";
  /** Color nerve. */
  nerve: "loud" | "stealth" | "both";
};

export type FittingResult = {
  colorway: Colorway;
  sizeLane: string;
  tags: string[];
  line: string;
};

export function scoreFitting(answers: FittingAnswers): FittingResult {
  const tags: string[] = [answers.scene, answers.fit, answers.nerve];
  let colorway = CURATED_COLORWAYS[0]!;
  if (answers.nerve === "stealth") colorway = CURATED_COLORWAYS.find((way) => way.name === "Clean money") ?? colorway;
  if (answers.nerve === "loud" && answers.scene === "night") colorway = CURATED_COLORWAYS.find((way) => way.name === "Ultraviolet block") ?? colorway;
  if (answers.nerve === "loud" && answers.scene !== "night") colorway = CURATED_COLORWAYS.find((way) => way.name === "Corner store") ?? colorway;
  if (answers.nerve === "both") colorway = CURATED_COLORWAYS.find((way) => way.name === "Night court") ?? colorway;
  const sizeLane =
    answers.fit === "close"
      ? "Cut close. Take your usual size and let it work."
      : answers.fit === "oversized"
        ? "Oversized lane. Size up once, drape does the talking."
        : "Classic lane. Usual size, clean lines.";
  return {
    colorway,
    sizeLane,
    tags,
    line: `Fitted: ${colorway.name}. ${sizeLane}`,
  };
}

export type FitProblem = {
  id: string;
  label: string;
  psa: string;
  fix: string;
  targetType: string;
};

export const FIT_PROBLEMS: FitProblem[] = [
  {
    id: "boxy",
    label: "Boxy — wearing a cardboard sign",
    psa: "Somewhere, a good night is being worn like a refrigerator box.",
    fix: "Re-cut on a close or classic lane blank, print smaller and higher on the chest so the piece has a shape again.",
    targetType: "T-Shirt",
  },
  {
    id: "drowned",
    label: "Drowned — sleeves past the elbows, hem past the point",
    psa: "The shirt is wearing him. This happens more than anyone admits.",
    fix: "Drop a size, move the print to the front thigh or chest mark instead of a billboard, let the garment end where it should.",
    targetType: "Long-Sleeve",
  },
  {
    id: "invisible-ink",
    label: "Invisible ink — print nobody can read",
    psa: "He paid for a statement. It whispers. From two feet away it says nothing.",
    fix: "Run Print Check, take the ink to a 3:1 contrast or better against the garment, and let the colorway engine pick the pair.",
    targetType: "Hoodie",
  },
  {
    id: "one-note",
    label: "One note — top and bottom are the same sentence",
    psa: "A whole outfit, one idea, repeated. The block noticed. The block said nothing. The block was right.",
    fix: "Split the sentence: loud top, quiet bottom, or the reverse. Complete the look with a third piece that argues a little.",
    targetType: "Joggers",
  },
];

export function rescueFor(problemId: string): FitProblem {
  return FIT_PROBLEMS.find((problem) => problem.id === problemId) ?? FIT_PROBLEMS[0]!;
}
