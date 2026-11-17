import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { cn } from "@/lib/cn";
import { toggleFollow } from "@/lib/social/api";

/** Follow a maker. Shows the change at once and undoes it if the save fails. On your own page it becomes the way to edit it. */
export function FollowButton({
  handle,
  following,
  isMe = false,
  className,
  onChange,
}: {
  handle: string;
  following: boolean;
  isMe?: boolean;
  className?: string;
  onChange?: (next: { following: boolean; followers?: number }) => void;
}) {
  const navigate = useNavigate();
  const { user, isPending } = useCurrentUserState();
  const [on, setOn] = useState(following);
  const [problem, setProblem] = useState("");
  const busy = useRef(false);

  useEffect(() => {
    setOn(following);
  }, [following, handle]);

  const base =
    "inline-flex min-h-11 items-center justify-center border-2 border-ink px-4 font-display text-sm tracking-wide uppercase transition-transform duration-150 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-fg";

  if (!handle) return null;
  if (isMe) {
    return (
      <Link to="/me" className={cn(base, "bg-surface text-fg hover:bg-cream", className)}>
        Edit your page
      </Link>
    );
  }

  async function tap() {
    if (busy.current || isPending) return;
    if (!user) {
      void navigate({ to: "/login" });
      return;
    }
    const before = on;
    const want = !before;
    busy.current = true;
    setProblem("");
    setOn(want);
    onChange?.({ following: want });
    try {
      const saved = await toggleFollow({ data: { handle, want } });
      setOn(saved.following);
      onChange?.(saved);
    } catch (reason: unknown) {
      setOn(before);
      onChange?.({ following: before });
      if (reason instanceof Error && reason.message === "Unauthorized") {
        void navigate({ to: "/login" });
      } else {
        setProblem(
          reason instanceof Error && reason.message === "You cannot follow yourself."
            ? reason.message
            : "That did not save. Try again.",
        );
      }
    } finally {
      busy.current = false;
    }
  }

  return (
    <span className={cn("inline-flex flex-col items-start gap-1", className)}>
      <button
        type="button"
        aria-pressed={on}
        aria-label={on ? `Following @${handle}. Tap to unfollow` : `Follow @${handle}`}
        onClick={() => void tap()}
        className={cn(
          base,
          on ? "bg-surface text-fg hover:bg-cream" : "sticker-shadow bg-accent text-accent-fg",
        )}
      >
        {on ? "Following" : "Follow"}
      </button>
      <span role="status" className={problem ? "text-xs text-muted" : "sr-only"}>
        {problem}
      </span>
    </span>
  );
}
