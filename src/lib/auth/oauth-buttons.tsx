import { useEffect, useState } from "react";
import { listOAuthProviders } from "./oauth.functions";

/** Google and X for this host, or nothing when the broker client is not configured. */
export function useOAuthProviders(): { providerId: string; label: string }[] {
  const [providers, setProviders] = useState<{ providerId: string; label: string }[]>([]);
  useEffect(() => {
    let live = true;
    void listOAuthProviders()
      .then((rows) => {
        if (live) setProviders(rows);
      })
      .catch(() => {
        if (live) setProviders([]);
      });
    return () => {
      live = false;
    };
  }, []);
  return providers;
}
