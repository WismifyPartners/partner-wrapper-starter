/**
 * Tipos y validador del schema Block Kit de Wismify.
 *
 * Estos tipos definen LO ÚNICO que Wismify acepta como respuesta del wrapper.
 * Cualquier campo extra o tipo no listado se descarta o produce error 422.
 *
 * Usa estos tipos al construir tus respuestas para tener autocompletado y
 * detectar errores en tiempo de compilación.
 */

export type WismifyResponse = {
  blocks: Block[];
};

export type Block =
  | TextBlock
  | HeadingBlock
  | FieldBlock
  | DividerBlock
  | ListBlock
  | LinkBlock
  | ButtonBlock
  | StatusBadgeBlock
  | TimelineBlock
  | FormBlock;

export type TextBlock = { type: 'text'; text: string };
export type HeadingBlock = { type: 'heading'; text: string };
export type FieldBlock = {
  type: 'field';
  label: string;
  value: string;
  style?: 'default' | 'success' | 'warning' | 'danger';
};
export type DividerBlock = { type: 'divider' };
export type ListBlock = { type: 'list'; items: string[] };
export type LinkBlock = { type: 'link'; label: string; url: string };
export type ButtonBlock = {
  type: 'button';
  label: string;
  action_id: string;
  style?: 'default' | 'primary' | 'danger';
  confirm?: string;
};
export type StatusBadgeBlock = {
  type: 'status_badge';
  text: string;
  tone: 'neutral' | 'success' | 'warning' | 'danger';
};
export type TimelineBlock = {
  type: 'timeline';
  items: { time?: string; label: string; status?: 'done' | 'pending' | 'failed' }[];
};
export type FormField =
  | { type: 'text'; name: string; label: string; default?: string; required?: boolean }
  | { type: 'textarea'; name: string; label: string; default?: string; required?: boolean }
  | { type: 'number'; name: string; label: string; default?: number; required?: boolean }
  | { type: 'select'; name: string; label: string; options: { value: string; label: string }[]; default?: string; required?: boolean };
export type FormBlock = {
  type: 'form';
  submit_action_id: string;
  submit_label?: string;
  fields: FormField[];
};

/**
 * Validación rápida — no exhaustiva. Wismify hace la validación dura;
 * esto te ayuda a detectar errores antes de devolver.
 */
export function validateResponse(r: unknown): r is WismifyResponse {
  if (!r || typeof r !== 'object') return false;
  const obj = r as { blocks?: unknown };
  return Array.isArray(obj.blocks);
}
