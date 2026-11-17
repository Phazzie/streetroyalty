import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Tracksuit } from "./tracksuit";

const COLORS = { body: "#b9a3ee", panel: "#f6ecd9", piping: "#ff8a3d" };

function panels(container: HTMLElement): string[] {
  return [
    ...new Set(
      [...container.querySelectorAll("[data-panel]")].map(
        (node) => node.getAttribute("data-panel") ?? "",
      ),
    ),
  ].sort();
}

describe("Tracksuit", () => {
  it("draws every named region of the hoodie", () => {
    const { container } = render(<Tracksuit colors={COLORS} view="hoodie" />);
    expect(panels(container)).toEqual(
      [
        "body",
        "cord",
        "cuff",
        "hem",
        "hood",
        "hood-lining",
        "piping",
        "pocket",
        "shoulder-panel",
        "side-panel",
        "sleeve",
        "sleeve-panel",
      ].sort(),
    );
    expect(container.querySelector("[data-piece='jogger']")).toBeNull();
  });

  it("draws every named region of the jogger", () => {
    const { container } = render(<Tracksuit colors={COLORS} view="jogger" />);
    expect(panels(container)).toEqual([
      "ankle-cuff",
      "cord",
      "leg",
      "leg-panel",
      "piping",
      "waistband",
    ]);
    expect(container.querySelector("[data-piece='hoodie']")).toBeNull();
  });

  it("draws both pieces as a set by default", () => {
    const { container } = render(<Tracksuit colors={COLORS} />);
    expect(container.querySelector("[data-piece='hoodie']")).not.toBeNull();
    expect(container.querySelector("[data-piece='jogger']")).not.toBeNull();
  });

  it("puts each colour on its own regions, with rib and cord falling back", () => {
    const { container } = render(<Tracksuit colors={COLORS} view="set" />);
    const fill = (name: string) =>
      container.querySelector(`[data-panel='${name}']`)?.getAttribute("fill");
    const stroke = (name: string) =>
      container.querySelector(`[data-panel='${name}']`)?.getAttribute("stroke");
    expect(fill("body")).toBe(COLORS.body);
    expect(fill("leg")).toBe(COLORS.body);
    expect(fill("sleeve-panel")).toBe(COLORS.panel);
    expect(fill("leg-panel")).toBe(COLORS.panel);
    expect(stroke("piping")).toBe(COLORS.piping);
    expect(fill("hem")).toBe(COLORS.body);
    expect(stroke("cord")).toBe(COLORS.panel);
  });

  it("takes its own rib and cord colours when given", () => {
    const { container } = render(
      <Tracksuit colors={{ ...COLORS, rib: "#111111", cord: "#ff2d95" }} view="hoodie" />,
    );
    expect(container.querySelector("[data-panel='cuff']")?.getAttribute("fill")).toBe("#111111");
    expect(container.querySelector("[data-panel='cord']")?.getAttribute("stroke")).toBe("#ff2d95");
  });

  it("keeps its pattern ids apart when two are on a page", () => {
    const { container } = render(
      <>
        <Tracksuit colors={COLORS} />
        <Tracksuit colors={COLORS} />
      </>,
    );
    const ids = [...container.querySelectorAll("pattern, linearGradient")].map((node) => node.id);
    expect(ids).toHaveLength(8);
    expect(new Set(ids).size).toBe(8);
  });

  it("is decoration unless it is given a title, and survives a colour that is not a colour", () => {
    const plain = render(
      <Tracksuit colors={{ body: "nope", panel: "", piping: "#12" }} />,
    ).container.querySelector("svg");
    expect(plain?.getAttribute("aria-hidden")).toBe("true");
    const titled = render(
      <Tracksuit colors={COLORS} title="A lilac sweatsuit" />,
    ).container.querySelector("svg");
    expect(titled?.getAttribute("role")).toBe("img");
    expect(titled?.getAttribute("aria-label")).toBe("A lilac sweatsuit");
  });
});
