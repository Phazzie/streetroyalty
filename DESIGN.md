---
name: Street Royalty
description: A streetwear label's shop, fitting room and print studio.
colors:
  night: "#0b0614"
  night-raised: "#161022"
  night-surface: "#20182c"
  night-line: "#3a2d52"
  ink-on-night: "#f6f1ff"
  muted-on-night: "#d5cbe8"
  subtle-on-night: "#b7a8d4"
  paper: "#f5ebdd"
  paper-raised: "#fffaf2"
  paper-deep: "#ecdfcd"
  paper-line: "#d8c8b1"
  ink-on-paper: "#17101f"
  muted-on-paper: "#4a4058"
  lime: "#d6ff3c"
  lime-ink: "#14081c"
  hot-pink: "#ff2d95"
  lilac: "#7c5cff"
  lilac-soft: "#b9a3ee"
  mint-soft: "#a5dccb"
  mint-deep: "#12343a"
typography:
  display:
    fontFamily: "Archivo, Arial Narrow, Archivo Black, sans-serif"
    fontSize: "clamp(3.6rem, 13vw, 9.5rem)"
    fontWeight: 900
    lineHeight: 0.88
    letterSpacing: "-0.012em"
    fontVariation: "'wdth' 62"
  headline:
    fontFamily: "Archivo, Arial Narrow, Archivo Black, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 900
    lineHeight: 0.88
    letterSpacing: "-0.012em"
    fontVariation: "'wdth' 62"
  title:
    fontFamily: "Archivo Black, Arial Black, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.25
  body:
    fontFamily: "Outfit, Avenir Next, Segoe UI, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Archivo Black, Arial Black, sans-serif"
    fontSize: "0.72rem"
    fontWeight: 400
    letterSpacing: "0.16em"
rounded:
  none: "0"
  sm: "0.35rem"
  md: "0.55rem"
  lg: "0.8rem"
  xl: "1.1rem"
  full: "9999px"
components:
  button-site:
    backgroundColor: "{colors.lime}"
    textColor: "{colors.lime-ink}"
    typography: "{typography.title}"
    rounded: "{rounded.none}"
    height: "3.5rem"
    padding: "0 1.25rem"
  button-app:
    backgroundColor: "{colors.lime}"
    textColor: "{colors.lime-ink}"
    rounded: "{rounded.md}"
    height: "3rem"
    padding: "0 1rem"
  button-ghost:
    backgroundColor: "{colors.night-surface}"
    textColor: "{colors.ink-on-night}"
    rounded: "{rounded.md}"
    height: "3rem"
    padding: "0 1rem"
---

# Design System: Street Royalty

> Recorded from the code on 2026-11-16. The North Star name and the colour names are a
> first draft for the owner to correct. The values are what the site ships.

## Overview

**Creative North Star: "The Night Drop"**

The site is a streetwear lookbook shot after dark. Pages sit on a near-black violet with a
fine dot grain, and cut to bands of warm cream paper for reading and buying. Headlines are
tall, condensed, italic capitals set tight enough to behave like a poster. One acid lime
does every job that asks for a tap.

The public pages (home, shop, product) are square-cornered and editorial. The tools (lab,
studio) are softer and stickier: rounded controls, a hard pink offset shadow under the main
button. Both share the same colours and type.

**Key Characteristics:**

- Dark by default, with cream paper bands that swap the surface colours in place.
- One condensed italic display voice for every section title.
- One lime accent for actions, on dark ink text.
- Flat surfaces with 2px ink borders. Depth comes from photography and from one offset
  shadow, not from blur.
- Motion is slow and eased (about 0.4 to 0.9 seconds) and is removed under reduced motion.

## Colors

A night violet ground, a cream paper ground, one lime for action, and three soft tints that
only appear in photography and garment colour.

### Primary

- **Acid Lime** (`lime`): every primary action, the active state, the halftone seam in the
  hero. Text on it is always `lime-ink`.

### Secondary

- **Hot Pink** (`hot-pink`): the hard offset shadow under the app's primary button, and
  piping details. Never a fill for text or large areas.

### Tertiary

- **Lilac** (`lilac`, `lilac-soft`) and **Mint** (`mint-soft`, `mint-deep`): garment and
  scene colours. They name the colourways of the drop.

### Neutral

- **Night** (`night`, `night-raised`, `night-surface`, `night-line`): page ground, raised
  blocks, cards and inputs, and dividers on dark.
- **Paper** (`paper`, `paper-raised`, `paper-deep`, `paper-line`): the same four roles on
  the cream bands.
- **Ink** (`ink-on-night`, `ink-on-paper`) with a muted and a subtle step for secondary
  text.

### Named Rules

**The One Lime Rule.** Lime means "tap this". It is not used for decoration, headings or
body text.

**The Band Rule.** A section is either night or paper. The `.paper` and `.night` classes
swap the surface tokens, so components are written once and never hard-code a ground.

## Typography

**Display Font:** Archivo at 62% width, italic, weight 900 (with Arial Narrow)
**Body Font:** Outfit (with Avenir Next, Segoe UI)
**Label Font:** Archivo Black (with Arial Black)

**Character:** A poster headline over a plain, friendly body. The display face shouts once
per section; everything else stays quiet.

### Hierarchy

- **Display** (900 italic, `clamp(3.6rem, 13vw, 9.5rem)`, 0.88): the hero line only.
- **Headline** (900 italic, 2.25rem to 4.5rem, 0.88): section titles, in capitals.
- **Title** (Archivo Black, 0.875rem, capitals): product names, buttons, nav.
- **Body** (Outfit 400, 1rem, 1.5): descriptions and help text.
- **Label** (Archivo Black, 0.72rem, 0.16em tracking, capitals): eyebrows above headlines.

### Named Rules

**The One Voice Rule.** Every section title uses the `.display` class. No second headline
style.

## Layout

Content sits in a centred column up to 80rem wide with side gutters. The hero runs full
bleed. Product grids go from two columns on a phone to four on a laptop. Drawers and
dialogs are capped near 28rem and slide in from the right. Touch targets are at least
2.5rem, usually 3rem.

## Elevation & Depth

Flat. Surfaces are separated by 2px borders in ink or line colour and by the night and
paper bands. There is no ambient blur shadow in the page flow.

### Shadow Vocabulary

- **Sticker** (`box-shadow: 4px 4px 0 #ff2d95`, growing to `6px 6px 0` on hover): under
  the app's primary button only.
- **Drawer** (Tailwind `shadow-2xl`): under the bag drawer, to lift it off the scrim.

### Named Rules

**The No Blur Rule.** If something needs to stand out, give it a border or a hard offset
shadow.

## Shapes

Public pages are square: buttons, cards and photos have no radius. Round only appears on
icon buttons and pills. The lab and studio use small radii (0.55rem controls, 0.8rem large
buttons). Borders are 2px.

## Components

### Buttons

- **Site primary:** square, lime fill, lime-ink Archivo Black capitals with wide tracking,
  3.5rem tall.
- **App primary:** 0.55rem radius, lime fill, 2px ink border, pink sticker shadow, presses
  to 98% scale.
- **Ghost:** surface fill, 2px ink border.
- **Focus:** 2px solid outline in the text colour, offset 2px.
- **Disabled:** line-colour fill with muted text, never faded opacity.

### Cards / Containers

- **Product card:** square photo, name in Archivo Black capitals, price beside it. On hover
  the photo scales to 103.5% over 0.7s and the second photo fades in.
- **Notes and status:** 2px ink border on the surface colour.

### Navigation

- **Header:** crown and wordmark left, four links, account and bag right. It sits over the
  hero on the home page and on a solid ground elsewhere. On a phone the links move into a
  full-height menu.

### Hero stage

A WebGL photo carousel with a noise sweep and a lime halftone seam between slides. It falls
back to plain photos when WebGL, motion or script is off.

## Do's and Don'ts

### Do:

- **Do** write components against the surface tokens so they work on night and on paper.
- **Do** keep lime for actions and pair it with `lime-ink` text.
- **Do** give every animation a reduced-motion fallback.

### Don't:

- **Don't** add a second headline face or a second accent colour.
- **Don't** use blurred drop shadows to separate surfaces.
- **Don't** round the corners of photos, cards or buttons on the public pages.
