import { createFileRoute, Link } from "@tanstack/react-router";
import { FineSection, HelpPage } from "@/components/help/help-page";

export const Route = createFileRoute("/privacy")({
  head: () => ({ meta: [{ title: "Privacy · Street Royalty" }] }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <HelpPage
      current="/privacy"
      eyebrow="Privacy"
      title="What we keep, and why."
      lede="We keep what it takes to make your piece and get it to you. We don't sell it, and we don't run ad trackers."
      updated="2026-11-26"
    >
      <FineSection n={1} title="What we keep">
        <ul>
          <li>Your account: your name and email from the way you signed in.</li>
          <li>What you make: your designs, the pictures you put on them, and your saved pieces.</li>
          <li>
            Your orders: the shipping address, email and phone you gave at checkout, what you
            bought, and the tracking.
          </li>
          <li>
            Your page on the rack, if you publish: your maker name, the pieces you put up, who
            you follow and the crowns and votes you give.
          </li>
          <li>
            A daily count of the pictures you make, so everyone gets a fair allowance. When you're
            signed out it's kept against a scrambled code that changes every day, not your name.
          </li>
        </ul>
      </FineSection>
      <FineSection n={2} title="Who else sees it">
        <p>Only the companies that do part of the job, and only the part they need:</p>
        <ul>
          <li>Printful gets your print file, the piece, and your shipping address, so they can print and ship it.</li>
          <li>Stripe takes your card. We never see or keep your card number.</li>
          <li>
            xAI makes the pictures when you ask the studio or the Outfit Lab for art. What you
            type or say, and any photo you give the lab, is sent to them to make that picture.
          </li>
          <li>Your sign-in provider, like Google, if you sign in with one.</li>
          <li>Our host, Vercel, which runs the site and its database.</li>
        </ul>
        <p>We don't sell your information, and we don't share it for advertising.</p>
      </FineSection>
      <FineSection n={3} title="Cookies">
        <p>
          One cookie keeps you signed in. The site also remembers small things in your own
          browser, like your last look in the Outfit Lab. There are no ad or tracking cookies.
        </p>
      </FineSection>
      <FineSection n={4} title="What's public">
        <p>
          Anything you publish to the rack is public: the piece, its name, and your maker name.
          Drafts and saved pieces stay private until you publish them.
        </p>
      </FineSection>
      <FineSection n={5} title="Deleting it">
        <p>
          To take a piece off the rack, or to have your account and everything in it deleted, <Link to="/contact">write to us</Link> from the email on your account. We keep
          order records only as long as the law needs them for tax and accounting.
        </p>
      </FineSection>
    </HelpPage>
  );
}
