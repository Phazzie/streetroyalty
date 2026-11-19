import type { ReactNode } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SERVICES } from "@/lib/golive/services.ts";
import { switchboard } from "@/lib/golive/switchboard.ts";
import { GoLivePanel } from "./panel.tsx";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children, className }: { to: string; children: ReactNode; className?: string }) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
}));

const NEEDED = SERVICES.flatMap((service) =>
  service.variables.filter((variable) => variable.need === "needed").map((item) => item.name),
);

function faces(container: HTMLElement): string[] {
  return [...container.querySelectorAll<HTMLElement>(".gl-row")].map(
    (row) => `${row.id}:${row.dataset.face}`,
  );
}

describe("the go-live panel", () => {
  it("keeps every switch under a cover for a visitor and still shows the whole checklist", () => {
    const { container } = render(
      <GoLivePanel
        view={{ view: "public", signedIn: false, podMode: "sandbox", paymentsMode: "sandbox" }}
      />,
    );
    expect(new Set(faces(container).map((face) => face.split(":")[1]))).toEqual(
      new Set(["covered"]),
    );
    expect(screen.queryByText("Missing")).toBeNull();
    expect(screen.queryByText("In")).toBeNull();
    for (const name of NEEDED) expect(screen.getAllByText(name).length).toBeGreaterThan(0);
    expect(screen.getByText(/printing is in sandbox and payments are in sandbox/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Sign in" }).getAttribute("href")).toBe("/login");
    // The first step is open and names the setting to add.
    const first = container.querySelector("#sw-admins details");
    expect(first?.hasAttribute("open")).toBe(true);
    expect(container.querySelector("#sw-database details")?.hasAttribute("open")).toBe(false);
  });

  it("tells a signed-in member the cover stays on, without offering sign-in again", () => {
    render(
      <GoLivePanel
        view={{ view: "public", signedIn: true, podMode: "live", paymentsMode: "sandbox" }}
      />,
    );
    expect(screen.getByText(/this email does not lift the cover/)).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Sign in" })).toBeNull();
    expect(screen.getByText(/printing is live and payments are in sandbox/)).toBeTruthy();
  });

  it("claims nothing about the modes when the server could not be read", () => {
    render(
      <GoLivePanel view={{ view: "public", signedIn: false, podMode: null, paymentsMode: null }} />,
    );
    expect(screen.queryByText(/What every visitor can already see/)).toBeNull();
  });

  it("shows an admin each lamp, the missing names and the next switch", () => {
    const board = switchboard({
      STUDIO_ADMIN_EMAILS: "ada@example.com",
      BETTER_AUTH_URL: "https://shop.example",
      STRIPE_SECRET_KEY: "Hh7Qz51Nq0aXwVb",
    });
    const { container } = render(<GoLivePanel view={{ view: "admin", board }} />);
    expect(faces(container)).toEqual([
      "sw-admins:on",
      "sw-database:off",
      "sw-signin:partly",
      "sw-payments:partly",
      "sw-printing:off",
      "sw-pictures:off",
      "sw-drop:off",
      "sw-test:off",
    ]);
    expect(screen.getByText("Nobody can pay yet.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Next: the database" }).getAttribute("href")).toBe(
      "#sw-database",
    );
    expect(container.querySelector("#sw-database details")?.hasAttribute("open")).toBe(true);
    // A setting that is in gets no copy button. One that is missing does.
    expect(screen.queryByRole("button", { name: "Copy name STRIPE_SECRET_KEY" })).toBeNull();
    expect(screen.getByRole("button", { name: "Copy name STRIPE_WEBHOOK_SECRET" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Printing" }).getAttribute("href")).toBe(
      "#sw-printing",
    );
    expect(container.textContent).not.toContain("Hh7Qz51Nq0aXwVb");
    expect(container.textContent).not.toContain("ada@example.com");
    expect(screen.getByRole("table").textContent).toContain("30 a day");
  });

  it("says people can pay once payments and printing are both live", () => {
    const env = {
      DATABASE_URL: "postgresql://x",
      STRIPE_SECRET_KEY: "a",
      STRIPE_WEBHOOK_SECRET: "b",
      PRINTFUL_API_KEY: "c",
      PRINT_FILE_SIGNING_SECRET: "d",
      APP_PUBLIC_URL: "https://shop.example",
      PRINTFUL_WEBHOOK_SECRET: "e",
    };
    const { container, unmount } = render(
      <GoLivePanel view={{ view: "admin", board: switchboard(env) }} />,
    );
    expect(screen.getByText("People can pay.", { selector: ".display" })).toBeTruthy();
    expect(faces(container)).toContain("sw-test:on");
    expect(screen.getByText("Ready to try")).toBeTruthy();
    unmount();

    // Real cards with nowhere to keep the order is not ready, and the board says why.
    const forgetful = render(
      <GoLivePanel
        view={{ view: "admin", board: switchboard({ ...env, DATABASE_URL: undefined }) }}
      />,
    );
    expect(screen.getByText("People can pay. Orders are not kept.")).toBeTruthy();
    expect(faces(forgetful.container)).toContain("sw-test:off");
    expect(screen.getByText(/a real, paid order is forgotten/)).toBeTruthy();
  });

  it("copies a setting's name, never anything else, and says so", async () => {
    const writeText = vi.fn(() => Promise.resolve());
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    render(
      <GoLivePanel
        view={{ view: "public", signedIn: false, podMode: "sandbox", paymentsMode: "sandbox" }}
      />,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copy name DATABASE_URL" }));
      await Promise.resolve();
    });
    expect(writeText).toHaveBeenCalledWith("DATABASE_URL");
    expect(screen.getByRole("status").textContent).toMatch(/Copied DATABASE_URL/);
    vi.unstubAllGlobals();
  });
});
