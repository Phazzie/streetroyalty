import { createFileRoute, Link } from "@tanstack/react-router";
import { FineSection, HelpPage } from "@/components/help/help-page";

export const Route = createFileRoute("/terms")({
  head: () => ({ meta: [{ title: "Terms · Street Royalty" }] }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <HelpPage
      current="/terms"
      eyebrow="Terms"
      title="The deal, in plain words."
      lede="Using Street Royalty means you agree to this. It's short on purpose."
      updated="2026-11-26"
    >
      <FineSection n={1} title="Everything is made to order">
        <p>
          When you pay, Printful prints your piece. The price you see at checkout, with shipping,
          is the price you pay, in US dollars. Shipping and returns work the way the{" "}
          <Link to="/shipping">shipping</Link> and <Link to="/returns">returns</Link> pages say.
        </p>
      </FineSection>
      <FineSection n={2} title="Previews are previews">
        <p>
          The pictures in the studio, the rack and the Outfit Lab show what a piece will look
          like. Real ink on real fabric can differ a little in colour and placement. Looks made in
          the Outfit Lab are generated pictures, not photos of real garments.
        </p>
      </FineSection>
      <FineSection n={3} title="Your designs stay yours">
        <p>
          You own what you make. When you order it, you let us and Printful print it. When you
          publish it to the rack, you also let us show it on the site and sell it to other
          people, and let people remix it into their own pieces.
        </p>
      </FineSection>
      <FineSection n={4} title="Only put up what's yours to use">
        <ul>
          <li>Don't use logos, art, photos or names that belong to someone else without their OK.</li>
          <li>No hate, no threats, nothing sexual involving minors, nothing that targets a real private person.</li>
          <li>Printful can refuse to print a design that breaks their rules, and then your order is refunded.</li>
        </ul>
        <p>
          We can take a piece off the rack, or close an account, that breaks these rules. Anyone
          can report a piece from its page.
        </p>
      </FineSection>
      <FineSection n={5} title="Art made with AI">
        <p>
          Making pictures costs money, so everyone gets a daily allowance, and the site asks
          before anything that costs. Generated art can look like something that already exists.
          Check it before you order or publish it.
        </p>
      </FineSection>
      <FineSection n={6} title="When things go wrong">
        <p>
          If something breaks on our side, we'll fix the order or refund it. Beyond the price of
          your order, we aren't responsible for losses from using the site. We may update these
          terms, and the date at the bottom says when they last changed.
        </p>
      </FineSection>
    </HelpPage>
  );
}
