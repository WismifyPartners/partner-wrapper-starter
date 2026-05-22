/**
 * Tipos del payload que Wismify envía a tu wrapper.
 *
 * Wismify firma con HMAC-SHA256 el body raw y lo manda en la cabecera
 * `X-Wismify-Signature`. Los datos vienen filtrados por los `scopes` que
 * tu acción declaró — no recibes nada que no hayas pedido.
 */

export type WismifyEventPayload = {
  /** Siempre "action.invoked" para invocaciones de acciones. */
  event: 'action.invoked';

  /** Acción invocada. Para sub-actions (de button/form), action_id puede venir aquí. */
  action: {
    id: string;
    label: string;
  };

  /** ID de la installation en el tenant. Útil para correlar en tu lado. */
  installation_id: string;

  /** Tu client_id (el que muestra Wismify en el panel). */
  client_id: string;

  /** auth.users.id del agente cx que ejecutó la acción. Solo para logging. */
  triggered_by: string;

  /** Cuándo se ejecutó. */
  triggered_at: string;

  /** Lista de scopes presentes en este request — coincide con los keys de `data`. */
  scopes: string[];

  /**
   * Datos del ticket según los scopes pedidos. Cada clave aparece SOLO si la
   * acción declaró el scope correspondiente.
   */
  data: {
    ticket?: {
      id: string;
      subject: string | null;
      status: string;
      urgency: string | null;
      channel: string | null;
      from_email: string | null;
      from_name: string | null;
      created_at: string;
    };
    customer?: {
      id: string;
      name: string | null;
      email: string | null;
      phone: string | null;
    };
    shipment?: {
      tracking_number?: string;
      carrier?: string;
      destination?: { city?: string; country?: string; address?: string };
    } | null;
    carrier?: {
      name?: string;
      tracking_url?: string;
      status?: string;
    } | null;
  };

  /**
   * Si la acción se invocó desde un sub-button o form submit dentro de un
   * Block Kit anterior, aquí vendrán los datos.
   */
  sub_action?: {
    action_id: string;             // el `action_id` del button/form
    form_values?: Record<string, string | number>;
  };
};
