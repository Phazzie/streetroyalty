import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AopStage } from "@/components/studio/aop-stage";
import { AOP_ORDER_CLOSED, PRINTFUL_AOP } from "@/lib/pod/aop-printful";
import { defaultGarment } from "@/lib/studio/garments";

/** What a maker reads in the all-over view: the cloth per garment, and that ordering is not open. */
describe("the all-over studio copy", () => {
  it("is open for orders, names the cloth, and never says the flat is what prints", () => {
    render(
      <AopStage
        garment={defaultGarment("aop-hoodie")}
        label="SR"
        onChange={vi.fn()}
      />,
    );
    expect(screen.queryByText(AOP_ORDER_CLOSED)).toBeNull();
    expect(screen.getByText(PRINTFUL_AOP.hoodie.material.line)).toBeTruthy();
    expect(screen.queryByText(/The flat is the garment/)).toBeNull();
  });

  it("gives the joggers their own line", () => {
    render(
      <AopStage
        garment={defaultGarment("aop-joggers")}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByText(PRINTFUL_AOP.joggers.material.line)).toBeTruthy();
    expect(PRINTFUL_AOP.joggers.material.line).not.toBe(PRINTFUL_AOP.hoodie.material.line);
  });

  it("shows a print sheet for every placement the printer cuts", () => {
    render(
      <AopStage
        garment={defaultGarment("aop-track-jacket")}
        onChange={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "See print sheets" }));
    for (const name of [
      "Front",
      "Back",
      "Collar and zip facings",
      "Pocket",
      "Left sleeve",
      "Right sleeve",
    ]) {
      expect(screen.getByRole("img", { name: `${name} print sheet` })).toBeTruthy();
    }
  });

});
