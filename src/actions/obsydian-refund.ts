/**
 * Acción simple: marcar reembolso aceptado. Solo necesita ticket.read.
 * Plantilla minimal para ver cómo se ve una acción "fire and forget".
 */

import type { WismifyEventPayload } from '../lib/payload.js';
import type { WismifyResponse } from '../lib/blockkit.js';

export async function handleObsydianRefund(payload: WismifyEventPayload): Promise<WismifyResponse> {
  const ticketId = payload.data.ticket?.id ?? '—';

  // Aquí harías la llamada a tu API para marcar el reembolso.
  // Ejemplo: await fetch(`${OBSYDIAN_BASE}/refunds`, { ... })

  return {
    blocks: [
      { type: 'heading', text: 'Reembolso registrado' },
      { type: 'status_badge', text: 'OK', tone: 'success' },
      { type: 'field', label: 'Ticket', value: ticketId },
      { type: 'text', text: 'El cliente ha sido marcado como reembolsado en Obsydian. El proceso de devolución bancaria tarda 3-5 días hábiles.' },
    ],
  };
}
