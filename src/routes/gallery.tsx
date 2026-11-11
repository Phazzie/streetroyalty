import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { StudioShell } from "@/components/studio/shell";
import { formatMoney } from "@/lib/pod/money";
import { myCollections, myDesigns } from "@/lib/studio/api";
import type { CollectionRecord, DesignSummary } from "@/lib/studio/models";

export const Route = createFileRoute("/gallery")({ component: GalleryPage });

function GalleryPage() {
  const [designs, setDesigns] = useState<DesignSummary[] | null>(null);
  const [collections, setCollections] = useState<CollectionRecord[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    void Promise.all([myDesigns(), myCollections()])
      .then(([pieces, racks]) => {
        setDesigns(pieces);
        setCollections(racks);
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Sign in to see your rack."));
  }, []);

  const groups = collections.length
    ? collections
    : [{ id: "", name: "Loose pieces", count: designs?.length ?? 0 }];

  return (
    <StudioShell current="/gallery">
      <h1 className="font-display text-4xl leading-none">Your rack</h1>
      <p className="mt-2 mb-6 text-muted">Saved pieces stay with your account.</p>
      {error ? <p className="border-2 border-pipe p-4">{error}. <Link to="/login" className="underline">Sign in</Link></p> : null}
      {designs && designs.length === 0 ? (
        <p className="empty-state">Nothing saved yet. The studio is open.</p>
      ) : null}
      {groups.map((group) => {
        const pieces = (designs ?? []).filter((design) => (group.id ? design.collectionId === group.id : !design.collectionId));
        if (group.id && pieces.length === 0 && collections.length > 0) {
          return (
            <section key={group.id} className="mb-8">
              <h2 className="font-display text-xl">{group.name}</h2>
              <p className="text-sm text-muted">Empty collection.</p>
            </section>
          );
        }
        if (pieces.length === 0) return null;
        return (
          <section key={group.id || "loose"} className="mb-8">
            <h2 className="mb-3 font-display text-xl">{group.name}</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {pieces.map((design) => (
                <Link key={design.id} to="/studio" search={{ design: design.id }} className="studio-card border-2 border-ink bg-surface p-2">
                  {design.mockupUrl ? <img src={design.mockupUrl} alt="" className="aspect-square w-full object-cover" /> : <div className="aspect-square bg-bg" />}
                  <p className="mt-2 font-display text-sm uppercase">{design.title}</p>
                  <p className="text-sm text-muted">{design.status === "published" ? "On the shop" : "Draft"} · {formatMoney(design.retailCents)}</p>
                </Link>
              ))}
            </div>
          </section>
        );
      })}
    </StudioShell>
  );
}
