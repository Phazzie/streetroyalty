import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { MakerCrown } from "@/components/makers/maker-crown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateProfile } from "@/lib/social/api";
import {
  BIO_MAX,
  HANDLE_MAX,
  NAME_MAX,
  checkBio,
  checkDisplayName,
  checkHandle,
  normalizeHandle,
} from "@/lib/social/handles";
import type { MakerProfile } from "@/lib/social/types";

/** Edit your name, handle and bio. The crown redraws as you type the handle, because it is cut from it. */
export function ProfileForm({
  profile,
  onSaved,
}: {
  profile: MakerProfile;
  onSaved: (next: MakerProfile) => void;
}) {
  const [name, setName] = useState(profile.name);
  const [handle, setHandle] = useState(profile.handle);
  const [bio, setBio] = useState(profile.bio);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const typed = normalizeHandle(handle);
  const nameCheck = checkDisplayName(name);
  // Your current handle stays valid even if the rules tightened after you took it.
  const handleCheck =
    typed === profile.handle ? ({ ok: true, value: typed } as const) : checkHandle(handle);
  const bioCheck = checkBio(bio);
  const dirty = name !== profile.name || typed !== profile.handle || bio !== profile.bio;
  const ready = nameCheck.ok && handleCheck.ok && bioCheck.ok && dirty && !saving;

  function edited() {
    setSaved(false);
    setError("");
  }

  return (
    <form
      className="grid gap-5"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        if (!ready) return;
        setSaving(true);
        setError("");
        void updateProfile({ data: { name, handle: typed, bio } })
          .then((next) => {
            setName(next.name);
            setHandle(next.handle);
            setBio(next.bio);
            setSaved(true);
            onSaved(next);
          })
          .catch((reason: unknown) =>
            setError(reason instanceof Error ? reason.message : "That did not save. Try again."),
          )
          .finally(() => setSaving(false));
      }}
    >
      <div className="paper flex items-center gap-4 border-2 border-ink p-4">
        <MakerCrown handle={handleCheck.ok ? typed : profile.handle} size={72} />
        <div className="min-w-0">
          <p className="display text-3xl break-words">{nameCheck.ok ? nameCheck.value : name}</p>
          <p className="font-display text-sm break-all">@{typed || profile.handle}</p>
          <p className="mt-1 text-sm text-muted">
            Your crown is cut from your handle. Change the handle and the crown changes.
          </p>
        </div>
      </div>

      <label className="grid gap-1.5">
        <span className="font-display text-sm uppercase">Name</span>
        <Input
          value={name}
          maxLength={NAME_MAX}
          autoComplete="nickname"
          aria-invalid={!nameCheck.ok}
          aria-describedby="me-name-help"
          onChange={(event) => {
            setName(event.target.value);
            edited();
          }}
        />
        <span id="me-name-help" className="text-sm text-muted">
          {nameCheck.ok ? "Shown on every piece you publish." : nameCheck.error}
        </span>
      </label>

      <label className="grid gap-1.5">
        <span className="font-display text-sm uppercase">Handle</span>
        <span className="flex items-stretch">
          <span
            aria-hidden="true"
            className="grid w-11 place-items-center rounded-l-md border-2 border-r-0 border-ink bg-surface font-display"
          >
            @
          </span>
          <Input
            value={handle}
            maxLength={HANDLE_MAX + 1}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            aria-invalid={!handleCheck.ok}
            aria-describedby="me-handle-help"
            className="rounded-l-none"
            onChange={(event) => {
              setHandle(event.target.value);
              edited();
            }}
          />
        </span>
        <span id="me-handle-help" className="text-sm break-words text-muted">
          {handleCheck.ok
            ? `Your page lives at /m/${typed}. Old links stop working if you change it.`
            : handleCheck.error}
        </span>
      </label>

      <label className="grid gap-1.5">
        <span className="flex items-baseline justify-between gap-3">
          <span className="font-display text-sm uppercase">Bio</span>
          <span className="text-sm text-muted tabular-nums">
            {bio.length} of {BIO_MAX}
          </span>
        </span>
        <textarea
          value={bio}
          rows={3}
          maxLength={BIO_MAX}
          aria-invalid={!bioCheck.ok}
          aria-describedby="me-bio-help"
          className="w-full rounded-md border-2 border-ink bg-cream px-3 py-2 text-base text-fg outline-none placeholder:text-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-ink"
          placeholder="What you make, in a line or two."
          onChange={(event) => {
            setBio(event.target.value);
            edited();
          }}
        />
        <span id="me-bio-help" className="text-sm text-muted">
          {bioCheck.ok ? "Plain words only. Links and code show up as typed." : bioCheck.error}
        </span>
      </label>

      <div role="status" className="min-h-6 text-sm">
        {error ? <span className="border-2 border-pipe bg-surface px-3 py-2">{error}</span> : null}
        {saved && !error ? "Saved." : null}
      </div>

      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={!ready}>
          {saving ? "Saving" : "Save"}
        </Button>
        <Button asChild variant="ghost">
          <Link to="/m/$handle" params={{ handle: profile.handle }}>
            See your page
          </Link>
        </Button>
      </div>
    </form>
  );
}
