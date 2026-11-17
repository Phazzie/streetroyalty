import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { CrownMark } from "@/components/tag/crown-mark";
import { QrFigure } from "@/components/tag/qr-figure";
import { tagUrl } from "@/lib/qr";
import { cleanHandle } from "@/lib/qr/handle";

/**
 * "Scan the fit" on a piece's page: a small crown tag that opens this same page,
 * and the way in to the full tag, the story card and the code on its own.
 */
export function PieceTag({
  slug,
  title,
  makerHandle,
}: {
  slug: string;
  title: string;
  makerHandle?: string;
}) {
  // The link needs the address the page is being read at, which only the browser knows.
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const handle = cleanHandle(makerHandle);

  return (
    <section
      aria-label="Scan the fit"
      className="mt-6 flex items-center gap-4 border-2 border-ink bg-surface p-3"
    >
      <div className="grid w-28 flex-none place-items-center border-2 border-ink bg-[#fffaf2] text-[#17101f] sm:w-32">
        {origin ? (
          <QrFigure
            url={tagUrl(origin, slug)}
            label={`Code that opens ${title} on the rack`}
            className="w-full"
          />
        ) : (
          <div className="grid aspect-square w-full place-items-center">
            <CrownMark className="w-10" />
          </div>
        )}
      </div>
      <div className="min-w-0">
        <h2 className="font-display text-lg leading-tight uppercase">Scan the fit</h2>
        <p className="mt-1 text-sm text-muted">
          This piece has its own crown tag. Hang it on the piece or post it, and whoever scans it
          lands here.
        </p>
        <Link
          to="/tag/$slug"
          params={{ slug }}
          search={handle ? { m: handle } : {}}
          className="chip chip-on mt-3"
        >
          Get the tag
        </Link>
      </div>
    </section>
  );
}
