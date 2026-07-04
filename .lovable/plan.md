## Problème

L'app est **TanStack Start (SSR)**, pas une SPA statique. Le `Dockerfile` actuel :
1. Copie les assets JS/CSS dans nginx
2. Génère un `index.html` bidon avec `<body></body>` vide

Résultat : le JS se charge mais il n'y a **aucun élément à hydrater** (TanStack Start rend `<html><body>` via `shellComponent`, il n'y a pas de `<div id="root">`). Page blanche garantie.

Nginx statique **ne peut pas** servir cette app — il faut un runtime Node/Bun qui exécute le serveur SSR généré dans `.output/server/index.mjs`.

## Solution : Docker Node + SSR (garder le même workflow build/push)

### 1. Nouveau `Dockerfile`

```dockerfile
# Build stage
FROM oven/bun:1-alpine AS builder
WORKDIR /app
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

# Runtime stage
FROM oven/bun:1-alpine
WORKDIR /app
COPY --from=builder /app/.output ./.output
COPY --from=builder /app/package.json ./
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
EXPOSE 3000
CMD ["bun", "run", ".output/server/index.mjs"]
```

Note : le build TanStack Start (nitro) produit `.output/server/index.mjs` (serveur) + `.output/public` (assets). Le serveur sert les deux.

### 2. Supprimer `nginx.conf`

Plus utilisé.

### 3. Workflow `.github/workflows/docker.yml`

Aucun changement — le build & push d'image continue à fonctionner. Le port exposé passe de `80` → `3000` (à répercuter dans le mapping de port du conteneur côté Unraid : `-p 7818:3000`).

### 4. Variables d'environnement runtime

Sur le conteneur (Unraid), ajouter :
- `VITE_SUPABASE_URL=https://fxsakgzcmonokvlwlwyz.supabase.co`
- `VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_BfU4re-LBCXeZlp2UhXR1w_gCi8PCzo`
- `SUPABASE_URL=…` et `SUPABASE_PUBLISHABLE_KEY=…` (mêmes valeurs, côté SSR)

Sans ça, la page rendra mais les appels Supabase échoueront.

## Ce que ça corrige

- Page blanche → le SSR renvoie un HTML complet, React s'hydrate
- Routing SSR (deep-link `/audits`, `/audits/:id`) fonctionne côté serveur
- Les server functions (si un jour ajoutées) continueront de marcher

## Alternative rejetée

Convertir l'app en SPA pure (Vite `build` classique, sans TanStack Start SSR) : demande de réécrire `router.tsx`, `__root.tsx`, retirer `shellComponent`, changer la config Vite. Beaucoup plus invasif pour un simple problème de déploiement.