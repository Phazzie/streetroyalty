import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ProfileForm } from "@/components/makers/profile-form";
import { Button } from "@/components/ui/button";
import { Note, StudioShell } from "@/components/studio/shell";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { getMyProfile } from "@/lib/social/api";
import type { MakerProfile } from "@/lib/social/types";

export const Route = createFileRoute("/me")({ component: MePage });

function MePage() {
  const { user, isPending } = useCurrentUserState();
  const [profile, setProfile] = useState<MakerProfile | null>(null);
  const [error, setError] = useState("");
  const viewerId = user?.id ?? "";

  useEffect(() => {
    if (!viewerId) {
      setProfile(null);
      return;
    }
    let live = true;
    setError("");
    void getMyProfile()
      .then((next) => {
        if (live) setProfile(next);
      })
      .catch((reason: unknown) => {
        if (live) setError(reason instanceof Error ? reason.message : "Your page did not load.");
      });
    return () => {
      live = false;
    };
  }, [viewerId]);

  return (
    <StudioShell current="/rack">
      <p className="tag">Maker</p>
      <h1 className="mt-3 font-display text-4xl leading-none">Your name on the rack</h1>
      {!isPending && !user ? (
        <div className="empty-state mt-6">
          <p>Sign in to pick your name and handle. Every piece you publish carries them.</p>
          <Button asChild className="mt-4">
            <Link to="/login">Sign in</Link>
          </Button>
        </div>
      ) : null}
      {error && error !== "Unauthorized" ? (
        <div className="mt-6">
          <Note>{error}</Note>
        </div>
      ) : null}
      {error === "Unauthorized" ? (
        <div className="empty-state mt-6">
          <p>Your sign-in ran out. Sign in again to edit your page.</p>
          <Button asChild className="mt-4">
            <Link to="/login">Sign in</Link>
          </Button>
        </div>
      ) : null}
      {user && profile ? (
        <div className="mt-6 max-w-xl">
          <p className="mb-5 text-muted">
            This is how other people see you: {profile.pieces}{" "}
            {profile.pieces === 1 ? "piece" : "pieces"} on the rack, {profile.followers}{" "}
            {profile.followers === 1 ? "follower" : "followers"}, {profile.crowns}{" "}
            {profile.crowns === 1 ? "crown" : "crowns"}.
          </p>
          {profile.name === "Maker" && /^maker\d*$/.test(profile.handle) ? (
            <div className="mb-5">
              <Note>
                You are on the rack as Maker for now. Pick a name and a handle of your own below.
              </Note>
            </div>
          ) : null}
          <ProfileForm profile={profile} onSaved={setProfile} />
        </div>
      ) : null}
    </StudioShell>
  );
}
