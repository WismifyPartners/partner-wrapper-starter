/**
 * Verificación de firma HMAC-SHA256 de los webhooks de Wismify.
 *
 * Cabeceras que Wismify envía:
 *   X-Wismify-Signature: t=<unix>,v1=<hex>
 *   X-Wismify-Timestamp: <unix>
 *
 * Para verificar: HMAC-SHA256(secret, `${timestamp}.${rawBody}`) === v1
 *
 * Tolerancia temporal: 5 minutos (rechazamos firmas más antiguas — replay protection).
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

const TOLERANCE_SEC = 300;

export type VerifyResult =
  | { ok: true }
  | { ok: false; reason: 'missing_header' | 'malformed' | 'expired' | 'invalid_signature' };

export function verifyWismifySignature(
  rawBody: string,
  signatureHeader: string | undefined,
  secret: string,
): VerifyResult {
  if (!signatureHeader) return { ok: false, reason: 'missing_header' };

  const parts = Object.fromEntries(
    signatureHeader.split(',').map((p) => {
      const [k, v] = p.split('=');
      return [k.trim(), v?.trim() ?? ''];
    }),
  );

  const ts = parseInt(parts.t ?? '', 10);
  const sigHex = parts.v1;
  if (!Number.isFinite(ts) || !sigHex) return { ok: false, reason: 'malformed' };

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > TOLERANCE_SEC) return { ok: false, reason: 'expired' };

  const expected = createHmac('sha256', secret).update(`${ts}.${rawBody}`).digest();
  let provided: Buffer;
  try {
    provided = Buffer.from(sigHex, 'hex');
  } catch {
    return { ok: false, reason: 'malformed' };
  }
  if (provided.length !== expected.length) return { ok: false, reason: 'invalid_signature' };
  if (!timingSafeEqual(expected, provided)) return { ok: false, reason: 'invalid_signature' };

  return { ok: true };
}
