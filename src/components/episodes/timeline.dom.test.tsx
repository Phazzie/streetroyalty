import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OnAirLamp } from "./channel.tsx";
import { Timeline } from "./timeline.tsx";
import { TEMPLATE_EPISODE } from "../../lib/episodes/data.ts";

describe("the timeline", () => {
  it("jumps to the start of a scene when its button is tapped", () => {
    const onSeek = vi.fn();
    render(<Timeline episode={TEMPLATE_EPISODE} time={0} onSeek={onSeek} />);
    fireEvent.click(screen.getByRole("button", { name: /Scene 4/ }));
    expect(onSeek).toHaveBeenCalledWith(185);
  });

  it("marks the scene under the playhead and reads the time out for a screen reader", () => {
    render(<Timeline episode={TEMPLATE_EPISODE} time={120} onSeek={() => undefined} />);
    expect(screen.getByRole("button", { name: /Scene 3/ }).getAttribute("aria-current")).toBe(
      "step",
    );
    expect(screen.getByRole("button", { name: /Scene 1/ }).getAttribute("aria-current")).toBeNull();
    const slider = screen.getByRole("slider", { name: "Move through the episode" });
    expect(slider.getAttribute("aria-valuetext")).toBe("02:00 of 05:00, Scene 3");
    expect(slider.getAttribute("max")).toBe("300");
  });

  it("seeks when the slider moves", () => {
    const onSeek = vi.fn();
    render(<Timeline episode={TEMPLATE_EPISODE} time={0} onSeek={onSeek} />);
    fireEvent.change(screen.getByRole("slider"), { target: { value: "200" } });
    expect(onSeek).toHaveBeenCalledWith(200);
  });

  it("draws a wardrobe lane for each cast member it is given", () => {
    const { container } = render(
      <Timeline
        episode={TEMPLATE_EPISODE}
        time={0}
        onSeek={() => undefined}
        lanes={[
          {
            cast: "Character A",
            segments: [{ id: "s1", startSec: 0, endSec: 45, colors: ["#b9a3ee", "#b9a3ee"] }],
          },
        ]}
      />,
    );
    expect(container.textContent).toContain("Character A");
    expect(container.textContent).toContain("One band per piece.");
  });
});

describe("the lamp", () => {
  it("says off air until it is told otherwise", () => {
    render(<OnAirLamp on={false} />);
    const lamp = screen.getByRole("status");
    expect(lamp.textContent).toBe("Off air");
    expect(lamp.getAttribute("data-on")).toBe("false");
  });

  it("says on air when lit", () => {
    render(<OnAirLamp on />);
    expect(screen.getByRole("status").textContent).toBe("On air");
  });
});
