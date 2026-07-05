import { createFileRoute } from "@tanstack/react-router";
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { join, extname } from "node:path";

export const Route = createFileRoute("/api/uploads")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const form = await request.formData();
        const file = form.get("file");
        if (!(file instanceof File)) {
          return new Response(JSON.stringify({ error: "no file" }), {
            status: 400,
            headers: { "content-type": "application/json" },
          });
        }
        if (file.size > 15 * 1024 * 1024) {
          return new Response(JSON.stringify({ error: "file too large (max 15MB)" }), {
            status: 413,
            headers: { "content-type": "application/json" },
          });
        }
        const { UPLOADS_DIR } = await import("@/db/client.server");
        const ext = (extname(file.name) || ".jpg").toLowerCase().replace(/[^.a-z0-9]/g, "");
        const filename = `${randomUUID()}${ext}`;
        const bytes = new Uint8Array(await file.arrayBuffer());
        writeFileSync(join(UPLOADS_DIR, filename), bytes);
        return Response.json({ filename });
      },
    },
  },
});
