import { useEffect, useState } from "react";
import { Crown } from "@/components/site/shell";
import { countTagScan, tagScans } from "@/lib/social/scans-api";

/**
 * Sits at the top of a rack piece. Someone who arrived by scanning the piece's tag
 * (`?via=tag`) gets a welcome and is counted once per browser tab. Everyone sees how
 * many times the piece has been scanned out in the street, once that is above zero.
 */
export function ScanStrip({ slug }: { slug: string }) {
  const [viaTag, setViaTag] = useState(false);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    let live = true;
    const arrived = new URLSearchParams(window.location.search).get("via") === "tag";
    setViaTag(arrived);
    const key = `sr-scan:${slug}`;
    let counted = false;
    try {
      counted = sessionStorage.getItem(key) === "1";
    } catch {
      counted = false;
    }
    const request =
      arrived && !counted ? countTagScan({ data: { slug } }) : tagScans({ data: { slug } });
    void request
      .then((result) => {
        if (!live) return;
        setTotal(result.total);
        if (arrived && !counted) {
          try {
            sessionStorage.setItem(key, "1");
          } catch {
            // Private tabs may refuse storage. The scan is already counted.
          }
        }
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [slug]);

  if (!viaTag && total === 0) return null;

  return (
    <div
      className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-1 border-2 border-pipe bg-surface px-3 py-2"
      role={viaTag ? "status" : undefined}
    >
      <Crown className="h-4 w-auto shrink-0 text-fg" />
      {viaTag ? (
        <p className="font-display text-sm tracking-wide uppercase">You scanned a fit.</p>
      ) : null}
      <p className="text-sm text-muted">
        {viaTag ? "This is the piece, and who made it. " : null}
        {total > 0 ? `Scanned ${total} ${total === 1 ? "time" : "times"} out in the street.` : null}
      </p>
    </div>
  );
}
