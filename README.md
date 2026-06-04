# Link App

Acortador de enlaces con panel de administracion, redirecciones por slug, dominios personalizados y contador de clics.

## Desarrollo local

```bash
npm install
npm run dev
```

La app usa `data/store.json` como almacenamiento local durante desarrollo.

## Cloudflare

El despliegue full-stack de Next.js se realiza con OpenNext sobre Cloudflare Workers. El almacenamiento persistente usa el KV namespace `LINK_APP_STORE`.

```bash
npm run typecheck
npm run build
npm run preview
npm run deploy
```

Worker actual:

```text
https://link-app.comunikoo.workers.dev
```
