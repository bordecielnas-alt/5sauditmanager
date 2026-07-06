import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";

const DB_PATH = process.env.DB_PATH ?? "./data/audit5s.db";
export const UPLOADS_DIR = process.env.UPLOADS_DIR ?? "./data/uploads";

const DEFAULT_5S = [
  {
    code: "1S",
    name: "Seiri - Trier",
    qs: [
      "Les objets inutiles sont-ils identifiés et retirés du poste ?",
      "Les zones de stockage sont-elles clairement définies ?",
      "N'y a-t-il aucun matériel obsolète en zone ?",
    ],
  },
  {
    code: "2S",
    name: "Seiton - Ranger",
    qs: [
      "Chaque outil a-t-il une place définie et identifiée ?",
      "Les emplacements sont-ils marqués (ombres, étiquettes) ?",
      "Les circulations sont-elles dégagées ?",
    ],
  },
  {
    code: "3S",
    name: "Seiso - Nettoyer",
    qs: [
      "Les postes de travail sont-ils propres ?",
      "Les sources de salissures sont-elles traitées ?",
      "Le matériel de nettoyage est-il disponible ?",
    ],
  },
  {
    code: "4S",
    name: "Seiketsu - Standardiser",
    qs: [
      "Les standards visuels sont-ils affichés et à jour ?",
      "Les procédures 5S sont-elles connues de l'équipe ?",
      "Les responsabilités sont-elles définies ?",
    ],
  },
  {
    code: "5S",
    name: "Shitsuke - Respecter",
    qs: [
      "Le respect des standards est-il audité régulièrement ?",
      "L'amélioration continue est-elle formalisée ?",
      "Les écarts sont-ils traités avec un plan d'actions ?",
    ],
  },
];

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sites (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE TABLE IF NOT EXISTS uaps (
      id TEXT PRIMARY KEY,
      site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE TABLE IF NOT EXISTS gaps (
      id TEXT PRIMARY KEY,
      uap_id TEXT NOT NULL REFERENCES uaps(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      code TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE TABLE IF NOT EXISTS criteria (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      weight REAL NOT NULL DEFAULT 1,
      order_index INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS questions (
      id TEXT PRIMARY KEY,
      criteria_id TEXT NOT NULL REFERENCES criteria(id) ON DELETE CASCADE,
      text TEXT NOT NULL,
      order_index INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS audits (
      id TEXT PRIMARY KEY,
      audit_date TEXT NOT NULL,
      site_id TEXT REFERENCES sites(id) ON DELETE SET NULL,
      uap_id TEXT REFERENCES uaps(id) ON DELETE SET NULL,
      gap_id TEXT REFERENCES gaps(id) ON DELETE SET NULL,
      auditor TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'draft',
      global_score REAL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE TABLE IF NOT EXISTS audit_responses (
      id TEXT PRIMARY KEY,
      audit_id TEXT NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
      question_id TEXT NOT NULL,
      criteria_id TEXT NOT NULL,
      score INTEGER,
      comment TEXT,
      gap_text TEXT,
      suggested_action TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      UNIQUE(audit_id, question_id)
    );
    CREATE TABLE IF NOT EXISTS audit_response_photos (
      id TEXT PRIMARY KEY,
      response_id TEXT NOT NULL REFERENCES audit_responses(id) ON DELETE CASCADE,
      file_path TEXT NOT NULL,
      comment TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE TABLE IF NOT EXISTS corrective_actions (
      id TEXT PRIMARY KEY,
      audit_id TEXT REFERENCES audits(id) ON DELETE CASCADE,
      criteria_id TEXT,
      description TEXT NOT NULL,
      responsible TEXT,
      due_date TEXT,
      status TEXT NOT NULL DEFAULT 'todo',
      completed_at INTEGER,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE INDEX IF NOT EXISTS idx_responses_audit ON audit_responses(audit_id);
    CREATE INDEX IF NOT EXISTS idx_actions_audit ON corrective_actions(audit_id);
    CREATE INDEX IF NOT EXISTS idx_photos_response ON audit_response_photos(response_id);
    CREATE INDEX IF NOT EXISTS idx_audits_triplet ON audits(site_id, uap_id, gap_id);
    CREATE INDEX IF NOT EXISTS idx_uaps_site ON uaps(site_id);
    CREATE INDEX IF NOT EXISTS idx_gaps_uap ON gaps(uap_id);
  `);
}

function seed(db: Database.Database) {
  const row = db.prepare("SELECT COUNT(*) as n FROM criteria").get() as { n: number };
  if (row.n > 0) return;
  const insC = db.prepare(
    "INSERT INTO criteria (id, code, name, order_index) VALUES (?, ?, ?, ?)",
  );
  const insQ = db.prepare(
    "INSERT INTO questions (id, criteria_id, text, order_index) VALUES (?, ?, ?, ?)",
  );
  const tx = db.transaction(() => {
    DEFAULT_5S.forEach((c, i) => {
      const cid = randomUUID();
      insC.run(cid, c.code, c.name, i);
      c.qs.forEach((t, j) => insQ.run(randomUUID(), cid, t, j));
    });
  });
  tx();
}

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;
  mkdirSync(dirname(DB_PATH), { recursive: true });
  mkdirSync(UPLOADS_DIR, { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  initSchema(db);
  // Additive migrations (idempotent)
  const cols = db.prepare("PRAGMA table_info(corrective_actions)").all() as { name: string }[];
  const colNames = new Set(cols.map((c) => c.name));
  if (!colNames.has("response_id")) db.exec("ALTER TABLE corrective_actions ADD COLUMN response_id TEXT");
  if (!colNames.has("site_id")) db.exec("ALTER TABLE corrective_actions ADD COLUMN site_id TEXT");
  if (!colNames.has("uap_id")) db.exec("ALTER TABLE corrective_actions ADD COLUMN uap_id TEXT");
  if (!colNames.has("gap_id")) db.exec("ALTER TABLE corrective_actions ADD COLUMN gap_id TEXT");
  seed(db);
  _db = db;
  return db;
}

export { randomUUID };
