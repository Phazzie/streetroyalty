import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { GoLivePanel, type PanelView } from "@/components/golive/panel";
import { StudioShell } from "@/components/studio/shell";
import { getBearerToken } from "@/lib/auth/client";
import { goLiveBoard } from "@/lib/golive/api";

/** Shown when the server cannot be read: the checklist alone, with nothing claimed. */
const UNREAD: PanelView = { view: "public", signedIn: false, podMode: null, paymentsMode: null };

export const Route = createFileRoute("/go-live")({
  loader: async (): Promise<PanelView> => {
    try {
      return await goLiveBoard();
    } catch {
      return UNREAD;
    }
  },
  head: () => ({
    meta: [{ title: "Go live · Street Royalty" }, { name: "robots", content: "noindex" }],
  }),
  component: GoLivePage,
});

function GoLivePage() {
  const loaded = Route.useLoaderData();
  const [view, setView] = useState<PanelView>(loaded);

  useEffect(() => setView(loaded), [loaded]);

  // Inside the preview frame the session rides a token the first page load cannot carry, so ask again with it.
  useEffect(() => {
    if (!getBearerToken()) return;
    void goLiveBoard()
      .then(setView)
      .catch(() => undefined);
  }, []);

  return (
    <StudioShell current="/go-live">
      <GoLivePanel view={view} />
    </StudioShell>
  );
}
