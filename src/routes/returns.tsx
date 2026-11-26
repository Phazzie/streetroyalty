import { createFileRoute, Link } from "@tanstack/react-router";
import { FineSection, HelpPage } from "@/components/help/help-page";

export const Route = createFileRoute("/returns")({
  head: () => ({ meta: [{ title: "Returns · Street Royalty" }] }),
  component: ReturnsPage,
});

function ReturnsPage() {
  return (
    <HelpPage
      current="/returns"
      eyebrow="Returns"
      title="If we messed up, we fix it."
      lede="Every piece is made for one person, so we can't take back a piece that came out right. If it came out wrong, it's on us."
      updated="2026-11-26"
    >
      <FineSection n={1} title="What we replace or refund, free">
        <ul>
          <li>The print is wrong, smudged, cracked, crooked or missing.</li>
          <li>The piece arrived damaged or has a flaw in the garment.</li>
          <li>You got a different piece, colour or size from the one you ordered.</li>
          <li>Your order never arrived.</li>
        </ul>
        <p>You choose: a new piece made and shipped again at no cost, or your money back.</p>
      </FineSection>
      <FineSection n={2} title="What we can't take back">
        <ul>
          <li>A piece that came out as ordered but doesn't fit. Check the <Link to="/sizes">size guide</Link> first.</li>
          <li>A change of mind about the design or the colour.</li>
          <li>A typo or picture that was in the design when you ordered it.</li>
        </ul>
        <p>
          Those pieces were made to order and can't be sold to anyone else. Some blanks run
          small, and the size guide says which.
        </p>
      </FineSection>
      <FineSection n={3} title="How to tell us">
        <p>
          <Link to="/contact">Write to us</Link> within 30 days of the day it arrived. Send your
          order number from your <Link to="/orders">orders page</Link> and a clear photo that
          shows the problem. You don't need to send anything back.
        </p>
      </FineSection>
      <FineSection n={4} title="Refunds">
        <p>
          A refund goes back to the card you paid with. Banks usually show it within 5 to 10
          business days.
        </p>
      </FineSection>
    </HelpPage>
  );
}
