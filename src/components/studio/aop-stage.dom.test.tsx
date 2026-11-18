import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AopStage } from "@/components/studio/aop-stage";
import { SetBoard } from "@/components/studio/set-board";
import { AOP_ORDER_CLOSED, PRINTFUL_AOP } from "@/lib/pod/aop-printful";
import { defaultGarment } from "@/lib/studio/garments";

/** What a maker reads in the all-over view: the cloth per garment, and that ordering is not open. */
describe("the all-over studio copy", () => {
  it("says ordering is not open yet and never that the flat is what prints", () => {
    render(
      <AopStage
        garment={defaultGarment("aop-hoodie")}
        label="SR"
        onChange={vi.fn()}
        onPreviewSet={vi.fn()}
      />,
    );
    expect(screen.getByText(AOP_ORDER_CLOSED)).toBeTruthy();
    expect(screen.getByText(PRINTFUL_AOP.hoodie.material.line)).toBeTruthy();
    expect(screen.queryByText(/The flat is the garment/)).toBeNull();
  });

  it("gives the joggers their own line, without a fabric", () => {
    render(
      <AopStage
        garment={defaultGarment("aop-joggers")}
        onChange={vi.fn()}
        onPreviewSet={vi.fn()}
      />,
    );
    expect(screen.getByText(PRINTFUL_AOP.joggers.material.line)).toBeTruthy();
    expect(screen.queryByText(/polyester|sublimation/i)).toBeNull();
  });

  it("names each piece's cloth on the set board", () => {
    const hoodie = defaultGarment("aop-hoodie");
    render(
      <SetBoard
        title="Night track set"
        colorways={hoodie.colorways}
        activeColorwayId={hoodie.activeColorwayId}
        pieces={[
          { name: "Hoodie", garment: hoodie },
          { name: "Joggers", garment: defaultGarment("aop-joggers") },
        ]}
      />,
    );
    expect(screen.getByText(`Hoodie: ${PRINTFUL_AOP.hoodie.material.line}`)).toBeTruthy();
    expect(screen.getByText(`Joggers: ${PRINTFUL_AOP.joggers.material.line}`)).toBeTruthy();
  });
});
