/**
 * The go-live checklist: every service the shop can run on, what it does for a
 * customer, the settings it reads and where to get them. Plain data with no
 * server imports, so the page can show it to anyone. It holds names and
 * instructions only. No setting's value is ever in here.
 */

export type ServiceId =
  "admins" | "database" | "signin" | "payments" | "printing" | "pictures";

export type VariableSpec = {
  name: string;
  /** Needed to switch the service on, or optional fine tuning. */
  need: "needed" | "optional";
  /** What it is, for someone who has never seen one. */
  what: string;
};

export type ServiceSpec = {
  id: ServiceId;
  /** Stencilled on the breaker. */
  name: string;
  /** What it unlocks for a customer, in one plain sentence. */
  unlocks: string;
  /** What is true while it is off. */
  without: string;
  /** Where the settings come from. */
  provider: { name: string; url: string } | null;
  variables: VariableSpec[];
  /** How to get the settings, one step a line. */
  steps: string[];
};

/** Where every setting goes, whichever service it belongs to. */
export const VERCEL_STEPS = [
  "Open vercel.com and pick this project.",
  "Go to Settings, then Environment Variables.",
  "Add a variable. Paste the name into Key and the secret into Value.",
  "Save. Then open Deployments, press the three dots on the newest one and choose Redeploy. A setting only counts after a redeploy.",
] as const;

export const VARIABLE_IN_ONE_LINE =
  "An environment variable is a named setting you type into Vercel, like a labelled key on a hook. The site reads it when it starts, and no visitor can see it.";

/** In the order to switch them on. */
export const SERVICES: ServiceSpec[] = [
  {
    id: "admins",
    name: "Who runs the shop",
    unlocks:
      "Nothing for customers. It lets you read this board live and reconnect the printer from the orders page.",
    without: "Nobody can read the live board, not even you.",
    provider: null,
    variables: [
      {
        name: "STUDIO_ADMIN_EMAILS",
        need: "needed",
        what: "The email you sign in with on this site. For more than one person, put commas between the emails.",
      },
    ],
    steps: [
      "Sign in on this site, or make an account. Note the email you used.",
      "In Vercel add STUDIO_ADMIN_EMAILS with that email as the value.",
      "Redeploy, then come back here signed in. The covers come off the board.",
    ],
  },
  {
    id: "database",
    name: "The database",
    unlocks: "Accounts, saved designs and orders are still there tomorrow.",
    without:
      "Accounts, saved designs and orders live in the server's memory and vanish when it restarts.",
    provider: { name: "Neon", url: "https://neon.com" },
    variables: [
      {
        name: "DATABASE_URL",
        need: "needed",
        what: "The address of your Postgres database, with its password inside.",
      },
    ],
    steps: [
      "Make a project at neon.com. The free plan is enough to start.",
      "In the Neon console press Connect and copy the connection string.",
      "In Vercel add DATABASE_URL with that string as the value.",
      "Redeploy. The tables are made during the deploy.",
    ],
  },
  {
    id: "signin",
    name: "Sign-in",
    unlocks: "People make an account once and stay signed in.",
    without:
      "Everyone is signed out whenever the server restarts, and sign-in may refuse your real web address.",
    provider: null,
    variables: [
      {
        name: "BETTER_AUTH_SECRET",
        need: "needed",
        what: "A long random password the site seals sign-in cookies with. You make it up. Nobody has to remember it.",
      },
      {
        name: "BETTER_AUTH_URL",
        need: "needed",
        what: "Your site's real address, starting with https and with no slash at the end.",
      },
    ],
    steps: [
      "Make a long random string, 32 characters or more. Any password generator will do.",
      "In Vercel add it as BETTER_AUTH_SECRET.",
      "Add BETTER_AUTH_URL with your site's address.",
      "Redeploy. Changing the secret later signs everyone out once.",
    ],
  },
  {
    id: "payments",
    name: "Payments",
    unlocks: "People can pay.",
    without: "Checkout is a sandbox. No card is charged and no money moves.",
    provider: { name: "Stripe", url: "https://dashboard.stripe.com" },
    variables: [
      {
        name: "STRIPE_SECRET_KEY",
        need: "needed",
        what: "Stripe's secret key. It lets the site open a checkout page.",
      },
      {
        name: "STRIPE_WEBHOOK_SECRET",
        need: "needed",
        what: "Lets Stripe tell the site a payment landed, and proves the message is from Stripe.",
      },
      {
        name: "PAYMENTS_MODE",
        need: "optional",
        what: "Set it to live to take real cards. Left out, checkout stays in practice even if a Stripe key is present.",
      },
    ],
    steps: [
      "Make a Stripe account and finish its business details, so it can take real cards.",
      "In Stripe open Developers, then API keys. Copy the live secret key into STRIPE_SECRET_KEY.",
      "Still under Developers, open Webhooks and add a destination of the kind Webhook endpoint. Its address is your site's address followed by /api/webhooks/stripe",
      "Have it send two events: checkout.session.completed and checkout.session.async_payment_succeeded.",
      "Reveal that endpoint's signing secret and copy it into STRIPE_WEBHOOK_SECRET.",
      "Switch printing on too. The site refuses real money while printing is in sandbox.",
    ],
  },
  {
    id: "printing",
    name: "Printing",
    unlocks: "A paid order goes to Printful, gets made and ships.",
    without: "The studio runs on built-in practice blanks. Nothing is printed or shipped.",
    provider: { name: "Printful", url: "https://developers.printful.com" },
    variables: [
      {
        name: "PRINTFUL_API_KEY",
        need: "needed",
        what: "Printful's private token. It lets the site send orders to be made.",
      },
      {
        name: "PRINT_FILE_SIGNING_SECRET",
        need: "needed",
        what: "A long random password you make up. It keeps people's print files from being open to anyone with a link.",
      },
      {
        name: "APP_PUBLIC_URL",
        need: "needed",
        what: "Your site's real address, starting with https. Printful downloads the print files from it.",
      },
      {
        name: "PRINTFUL_WEBHOOK_SECRET",
        need: "needed",
        what: "Lets Printful tell the site when an order is made and shipped.",
      },
      {
        name: "PRINTFUL_STORE_ID",
        need: "needed",
        what: "The Printful store orders are sent to. Live mode refuses to start without it.",
      },
      {
        name: "STUDIO_MARKUP",
        need: "optional",
        what: "Your price is the printer's cost times this number. It is 2.2 when left out.",
      },
      {
        name: "POD_MODE",
        need: "needed",
        what: "Set it to sandbox or live. A Printful key does not choose the mode.",
      },
    ],
    steps: [
      "Make a Printful account. In its dashboard go to Stores and connect one by API.",
      "Add a payment method in Printful's billing. Printful charges you for each order it makes.",
      "Sign in at developers.printful.com, open Tokens and add a new token for that one store. Copy it straight away. Printful shows it once. It goes in PRINTFUL_API_KEY.",
      "Make up a long random string for PRINT_FILE_SIGNING_SECRET.",
      "Set APP_PUBLIC_URL to your site's address.",
      "Redeploy, then open Orders on this site and press Connect webhooks. Copy the secret it shows into PRINTFUL_WEBHOOK_SECRET and redeploy once more.",
    ],
  },
  {
    id: "pictures",
    name: "Pictures and video",
    unlocks: "People can generate art, try pieces on and walk a look.",
    without: "Nothing new can be generated. Ready-made art and the editor still work.",
    provider: { name: "xAI", url: "https://console.x.ai" },
    variables: [
      {
        name: "XAI_API_KEY",
        need: "needed",
        what: "xAI's key. Every picture and video the site makes is billed to it.",
      },
      {
        name: "AI_VISITOR_IMAGE",
        need: "optional",
        what: "How many pictures one visitor can make in a day.",
      },
      {
        name: "AI_DAILY_IMAGE",
        need: "optional",
        what: "How many pictures everyone together can make in a day.",
      },
      {
        name: "AI_VISITOR_VIDEO",
        need: "optional",
        what: "How many videos one visitor can make in a day.",
      },
      {
        name: "AI_DAILY_VIDEO",
        need: "optional",
        what: "How many videos everyone together can make in a day.",
      },
      {
        name: "AI_VISITOR_TEXT",
        need: "optional",
        what: "How many written answers one visitor can ask for in a day.",
      },
      {
        name: "AI_DAILY_TEXT",
        need: "optional",
        what: "How many written answers everyone together can ask for in a day.",
      },
    ],
    steps: [
      "Sign in at console.x.ai and add credit.",
      "Open API Keys, create a key and copy it straight away.",
      "In Vercel add it as XAI_API_KEY and redeploy.",
      "Each picture and video costs money. The daily caps keep a busy day from running up the bill. Zero turns a kind off.",
    ],
  },
];

export const TEST_ORDER_STEPS = [
  "Make a piece in the studio and publish it.",
  "Put it in the cart and check out with a real card, to your own address.",
  "You pay for it and it gets made. That is the test.",
  "Watch it on the orders page: paid, sent to print, shipped.",
] as const;

export function serviceSpec(id: ServiceId): ServiceSpec {
  const spec = SERVICES.find((service) => service.id === id);
  if (!spec) throw new Error(`Unknown service ${id}`);
  return spec;
}
