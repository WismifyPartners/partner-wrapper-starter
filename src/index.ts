/**
 * Wismify Partner Wrapper — entry point.
 *
 * 1. Recibe webhooks firmados de Wismify
 * 2. Verifica la firma HMAC
 * 3. Despacha al handler de la acción correspondiente
 * 4. Devuelve Block Kit (validado por tipo)
 *
 * Para añadir una acción nueva: crear `src/actions/<nombre>.ts` con un
 * `export async function handler(payload): Promise<WismifyResponse>` y
 * registrarla en el switch de abajo.
 */

import 'dotenv/config';
import express from 'express';
import { verifyWismifySignature } from './lib/verify.js';
import type { WismifyEventPayload } from './lib/payload.js';
import type { WismifyResponse } from './lib/blockkit.js';

import { handleObsydianClaim } from './actions/obsydian-claim.js';
import { handleObsydianRefund } from './actions/obsydian-refund.js';

const app = express();
const PORT = parseInt(process.env.PORT ?? '3000', 10);
const WEBHOOK_SECRET = process.env.WISMIFY_WEBHOOK_SECRET ?? '';

if (!WEBHOOK_SECRET) {
  console.error('FATAL: WISMIFY_WEBHOOK_SECRET no está definido en .env');
  process.exit(1);
}

/**
 * Necesitamos el body raw (sin parsear por JSON) para verificar la firma.
 * Express con `express.json({ verify })` guarda el raw en req.rawBody.
 */
app.use(
  express.json({
    verify: (req: any, _res, buf) => { req.rawBody = buf.toString('utf8'); },
    limit: '256kb',
  }),
);

app.get('/health', (_req, res) => res.json({ ok: true, name: 'wismify-partner-wrapper' }));

/**
 * Endpoint de acción — Wismify hace POST aquí.
 * URL: https://tu-dominio.com/actions/:actionSlug
 *
 * Cada `actionSlug` mapea a un handler en `src/actions/`.
 */
app.post('/actions/:actionSlug', async (req, res) => {
  const rawBody = (req as any).rawBody as string;
  const signature = req.header('x-wismify-signature');

  const verify = verifyWismifySignature(rawBody, signature, WEBHOOK_SECRET);
  if (!verify.ok) {
    console.warn(`[verify] rejected: ${verify.reason}`);
    return res.status(401).json({ error: `signature ${verify.reason}` });
  }

  const payload = req.body as WismifyEventPayload;
  const slug = req.params.actionSlug;

  try {
    let response: WismifyResponse;
    switch (slug) {
      case 'obsydian-claim':
        response = await handleObsydianClaim(payload);
        break;
      case 'obsydian-refund':
        response = await handleObsydianRefund(payload);
        break;
      default:
        return res.status(404).json({ error: `unknown action: ${slug}` });
    }
    return res.json(response);
  } catch (err) {
    console.error(`[action:${slug}] error:`, err);
    return res.status(500).json({
      blocks: [
        { type: 'heading', text: 'Error interno' },
        { type: 'text', text: 'No pudimos completar la acción. Inténtalo más tarde.' },
      ],
    } satisfies WismifyResponse);
  }
});

/**
 * Endpoint de DASHBOARD (opcional) — Wismify hace POST aquí cuando el agente
 * abre la pestaña de tu app en el sidebar del tenant.
 *
 * Configúralo poniendo esta URL en el campo "Dashboard URL" del wizard.
 *
 * Recibe el mismo formato firmado, pero con `event: 'dashboard.load'`. Devuelve
 * Block Kit (igual que las acciones). Las sub-actions (buttons/forms) dentro
 * vuelven al endpoint `/actions/:slug` normal — usa el `action.id` que pongas
 * en el button para enrutar.
 */
app.post('/dashboard', async (req, res) => {
  const rawBody = (req as any).rawBody as string;
  const signature = req.header('x-wismify-signature');
  const verify = verifyWismifySignature(rawBody, signature, WEBHOOK_SECRET);
  if (!verify.ok) {
    return res.status(401).json({ error: `signature ${verify.reason}` });
  }

  // const payload = req.body as WismifyEventPayload;
  // Aquí carga tus estadísticas, métricas, formularios, etc.
  return res.json({
    blocks: [
      { type: 'heading', text: 'Tu dashboard' },
      { type: 'text', text: 'Aquí puedes mostrar KPIs, formularios, accesos rápidos…' },
      { type: 'divider' },
      { type: 'text', text: 'Edita `src/index.ts` → `app.post(\'/dashboard\', …)` para personalizar.' },
    ],
  } satisfies WismifyResponse);
});

app.listen(PORT, () => {
  console.log(`✓ Wismify partner wrapper listening on :${PORT}`);
});
