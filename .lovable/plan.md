# Refonte complète : SQLite locale, hiérarchie Site/UAP/Gap, photos, dashboard filtré

C'est un gros chantier — je préfère cadrer avant de coder. Voici le plan.

## 1. Stack backend : Supabase → SQLite locale

Suppression complète de Lovable Cloud / Supabase :
- Retrait de `@supabase/*`, `src/integrations/supabase/**`, `src/start.ts` middleware, `.env` VITE_SUPABASE_*.
- Ajout de `better-sqlite3` + `drizzle-orm` (léger, synchrone, éprouvé sur Bun/Node).
- Fichier DB : `/data/audit5s.db` (chemin via env `DB_PATH`, défaut `./data/audit5s.db` en dev).
- Toutes les lectures/écritures passent par des `createServerFn` (RPC TanStack Start) — plus de client Supabase côté navigateur.
- Init au boot : si le fichier DB n'existe pas, on le crée + on applique les migrations Drizzle automatiquement (au démarrage du serveur SSR).

**Auth** : Supabase auth disparaît. Comme l'app n'a actuellement aucune UI de login et que toutes les policies étaient `USING true`, je pars sur **pas d'auth** (single-tenant, réseau interne). Si tu veux une auth basique plus tard on l'ajoute.

## 2. Schéma DB (Drizzle)

```
sites        (id, name, created_at)
uaps         (id, site_id → sites, name, created_at)
gaps         (id, uap_id → uaps, name, code?, created_at)

criteria     (id, code, name, description, weight, order_index)  -- 5S seed
questions    (id, criteria_id → criteria, text, order_index)     -- seed

audits            (id, audit_date, site_id, uap_id, gap_id, auditor, status, global_score, created_at)
audit_responses   (id, audit_id, question_id, criteria_id, score, comment, gap_text, suggested_action, created_at)
audit_response_photos (id, response_id → audit_responses, file_path, comment, created_at)

corrective_actions (id, audit_id, criteria_id, description, responsible, due_date, status, completed_at, created_at)
```

Suppression : `workshops`, `zones`, `machines`, `audit_machines`. Seed initial : les 5 critères 5S + questions (identique à l'existant).

## 3. Photos : upload dans /data/uploads

- Server route `POST /api/uploads` (multipart) → écrit dans `/data/uploads/<uuid>.<ext>`, retourne le chemin relatif.
- Server route `GET /api/uploads/:filename` → sert le fichier (streaming).
- Table `audit_response_photos` : plusieurs photos par item d'audit, chacune avec commentaire.
- Volume Docker `/data` = DB + uploads persistants.

## 4. UI — pages modifiées

**Suppression** des onglets `Ateliers` et `Machines` (fichiers `src/routes/workshops.tsx`, `src/routes/machines.tsx`) et de leurs liens dans `AppLayout`.

**Paramètres** (`src/routes/settings.tsx`) : nouvelle UI avec 3 sections CRUD imbriquées :
- Sites : liste + create/edit/delete inline
- UAPs (filtrées par site sélectionné)
- Gaps (filtrés par UAP sélectionnée)

**Audits** :
- Nouvel audit : 3 selects en cascade Site → UAP → Gap (obligatoires) + auditeur + date.
- Éditeur (`audits.$id.tsx`) : plus de sélection machines. Pour chaque question :
  - Score 0–5
  - Textes : commentaire, écart, action suggérée
  - **Upload multi-photos** avec commentaire par photo (drag-drop + preview)
  - **Dépliant "Dernier audit"** (collapsible) : si un audit précédent existe pour le même triplet Site/UAP/Gap, on affiche le score de cet item et ses photos. Requête lookup par question_id + gap_id, tri desc.

**Dashboard** (`src/routes/index.tsx`) :
- Barre de filtres : multi-select Site / UAP / Gap (tout coché par défaut) + preset période (S-1, M-1, A-1, Tout).
- Tous les KPIs, radar, timeline, classement recalculés selon filtre.
- **Nouvelle section "Galerie photos"** en bas : grid responsive des photos des audits filtrés, avec au survol le commentaire + lien vers l'audit. Lightbox au clic.

## 5. Docker

- `Dockerfile` : `VOLUME /data`, création `/data/uploads` au démarrage, `DB_PATH=/data/audit5s.db`.
- `better-sqlite3` a des bindings natifs : build stage installe `python3 make g++`, runtime stage seulement les .node.
- Compose/Unraid : mount `/mnt/user/appdata/audit5s:/data`.

## 6. Ordre d'exécution (un seul batch)

1. `bun add better-sqlite3 drizzle-orm drizzle-kit @types/better-sqlite3`
2. `bun remove @supabase/supabase-js` + suppression `src/integrations/supabase/*`
3. Création `src/db/schema.ts`, `src/db/client.server.ts`, `src/db/migrate.server.ts`, `src/db/seed.server.ts`
4. Création `src/lib/*.functions.ts` (server fns : sites, uaps, gaps, audits, responses, photos, dashboard)
5. Routes upload : `src/routes/api/uploads.ts`, `src/routes/api/uploads.$filename.ts`
6. Réécriture `src/routes/settings.tsx`, `audits.index.tsx`, `audits.$id.tsx`, `index.tsx`, `actions.tsx`
7. Suppression `workshops.tsx`, `machines.tsx` + refactor `AppLayout`
8. Dockerfile / supervisord update pour créer `/data/uploads`

## Points de vigilance

- **Perte des données actuelles** : tu as validé "repartir à zéro".
- **better-sqlite3 sur Alpine** : je reste sur `node:20-bookworm-slim` (déjà en place).
- **SSR + SQLite** : DB ouverte une seule fois par process (singleton dans un `.server.ts`).
- **Pas d'auth** : l'app sera accessible à quiconque atteint le port. À sécuriser au niveau réseau (VPN, reverse proxy avec basic auth) ou on rajoute une auth plus tard.

---

Je pars là-dessus dès approbation. Compte ~10-15 fichiers créés/modifiés dans un batch.