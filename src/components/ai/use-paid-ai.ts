import { useSyncExternalStore } from "react";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

const subscribeToNothing = () => () => {};

/**
 * False on the server and during hydration, true after. The first client render
 * has to match the server, so a signed-out prompt waits until then.
 */
function useHydrated(): boolean {
  return useSyncExternalStore(subscribeToNothing, () => true, () => false);
}

/** True only once we know the visitor is signed out. Pending and the dev user are not. */
export function usePaidAiAccess(): { signedOut: boolean } {
  const hydrated = useHydrated();
  const { user, isPending } = useCurrentUserState();
  return { signedOut: hydrated && !isPending && user == null };
}
