import { useId, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useNavigate } from "@tanstack/react-router";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  NOTE_LIMIT,
  REPORT_MESSAGES,
  REPORT_REASONS,
  noteLength,
  type ReportReason,
  type ReportTarget,
} from "@/components/reports/reasons";
import { ReportStyles, Stamp } from "@/components/reports/stamp";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { fileReport } from "@/lib/social/reports-api";
import { createSingleFlight } from "@/lib/ui/single-flight";

type Done = "filed" | "already";

/**
 * A quiet "Report" under a piece or a maker. It opens a short form: one reason,
 * an optional note. The server finds the target from the slug or handle, so this
 * never sends an id.
 */
export function ReportLink(props: ReportTarget) {
  const { user, isPending } = useCurrentUserState();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason | "">("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<Done | null>(null);
  const flight = useRef(createSingleFlight());
  const firstReason = useRef<HTMLInputElement>(null);
  const name = useId();
  const noteId = useId();
  const errorId = useId();

  const what = props.kind === "piece" ? "piece" : "maker";
  const length = noteLength(note);

  function send() {
    if (!reason) {
      setError(REPORT_MESSAGES.pickReason);
      firstReason.current?.focus();
      return;
    }
    void flight.current(async () => {
      setBusy(true);
      setError("");
      try {
        const target =
          props.kind === "piece"
            ? { kind: "piece", slug: props.slug }
            : { kind: "maker", handle: props.handle };
        const result = await fileReport({ data: { ...target, reason, note } });
        setDone(result.status);
      } catch (cause: unknown) {
        const message = cause instanceof Error ? cause.message : "";
        if (message === "Unauthorized") {
          setOpen(false);
          void navigate({ to: "/login" });
          return;
        }
        setError(message || "That did not send. Try again.");
      } finally {
        setBusy(false);
      }
    });
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        // Signed out: the form is no use yet, so go and sign in.
        if (next && !user && !isPending) {
          void navigate({ to: "/login" });
          return;
        }
        setOpen(next);
        if (!next) setError("");
      }}
    >
      <Dialog.Trigger asChild>
        <button
          type="button"
          className="inline-flex min-h-11 items-center px-1 font-sans text-sm text-muted underline decoration-line decoration-2 underline-offset-4 hover:text-fg hover:decoration-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg"
        >
          {done ? "Reported" : "Report"}
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="sr-rep-scrim fixed inset-0 z-50 grid items-end justify-items-center overflow-y-auto bg-black/75 sm:items-center sm:p-4">
          <Dialog.Content
            className="night sr-rep-sheet relative w-full max-w-md border-2 border-ink bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-fg focus:outline-none sm:pb-5"
            aria-describedby={undefined}
            onOpenAutoFocus={(event) => {
              // Start on the first reason, not on the close button.
              if (done || !firstReason.current) return;
              event.preventDefault();
              firstReason.current.focus();
            }}
          >
            <ReportStyles />
            <div className="flex items-start justify-between gap-3">
              <Dialog.Title className="font-display text-2xl leading-none uppercase">
                {done ? "On file" : `Report this ${what}`}
              </Dialog.Title>
              <Dialog.Close asChild>
                <button
                  type="button"
                  aria-label="Close"
                  className="-mt-2 -mr-2 grid h-11 w-11 shrink-0 place-items-center rounded-full text-fg hover:bg-fg/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg"
                >
                  <X className="h-5 w-5" aria-hidden />
                </button>
              </Dialog.Close>
            </div>

            {done ? (
              <div className="mt-4">
                <div className="relative grid min-h-36 place-items-center overflow-hidden border-2 border-dashed border-line bg-bg">
                  <Stamp tone={done === "filed" ? "pink" : "ink"}>
                    {done === "filed" ? "Sent" : "Already in"}
                  </Stamp>
                </div>
                <p role="status" className="mt-4 text-fg">
                  {done === "filed"
                    ? "Sent. A person at the shop reads every report."
                    : REPORT_MESSAGES.already}
                </p>
                <p className="mt-1 text-sm text-muted">
                  Nothing comes down on its own. One report or fifty, a person decides.
                </p>
                <Dialog.Close asChild>
                  <Button variant="ghost" className="mt-5 w-full">
                    Done
                  </Button>
                </Dialog.Close>
              </div>
            ) : (
              <form
                className="mt-2"
                noValidate
                onSubmit={(event) => {
                  event.preventDefault();
                  send();
                }}
              >
                <p className="text-sm text-muted">
                  Tell the shop what is wrong. A person reads it. Nothing comes down on its own.
                </p>
                <fieldset
                  className="mt-4 flex flex-col gap-2"
                  aria-describedby={error ? errorId : undefined}
                >
                  <legend className="mb-2 font-display text-xs tracking-widest uppercase">
                    What is wrong with it
                  </legend>
                  {REPORT_REASONS.map((item, index) => (
                    <label
                      key={item.id}
                      className="sr-rep-reason flex min-h-12 cursor-pointer items-center gap-3 border-2 border-line bg-bg px-3 py-2"
                    >
                      <input
                        ref={index === 0 ? firstReason : undefined}
                        type="radio"
                        name={name}
                        value={item.id}
                        checked={reason === item.id}
                        onChange={() => {
                          setReason(item.id);
                          setError("");
                        }}
                        className="sr-rep-radio"
                      />
                      <span className="font-sans text-base">{item.label}</span>
                    </label>
                  ))}
                </fieldset>

                <label
                  htmlFor={noteId}
                  className="mt-4 block font-display text-xs tracking-widest uppercase"
                >
                  Anything to add{" "}
                  <span className="font-sans tracking-normal text-muted normal-case">
                    (you can skip this)
                  </span>
                </label>
                <textarea
                  id={noteId}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  rows={3}
                  maxLength={NOTE_LIMIT}
                  placeholder="Where you saw the original, or what it says."
                  className="mt-2 block w-full resize-none rounded-md border-2 border-ink bg-cream p-3 font-sans text-base text-fg placeholder:text-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                />
                <p className="mt-1 text-right text-xs text-subtle tabular-nums" aria-hidden>
                  {length} / {NOTE_LIMIT}
                </p>

                {error ? (
                  <p
                    id={errorId}
                    role="alert"
                    className="mt-2 border-2 border-pipe bg-bg px-3 py-2 text-sm text-fg"
                  >
                    {error}
                  </p>
                ) : null}

                <Button type="submit" className="mt-4 w-full" disabled={busy}>
                  {busy ? "Sending" : "Send report"}
                </Button>
              </form>
            )}
          </Dialog.Content>
        </Dialog.Overlay>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
