import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { printFileAuthorized, printFileToken, printSigningSecret, signedPrintFileUrl } from "../pod/print-access.ts";
import { applyMarkup } from "../pod/money.ts";
import {
  canBuyDesign,
  imageDimensions,
  isArtworkSrc,
  parseLayers,
  printQualityWarning,
} from "./validate.ts";

const ONE_PX_PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

describe("ownership and artwork", () => {
  it("lets only the owner buy a private design", () => {
    assert.equal(canBuyDesign({ ownerId: "a", status: "draft" }, "b"), false);
    assert.equal(canBuyDesign({ ownerId: "a", status: "published" }, "b"), true);
    assert.equal(canBuyDesign({ ownerId: "a", status: "draft" }, "a"), true);
    assert.equal(canBuyDesign({ ownerId: "a", status: "draft" }, ""), false);
  });

  it("rejects svg artwork and accepts a png", () => {
    assert.equal(isArtworkSrc("data:image/svg+xml;base64,PHN2Zy8+"), false);
    assert.equal(isArtworkSrc(`data:image/png;base64,${ONE_PX_PNG}`), true);
    assert.throws(() =>
      parseLayers([{ id: "a", type: "image", src: "data:image/svg+xml;base64,PHN2Zy8+", x: 0.5, y: 0.5, scale: 1, rotation: 0 }]),
    );
  });

  it("warns when a print file is below the area's DPI", () => {
    const size = imageDimensions("image/png", ONE_PX_PNG);
    assert.deepEqual(size, { width: 1, height: 1 });
    const warning = printQualityWarning(size ?? { width: 1, height: 1 }, { widthIn: 12, heightIn: 16, dpi: 150 });
    assert.match(warning ?? "", /1800×2400/);
    assert.equal(printQualityWarning({ width: 2000, height: 2600 }, { widthIn: 12, heightIn: 16, dpi: 150 }), null);
  });
});

describe("print file capability", () => {
  it("rejects a missing or forged token and keeps the sandbox secret off live mode", () => {
    const token = printFileToken("file-1", "secret");
    assert.equal(printFileAuthorized("file-1", token, "secret"), true);
    assert.equal(printFileAuthorized("file-1", token, "other"), false);
    assert.equal(printFileAuthorized("file-1", null, "secret"), false);
    assert.equal(printFileAuthorized("file-2", token, "secret"), false);
    assert.match(signedPrintFileUrl("https://shop.example", "file-1", "secret"), /token=/);
    assert.equal(printSigningSecret({}, "sandbox"), "sandbox-print-file");
    assert.throws(() => printSigningSecret({}, "live"), /PRINT_FILE_SIGNING_SECRET/);
  });

  it("rounds retail to integer cents", () => {
    assert.equal(applyMarkup(1395, 2.2), 3069);
    assert.equal(Number.isInteger(applyMarkup(1, 2.2)), true);
  });
});
