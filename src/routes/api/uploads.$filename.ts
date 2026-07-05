import { createFileRoute } from "@tanstack/react-router";
import { readFileSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

export const Route = createFileRoute("/api/uploads/$filename")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const name = params.filename;
        if (!/^[a-zA-Z0-9._-]+$/.test(name)) return new Response("bad", { status: 400 });
        const { UPLOADS_DIR } = await import("@/db/client.server");
        const p = join(UPLOADS_DIR, name);
        try {
          statSync(p);
        } catch {
          return new Response("not found", { status: 404 });
        }
        const data = readFileSync(p);
        const type = MIME[extname(name).toLowerCase()] ?? "application/octet-stream";
        return new Response(new Uint8Array(data), {
          headers: { "content-type": type, "cache-control": "public, max-age=31536000, immutable" },
        });
      },
    },
  },
});
