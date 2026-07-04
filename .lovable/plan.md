## Plan

Adapter le déploiement Docker de cette app sur la même logique que WealthTracker, qui fonctionne : un serveur TanStack Start SSR derrière nginx, piloté par supervisor.

### 1. Reprendre l’architecture Docker WealthTracker
- Remplacer le runtime Docker actuel `node:20-alpine` direct par un runtime Debian slim avec `nginx` + `supervisor`.
- Construire l’app avec `node:20-bookworm-slim` + Bun, comme WealthTracker.
- Copier `.output` dans l’image runtime.
- Exposer le port `80` côté conteneur, comme avant côté Unraid.

### 2. Ajouter les fichiers de runtime manquants
- Recréer `nginx.conf` pour proxyfier toutes les routes vers le serveur SSR sur `127.0.0.1:3000`.
- Ajouter `supervisord.conf` pour lancer :
  - le serveur Node SSR `.output/server/index.mjs`
  - nginx en frontal
- Garder les headers proxy nécessaires (`Host`, `X-Forwarded-*`, websocket upgrade, timeout).

### 3. Forcer proprement le build Node dans Vite/Nitro
- Ajouter dans `vite.config.ts` la config équivalente à WealthTracker :
  - `tanstackStart.server.entry = "server"`
  - `nitro.preset = "node-server"`
- Retirer la dépendance au seul `ENV NITRO_PRESET=node-server` dans le Dockerfile si la config Vite suffit.

### 4. Corriger l’écart `src/start.ts`
- Remettre `src/start.ts` comme WealthTracker : ne pas enregistrer `attachSupabaseAuth` dans `functionMiddleware`.
- Raison : dans le conteneur Docker, ce middleware peut appeler le client auth côté navigateur et casser les server functions si les variables publiques ne sont pas injectées exactement comme dans Lovable.

### 5. Dockerignore optionnel
- Ajouter un `.dockerignore` proche de WealthTracker si absent, pour éviter d’envoyer `node_modules`, `.env`, `.lovable`, logs, etc. au build Docker.

### À appliquer côté Unraid après rebuild
- Si on reprend exactement WealthTracker : mapping `port hôte -> 80 conteneur`.
- Exemple : `7818:80`, pas `7818:3000`.

## Résultat attendu
- Le conteneur affiche des logs supervisor/nginx + serveur SSR.
- Les routes `/`, `/audits`, `/machines`, etc. renvoient du HTML SSR complet, pas une page vide.
- Le comportement Docker devient cohérent avec WealthTracker.