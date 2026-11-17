import { describe, expect, it } from "vitest";
import { demoCatalog } from "../storefront/demo.ts";
import { EPISODES, findEpisode, onAir, TEMPLATE_EPISODE } from "./data.ts";
import {
  clampTime,
  episodePieces,
  firstSeen,
  formatRunningTime,
  formatTimecode,
  sceneAt,
  validateEpisode,
  wardrobeAt,
} from "./helpers.ts";
import type { Episode } from "./types.ts";

const EP: Episode = {
  slug: "t",
  number: 1,
  title: "T",
  logline: "",
  status: "planned",
  durationSec: 100,
  cast: [
    { name: "A", role: "" },
    { name: "B", role: "" },
  ],
  scenes: [
    {
      id: "one",
      title: "One",
      startSec: 0,
      endSec: 40,
      beat: "",
      wardrobe: [{ cast: "A", pieces: [{ kind: "shop", slug: "x" }] }],
    },
    {
      id: "two",
      title: "Two",
      startSec: 60,
      endSec: 100,
      beat: "",
      wardrobe: [
        { cast: "A", pieces: [{ kind: "shop", slug: "x" }] },
        { cast: "B", pieces: [{ kind: "rack", slug: "y" }] },
      ],
    },
  ],
};

describe("sceneAt", () => {
  it("gives the cut to the scene that starts there", () => {
    expect(sceneAt(EP, 0)?.id).toBe("one");
    expect(sceneAt(EP, 39.9)?.id).toBe("one");
    expect(sceneAt(EP, 60)?.id).toBe("two");
  });

  it("returns nothing in a gap between scenes", () => {
    expect(sceneAt(EP, 40)).toBeNull();
    expect(sceneAt(EP, 50)).toBeNull();
  });

  it("gives the very last frame to the last scene", () => {
    expect(sceneAt(EP, 100)?.id).toBe("two");
  });

  it("returns nothing outside the episode or for a bad time", () => {
    expect(sceneAt(EP, -1)).toBeNull();
    expect(sceneAt(EP, 100.1)).toBeNull();
    expect(sceneAt(EP, Number.NaN)).toBeNull();
  });
});

describe("wardrobeAt", () => {
  it("follows the playhead", () => {
    expect(wardrobeAt(EP, 10).map((look) => look.cast)).toEqual(["A"]);
    expect(wardrobeAt(EP, 70).map((look) => look.cast)).toEqual(["A", "B"]);
  });

  it("is empty between scenes", () => {
    expect(wardrobeAt(EP, 45)).toEqual([]);
  });
});

describe("episodePieces and firstSeen", () => {
  it("lists each piece once, in order of first appearance", () => {
    expect(episodePieces(EP)).toEqual([
      { kind: "shop", slug: "x" },
      { kind: "rack", slug: "y" },
    ]);
  });

  it("finds when a piece first shows up", () => {
    expect(firstSeen(EP, { kind: "rack", slug: "y" })).toBe(60);
    expect(firstSeen(EP, { kind: "rack", slug: "nope" })).toBeNull();
  });
});

describe("clampTime", () => {
  it("keeps the playhead inside the episode", () => {
    expect(clampTime(EP, -5)).toBe(0);
    expect(clampTime(EP, 500)).toBe(100);
    expect(clampTime(EP, 12.5)).toBe(12.5);
    expect(clampTime(EP, Number.NaN)).toBe(0);
  });
});

describe("validateEpisode", () => {
  it("passes a sound episode", () => {
    expect(validateEpisode(EP)).toEqual([]);
  });

  it("catches overlapping scenes", () => {
    const bad: Episode = {
      ...EP,
      scenes: [EP.scenes[0]!, { ...EP.scenes[1]!, startSec: 30 }],
    };
    expect(validateEpisode(bad)).toContain("One and Two overlap.");
  });

  it("catches overlap even when the scenes are listed out of order", () => {
    const bad: Episode = {
      ...EP,
      scenes: [{ ...EP.scenes[1]!, startSec: 30 }, EP.scenes[0]!],
    };
    expect(validateEpisode(bad)).toContain("One and Two overlap.");
  });

  it("lets scenes touch without calling it an overlap", () => {
    const fine: Episode = {
      ...EP,
      scenes: [EP.scenes[0]!, { ...EP.scenes[1]!, startSec: 40 }],
    };
    expect(validateEpisode(fine)).toEqual([]);
  });

  it("catches a scene that runs past the end or starts before zero", () => {
    const late: Episode = { ...EP, scenes: [{ ...EP.scenes[1]!, endSec: 101 }] };
    const early: Episode = { ...EP, scenes: [{ ...EP.scenes[0]!, startSec: -1 }] };
    expect(validateEpisode(late)).toContain("Two runs outside the episode.");
    expect(validateEpisode(early)).toContain("One runs outside the episode.");
  });

  it("catches a scene that ends before it starts", () => {
    const bad: Episode = { ...EP, scenes: [{ ...EP.scenes[0]!, startSec: 40, endSec: 40 }] };
    expect(validateEpisode(bad)).toContain("One ends before it starts.");
  });

  it("catches wardrobe for someone who is not in the cast", () => {
    const bad: Episode = {
      ...EP,
      scenes: [{ ...EP.scenes[0]!, wardrobe: [{ cast: "Zed", pieces: [] }] }],
    };
    expect(validateEpisode(bad)).toContain("One dresses Zed, who is not in the cast.");
  });

  it("catches one person dressed twice in a scene, and a repeated cast name", () => {
    const twice: Episode = {
      ...EP,
      scenes: [
        {
          ...EP.scenes[0]!,
          wardrobe: [
            { cast: "A", pieces: [] },
            { cast: "A", pieces: [] },
          ],
        },
      ],
    };
    expect(validateEpisode(twice)).toContain("One dresses A twice.");
    expect(validateEpisode({ ...EP, cast: [...EP.cast, { name: "A", role: "" }] })).toContain(
      "A is in the cast twice.",
    );
  });

  it("refuses an episode marked out with no video, and a zero running time", () => {
    expect(validateEpisode({ ...EP, status: "out" })).toContain(
      "An episode marked out needs a video.",
    );
    expect(validateEpisode({ ...EP, durationSec: 0, scenes: [] })).toContain(
      "The episode needs a running time above zero.",
    );
  });
});

describe("formatTimecode", () => {
  it("writes minutes and seconds", () => {
    expect(formatTimecode(0)).toBe("00:00");
    expect(formatTimecode(45)).toBe("00:45");
    expect(formatTimecode(300)).toBe("05:00");
    expect(formatTimecode(59.99)).toBe("00:59");
  });

  it("adds hours past the hour", () => {
    expect(formatTimecode(3723)).toBe("01:02:03");
  });

  it("adds frames when given a frame rate", () => {
    expect(formatTimecode(45.5, { fps: 24 })).toBe("00:00:45:12");
    expect(formatTimecode(0, { fps: 24 })).toBe("00:00:00:00");
    expect(formatTimecode(1.999, { fps: 24 })).toBe("00:00:01:23");
  });

  it("treats bad input as zero", () => {
    expect(formatTimecode(-3)).toBe("00:00");
    expect(formatTimecode(Number.NaN)).toBe("00:00");
  });
});

describe("formatRunningTime", () => {
  it("reads like a person would say it", () => {
    expect(formatRunningTime(300)).toBe("5 min");
    expect(formatRunningTime(270)).toBe("4 min 30 sec");
    expect(formatRunningTime(40)).toBe("40 sec");
  });
});

describe("the shipped episode list", () => {
  it("is exactly one template, planned, with no video and nothing claimed", () => {
    expect(EPISODES).toHaveLength(1);
    expect(EPISODES[0]).toBe(TEMPLATE_EPISODE);
    expect(TEMPLATE_EPISODE.status).toBe("planned");
    expect(TEMPLATE_EPISODE.template).toBe(true);
    expect(TEMPLATE_EPISODE.videoUrl).toBeUndefined();
    expect(TEMPLATE_EPISODE.title).toMatch(/not shot yet/i);
  });

  it("is sound", () => {
    for (const episode of EPISODES) expect(validateEpisode(episode)).toEqual([]);
  });

  it("writes every beat as an instruction, not a story", () => {
    for (const scene of TEMPLATE_EPISODE.scenes)
      expect(scene.beat).toMatch(/^Write the beat here:/);
  });

  it("covers the whole running time with no gaps", () => {
    let cursor = 0;
    for (const scene of TEMPLATE_EPISODE.scenes) {
      expect(scene.startSec).toBe(cursor);
      cursor = scene.endSec;
    }
    expect(cursor).toBe(TEMPLATE_EPISODE.durationSec);
  });

  it("only wears pieces that are in the preview drop", () => {
    const slugs = new Set(demoCatalog.products.map((product) => product.slug));
    for (const ref of episodePieces(TEMPLATE_EPISODE)) {
      expect(ref.kind).toBe("shop");
      expect(slugs.has(ref.slug)).toBe(true);
    }
  });

  it("keeps the lamp off until an episode is out with a video", () => {
    expect(onAir()).toBe(false);
    expect(onAir([{ ...TEMPLATE_EPISODE, status: "out" }])).toBe(false);
    expect(onAir([{ ...TEMPLATE_EPISODE, status: "out", videoUrl: "/v.mp4" }])).toBe(true);
  });

  it("finds an episode by slug and nothing else", () => {
    expect(findEpisode("episode-0")).toBe(TEMPLATE_EPISODE);
    expect(findEpisode("episode-9")).toBeNull();
  });
});
