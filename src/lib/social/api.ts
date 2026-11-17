import { createMiddleware, createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "../auth/middleware.ts";
import type { RackSort } from "./types.ts";

/** Reads the caller if there is one, and never refuses a visitor. */
const optionalUser = createMiddleware({ type: "function" })
  .client(async ({ next }) => {
    const { getBearerToken } = await import("../auth/client.ts");
    return next({ sendContext: { bearerToken: getBearerToken() ?? undefined } });
  })
  .server(async ({ next, context }) => {
    const { getSessionUser } = await import("../auth/verify.server.ts");
    const user = await getSessionUser(context.bearerToken);
    return next({ context: { userId: user?.id ?? null } });
  });

function sortOf(value: unknown): RackSort {
  return value === "crowned" || value === "following" ? value : "fresh";
}

function wantOf(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

/** Open: the rack is public. The viewer only decides crownedByMe and the following tab. */
export const rackList = createServerFn({ method: "GET" })
  .middleware([optionalUser])
  .validator((input: { sort?: string } | undefined) => ({ sort: sortOf(input?.sort) }))
  .handler(async ({ data, context }) => {
    const { rackList: list } = await import("./rack.server.ts");
    return list(context.userId, data.sort);
  });

/** Open: a published piece is a public shop page. */
export const rackPiece = createServerFn({ method: "GET" })
  .middleware([optionalUser])
  .validator((input: { slug?: string }) => ({ slug: String(input?.slug ?? "").trim() }))
  .handler(async ({ data, context }) => {
    const { rackPiece: piece } = await import("./rack.server.ts");
    return piece(context.userId, data.slug);
  });

/** Open: a maker's page is their public shop window. */
export const makerPage = createServerFn({ method: "GET" })
  .middleware([optionalUser])
  .validator((input: { handle?: string }) => ({ handle: String(input?.handle ?? "").trim() }))
  .handler(async ({ data, context }) => {
    const { makerPage: page } = await import("./makers.server.ts");
    return page(context.userId, data.handle);
  });

export const toggleCrown = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { designId?: string; want?: boolean }) => ({
    designId: String(input?.designId ?? ""),
    want: wantOf(input?.want),
  }))
  .handler(async ({ data, context }) => {
    const { toggleCrown: toggle } = await import("./rack.server.ts");
    return toggle(context.userId, data.designId, data.want);
  });

export const toggleFollow = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { handle?: string; want?: boolean }) => ({
    handle: String(input?.handle ?? ""),
    want: wantOf(input?.want),
  }))
  .handler(async ({ data, context }) => {
    const { toggleFollow: toggle } = await import("./makers.server.ts");
    return toggle(context.userId, data.handle, data.want);
  });

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { myProfile } = await import("./makers.server.ts");
    return myProfile(context.userId);
  });

export const updateProfile = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { name?: string; handle?: string; bio?: string }) => ({
    name: String(input?.name ?? ""),
    handle: String(input?.handle ?? ""),
    bio: String(input?.bio ?? ""),
  }))
  .handler(async ({ data, context }) => {
    const { updateProfile: update } = await import("./makers.server.ts");
    return update(context.userId, data);
  });
