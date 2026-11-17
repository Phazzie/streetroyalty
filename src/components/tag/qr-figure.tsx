import { useMemo } from "react";
import { cn } from "@/lib/cn";
import { encodeQr, qrSvg } from "@/lib/qr";

/** The crown tag for a link, drawn inline so it stays sharp on screen and on paper. */
export function QrFigure({
  url,
  label,
  stitched = true,
  dark = "#17101f",
  light = "#fffaf2",
  className,
}: {
  url: string;
  label: string;
  stitched?: boolean;
  dark?: string;
  light?: string;
  className?: string;
}) {
  const svg = useMemo(() => {
    try {
      return qrSvg(encodeQr(url), {
        style: stitched ? "stitched" : "square",
        dark,
        light,
        title: label,
      });
    } catch {
      return "";
    }
  }, [url, label, stitched, dark, light]);

  if (!svg)
    return <div className={className} role="img" aria-label="The link is too long for a tag" />;
  return (
    <div
      className={cn("[&>svg]:block [&>svg]:h-auto [&>svg]:w-full", className)}
      // The string comes from qrSvg, which escapes everything it is given.
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
