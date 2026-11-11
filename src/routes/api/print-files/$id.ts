import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/print-files/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { readPrintFile } = await import("@/lib/studio/repo.server");
        const file = await readPrintFile(params.id);
        if (!file) return new Response("Not found", { status: 404 });
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
