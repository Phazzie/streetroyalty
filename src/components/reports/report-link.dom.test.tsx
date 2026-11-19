import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ReportLink } from "../rack/report-link.tsx";
import { REPORT_MESSAGES } from "./reasons.ts";

/**
 * The report form in a fake page. The server call, the router and the session are
 * stand-ins, so this checks what the form sends and what it says back. The real
 * round trip is covered by src/lib/social/reports.int.test.ts.
 */

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  fileReport: vi.fn(),
  session: { user: null as { id: string } | null, isPending: false },
}));

vi.mock("@tanstack/react-router", () => ({ useNavigate: () => mocks.navigate }));
vi.mock("@/lib/auth/use-current-user", () => ({ useCurrentUserState: () => mocks.session }));
vi.mock("@/lib/social/reports-api", () => ({
  fileReport: (input: unknown) => mocks.fileReport(input),
}));

beforeEach(() => {
  mocks.navigate.mockReset();
  mocks.fileReport.mockReset();
  mocks.session.user = { id: "bo" };
  mocks.session.isPending = false;
});

describe("the report link", () => {
  it("sends a signed-out person to sign in and opens nothing", async () => {
    mocks.session.user = null;
    const user = userEvent.setup();
    render(<ReportLink kind="piece" slug="loud-hoodie" />);
    await user.click(screen.getByRole("button", { name: "Report" }));
    expect(mocks.navigate).toHaveBeenCalledWith({ to: "/login" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(mocks.fileReport).not.toHaveBeenCalled();
  });

  it("offers the five reasons and will not send without one", async () => {
    const user = userEvent.setup();
    render(<ReportLink kind="piece" slug="loud-hoodie" />);
    await user.click(screen.getByRole("button", { name: "Report" }));
    expect(screen.getByRole("dialog", { name: "Report this piece" })).toBeTruthy();
    expect(screen.getAllByRole("radio").map((radio) => radio.getAttribute("value"))).toEqual([
      "stolen",
      "hate",
      "nudity",
      "scam",
      "other",
    ]);
    await user.click(screen.getByRole("button", { name: "Send report" }));
    expect(screen.getByRole("alert").textContent).toBe(REPORT_MESSAGES.pickReason);
    expect(mocks.fileReport).not.toHaveBeenCalled();
  });

  it("sends the slug, the reason and the note, and nothing that names an id", async () => {
    mocks.fileReport.mockResolvedValue({ status: "filed" });
    const user = userEvent.setup();
    render(<ReportLink kind="piece" slug="loud-hoodie" />);
    await user.click(screen.getByRole("button", { name: "Report" }));
    await user.click(screen.getByLabelText("Stolen art or someone else's logo"));
    await user.type(screen.getByLabelText(/Anything to add/), "That is my logo.");
    await user.click(screen.getByRole("button", { name: "Send report" }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toMatch(/^Sent\./));
    expect(mocks.fileReport).toHaveBeenCalledTimes(1);
    expect(mocks.fileReport).toHaveBeenCalledWith({
      data: { kind: "piece", slug: "loud-hoodie", reason: "stolen", note: "That is my logo." },
    });
    await user.click(screen.getByRole("button", { name: "Done" }));
    expect(screen.getByRole("button", { name: "Reported" })).toBeTruthy();
  });

  it("reports a maker by handle and says so when it was already reported", async () => {
    mocks.fileReport.mockResolvedValue({ status: "already" });
    const user = userEvent.setup();
    render(<ReportLink kind="maker" handle="ada" />);
    await user.click(screen.getByRole("button", { name: "Report" }));
    expect(screen.getByRole("dialog", { name: "Report this maker" })).toBeTruthy();
    await user.click(screen.getByLabelText("Hate or threats"));
    await user.click(screen.getByRole("button", { name: "Send report" }));
    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toBe(REPORT_MESSAGES.already),
    );
    expect(mocks.fileReport).toHaveBeenCalledWith({
      data: { kind: "maker", handle: "ada", reason: "hate", note: "" },
    });
  });

  it("shows the server's refusal and keeps the form open", async () => {
    mocks.fileReport.mockRejectedValue(new Error(REPORT_MESSAGES.ownPiece));
    const user = userEvent.setup();
    render(<ReportLink kind="piece" slug="my-own-tee" />);
    await user.click(screen.getByRole("button", { name: "Report" }));
    await user.click(screen.getByLabelText("Something else"));
    await user.click(screen.getByRole("button", { name: "Send report" }));
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toBe(REPORT_MESSAGES.ownPiece),
    );
    expect(screen.getByRole("button", { name: "Send report" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Report", hidden: true })).toBeTruthy();
  });

  it("goes to sign in when the session ran out before sending", async () => {
    mocks.fileReport.mockRejectedValue(new Error("Unauthorized"));
    const user = userEvent.setup();
    render(<ReportLink kind="piece" slug="loud-hoodie" />);
    await user.click(screen.getByRole("button", { name: "Report" }));
    await user.click(screen.getByLabelText("Nudity"));
    await user.click(screen.getByRole("button", { name: "Send report" }));
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith({ to: "/login" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});
