import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { scoreFitting, type FittingAnswers } from "@/lib/moon/fitting";

/** Crown Fitting: three taps, one lane. Seeds palette, size lane, tags. */
export function CrownFitting() {
  const [answers, setAnswers] = useState<Partial<FittingAnswers>>({});
  const done = answers.scene && answers.fit && answers.nerve;
  const result = done ? scoreFitting(answers as FittingAnswers) : null;

  function pick<K extends keyof FittingAnswers>(key: K, value: FittingAnswers[K]) {
    const next = { ...answers, [key]: value };
    setAnswers(next);
    if (next.scene && next.fit && next.nerve) {
      try {
        window.localStorage.setItem("sr-fitting", JSON.stringify(next));
      } catch {
        // The result still shows; persistence is a bonus.
      }
    }
  }

  const groups: { key: keyof FittingAnswers; label: string; options: { value: string; label: string }[] }[] = [
    {
      key: "scene",
      label: "Where does it work?",
      options: [
        { value: "block", label: "The block" },
        { value: "boardroom", label: "The boardroom" },
        { value: "night", label: "The night" },
        { value: "everywhere", label: "Everywhere" },
      ],
    },
    {
      key: "fit",
      label: "How does it sit?",
      options: [
        { value: "close", label: "Close" },
        { value: "classic", label: "Classic" },
        { value: "oversized", label: "Oversized" },
      ],
    },
    {
      key: "nerve",
      label: "Color nerve?",
      options: [
        { value: "loud", label: "Loud" },
        { value: "stealth", label: "Stealth" },
        { value: "both", label: "Both, depends" },
      ],
    },
  ];

  return (
    <section aria-label="Crown fitting" className="mx-auto max-w-6xl px-4 pb-10">
      <p className="tag">Crown Fitting</p>
      <h2 className="mt-3 font-display text-4xl leading-none uppercase">Three taps. One lane.</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        {groups.map((group) => (
          <fieldset key={group.key} className="border-2 border-line bg-surface p-3">
            <legend className="font-display text-sm uppercase">{group.label}</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {group.options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={answers[group.key] === option.value}
                  onClick={() => pick(group.key, option.value as FittingAnswers[typeof group.key])}
                  className={`chip ${answers[group.key] === option.value ? "chip-on" : ""}`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </fieldset>
        ))}
      </div>
      {result ? (
        <div className="mt-4 flex flex-wrap items-center gap-3 border-2 border-lime bg-bg p-4">
          <span className="inline-block size-10 border-2 border-ink" style={{ background: result.colorway.garmentHex }} aria-hidden="true" />
          <span className="inline-block size-10 border-2 border-ink" style={{ background: result.colorway.inkHex }} aria-hidden="true" />
          <p className="font-display text-lg">{result.line}</p>
          <Link to="/studio" className="chip chip-on">
            Build in this lane
          </Link>
        </div>
      ) : null}
    </section>
  );
}
