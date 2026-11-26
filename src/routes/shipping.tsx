import { createFileRoute, Link } from "@tanstack/react-router";
import { FineSection, HelpPage } from "@/components/help/help-page";

export const Route = createFileRoute("/shipping")({
  head: () => ({ meta: [{ title: "Shipping · Street Royalty" }] }),
  component: ShippingPage,
});

function ShippingPage() {
  return (
    <HelpPage
      current="/shipping"
      eyebrow="Shipping"
      title="Made for you, then it ships."
      lede="Nothing sits on a shelf here. Your piece is printed after you pay, then it goes in the mail."
      updated="2026-11-26"
    >
      <FineSection n={1} title="Who makes it">
        <p>
          Printful prints every piece. They print it on the blank you picked, pack it and ship it
          straight to you. It does not pass through us.
        </p>
      </FineSection>
      <FineSection n={2} title="How long it takes">
        <ul>
          <li>Printing usually takes 2 to 7 business days after you pay.</li>
          <li>
            Then it ships. Checkout shows the shipping options for your address, with the price
            and how many days each one takes, before you pay.
          </li>
          <li>Busy seasons, like November and December, can add a few days.</li>
        </ul>
      </FineSection>
      <FineSection n={3} title="What shipping costs">
        <p>
          Shipping is priced by Printful for your address and the number of pieces. You see the
          exact amount at checkout, added to your total, before you pay anything. We do not add
          to it.
        </p>
      </FineSection>
      <FineSection n={4} title="Tracking">
        <p>
          When your order ships, its tracking number and link show up on your{" "}
          <Link to="/orders">orders page</Link>. If you gave an email at checkout, we send it
          there too.
        </p>
      </FineSection>
      <FineSection n={5} title="Where we ship">
        <p>
          Printful ships to most countries. If your address cannot be reached, checkout says so
          before you pay. Orders going outside the United States may owe import duties or taxes
          to their own country when they arrive. Those are set by that country, not by us.
        </p>
      </FineSection>
      <FineSection n={6} title="Wrong address">
        <p>
          Check the address before you pay, because printing starts right after. If you spot a
          mistake, <Link to="/contact">write to us</Link> as fast as you can. We can fix it only
          if the piece has not been printed yet.
        </p>
      </FineSection>
    </HelpPage>
  );
}
