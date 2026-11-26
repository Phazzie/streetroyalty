import { createFileRoute, Link } from "@tanstack/react-router";
import { FineSection, HelpPage } from "@/components/help/help-page";
import { getShopContact } from "@/lib/help/contact";

export const Route = createFileRoute("/contact")({
  head: () => ({ meta: [{ title: "Contact · Street Royalty" }] }),
  loader: () => getShopContact(),
  component: ContactPage,
});

function ContactPage() {
  const { email } = Route.useLoaderData();
  return (
    <HelpPage
      current="/contact"
      eyebrow="Contact"
      title="Talk to a person."
      lede="Questions about an order, a piece, or the studio. A real person reads every message."
    >
      <FineSection n={1} title="Write to us">
        {email ? (
          <p>
            <a
              href={`mailto:${email}`}
              className="display break-all text-3xl no-underline hover:underline sm:text-4xl"
            >
              {email}
            </a>
          </p>
        ) : (
          <p>
            Our inbox isn't open yet. For anything about an order, your{" "}
            <Link to="/orders">orders page</Link> shows where it is and its tracking link.
          </p>
        )}
      </FineSection>
      <FineSection n={2} title="About an order">
        <p>
          Put your order number in the message. It's on your <Link to="/orders">orders page</Link>.
          If something came out wrong, add a photo of it. The <Link to="/returns">returns page</Link>{" "}
          says what we fix.
        </p>
      </FineSection>
      <FineSection n={3} title="About a piece on the rack">
        <p>
          If a piece on the rack copies your work or crosses a line, use the report link on that
          piece. It goes straight to the shop.
        </p>
      </FineSection>
    </HelpPage>
  );
}
