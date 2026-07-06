import { createServerFn } from "@tanstack/react-start";

// All handlers dynamically import the DB to keep native `better-sqlite3`
// out of the client bundle.

async function db() {
  const { getDb } = await import("@/db/client.server");
  return getDb();
}
async function uid() {
  const { randomUUID } = await import("@/db/client.server");
  return randomUUID();
}

// ---------- Sites / UAPs / Gaps ----------

export const listHierarchy = createServerFn({ method: "GET" }).handler(async () => {
  const d = await db();
  const sites = d.prepare("SELECT * FROM sites ORDER BY name").all() as {
    id: string; name: string;
  }[];
  const uaps = d.prepare("SELECT * FROM uaps ORDER BY name").all() as {
    id: string; site_id: string; name: string;
  }[];
  const gaps = d.prepare("SELECT * FROM gaps ORDER BY name").all() as {
    id: string; uap_id: string; name: string; code: string | null;
  }[];
  return { sites, uaps, gaps };
});

export const createSite = createServerFn({ method: "POST" })
  .inputValidator((d: { name: string }) => d)
  .handler(async ({ data }) => {
    const id = await uid();
    (await db()).prepare("INSERT INTO sites (id, name) VALUES (?, ?)").run(id, data.name.trim());
    return { id };
  });

export const renameSite = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string; name: string }) => d)
  .handler(async ({ data }) => {
    (await db()).prepare("UPDATE sites SET name = ? WHERE id = ?").run(data.name.trim(), data.id);
    return { ok: true };
  });

export const deleteSite = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    (await db()).prepare("DELETE FROM sites WHERE id = ?").run(data.id);
    return { ok: true };
  });

export const createUap = createServerFn({ method: "POST" })
  .inputValidator((d: { site_id: string; name: string }) => d)
  .handler(async ({ data }) => {
    const id = await uid();
    (await db())
      .prepare("INSERT INTO uaps (id, site_id, name) VALUES (?, ?, ?)")
      .run(id, data.site_id, data.name.trim());
    return { id };
  });

export const renameUap = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string; name: string }) => d)
  .handler(async ({ data }) => {
    (await db()).prepare("UPDATE uaps SET name = ? WHERE id = ?").run(data.name.trim(), data.id);
    return { ok: true };
  });

export const deleteUap = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    (await db()).prepare("DELETE FROM uaps WHERE id = ?").run(data.id);
    return { ok: true };
  });

export const createGap = createServerFn({ method: "POST" })
  .inputValidator((d: { uap_id: string; name: string; code?: string }) => d)
  .handler(async ({ data }) => {
    const id = await uid();
    (await db())
      .prepare("INSERT INTO gaps (id, uap_id, name, code) VALUES (?, ?, ?, ?)")
      .run(id, data.uap_id, data.name.trim(), data.code?.trim() ?? null);
    return { id };
  });

export const updateGap = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string; name: string; code?: string }) => d)
  .handler(async ({ data }) => {
    (await db())
      .prepare("UPDATE gaps SET name = ?, code = ? WHERE id = ?")
      .run(data.name.trim(), data.code?.trim() || null, data.id);
    return { ok: true };
  });

export const deleteGap = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    (await db()).prepare("DELETE FROM gaps WHERE id = ?").run(data.id);
    return { ok: true };
  });

// ---------- Criteria & Questions ----------

export const listReferential = createServerFn({ method: "GET" }).handler(async () => {
  const d = await db();
  const criteria = d
    .prepare("SELECT * FROM criteria ORDER BY order_index")
    .all() as { id: string; code: string; name: string; order_index: number }[];
  const questions = d
    .prepare("SELECT * FROM questions ORDER BY order_index")
    .all() as { id: string; criteria_id: string; text: string; order_index: number }[];
  return { criteria, questions };
});

export const addQuestion = createServerFn({ method: "POST" })
  .inputValidator((d: { criteria_id: string; text: string }) => d)
  .handler(async ({ data }) => {
    const dbi = await db();
    const n = dbi
      .prepare("SELECT COUNT(*) as n FROM questions WHERE criteria_id = ?")
      .get(data.criteria_id) as { n: number };
    const id = await uid();
    dbi
      .prepare("INSERT INTO questions (id, criteria_id, text, order_index) VALUES (?, ?, ?, ?)")
      .run(id, data.criteria_id, data.text.trim(), n.n);
    return { id };
  });

export const deleteQuestion = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    (await db()).prepare("DELETE FROM questions WHERE id = ?").run(data.id);
    return { ok: true };
  });

// ---------- Audits ----------

export const listAudits = createServerFn({ method: "GET" }).handler(async () => {
  return (await db())
    .prepare("SELECT * FROM audits ORDER BY audit_date DESC, created_at DESC")
    .all() as Audit[];
});

export type Audit = {
  id: string;
  audit_date: string;
  site_id: string | null;
  uap_id: string | null;
  gap_id: string | null;
  auditor: string;
  status: string;
  global_score: number | null;
  created_at: number;
};

export const createAudit = createServerFn({ method: "POST" })
  .inputValidator(
    (d: { site_id: string; uap_id: string; gap_id: string; auditor: string; audit_date: string }) => d,
  )
  .handler(async ({ data }) => {
    const id = await uid();
    (await db())
      .prepare(
        "INSERT INTO audits (id, audit_date, site_id, uap_id, gap_id, auditor) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .run(id, data.audit_date, data.site_id, data.uap_id, data.gap_id, data.auditor.trim() || "Auditeur");
    return { id };
  });

export const deleteAudit = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    (await db()).prepare("DELETE FROM audits WHERE id = ?").run(data.id);
    return { ok: true };
  });

export const updateAuditHeader = createServerFn({ method: "POST" })
  .inputValidator(
    (d: { id: string; audit_date: string; site_id: string; uap_id: string; gap_id: string; auditor: string }) => d,
  )
  .handler(async ({ data }) => {
    (await db())
      .prepare(
        "UPDATE audits SET audit_date = ?, site_id = ?, uap_id = ?, gap_id = ?, auditor = ? WHERE id = ?",
      )
      .run(data.audit_date, data.site_id, data.uap_id, data.gap_id, data.auditor, data.id);
    return { ok: true };
  });

export const getAudit = createServerFn({ method: "GET" })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    const dbi = await db();
    const audit = dbi.prepare("SELECT * FROM audits WHERE id = ?").get(data.id) as Audit | undefined;
    if (!audit) return null;
    const responses = dbi
      .prepare("SELECT * FROM audit_responses WHERE audit_id = ?")
      .all(data.id) as Array<{
        id: string; audit_id: string; question_id: string; criteria_id: string;
        score: number | null; comment: string | null; gap_text: string | null;
        suggested_action: string | null;
      }>;
    const photos = dbi
      .prepare(
        `SELECT p.* FROM audit_response_photos p
         JOIN audit_responses r ON r.id = p.response_id
         WHERE r.audit_id = ?`,
      )
      .all(data.id) as Array<{
        id: string; response_id: string; file_path: string; comment: string | null;
      }>;
    return { audit, responses, photos };
  });

export const saveResponse = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      audit_id: string;
      question_id: string;
      criteria_id: string;
      score?: number | null;
      comment?: string | null;
      gap_text?: string | null;
      suggested_action?: string | null;
    }) => d,
  )
  .handler(async ({ data }) => {
    const dbi = await db();
    const existing = dbi
      .prepare("SELECT id FROM audit_responses WHERE audit_id = ? AND question_id = ?")
      .get(data.audit_id, data.question_id) as { id: string } | undefined;
    if (existing) {
      const sets: string[] = [];
      const vals: unknown[] = [];
      for (const k of ["score", "comment", "gap_text", "suggested_action"] as const) {
        if (k in data) {
          sets.push(`${k} = ?`);
          vals.push(data[k] ?? null);
        }
      }
      if (sets.length) {
        vals.push(existing.id);
        dbi.prepare(`UPDATE audit_responses SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
      }
      return { id: existing.id };
    }
    const id = await uid();
    dbi
      .prepare(
        "INSERT INTO audit_responses (id, audit_id, question_id, criteria_id, score, comment, gap_text, suggested_action) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
        id,
        data.audit_id,
        data.question_id,
        data.criteria_id,
        data.score ?? null,
        data.comment ?? null,
        data.gap_text ?? null,
        data.suggested_action ?? null,
      );
    return { id };
  });

// Ensure a response row exists (so we can attach a photo before entering a score)
export const ensureResponse = createServerFn({ method: "POST" })
  .inputValidator((d: { audit_id: string; question_id: string; criteria_id: string }) => d)
  .handler(async ({ data }) => {
    const dbi = await db();
    const existing = dbi
      .prepare("SELECT id FROM audit_responses WHERE audit_id = ? AND question_id = ?")
      .get(data.audit_id, data.question_id) as { id: string } | undefined;
    if (existing) return { id: existing.id };
    const id = await uid();
    dbi
      .prepare(
        "INSERT INTO audit_responses (id, audit_id, question_id, criteria_id) VALUES (?, ?, ?, ?)",
      )
      .run(id, data.audit_id, data.question_id, data.criteria_id);
    return { id };
  });

export const addPhoto = createServerFn({ method: "POST" })
  .inputValidator((d: { response_id: string; file_path: string; comment?: string }) => d)
  .handler(async ({ data }) => {
    const id = await uid();
    (await db())
      .prepare("INSERT INTO audit_response_photos (id, response_id, file_path, comment) VALUES (?, ?, ?, ?)")
      .run(id, data.response_id, data.file_path, data.comment ?? null);
    return { id };
  });

export const updatePhotoComment = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string; comment: string }) => d)
  .handler(async ({ data }) => {
    (await db())
      .prepare("UPDATE audit_response_photos SET comment = ? WHERE id = ?")
      .run(data.comment, data.id);
    return { ok: true };
  });

export const deletePhoto = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    const dbi = await db();
    const row = dbi
      .prepare("SELECT file_path FROM audit_response_photos WHERE id = ?")
      .get(data.id) as { file_path: string } | undefined;
    dbi.prepare("DELETE FROM audit_response_photos WHERE id = ?").run(data.id);
    if (row?.file_path) {
      try {
        const { unlinkSync } = await import("node:fs");
        const { join } = await import("node:path");
        const { UPLOADS_DIR } = await import("@/db/client.server");
        unlinkSync(join(UPLOADS_DIR, row.file_path));
      } catch {
        /* ignore */
      }
    }
    return { ok: true };
  });

// Reference to the previous audit for the same triplet — for each question, its
// last score + photos.
export const previousAuditContext = createServerFn({ method: "GET" })
  .inputValidator((d: { audit_id: string }) => d)
  .handler(async ({ data }) => {
    const dbi = await db();
    const cur = dbi.prepare("SELECT * FROM audits WHERE id = ?").get(data.audit_id) as Audit | undefined;
    if (!cur || !cur.site_id || !cur.uap_id || !cur.gap_id) return null;
    const prev = dbi
      .prepare(
        `SELECT * FROM audits
         WHERE site_id = ? AND uap_id = ? AND gap_id = ? AND id != ? AND status = 'completed'
         ORDER BY audit_date DESC, created_at DESC
         LIMIT 1`,
      )
      .get(cur.site_id, cur.uap_id, cur.gap_id, data.audit_id) as Audit | undefined;
    if (!prev) return null;
    const responses = dbi
      .prepare("SELECT * FROM audit_responses WHERE audit_id = ?")
      .all(prev.id) as Array<{
        id: string; question_id: string; score: number | null; comment: string | null;
      }>;
    const photos = dbi
      .prepare(
        `SELECT p.* FROM audit_response_photos p
         JOIN audit_responses r ON r.id = p.response_id
         WHERE r.audit_id = ?`,
      )
      .all(prev.id) as Array<{
        id: string; response_id: string; file_path: string; comment: string | null;
      }>;
    return { audit: prev, responses, photos };
  });

// ---------- Complete audit → global score + corrective actions ----------

export const completeAudit = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    const dbi = await db();
    const audit = dbi.prepare("SELECT * FROM audits WHERE id = ?").get(data.id) as Audit | undefined;
    if (!audit) return { global: null };
    const responses = dbi
      .prepare("SELECT id, criteria_id, score, suggested_action FROM audit_responses WHERE audit_id = ?")
      .all(data.id) as { id: string; criteria_id: string; score: number | null; suggested_action: string | null }[];
    const scored = responses.filter((r) => r.score != null) as { criteria_id: string; score: number }[];
    const byC: Record<string, { sum: number; n: number }> = {};
    scored.forEach((r) => {
      byC[r.criteria_id] ??= { sum: 0, n: 0 };
      byC[r.criteria_id].sum += r.score;
      byC[r.criteria_id].n += 1;
    });
    const avgs = Object.values(byC);
    const global = avgs.length ? avgs.reduce((s, x) => s + x.sum / x.n, 0) / avgs.length : null;
    dbi
      .prepare("UPDATE audits SET status = 'completed', global_score = ? WHERE id = ?")
      .run(global, data.id);

    // Turn each response's `suggested_action` (if non-empty) into a corrective action.
    // Dedupe by response_id so re-closing an audit does not duplicate rows.
    const existing = dbi
      .prepare("SELECT response_id FROM corrective_actions WHERE audit_id = ? AND response_id IS NOT NULL")
      .all(data.id) as { response_id: string }[];
    const existingSet = new Set(existing.map((e) => e.response_id));
    const ins = dbi.prepare(
      `INSERT INTO corrective_actions
         (id, audit_id, response_id, criteria_id, site_id, uap_id, gap_id, description, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'todo')`,
    );
    for (const r of responses) {
      const desc = (r.suggested_action ?? "").trim();
      if (!desc || existingSet.has(r.id)) continue;
      const id = await uid();
      ins.run(id, data.id, r.id, r.criteria_id, audit.site_id, audit.uap_id, audit.gap_id, desc);
    }
    return { global };
  });

// ---------- Corrective actions ----------

export const listActions = createServerFn({ method: "GET" }).handler(async () => {
  return (await db())
    .prepare(
      `SELECT ca.*,
              COALESCE(ca.site_id, a.site_id) AS site_id,
              COALESCE(ca.uap_id, a.uap_id)   AS uap_id,
              COALESCE(ca.gap_id, a.gap_id)   AS gap_id
       FROM corrective_actions ca
       LEFT JOIN audits a ON a.id = ca.audit_id
       ORDER BY ca.created_at DESC`,
    )
    .all() as Array<{
      id: string; audit_id: string | null; criteria_id: string | null;
      site_id: string | null; uap_id: string | null; gap_id: string | null;
      description: string; responsible: string | null; due_date: string | null;
      status: string; completed_at: number | null;
    }>;
});

export const createAction = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      description: string;
      site_id?: string | null;
      uap_id?: string | null;
      gap_id?: string | null;
      responsible?: string | null;
      due_date?: string | null;
    }) => d,
  )
  .handler(async ({ data }) => {
    const id = await uid();
    (await db())
      .prepare(
        `INSERT INTO corrective_actions
           (id, description, site_id, uap_id, gap_id, responsible, due_date, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'todo')`,
      )
      .run(
        id,
        data.description.trim(),
        data.site_id ?? null,
        data.uap_id ?? null,
        data.gap_id ?? null,
        data.responsible ?? null,
        data.due_date ?? null,
      );
    return { id };
  });

export const updateAction = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      id: string;
      description?: string;
      responsible?: string | null;
      due_date?: string | null;
      status?: string;
      site_id?: string | null;
      uap_id?: string | null;
      gap_id?: string | null;
    }) => d,
  )
  .handler(async ({ data }) => {
    const dbi = await db();
    const sets: string[] = [];
    const vals: unknown[] = [];
    if ("description" in data) { sets.push("description = ?"); vals.push(data.description); }
    if ("responsible" in data) { sets.push("responsible = ?"); vals.push(data.responsible ?? null); }
    if ("due_date" in data) { sets.push("due_date = ?"); vals.push(data.due_date ?? null); }
    if ("site_id" in data) { sets.push("site_id = ?"); vals.push(data.site_id ?? null); }
    if ("uap_id" in data) { sets.push("uap_id = ?"); vals.push(data.uap_id ?? null); }
    if ("gap_id" in data) { sets.push("gap_id = ?"); vals.push(data.gap_id ?? null); }
    if ("status" in data) {
      sets.push("status = ?");
      vals.push(data.status);
      if (data.status === "done") { sets.push("completed_at = ?"); vals.push(Date.now()); }
      else { sets.push("completed_at = ?"); vals.push(null); }
    }
    if (sets.length) {
      vals.push(data.id);
      dbi.prepare(`UPDATE corrective_actions SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
    }
    return { ok: true };
  });

export const deleteAction = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    (await db()).prepare("DELETE FROM corrective_actions WHERE id = ?").run(data.id);
    return { ok: true };
  });

// ---------- Dashboard payload ----------

export const dashboardData = createServerFn({ method: "GET" }).handler(async () => {
  const dbi = await db();
  const audits = dbi
    .prepare("SELECT * FROM audits ORDER BY audit_date DESC")
    .all() as Audit[];
  const actions = dbi.prepare("SELECT * FROM corrective_actions").all() as Array<{
    id: string; status: string; due_date: string | null;
  }>;
  const criteria = dbi
    .prepare("SELECT * FROM criteria ORDER BY order_index")
    .all() as { id: string; name: string }[];
  const responses = dbi
    .prepare("SELECT * FROM audit_responses")
    .all() as Array<{
      id: string; audit_id: string; criteria_id: string; question_id: string;
      score: number | null; comment: string | null;
    }>;
  const photos = dbi
    .prepare(
      `SELECT p.id, p.response_id, p.file_path, p.comment, r.audit_id
       FROM audit_response_photos p
       JOIN audit_responses r ON r.id = p.response_id
       ORDER BY p.created_at DESC`,
    )
    .all() as Array<{
      id: string; response_id: string; file_path: string; comment: string | null; audit_id: string;
    }>;
  const sites = dbi.prepare("SELECT * FROM sites ORDER BY name").all() as { id: string; name: string }[];
  const uaps = dbi.prepare("SELECT * FROM uaps ORDER BY name").all() as {
    id: string; site_id: string; name: string;
  }[];
  const gaps = dbi.prepare("SELECT * FROM gaps ORDER BY name").all() as {
    id: string; uap_id: string; name: string;
  }[];
  return { audits, actions, criteria, responses, photos, sites, uaps, gaps };
});
