/**
 * Acción de ejemplo: gestionar la reclamación de Obsydian para el ticket actual.
 *
 * Lógica:
 *   1. Mira si hay una reclamación abierta para el tracking del envío
 *   2. Si NO existe → devuelve un form para abrirla
 *   3. Si SÍ existe → devuelve tarjeta con estado actual + botones contextuales
 *   4. Si llega un sub_action 'create_claim' (del form) → crea la reclamación
 *
 * Reemplaza esto con tu propia lógica si vas a integrar otra API.
 */

import type { WismifyEventPayload } from '../lib/payload.js';
import type { WismifyResponse } from '../lib/blockkit.js';

const OBSYDIAN_BASE = 'https://api.obsydianai.com/v1';

function obsydianAuth(): string {
  const id = process.env.OBSYDIAN_API_KEY_ID ?? '';
  const secret = process.env.OBSYDIAN_API_KEY_SECRET ?? '';
  return 'Basic ' + Buffer.from(`${id}:${secret}`).toString('base64');
}

type ObsydianClaim = {
  id: string;
  claimNumber: string | null;
  status: string;
  totalAmount: number;
  aging: number;
  currency: string;
};

export async function handleObsydianClaim(payload: WismifyEventPayload): Promise<WismifyResponse> {
  // Sub-action del form de crear reclamación
  if (payload.sub_action?.action_id === 'create_claim') {
    return await createClaim(payload);
  }

  const tracking = payload.data.shipment?.tracking_number;
  if (!tracking) {
    return {
      blocks: [
        { type: 'heading', text: 'Sin tracking detectado' },
        { type: 'text', text: 'No encontramos el número de tracking en este ticket. Asegúrate de pedir el scope shipment.read en tu acción.' },
      ],
    };
  }

  // Busca claims existentes en Obsydian filtrando por carrier o tracking
  const res = await fetch(`${OBSYDIAN_BASE}/claims?limit=10`, {
    headers: { Authorization: obsydianAuth() },
  });
  if (!res.ok) {
    return {
      blocks: [
        { type: 'heading', text: 'Error contactando Obsydian' },
        { type: 'text', text: `${res.status} — revisa tus credenciales.` },
      ],
    };
  }
  const json = (await res.json()) as { data: (ObsydianClaim & { shipment?: { trackingNumber?: string } })[] };
  const match = json.data?.find((c) => c.shipment?.trackingNumber === tracking) ?? null;

  if (!match) {
    // No hay claim — devuelve form para crear
    return {
      blocks: [
        { type: 'heading', text: 'Sin reclamación abierta' },
        { type: 'field', label: 'Tracking', value: tracking },
        { type: 'field', label: 'Transportista', value: payload.data.shipment?.carrier ?? '—' },
        { type: 'divider' },
        {
          type: 'form',
          submit_action_id: 'create_claim',
          submit_label: 'Abrir reclamación',
          fields: [
            {
              type: 'select',
              name: 'type',
              label: 'Motivo',
              required: true,
              options: [
                { value: 'LOST', label: 'Paquete perdido' },
                { value: 'DAMAGED', label: 'Paquete dañado' },
              ],
            },
            {
              type: 'number',
              name: 'amount_cents',
              label: 'Importe a reclamar (céntimos)',
              required: true,
            },
            {
              type: 'textarea',
              name: 'description',
              label: 'Observaciones (opcional)',
            },
          ],
        },
      ],
    };
  }

  // Hay claim — muestra estado
  return claimStatusCard(match);
}

async function createClaim(payload: WismifyEventPayload): Promise<WismifyResponse> {
  const v = payload.sub_action?.form_values ?? {};
  const tracking = payload.data.shipment?.tracking_number;
  if (!tracking) {
    return { blocks: [{ type: 'text', text: 'Falta tracking.' }] };
  }

  const body = {
    shipment: {
      tracking_number: tracking,
      carrier: payload.data.shipment?.carrier ?? 'UPS',
      line_items: [
        {
          description: payload.data.ticket?.subject ?? 'Item',
          quantity: 1,
          unit_price: Number(v.amount_cents) || 0,
          currency: 'EUR',
        },
      ],
      origin: { postcode: '00000', country: 'ES' },
      destination: {
        postcode: '00000',
        country: payload.data.shipment?.destination?.country ?? 'ES',
        city: payload.data.shipment?.destination?.city ?? '—',
        address: payload.data.shipment?.destination?.address ?? '—',
        customer_name: payload.data.customer?.name ?? '—',
      },
    },
    incidence: {
      type: String(v.type ?? 'LOST'),
      description: String(v.description ?? ''),
      claimed_amount: Number(v.amount_cents) || 0,
      currency: 'EUR',
    },
  };

  const res = await fetch(`${OBSYDIAN_BASE}/claims`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: obsydianAuth() },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errText = await res.text();
    return {
      blocks: [
        { type: 'heading', text: 'No se pudo abrir la reclamación' },
        { type: 'text', text: errText.slice(0, 500) },
      ],
    };
  }
  const claim = (await res.json()) as ObsydianClaim;
  return claimStatusCard(claim);
}

function claimStatusCard(claim: ObsydianClaim): WismifyResponse {
  const tone = ({
    CREATED: 'neutral',
    UNDER_REVIEW: 'warning',
    PENDING_ACTION: 'warning',
    PENDING_REFUND: 'warning',
    RESOLVED: 'success',
    CLOSED: 'success',
    CANCELED: 'neutral',
    REJECTED: 'danger',
  } as const)[claim.status] ?? 'neutral';

  return {
    blocks: [
      { type: 'heading', text: `Reclamación ${claim.claimNumber ?? claim.id.slice(0, 12)}` },
      { type: 'status_badge', text: claim.status, tone },
      { type: 'field', label: 'Importe reclamado', value: `${(claim.totalAmount / 100).toFixed(2)} ${claim.currency}` },
      { type: 'field', label: 'Aging', value: `${claim.aging} días` },
      { type: 'divider' },
      {
        type: 'link',
        label: 'Ver detalle en Obsydian',
        url: `https://dashboard.obsydianai.com/claims/${claim.id}`,
      },
    ],
  };
}
