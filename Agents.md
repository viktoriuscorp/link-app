# Agents.md

Este documento es la memoria operativa de Link App. Debe actualizarse cada vez que se haga un cambio relevante, una version nueva, un despliegue o una decision tecnica que afecte al producto.

## Producto

Link App es una aplicacion privada tipo Bitly para crear enlaces cortos, redirigirlos a URLs externas, contar clics y preparar el uso de dominios personalizados.

Objetivo del MVP:

- Crear links cortos desde un panel web.
- Elegir slug manual o generar uno automaticamente.
- Redirigir `/:slug` hacia la URL destino.
- Contabilizar clics y ultimo clic.
- Gestionar dominios personalizados.
- Verificar dominios o marcarlos manualmente en modo desarrollo.
- Desplegar la app full-stack en Cloudflare.

## Repositorio

- Local: `/Users/victor/Documents/Link App`
- GitHub: `https://github.com/viktoriuscorp/link-app`
- Rama principal: `main`
- Version inicial etiquetada: `v1-link-up`
- Versiones etiquetadas: `v1-link-up`, `v2-link-up`, `v3-link-up`

## Produccion

- URL actual: `https://link-app.comunikoo.workers.dev`
- Dominio custom configurado: `https://dayibiza.link`
- Alias custom configurado: `https://www.dayibiza.link`
- Estado del dominio custom el 2026-06-04: activo en Cloudflare Workers.
- HTTPS: activo y verificado en `dayibiza.link`, `www.dayibiza.link` y `link-app.comunikoo.workers.dev`.
- Seguridad HTTPS: `http://dayibiza.link/*` redirige a `https://dayibiza.link/*` con `308`; las respuestas HTTPS incluyen `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`.
- Certificado verificado el 2026-06-04: `dayibiza.link`, TLSv1.3, issuer `Google Trust Services`, HTTP/2.
- Version Cloudflare actual: `b3309849-bc54-49b8-bd78-2fe20c851b23`
- Plataforma: Cloudflare Workers con OpenNext.
- Motivo: la app usa Next.js full-stack con route handlers, redirecciones dinamicas y persistencia. Cloudflare Pages queda mejor para sitios estaticos; para esta app se usa Workers/OpenNext.
- KV namespace: `LINK_APP_STORE`
- KV namespace id actual: `da149d04556f4fd99d148aaf04b41aea`
- Worker name: `link-app`

## Stack

- Next.js `16.2.7`
- React `19`
- TypeScript
- Zod para validacion
- Nanoid para IDs/slugs
- Lucide React para iconos
- OpenNext Cloudflare para adaptar Next.js a Workers
- Wrangler para preview/deploy
- Cloudflare KV para persistencia en produccion
- JSON local en `data/store.json` para desarrollo local

## Comandos

Instalar dependencias:

```bash
npm install
```

Desarrollo local con Next:

```bash
npm run dev
```

Validaciones:

```bash
npm run typecheck
npm run build
```

Preview en runtime Cloudflare:

```bash
npm run preview
```

Deploy a Cloudflare:

```bash
npm run deploy
```

Subir a GitHub:

```bash
git push
```

Subir tags:

```bash
git push origin v1-link-up
```

## Estructura Importante

- `src/app/page.tsx`: entrada del panel web. Forzada como dinamica con `dynamic = "force-dynamic"` para leer datos actuales.
- `src/app/login/page.tsx`: pantalla de acceso.
- `src/app/register/page.tsx`: redirige a `/login`; el registro publico esta desactivado.
- `src/components/auth-form.tsx`: formulario compartido de login/registro.
- `src/components/dashboard.tsx`: interfaz principal de links, dominios, copiado y acciones.
- `src/app/[slug]/route.ts`: redireccion dinamica de enlaces cortos.
- `src/app/api/auth/login/route.ts`: crea sesion de usuario.
- `src/app/api/auth/logout/route.ts`: cierra sesion actual.
- `src/app/api/auth/register/route.ts`: devuelve `403`; el registro publico esta desactivado.
- `src/app/api/api-keys/route.ts`: lista y crea API Keys desde el panel.
- `src/app/api/api-keys/[id]/route.ts`: revoca API Keys.
- `src/app/api/v1/links/route.ts`: API publica para crear enlaces con `Authorization: Bearer <API_KEY>`.
- `src/app/api/snapshot/route.ts`: snapshot de links y dominios.
- `src/app/api/users/route.ts`: lista usuarios del workspace.
- `src/app/api/links/route.ts`: listar y crear links.
- `src/app/api/links/[id]/route.ts`: actualizar o borrar links.
- `src/app/api/domains/route.ts`: listar y crear dominios.
- `src/app/api/domains/[id]/route.ts`: borrar dominios.
- `src/app/api/domains/[id]/verify/route.ts`: verificar dominios.
- `src/middleware.ts`: Edge Middleware para forzar HTTP -> HTTPS fuera de localhost y anadir HSTS. Se usa `middleware.ts` aunque Next 16 recomiende `proxy.ts` porque OpenNext Cloudflare 1.19.11 no soporta Node Middleware de `proxy.ts`.
- `src/lib/auth.ts`: registro, login, sesiones, cookie HTTP-only y usuario actual.
- `src/lib/store.ts`: capa de persistencia. Usa Cloudflare KV si existe binding; si no, JSON local.
- `src/lib/validators.ts`: esquemas Zod.
- `src/lib/config.ts`: nombre, URL base y target CNAME.
- `wrangler.jsonc`: configuracion de Cloudflare Workers, assets y KV.
- `open-next.config.ts`: configuracion OpenNext.
- `public/_headers`: cache immutable para assets Next.

## Persistencia

El almacenamiento se guarda como snapshot completo bajo la clave:

```text
link-app:store
```

Modelo:

- `domains`: dominios personalizados.
- `links`: enlaces cortos.
- `clickEvents`: eventos de clic para analitica.
- `users`: usuarios registrados de forma privada.
- `sessions`: sesiones activas con expiracion.
- `apiKeys`: claves API hasheadas, con prefijo visible, scopes, ultimo uso y revocacion.

Desde V3, las APIs del panel requieren sesion. La ruta publica `/:slug` queda sin autenticacion para que los enlaces cortos sigan redirigiendo a cualquier visitante.

Las integraciones externas usan API Keys y pueden crear links por:

```text
POST /api/v1/links
Authorization: Bearer <API_KEY>
```

La API Key completa solo se muestra una vez al crearla. En persistencia solo se guarda `tokenHash` y `prefix`.

En desarrollo local, si no hay contexto Cloudflare, se usa:

```text
data/store.json
```

Ese archivo esta ignorado por Git.

## Dominios Personalizados

Flujo previsto:

1. El usuario anade un dominio o subdominio, por ejemplo `go.tumarca.com`.
2. La app muestra el CNAME esperado.
3. El usuario configura ese CNAME en su proveedor DNS.
4. La app verifica el dominio.
5. El dominio queda disponible para crear links.

Configuracion actual:

- `CNAME_TARGET` viene de `SHORTLINK_CNAME_TARGET` o `NEXT_PUBLIC_SHORTLINK_CNAME_TARGET`.
- Si no se define, usa `links.example.com`.
- En local se intenta verificar con `dns/promises`.
- En Cloudflare la verificacion automatica esta desactivada por ahora; se puede marcar con el boton `Dev`.

Pendiente recomendado:

- Cambiar la verificacion DNS en Cloudflare por DNS-over-HTTPS.
- Definir el dominio final real y actualizar `SHORTLINK_CNAME_TARGET`.
- Asociar un custom domain al Worker desde Cloudflare.

## Despliegue Cloudflare

Se eligio OpenNext porque Cloudflare documenta que Next.js full-stack con SSR, route handlers y server behavior debe correr en Workers con el adaptador.

Archivos clave:

- `wrangler.jsonc`
- `open-next.config.ts`
- `next.config.ts`

El deploy actual fue verificado con:

- `npm run typecheck`
- `npm run build`
- `npx opennextjs-cloudflare build`
- Smoke test en produccion: crear link, comprobar redireccion `307`, borrar link y confirmar snapshot vacio.

## Versiones

### v1-link-up

Commit: `0e7a20f`

Contenido:

- MVP inicial de Link App.
- Panel para crear links.
- Gestion de dominios.
- Redireccion por slug.
- Conteo de clics.
- Persistencia local JSON.
- Tag local y remoto `v1-link-up`.

### Cloudflare deployment

Commit: `a917f7e`

Contenido:

- Adaptacion a Cloudflare Workers con OpenNext.
- KV namespace `LINK_APP_STORE`.
- Fallback local para desarrollo.
- Configuracion Wrangler.
- Headers de cache para assets.
- README con comandos principales.
- Deploy en `https://link-app.comunikoo.workers.dev`.

### v2-link-up

Estado: desplegada en Cloudflare el 2026-06-04.

Commit base: `cdb087c`

Cloudflare version id: `101a812d-30ae-45c2-bac0-fb5f481cf83a`

Contenido:

- Analitica por evento de clic.
- Conteo de clics unicos por hash de visitante.
- Captura de pais, dispositivo, navegador y referrer.
- QR dinamico descargable por link.
- Edicion inline de links.
- Edicion del slug para cambiar la URL corta.
- Activar/pausar links.
- Tags y campanas.
- UTM builder en el formulario de creacion.
- Expiracion por fecha.
- Expiracion por limite de clics.
- URL fallback para links pausados o expirados.
- Buscador/filtro de links.
- Normalizacion de datos V1 al leer el store para evitar migraciones duras.

Validacion:

- `npm run typecheck`
- `npm run build`
- `npm run deploy`
- Produccion `https://link-app.comunikoo.workers.dev` muestra `Version 2 local`.
- `dayibiza.link` muestra V2 cuando se fuerza resolucion contra Cloudflare.
- Smoke test produccion: crear link V2, comprobar redireccion `307` y borrar link de prueba.
- Pendiente externo: DNS publico de `dayibiza.link` todavia puede tardar en resolver tras el registro.

### v3-link-up

Estado: desplegada en Cloudflare el 2026-06-04.

Cloudflare version id: `b3309849-bc54-49b8-bd78-2fe20c851b23`

Contenido:

- Redisenio del panel hacia un dashboard tipo Linkly/Bitly.
- Sidebar fija con workspace, navegacion principal, uso de links ilimitados y logout.
- Vistas separadas: crear enlace, enlaces, Analytics, usuarios, dominios, importacion masiva y configuracion.
- Vista de crear enlace con panel de destino, slug/dominio, nombre interno, UTMs, campana, tags, expiracion, limite de clics, fallback y previsualizacion lateral.
- Vista de enlaces con tabla densa, buscador, exportacion visual y acciones existentes al expandir cada fila.
- La antigua vista de trafico queda sustituida por Analytics.
- Vista Analytics tipo Bitly con filtros por periodo y link.
- Modulos Analytics: KPIs, interacciones en el tiempo, links top, referentes, ubicacion, dispositivos, navegadores y campanas.
- Exportacion CSV de eventos filtrados desde Analytics.
- Seccion API Keys para generar y revocar claves de integracion.
- Endpoint remoto `POST /api/v1/links` para crear enlaces desde MCP, n8n, CRMs u otros proyectos.
- Las API Keys se guardan hasheadas y solo se revela el token completo una vez.
- Cada API Key tiene scope `links:create`, prefijo visible y `lastUsedAt`.
- Vista de usuarios con listado del workspace.
- Vista de dominios inspirada en el flujo de conectar dominio propio.
- Login con cookie HTTP-only `link_app_session`.
- Registro publico desactivado: `/register` redirige a `/login` y `/api/auth/register` devuelve `403`.
- APIs del dashboard protegidas por sesion.
- Los slugs publicos siguen funcionando sin login.
- HTTP forzado a HTTPS en produccion.
- HSTS activado para dominios no locales.

Validacion local:

- `npm run typecheck`
- `npm run build`
- `http://localhost:3000/` redirige a `/login` sin sesion.
- Login local probado con usuario de desarrollo.
- Crear enlace por API autenticada probado correctamente.
- `/api/snapshot` devuelve `401` sin sesion.
- Slug publico probado con redireccion `307` sin sesion.
- Captura visual del navegador integrado intentada, pero el mecanismo de captura quedo bloqueado en esta sesion; se valido navegacion por DOM de las vistas principales.

Validacion produccion:

- `npm run deploy`
- `https://dayibiza.link/login` devuelve `200`.
- `https://www.dayibiza.link/login` devuelve `200`.
- `https://link-app.comunikoo.workers.dev/login` devuelve `200`.
- `http://dayibiza.link/login` redirige a `https://dayibiza.link/login` con `308`.
- `https://dayibiza.link/` redirige a `/login` con `307` si no hay sesion.
- `https://dayibiza.link/api/snapshot` devuelve `401` sin sesion.
- TLS verificado con `curl -vI`: TLSv1.3, certificado para `dayibiza.link`, issuer `Google Trust Services`.
- Bundle de produccion verificado con navegacion `Analytics` y textos de modulos desplegados.
- API Keys validado en local: crear key, crear link remoto con `Bearer`, recibir `shortUrl`, redireccion publica `307`, `401` sin key y `401` tras revocar.
- API Keys desplegado en Cloudflare: `POST https://dayibiza.link/api/v1/links` devuelve `401` sin Bearer, HTTP redirige a HTTPS con `308`, HTTPS conserva HSTS.
- App privada: login sin enlace de registro, `/register` redirige a `/login`, `/api/auth/register` devuelve `403`.

Pendiente despues de desplegar V3:

- Separar datos por usuario/workspace antes de multiusuario real.
- Implementar invitaciones reales desde la vista de usuarios.
- Revisar UX responsive en navegador con captura estable.
- Si se anade cuota de links, debe ser editable/configurable; por defecto no hay limite de links.

## Reglas Para Futuras Sesiones

Antes de cambiar codigo:

1. Leer este archivo.
2. Revisar `git status --short --branch`.
3. Identificar si el cambio afecta producto, infraestructura, datos o versionado.

Despues de cambiar codigo:

1. Actualizar este archivo si cambia arquitectura, comandos, despliegue, variables, dominio, almacenamiento, version o flujo de producto.
2. Ejecutar al menos:

```bash
npm run typecheck
```

3. Si afecta runtime o despliegue, ejecutar tambien:

```bash
npm run build
npx opennextjs-cloudflare build
```

4. Si se despliega, apuntar aqui la URL, version de Cloudflare y resultado del smoke test.
5. Hacer commit con un mensaje claro.
6. Subir a GitHub.

## Pendientes

- Configurar dominio real de produccion.
- Decidir dominio corto comercial.
- Cambiar la verificacion DNS en Cloudflare a DNS-over-HTTPS.
- Separar datos por usuario/equipo.
- Implementar invitaciones y permisos reales.
- Mejorar analitica: series temporales avanzadas y exportaciones reales.
- Anadir pagina de error publica para slug no encontrado.
- Anadir favicon/iconos.
- Revisar vulnerabilidades moderadas reportadas por `npm audit` cuando Next/PostCSS publiquen una ruta de actualizacion sin downgrade rompedor.
