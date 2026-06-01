# SEO Agency App

Centro de control SEO con IA para agencias con clientes en Tienda Nube.

## Stack
- **Backend**: Node.js 24, Express 5, TypeScript
- **DB**: PostgreSQL (Neon) + Drizzle ORM
- **IA**: Claude API (Haiku 4.5 + Sonnet 4.5)
- **Deploy**: Render + GitHub

## Servicios
- `apps/api` — Backend Express
- `apps/web` — Frontend React (próximamente)
- `packages/db` — Schema y cliente de DB

## Automatización SEO

El flujo cierra el loop completo: **sync → score → generar (IA) → aplicar en Tienda Nube**.

Cada tienda define su `automation_mode`:

| Modo | Qué hace el cron diario |
|------|--------------------------|
| `manual` | Nada automático — solo acciones desde la UI |
| `suggest` | Sincroniza y genera sugerencias (quedan `pending` para aprobar) |
| `auto` | Sincroniza, genera y **aplica** los cambios directo en Tienda Nube |

### Endpoints clave
- `PATCH /api/stores/:storeId/settings` — configurar `automation_mode` / `preferred_model`
- `POST /api/stores/:storeId/optimize` — lanzar optimización masiva (job en lote)
- `GET  /api/jobs/:jobId` — progreso del job
- `POST /api/stores/:storeId/versions/:versionId/apply` — aprobar y escribir en Tienda Nube
- `POST /api/stores/:storeId/versions/:versionId/reject` — descartar una sugerencia

El scheduler corre a las 03:00 (configurable con `AUTOMATION_CRON`).

## Variables de entorno
Copiá `.env.example` a `.env` y completá los valores.
