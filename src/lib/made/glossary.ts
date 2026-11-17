/**
 * The field guide: print words in plain words. Each entry is 60 words at most, and the
 * test holds it to that. Numbers in here come from the studio's own blanks
 * (src/lib/pod/sandbox.ts): the house tee prints 12 by 16 inches at 150 dots per inch.
 */

export type EntryId =
  | "dtg"
  | "dtf"
  | "embroidery"
  | "puff"
  | "all-over"
  | "cut-and-sew"
  | "screen"
  | "blank"
  | "colourway"
  | "mockup"
  | "print-area"
  | "dpi"
  | "made-to-order";

export type Entry = {
  id: EntryId;
  /** The short form people see in print shops, or the word itself. */
  short: string;
  /** What the letters stand for, in full. */
  name: string;
  body: string;
  /** What the drawing shows, for people who cannot see it. */
  drawing: string;
  group: "method" | "word";
};

export const ENTRIES: Entry[] = [
  {
    id: "dtg",
    short: "DTG",
    name: "Direct to garment",
    body: "A printer like the one on a desk, only bigger, sprays ink straight onto a finished shirt. Good for photos and lots of colours. It likes cotton best. The studio's tees, hoodies and crewnecks are set up for this.",
    drawing: "A print head slides over a tee and drops ink onto the chest.",
    group: "method",
  },
  {
    id: "dtf",
    short: "DTF",
    name: "Direct to film",
    body: "The picture is printed onto a clear film first, then pressed onto the garment with heat, and the film is peeled away. It sticks to more kinds of fabric than DTG and keeps hard edges. You can feel it sitting on top of the cloth, like a very thin sticker.",
    drawing: "A printed sheet of film, then a hot press pushing the picture onto a tee.",
    group: "method",
  },
  {
    id: "embroidery",
    short: "Embroidery",
    name: "Stitched with thread",
    body: "A machine stitches the design in thread, one colour at a time. It is raised, tough and lasts. Tiny words and soft fades do not stitch well, so keep it bold. The studio's hat is made this way.",
    drawing: "A needle carrying thread goes down through cloth in a hoop and leaves a row of stitches.",
    group: "method",
  },
  {
    id: "puff",
    short: "Puff print",
    name: "Ink that rises",
    body: "An ink that swells under heat, the way bread rises in an oven. The print stands up off the fabric and you can feel it with your eyes shut. Best for thick letters and simple shapes. Fine detail gets lost when it rises.",
    drawing: "From the side: a thin flat layer of ink, then the same ink swollen into a dome after heat.",
    group: "method",
  },
  {
    id: "all-over",
    short: "AOP",
    name: "All-over print, and sublimation",
    body: "The whole garment is the picture, edge to edge. Sublimation is how: heat pushes dye into white polyester until the colour is part of the thread. Nothing sits on top, so nothing cracks or peels. The printed fabric is then cut and sewn into the piece.",
    drawing: "A sheet of fabric printed all over, with the outline of a body and two sleeves to cut from it.",
    group: "method",
  },
  {
    id: "cut-and-sew",
    short: "Cut and sew",
    name: "Built from flat pieces",
    body: "Flat pieces of fabric are cut out and stitched together. All clothes start this way. When a printer says cut and sew, they mean they print the flat fabric first and sew it after, so the print can cross seams and reach every edge.",
    drawing: "A body piece and a sleeve piece being stitched together, with a pair of scissors.",
    group: "method",
  },
  {
    id: "screen",
    short: "Screen print",
    name: "Ink through a stencil",
    body: "Ink is pulled through a fine mesh stencil, one stencil for each colour. Making the stencils takes time and money, so shops print stacks of the same shirt in one go. That is why it is not made one at a time, and why the studio does not offer it.",
    drawing: "A blade pulls ink across a mesh frame, above a stack of the same shirt.",
    group: "method",
  },
  {
    id: "blank",
    short: "A blank",
    name: "The plain garment",
    body: "A plain garment with nothing on it yet. The tee, hoodie, crewneck or hat you pick in the studio is a blank. Its weight, cut and fabric decide how the piece feels more than the print does.",
    drawing: "A plain tee with only a neck label.",
    group: "word",
  },
  {
    id: "colourway",
    short: "A colourway",
    name: "One set of colours",
    body: "One design in one set of colours. A hoodie in lilac with cream panels is one colourway. The same hoodie in mint with peach panels is another. Same shape, different mood.",
    drawing: "Three tees of the same shape in three different colours.",
    group: "word",
  },
  {
    id: "mockup",
    short: "A mockup",
    name: "A picture, not a photo",
    body: "A picture of what your piece should look like, made on a computer before anything is printed. It is a preview, not a photo. A screen is lit from behind and cloth is not, so the real colours will look a little flatter.",
    drawing: "A tee drawn in dotted lines inside a screen, with a pointer beside it.",
    group: "word",
  },
  {
    id: "print-area",
    short: "The print area",
    name: "Where the printer can reach",
    body: "The part of the garment the printer can reach. On the studio's house tee the front area is 12 inches wide and 16 tall. Art outside that box gets cut off. Seams, pockets, zips and collars sit outside it.",
    drawing: "A tee with a dotted box on the chest, marked 12 inches by 16 inches.",
    group: "word",
  },
  {
    id: "dpi",
    short: "DPI",
    name: "Dots per inch",
    body: "How many dots of ink fit in one inch. A picture is made of tiny squares. Stretch a small picture across a chest and each square gets big enough to see, so it prints blurry. The studio prints at 150 dots an inch, so a 12 inch print wants a picture 1,800 squares wide.",
    drawing: "A small smooth shape, then the same shape blown up into big visible squares.",
    group: "word",
  },
  {
    id: "made-to-order",
    short: "Made to order",
    name: "Nothing until you pay",
    body: "Nothing is made until someone pays for it. No stock, no warehouse, no pile of shirts nobody wanted. Each piece costs more than making hundreds at once, and it takes longer to reach you than something already on a shelf.",
    drawing: "Three steps in a row: an order slip, a tee being made, a box.",
    group: "word",
  },
];

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/** Trade words a person new to this should never have to look up. */
export const JARGON = [
  "substrate",
  "pretreat",
  "plastisol",
  "cmyk",
  "rgb",
  "raster",
  "vector",
  "gsm",
  "platen",
  "squeegee",
  "emulsion",
  "polymer",
  "fulfilment",
  "fulfillment",
  "sku",
  "moq",
];
