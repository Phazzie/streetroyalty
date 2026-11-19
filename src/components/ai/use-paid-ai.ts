import { useState, useSyncExternalStore } from "react";
import { isUnauthorized } from "@/lib/ai/access";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

const subscribeToNothing = () => () => {};

/**
 * False on the server and during hydration, true after. The first client render
 * has to match the server, so a signed-out prompt waits until then.
 */
function useHydrated(): boolean {
  return useSyncExternalStore(subscribeToNothing, () => true, () => false);
}

/** Pending while the session is loading. Signed out only once we know. */
export function usePaidAiAccess(): { signedOut: boolean; pending: boolean; blocked: boolean } {
  const hydrated = useHydrated();
  const { user, isPending } = useCurrentUserState();
  const pending = !hydrated || isPending;
  const signedOut = hydrated && !isPending && user == null;
  return { signedOut, pending, blocked: pending || signedOut };
}

/** The same gate, plus a sign-in prompt after a stale session is refused. */
export function useAiPrompt(): {
  signedOut: boolean;
  pending: boolean;
  blocked: boolean;
  showSignIn: boolean;
  refused(reason: unknown): boolean;
} {
  const access = usePaidAiAccess();
  const [forced, setForced] = useState(false);
  return {
    ...access,
    blocked: access.blocked || forced,
    showSignIn: access.signedOut || forced,
    refused(reason: unknown) {
      if (!isUnauthorized(reason)) return false;
      setForced(true);
      return true;
    },
  };
}
