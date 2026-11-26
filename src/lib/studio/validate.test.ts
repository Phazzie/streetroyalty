import assert from "node:assert/strict";
import { describe, it } from "vitest";
import {
  printFileAuthorized,
  printFileToken,
  printSigningSecret,
  signedPrintFileUrl,
} from "../pod/print-access.ts";
import { applyMarkup } from "../pod/money.ts";
import {
  canBuyDesign,
  imageDimensions,
  isArtworkSrc,
  isPublicHttpUrl,
  parseLayers,
  parseRecipient,
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
      parseLayers([
        {
          id: "a",
          type: "image",
          src: "data:image/svg+xml;base64,PHN2Zy8+",
          x: 0.5,
          y: 0.5,
          scale: 1,
          rotation: 0,
        },
      ]),
    );
  });

  it("warns when a print file is below the area's DPI", () => {
    const size = imageDimensions("image/png", ONE_PX_PNG);
    assert.deepEqual(size, { width: 1, height: 1 });
    const warning = printQualityWarning(size ?? { width: 1, height: 1 }, {
      widthIn: 12,
      heightIn: 16,
      dpi: 150,
    });
    assert.match(warning ?? "", /1800×2400/);
    assert.equal(
      printQualityWarning({ width: 2000, height: 2600 }, { widthIn: 12, heightIn: 16, dpi: 150 }),
      null,
    );
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
    assert.equal(applyMarkup(1395, 2.2), 3100);
    assert.equal(applyMarkup(1560, 2.2), 3500);
    assert.equal(applyMarkup(1000, 2), 2000);
    assert.equal(Number.isInteger(applyMarkup(1, 2.2)), true);
  });
});

const ada = {
  name: "Ada Lovelace",
  address1: "1 Main",
  city: "Austin",
  stateCode: "TX",
  countryCode: "US",
  zip: "78701",
  email: "ada@shop.test",
};

describe("parseRecipient", () => {
  it("keeps a real address and refuses a country name or a spelled-out state", () => {
    assert.equal(parseRecipient(ada).countryCode, "US");
    assert.throws(
      () => parseRecipient({ ...ada, countryCode: "United States" }),
      /two-letter country/,
    );
    assert.throws(() => parseRecipient({ ...ada, countryCode: "USA" }), /two-letter country/);
    assert.throws(() => parseRecipient({ ...ada, stateCode: "Texas" }), /two-letter state/);
    assert.throws(() => parseRecipient({ ...ada, email: "ada" }), /email/);
    assert.throws(() => parseRecipient({ ...ada, email: "" }), /email/);
  });
});

describe("a URL the printer can reach", () => {
  it.each([
    "https://streetroyalty.com/api/print-files/abc?token=x",
    "https://shop.example.co.uk/file.png",
    "http://203.0.113.9/file.png",
    "https://[2606:4700:4700::1111]/file.png",
  ])("accepts %s", (url) => {
    assert.equal(isPublicHttpUrl(url), true);
  });

  it.each([
    ["loopback by name", "http://localhost:8080/api/print-files/abc"],
    ["loopback by name, any case", "http://LOCALHOST/x"],
    ["a name under localhost", "http://app.localhost/x"],
    ["loopback", "http://127.0.0.1/x"],
    ["the rest of the loopback block", "http://127.0.0.2/x"],
    ["IPv6 loopback", "http://[::1]/x"],
    ["the unspecified address", "http://0.0.0.0/x"],
    ["a 10.x private address", "http://10.0.0.5/x"],
    ["a 172.16 private address", "http://172.16.4.1/x"],
    ["the top of the 172 private block", "http://172.31.255.255/x"],
    ["a 192.168 private address", "https://192.168.1.20/x"],
    ["a link-local address", "http://169.254.169.254/latest/meta-data"],
    ["carrier-grade NAT space", "http://100.64.0.1/x"],
    ["an IPv6 private address", "http://[fd12:3456::1]/x"],
    ["an IPv6 link-local address", "http://[fe80::1]/x"],
    ["a private address written as IPv6", "http://[::ffff:10.0.0.5]/x"],
    ["loopback written as one number", "http://2130706433/x"],
    ["loopback written in hex", "http://0x7f.1/x"],
    ["an mDNS name", "http://printer.local/x"],
    ["an internal name", "http://build.internal/x"],
    ["a bare machine name", "http://devbox/x"],
    ["a file path", "file:///etc/passwd"],
    ["a data URL", "data:image/png;base64,AAAA"],
    ["not a URL", "print.png"],
    ["nothing", ""],
  ])("refuses %s", (_what, url) => {
    assert.equal(isPublicHttpUrl(url), false);
  });

  it("does not mistake public addresses next to the private blocks for private ones", () => {
    assert.equal(isPublicHttpUrl("http://172.32.0.1/x"), true);
    assert.equal(isPublicHttpUrl("http://11.0.0.1/x"), true);
    assert.equal(isPublicHttpUrl("http://192.169.0.1/x"), true);
    assert.equal(isPublicHttpUrl("https://10.example.com/x"), true);
  });
});
