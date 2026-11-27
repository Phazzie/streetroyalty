import type { PaymentsMode, PodMode } from "../pod/types.ts";
import { readStudioAccess } from "../studio/orders.server.ts";
import { readStudioConfig } from "../studio/shared.server.ts";
import { switchboard, type Switchboard } from "./switchboard.ts";

/**
 * What one viewer gets to see of the board.
 *
 * Only a signed-in shop admin gets the live reading. Everyone else, signed in
 * or not, gets the same answer whether or not an admin list exists: the two
 * modes the studio already shows on every page, and whether they are signed in.
 */
export type BoardView =
  | { view: "admin"; board: Switchboard }
  | { view: "public"; signedIn: boolean; podMode: PodMode; paymentsMode: PaymentsMode };

export async function readBoard(userId: string | null): Promise<BoardView> {
  if (userId) {
    const access = await readStudioAccess(userId);
    if (access.admin) return { view: "admin", board: switchboard(process.env) };
  }
  const config = readStudioConfig();
  return {
    view: "public",
    signedIn: Boolean(userId),
    podMode: config.podMode,
    paymentsMode: config.paymentsMode,
  };
}
