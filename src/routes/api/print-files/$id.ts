import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/print-files/$id")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const { readPrintFile, authorizePrintFile } = await import("@/lib/studio/repo.server");
        const token = new URL(request.url).searchParams.get("token");
        if (!authorizePrintFile(params.id, token))
          return new Response("Not found", { status: 404 });
        const { AOP_RECIPE_MIME, parseAopFileId, renderAopPrintFile } =
          await import("@/lib/studio/aop-print.server");
        const aop = parseAopFileId(params.id);
        const file = aop
          ? await renderAopPrintFile(aop.recipe, aop.placement)
          : await readPrintFile(params.id);
        // A recipe is data for the renderer, never a file to hand out.
        if (!file || file.mime === AOP_RECIPE_MIME)
          return new Response("Not found", { status: 404 });
        const copy = new ArrayBuffer(file.bytes.byteLength);
        new Uint8Array(copy).set(file.bytes);
        return new Response(copy, {
          headers: {
            "content-type": file.mime,
            "cache-control": "public, max-age=31536000, immutable",
          },
        });
      },
    },
  },
});
